import { spawn } from 'node:child_process';
import { normalize } from 'node:path';
import { createInterface } from 'node:readline';
import type { CliChatProvider } from './cli-mention.js';
import { terminateCliProcess } from './external-cli.js';
import { formatCliToolOutput } from './cli-tool-output.js';

type Json = Record<string, unknown>;
const record = (value: unknown): Json => value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
const rows = (value: unknown): Json[] => Array.isArray(value) ? value.map(record) : [];
const text = (value: unknown): string => typeof value === 'string' ? value : '';
export type CliQuestion = { id: string; header?: string; question: string; detail?: string; options?: { label: string; description?: string }[] };
type Bridge = {
  session: (id: string) => Promise<void>;
  write: (text: string) => void;
  approve: (tool: string, reason: string) => Promise<boolean>;
  ask: (questions: CliQuestion[]) => Promise<Record<string, string[]>>;
};

function rpc(executable: string, args: string[], cwd: string, signal: AbortSignal,
  event: (method: string, params: Json) => void, interactive: (method: string, params: Json) => Promise<unknown>) {
  signal.throwIfAborted();
  const child = spawn(normalize(executable), args, {
    cwd, windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'ignore'],
  });
  const reader = createInterface({ input: child.stdout, crlfDelay: Infinity });
  let nextId = 0;
  let closed = false;
  const exited = new Promise<void>(resolve => child.once('close', () => resolve()));
  const pending = new Map<number, { resolve: (result: Json) => void; reject: (error: Error) => void }>();
  const close = () => {
    if (closed) return;
    closed = true;
    if (child.exitCode === null && child.signalCode === null) terminateCliProcess(child);
    reader.close();
    child.stdin.destroy();
    child.stdout.destroy();
    for (const request of pending.values()) request.reject(new Error('CLI 连接已结束。'));
    pending.clear();
    signal.removeEventListener('abort', close);
  };
  child.on('error', close);
  child.on('close', close);
  child.stdin.on('error', close);
  signal.addEventListener('abort', close, { once: true });
  const send = (message: Json) => {
    if (!closed) child.stdin.write(JSON.stringify(message) + '\n');
  };
  reader.on('line', line => {
    let msg: Json;
    try { msg = record(JSON.parse(line)); } catch { return; }
    const method = text(msg.method);
    const params = record(msg.params);
    if (method && msg.id !== undefined) {
      void interactive(method, params).then(
        result => send({ jsonrpc: '2.0', id: msg.id, result }),
        () => send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: 'Interaction unavailable' } }),
      );
    } else if (method) {
      event(method, params);
    } else if (typeof msg.id === 'number') {
      const request = pending.get(msg.id);
      if (!request) return;
      pending.delete(msg.id);
      if (msg.error) request.reject(new Error('CLI 拒绝了协议请求。'));
      else request.resolve(record(msg.result));
    }
  });
  const request = (method: string, params: Json) => new Promise<Json>((resolve, reject) => {
    if (closed) { reject(new Error('CLI 连接已结束。')); return; }
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    send({ jsonrpc: '2.0', id, method, params });
  });
  const shutdown = async () => {
    close();
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([exited, new Promise<void>(resolve => { timer = setTimeout(resolve, 4000); })]);
    } finally { clearTimeout(timer); }
  };
  return { request, notify: (method: string, params?: Json) => send({ jsonrpc: '2.0', method, params }), shutdown };
}

function itemText(item: Json) {
  const kind = text(item.type);
  if (kind === 'commandExecution') return [text(item.command), text(item.aggregatedOutput)].filter(Boolean).join('\n');
  if (kind === 'fileChange') return rows(item.changes).map(change => [text(change.path), text(change.diff)].filter(Boolean).join('\n')).join('\n');
  if (kind === 'plan') return text(item.text);
  if (kind === 'reasoning') return Array.isArray(item.summary) ? item.summary.filter(part => typeof part === 'string').join('\n') : '';
  if (kind === 'mcpToolCall') return [text(item.server), text(item.tool)].filter(Boolean).join(' / ');
  return '';
}

