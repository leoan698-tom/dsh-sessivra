import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, realpath, rmdir, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, normalize } from 'node:path';
import type { Readable } from 'node:stream';
import { z } from 'zod';

export const externalProviders = ['claude', 'codex', 'grok'] as const;
export const externalProvider = z.enum(externalProviders);
const uuid = z.uuid();
export const externalTaskSchema = z.object({
  provider: externalProvider,
  prompt: z.string().min(1).max(16_000).refine(text => text.trim().length > 0),
  sessionId: uuid.optional(),
}).strict();

const cliConfig = z.object({
  executable: z.string().refine(path => isAbsolute(path)
    && (process.platform !== 'win32' || /\.exe$/i.test(path))),
  timeoutSeconds: z.number().int().min(1).max(1800).default(600),
  dispatchApproval: z.enum(['ask', 'direct']).default('ask'),
}).strict();
export const externalCliSchema = z.partialRecord(externalProvider, cliConfig);
type Task = z.output<typeof externalTaskSchema>;
type Cli = z.output<typeof cliConfig>;

export async function externalWorkspace(cwd: string | null | undefined) {
  if (!cwd || !isAbsolute(cwd)) throw new Error('EXTERNAL_CLI_WORKSPACE_REQUIRED');
  const resolved = await realpath(cwd);
  if (!(await stat(resolved)).isDirectory()) throw new Error('EXTERNAL_CLI_WORKSPACE_REQUIRED');
  return resolved;
}

function capture(stream: Readable, limit: number) {
  const chunks: Buffer[] = [];
  let remaining = limit;
  let truncated = false;
  stream.on('data', (chunk: Buffer) => {
    if (chunk.length > remaining) truncated = true;
    if (!remaining) return;
    const kept = chunk.subarray(0, remaining);
    chunks.push(kept);
    remaining -= kept.length;
  });
  return () => ({ text: Buffer.concat(chunks).toString('utf8'), truncated });
}

