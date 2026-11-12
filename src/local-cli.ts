import { spawn, type ChildProcess } from 'node:child_process';
import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join, normalize } from 'node:path';
import type { Context } from '@deepseek-ai/cordis';
import { defineDomain } from '@deepseek-ai/dsh-storage-domain';
import { z } from 'zod';
import { externalProvider, externalProviders, runCliProcess, type externalCliSchema } from './external-cli.js';
import { persistWithContentionRetry } from './storage-write.js';

type Provider = z.output<typeof externalProvider>;
type Config = z.output<typeof externalCliSchema>;
type Auth = 'signed-in' | 'signed-out' | 'unknown';
export type LocalCliStatus = {
  provider: Provider;
  installed: boolean;
  version: string | null;
  auth: Auth;
  dispatchConfigured: boolean;
  loginRunning: boolean;
  launchFailed: boolean;
  authUnverified?: boolean;
};
const statusRecord = z.object({
  provider: externalProvider, installed: z.boolean(), version: z.string().nullable(),
  auth: z.enum(['signed-in', 'signed-out', 'unknown']), dispatchConfigured: z.boolean(),
  authUnverified: z.boolean().optional(),
});
type CachedStatus = z.output<typeof statusRecord>;
const cacheDomain = defineDomain({
  name: 'dsh_sessivra_local_cli_status', version: 1, tables: {},
  global: { schema: z.object({ rows: z.array(statusRecord) }), initial: { rows: [] } },
});

export async function openLocalCli(ctx: Context, config: Config) {
  const domain = await ctx.storageDomain.open(cacheDomain);
  const cli = new LocalCli(config, domain.global.get().rows,
    rows => persistWithContentionRetry(() => domain.global.set({ rows })));
  ctx.effect(() => async () => { await cli.close(); await domain.close(); });
  return cli;
}

const loginArgs = { claude: ['auth', 'login'], codex: ['login'], grok: ['login', '--oauth'] };
const statusArgs = { claude: ['auth', 'status', '--json'], codex: ['login', 'status'], grok: ['agent', '--no-leader', 'stdio'] };
const initialize = JSON.stringify({
  jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: 1, clientCapabilities: {} },
}) + '\n';

function parseJson(line: string): unknown {
  try { return JSON.parse(line); } catch { return null; }
}

function authStatus(provider: Provider, result: Awaited<ReturnType<typeof runCliProcess>>): Auth {
  if (provider !== 'grok' && (result.stopped || result.exitCode === null)) return 'unknown';
  if (provider === 'claude') {
    const response = parseJson(result.stdout.text) as { loggedIn?: unknown } | null;
    if (result.exitCode === 0 && response?.loggedIn === true) return 'signed-in';
    if (result.exitCode === 1 && response?.loggedIn === false) return 'signed-out';
  }
  if (provider === 'codex') {
    const output = result.stdout.text + '\n' + result.stderr.text;
    if (result.exitCode === 0 && /^Logged in\b/im.test(output)) return 'signed-in';
    if (result.exitCode === 1 && /^Not logged in\b/im.test(output)) return 'signed-out';
  }
  if (provider === 'grok') {
    for (const line of result.stdout.text.split(/\r?\n/)) {
      const response = parseJson(line) as { id?: unknown; result?: { authMethods?: { id: string }[] } } | null;
      if (response?.id !== 1 || !Array.isArray(response.result?.authMethods)) continue;
      const methods = response.result.authMethods.map(method => method?.id);
      if (methods.includes('cached_token') || (methods.includes('xai.api_key') && process.env.XAI_API_KEY)) return 'signed-in';
      if (!result.stopped && result.exitCode === 0 && methods.length === 1 && methods[0] === 'grok.com') return 'signed-out';
    }
  }
  return 'unknown';
}

async function executable(path: string) {
  try {
    await access(path, constants.X_OK);
    return (await stat(path)).isFile();
  } catch { return false; }
}