async function codex(exe: string, cwd: string, previous: string | undefined, prompt: string, bridge: Bridge, signal: AbortSignal) {
  let threadId: string | undefined;
  let finish: (status: string) => void = () => {};
  const completed = new Promise<string>(resolve => { finish = resolve; });
  const streamed = new Set<string>();
  const wire = rpc(exe, ['app-server', '--listen', 'stdio://'], cwd, signal, (method, params) => {
    if (params.threadId !== threadId || !threadId) return;
    if (method === 'item/agentMessage/delta') {
      streamed.add(text(params.itemId));
      bridge.write(text(params.delta));
    }
    if (method === 'item/completed') {
      const item = record(params.item);
      if (item.type === 'agentMessage') {
        if (!streamed.has(text(item.id))) bridge.write(text(item.text));
      } else {
        const display = itemText(item);
        if (display) {
          const kind = text(item.type);
          bridge.write(kind === 'plan' || kind === 'reasoning'
            ? `\n\n**Codex · ${kind}**\n\n${display}\n\n`
            : formatCliToolOutput(`Codex · ${kind}`, display));
        }
      }
    }
    if (method === 'turn/completed') finish(text(record(params.turn).status));
  }, async (method, params) => {
    if (!threadId || params.threadId !== threadId) throw new Error('CLI_INTERACTION_MISMATCH');
    if (method === 'item/commandExecution/requestApproval' || method === 'item/fileChange/requestApproval') {
      const offered = Array.isArray(params.availableDecisions) ? params.availableDecisions : undefined;
      if (offered && !offered.includes('accept')) return { decision: offered.includes('decline') ? 'decline' : 'cancel' };
      const command = method.startsWith('item/command') ? text(params.command) : text(params.grantRoot);
      const reason = [text(params.reason), command, text(params.cwd) || cwd].filter(Boolean).join('\n');
      const allowed = await bridge.approve(method.startsWith('item/command') ? 'Codex · 命令执行' : 'Codex · 文件修改', reason);
      return { decision: allowed ? 'accept' : 'decline' };
    }
    if (method === 'item/permissions/requestApproval') {
      const permissions = record(params.permissions);
      const allowed = await bridge.approve('Codex · 额外权限', [text(params.reason), JSON.stringify(permissions)].filter(Boolean).join('\n'));
      return { permissions: allowed ? permissions : {}, scope: 'turn' };
    }
    if (method === 'item/tool/requestUserInput') {
      const questions = rows(params.questions).map(q => ({
        id: text(q.id), header: text(q.header), question: text(q.question),
        options: rows(q.options).map(o => ({ label: text(o.label), description: text(o.description) })),
      }));
      // Password fields cannot be represented as a private DSH response.
      if (rows(params.questions).some(q => q.isSecret)) return { answers: {} };
      const answers = await bridge.ask(questions);
      return { answers: Object.fromEntries(Object.entries(answers).map(([id, items]) => [id, { answers: items }])) };
    }
    if (method === 'mcpServer/elicitation/request') return { action: 'decline', content: null, _meta: null };
    throw new Error('CLI_INTERACTION_UNSUPPORTED');
  });
  try {
    await wire.request('initialize', { clientInfo: { name: 'sessivra', title: 'DSH Sessivra', version: '0.3.0' }, capabilities: { experimentalApi: true } });
    wire.notify('initialized');
    const reply = await wire.request(previous ? 'thread/resume' : 'thread/start', {
      cwd, approvalPolicy: 'on-request', approvalsReviewer: 'user', ...(previous ? { threadId: previous, excludeTurns: true } : {}),
    });
    threadId = text(record(reply.thread).id);
    if (!threadId || (previous && threadId !== previous)) throw new Error('Codex 会话身份无法确认。');
    await bridge.session(threadId);
    await wire.request('turn/start', { threadId, input: [{ type: 'text', text: prompt, text_elements: [] }] });
    const status = await new Promise<string>((resolve, reject) => {
      const aborted = () => reject(new Error('Codex 回合已停止或超时。'));
      if (signal.aborted) { aborted(); return; }
      signal.addEventListener('abort', aborted, { once: true });
      void completed.then(value => { signal.removeEventListener('abort', aborted); resolve(value); });
    });
    if (status !== 'completed') throw new Error('Codex 回合未完成。');
  } finally {
    await wire.shutdown();
  }
}