export function terminateCliProcess(child: ChildProcess) {
  if (child.pid === undefined) return;
  if (process.platform === 'win32') {
    const systemRoot = process.env.SystemRoot;
    if (systemRoot && isAbsolute(systemRoot)) {
      execFile(join(systemRoot, 'System32', 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'],
        { windowsHide: true, timeout: 3000 }, error => {
          if (error && child.exitCode === null) child.kill('SIGKILL');
        });
      return;
    }
    child.kill('SIGKILL');
    return;
  }
  try { process.kill(-child.pid, 'SIGKILL'); }
  catch { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
}

export function runCliProcess(executable: string, args: string[], cwd: string, input: string | undefined, signal: AbortSignal, timeoutSeconds: number) {
  signal.throwIfAborted();
  const child = spawn(normalize(executable), args, {
    cwd, windowsHide: true, detached: process.platform !== 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const stdout = capture(child.stdout, 1024 * 1024);
  const stderr = capture(child.stderr, 8192);
  return new Promise<{
    exitCode: number | null;
    stopped?: 'cancelled' | 'timed-out' | 'outcome-unknown';
    stdout: ReturnType<typeof stdout>;
    stderr: ReturnType<typeof stderr>;
  }>((resolve, reject) => {
    let startError: Error | undefined;
    let stopped: 'cancelled' | 'timed-out' | undefined;
    let watchdog: NodeJS.Timeout | undefined;
    function finish(exitCode: number | null, unconfirmed = false) {
      clearTimeout(timer);
      clearTimeout(watchdog);
      signal.removeEventListener('abort', abort);
      if (startError) reject(new Error(`EXTERNAL_CLI_START_FAILED: ${startError.message}`));
      else resolve({ exitCode, stopped: unconfirmed ? 'outcome-unknown' : stopped, stdout: stdout(), stderr: stderr() });
    }
    function stop(reason: 'cancelled' | 'timed-out') {
      if (stopped) return;
      stopped = reason;
      terminateCliProcess(child);
      watchdog = setTimeout(() => {
        child.stdout.destroy();
        child.stderr.destroy();
        child.stdin.destroy();
        child.unref();
        finish(null, true);
      }, 5000);
    }
    const abort = () => stop('cancelled');
    const timer = setTimeout(() => stop('timed-out'), timeoutSeconds * 1000);
    child.on('error', error => { startError = error; });
    child.once('close', exitCode => finish(exitCode));
    child.stdin.on('error', () => { /* CLI can exit before it reads stdin. */ });
    signal.addEventListener('abort', abort, { once: true });
    child.stdin.end(input, 'utf8');
  });
}

function json(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch { /* The CLI can emit a diagnostic instead of JSON. */ }
  return undefined;
}

function readResult(provider: Task['provider'], stdout: string) {
  if (provider === 'grok') return { text: stdout.trim(), completed: !!stdout.trim() };
  if (provider === 'claude') {
    const result = json(stdout);
    return {
      sessionId: result?.session_id,
      text: result?.result,
      completed: result?.type === 'result' && result.is_error === false,
    };
  }
  let sessionId: unknown;
  let text: unknown;
  let diagnostic: unknown;
  let completed = false;
  for (const line of stdout.split(/\r?\n/)) {
    const event = json(line);
    if (event?.type === 'thread.started') sessionId = event.thread_id;
    if (event?.type === 'turn.completed') completed = true;
    if (event?.type === 'turn.failed') {
      completed = false;
      diagnostic = (event.error as { message?: unknown } | undefined)?.message;
    }
    if (event?.type === 'error') diagnostic = event.message;
    if (event?.type === 'item.completed') {
      const item = event.item as { type?: unknown; text?: unknown } | undefined;
      if (item?.type === 'agent_message') text = item.text;
    }
  }
  return { sessionId, text, completed, diagnostic };
}

export async function runExternalTask(task: Task, cli: Cli, cwd: string, signal: AbortSignal) {
  const { provider, prompt, sessionId } = task;
  const expectedId = sessionId ?? (provider === 'codex' ? undefined : randomUUID());
  const selection = sessionId ? ['--resume', sessionId] : expectedId ? ['--session-id', expectedId] : [];
  let args: string[];
  let scratch: string | undefined;
  try {
    if (provider === 'claude') {
      args = ['--print', '--output-format', 'json', ...selection];
    } else if (provider === 'codex') {
      args = ['exec', '--json', '--skip-git-repo-check', ...(sessionId ? ['resume', sessionId] : []), '-'];
    } else {
      scratch = await mkdtemp(join(tmpdir(), 'sessivra-grok-'));
      const file = join(scratch, 'prompt.txt');
      await writeFile(file, prompt, { encoding: 'utf8', mode: 0o600 });
      args = ['--prompt-file', file, '--output-format', 'plain', ...selection];
    }
    const result = await runCliProcess(cli.executable, args, cwd, provider === 'grok' ? undefined : prompt, signal, cli.timeoutSeconds);
    const parsed = readResult(provider, result.stdout.text);
    const observedId = 'sessionId' in parsed && uuid.safeParse(parsed.sessionId).success
      ? parsed.sessionId as string : undefined;
    const actualId = observedId ?? expectedId;
    const matched = !expectedId || !observedId || expectedId.toLowerCase() === observedId.toLowerCase();
    const completed = parsed.completed && matched && !!actualId
      && (provider === 'grok' || !!observedId) && !result.stdout.truncated;
    const status = result.stopped ?? (result.exitCode === null ? 'outcome-unknown'
      : result.exitCode !== 0 ? 'failed' : completed ? 'turn-completed' : 'outcome-unknown');
    const text = typeof parsed.text === 'string' ? parsed.text : '';
    const diagnostic = 'diagnostic' in parsed && typeof parsed.diagnostic === 'string' ? parsed.diagnostic : result.stderr.text;
    return {
      provider, status, sessionId: matched ? actualId ?? null : null, exitCode: result.exitCode,
      output: text.slice(0, 16_000), outputTruncated: result.stdout.truncated || text.length > 16_000,
      diagnostic: matched ? diagnostic.slice(0, 4000) : 'EXTERNAL_CLI_SESSION_MISMATCH',
    };
  } finally {
    if (scratch) {
      await unlink(join(scratch, 'prompt.txt')).catch(() => {});
      await rmdir(scratch).catch(() => {});
    }
  }
}