async function findCli(provider: Provider, configured?: string) {
  const home = homedir();
  const paths = (process.env.PATH ?? '').split(delimiter).map(path => path.replace(/^"|"$/g, '')).filter(isAbsolute);
  const npm = process.env.APPDATA && join(process.env.APPDATA, 'npm');
  if (npm && isAbsolute(npm)) paths.push(npm);
  const windows = process.platform === 'win32';
  const name = provider + (windows ? '.exe' : '');
  const common = { claude: '.local', codex: '.local', grok: '.grok' };
  const native = [join(home, common[provider], 'bin', name), ...paths.map(path => join(path, name))];
  const triple = process.arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
  const variant = process.arch === 'arm64' ? 'codex-win32-arm64' : 'codex-win32-x64';
  const npmBinaries = windows ? paths.flatMap(path => {
    if (provider === 'claude') return [join(path, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', name)];
    if (provider === 'codex') return [
      join(path, 'node_modules', '@openai', 'codex', 'node_modules', '@openai', variant, 'vendor', triple, 'bin', name),
      join(path, 'node_modules', '@openai', 'codex', 'vendor', triple, 'codex', name),
    ];
    return [];
  }) : [];
  const candidates = new Set([...(configured ? [normalize(configured)] : []), ...native, ...npmBinaries]);
  for (const path of candidates) if (await executable(path)) return path;
  return null;
}

export class LocalCli {
  private scan?: Promise<void>;
  private logins = new Map<Provider, ChildProcess>();
  private failures = new Set<Provider>();
  private saving: Promise<void> = Promise.resolve();
  private closed = false;

  constructor(
    private config: Config,
    private cached: CachedStatus[] = [],
    private save?: (rows: CachedStatus[]) => Promise<void>,
  ) {}

  async close() {
    this.closed = true;
    await this.saving;
  }

  chatProviders() {
    return (['codex', 'grok'] as const).filter(provider => this.config[provider]);
  }

  async status(refresh = false): Promise<LocalCliStatus[]> {
    if (refresh || this.cached.length !== externalProviders.length) {
      this.scan ??= Promise.all(externalProviders.map(provider => this.detect(provider)))
        .then(rows => this.commit(rows)).finally(() => { this.scan = undefined; });
      await this.scan;
    }
    return this.cached.map(row => ({
      ...row, loginRunning: this.logins.has(row.provider), launchFailed: this.failures.has(row.provider),
    }));
  }

  private async commit(rows: CachedStatus[]) {
    if (this.closed) return;
    const merged = new Map(this.cached.map(row => [row.provider, row]));
    for (const row of rows) {
      const previous = merged.get(row.provider);
      if (row.installed && row.auth === 'unknown' && previous?.auth === 'signed-in') {
        merged.set(row.provider, { ...row, auth: 'signed-in', authUnverified: true });
      } else {
        merged.set(row.provider, row);
      }
    }
    const updated = [...merged.values()];
    this.cached = updated;
    if (!this.save) return;
    const saving = this.saving.then(() => this.save?.(updated));
    this.saving = saving.catch(() => {});
    await saving;
  }

  private async detect(provider: Provider): Promise<CachedStatus> {
    const configured = this.config[provider]?.executable;
    const path = await findCli(provider, configured);
    const result: CachedStatus = {
      provider, installed: !!path, version: null, auth: 'unknown',
      dispatchConfigured: !!path && !!configured && path === normalize(configured),
    };
    if (!path) return result;
    const probe = (args: string[], input?: string) =>
      runCliProcess(path, args, homedir(), input, AbortSignal.timeout(8000), 8).catch(() => null);
    const [version, status] = await Promise.all([
      probe(['--version']), probe(statusArgs[provider], provider === 'grok' ? initialize : undefined),
    ]);
    result.version = version?.exitCode === 0 ? version.stdout.text.match(/\b\d+\.\d+\.\d+(?:-[\w.-]+)?\b/)?.[0] ?? null : null;
    if (status) result.auth = authStatus(provider, status);
    return result;
  }

  async login(raw: Provider): Promise<'started' | 'already-running' | 'terminal-required' | 'missing'> {
    const provider = externalProvider.parse(raw);
    const path = await findCli(provider, this.config[provider]?.executable);
    if (!path) return 'missing';
    if (this.logins.has(provider)) return 'already-running';
    let command: string;
    let args: string[];
    if (process.platform === 'win32' && process.env.SystemRoot && isAbsolute(process.env.SystemRoot)) {
      command = join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      const encodedPath = Buffer.from(path, 'utf8').toString('base64');
      const argumentsLiteral = loginArgs[provider].map(arg => "'" + arg + "'").join(',');
      const script = `$ErrorActionPreference = 'Stop'
$exe = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedPath}'))
$child = Start-Process -FilePath $exe -ArgumentList @(${argumentsLiteral}) -WindowStyle Normal -PassThru -Wait
exit $child.ExitCode`;
      args = ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];
    } else if (process.platform === 'linux' && await executable('/usr/bin/x-terminal-emulator')) {
      command = '/usr/bin/x-terminal-emulator';
      args = ['-e', path, ...loginArgs[provider]];
    } else {
      return 'terminal-required';
    }
    if (this.logins.has(provider)) return 'already-running';
    this.failures.delete(provider);
    const child = spawn(command, args, {
      cwd: homedir(), detached: process.platform !== 'win32', stdio: 'ignore', windowsHide: true,
    });
    this.logins.set(provider, child);
    child.once('exit', code => {
      void (async () => {
        try {
          await this.scan?.catch(() => {});
          if (!this.closed) await this.commit([await this.detect(provider)]);
        } catch {
          this.failures.add(provider);
        } finally {
          this.logins.delete(provider);
          if (code !== 0) this.failures.add(provider);
        }
      })();
    });
    return new Promise((resolve, reject) => {
      child.once('spawn', () => { child.unref(); resolve('started'); });
      child.once('error', () => {
        this.logins.delete(provider);
        this.failures.add(provider);
        reject(new Error('LOCAL_CLI_LOGIN_START_FAILED'));
      });
    });
  }
}