async function grok(exe: string, cwd: string, previous: string | undefined, prompt: string, bridge: Bridge, signal: AbortSignal) {
  let sessionId: string | undefined;
  let prompting = false;
  const wire = rpc(exe, ['agent', '--no-leader', 'stdio'], cwd, signal, (method, params) => {
    if (!prompting || method !== 'session/update' || params.sessionId !== sessionId) return;
    const update = record(params.update);
    if (update.sessionUpdate === 'agent_message_chunk') bridge.write(text(record(update.content).text));
    if (update.sessionUpdate === 'tool_call' || update.sessionUpdate === 'tool_call_update') {
      const title = text(update.title);
      const content = rows(update.content).map(entry => text(record(entry.content).text) || text(entry.path)).filter(Boolean);
      if (title || content.length) bridge.write(formatCliToolOutput(`Grok · ${title || '工具结果'}`, content.join('\n')));
    }
    if (update.sessionUpdate === 'plan') {
      const plan = rows(update.entries).map(entry => '- ' + text(entry.content)).join('\n');
      if (plan) bridge.write(`\n\n**Grok · 计划**\n\n${plan}\n\n`);
    }
  }, async (method, params) => {
    if (!prompting || params.sessionId !== sessionId) throw new Error('CLI_INTERACTION_MISMATCH');
    if (method !== 'session/request_permission') throw new Error('CLI_INTERACTION_UNSUPPORTED');
    const tool = record(params.toolCall);
    const options = rows(params.options);
    const reason = [text(tool.title), JSON.stringify(tool.rawInput ?? {}), cwd].filter(Boolean).join('\n');
    const once = options.find(option => option.kind === 'allow_once');
    const reject = options.find(option => option.kind === 'reject_once');
    const selected = once && await bridge.approve('Grok · 工具执行', reason) ? once : reject;
    const optionId = text(selected?.optionId);
    return { outcome: optionId ? { outcome: 'selected', optionId } : { outcome: 'cancelled' } };
  });
  try {
    const init = await wire.request('initialize', { protocolVersion: 1, clientCapabilities: {} });
    const methods = rows(init.authMethods).map(method => method.id);
    const methodId = methods.includes('xai.api_key') && process.env.XAI_API_KEY ? 'xai.api_key'
      : methods.includes('cached_token') ? 'cached_token' : undefined;
    if (!methodId) throw new Error('Grok Build 尚未登录。');
    await wire.request('authenticate', { methodId, _meta: { headless: true } });
    if (previous) {
      await wire.request('session/load', { cwd, sessionId: previous, mcpServers: [] });
      sessionId = previous;
    } else {
      const result = await wire.request('session/new', { cwd, mcpServers: [] });
      sessionId = text(result.sessionId);
    }
    if (!sessionId) throw new Error('Grok 会话身份无法确认。');
    await bridge.session(sessionId);
    prompting = true;
    const result = await wire.request('session/prompt', { sessionId, prompt: [{ type: 'text', text: prompt }] });
    if (result.stopReason !== 'end_turn') throw new Error('Grok 回合未完成。');
  } finally {
    await wire.shutdown();
  }
}

export const cliChatTurn: Record<CliChatProvider, typeof codex> = { codex, grok };
