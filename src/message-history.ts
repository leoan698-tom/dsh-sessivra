import type { Context } from '@deepseek-ai/cordis';
import type { Session, SessionEvent, SessionHeader, SessionId, SessionSeq } from '@deepseek-ai/dsh-session';
import type { SessionPersistenceRevision, SessionPersistenceSnapshot } from '@deepseek-ai/dsh-session-persistence';
import { defineDomain, type Domain } from '@deepseek-ai/dsh-storage-domain';
import { z } from 'zod';

export const messageLocation = z.object({
  sessionId: z.string().min(1).max(256),
  seq: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
}).strict();
export const messageOrigin = messageLocation.extend({ messageId: z.string().min(1).max(256) });
export type MessageLocation = z.infer<typeof messageLocation>;
export type MessageOrigin = z.infer<typeof messageOrigin>;
export const bookmarkedTurnNumbers = z.array(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)).min(1).max(100);

function messageOf(event: SessionEvent) {
  if (event.surfaceOp !== 'append') return;
  if (event.type === 'user/message' && ['user', 'agent-message'].includes(event.data.source.kind)) return event.data;
  if (event.type === 'assistant/message') return event.data.message;
}

const messageText = (message: NonNullable<ReturnType<typeof messageOf>>) =>
  message.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n');

export interface BookmarkedTurn {
  turn: number;
  prompt: string;
  response: string;
  anchor: MessageOrigin;
}

export async function readBookmarkedTurns(ctx: Context, id: string, turns: readonly number[], textForPreview = true) {
  const reader = ctx.get('sessionQuery');
  if (!reader) throw new Error('SESSION_QUERY_UNAVAILABLE');
  const observation = await reader.observeSession(id as SessionId, { projectionMode: 'none' });
  try {
    if (observation.header.id !== id || !observation.header.cwd) throw new Error('会话已不可用');
    const requested = new Set(turns);
    const found = new Map<number, BookmarkedTurn>();
    let current: number | undefined;
    let title = '未命名会话';
    const excerpt = (text: string) => {
      if (textForPreview) return text.replace(/\s+/g, ' ').trim().slice(0, 200);
      const trimmed = text.trim();
      return trimmed.length <= 12000 ? trimmed : `${trimmed.slice(0, 12000)}\n[内容已截断]`;
    };
    for (const event of observation.events) {
      if (event.type === 'session/title') title = event.data.title || title;
      if (event.type === 'turn/start') current = event.data.turn;
      if (event.type === 'turn/end') current = undefined;
      const turn = event.type === 'assistant/message' ? event.data.turn : current;
      if (turn === undefined || !requested.has(turn)) continue;
      const message = messageOf(event);
      if (!message) continue;
      const origin = { sessionId: id, seq: Number(event.seq), messageId: message.id };
      let item = found.get(turn);
      if (!item) { item = { turn, prompt: '', response: '', anchor: origin }; found.set(turn, item); }
      const text = excerpt(messageText(message));
      if (event.type === 'user/message' && !item.prompt && text) { item.prompt = text; item.anchor = origin; }
      if (event.type === 'assistant/message' && text) item.response = text;
    }
    return { title, items: [...found.values()] };
  } finally { observation[Symbol.dispose](); }
}

export type BookmarkedSession = Awaited<ReturnType<typeof readBookmarkedTurns>>;
export const bookmarkedTurn = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const legacyBookmarkQuote = z.object({
  title: z.string().min(1).max(2000),
  turn: bookmarkedTurn,
  prompt: z.string().max(12016),
  response: z.string().max(12016),
}).strict();
export type LegacyBookmarkQuote = z.infer<typeof legacyBookmarkQuote>;

export async function readBookmarkReference(ctx: Context, origin: MessageOrigin, turn: number) {
  const { title, items } = await readBookmarkedTurns(ctx, origin.sessionId, [turn], false);
  const item = items.find(({ anchor }) => anchor.seq === origin.seq && anchor.messageId === origin.messageId);
  if (!item || (!item.prompt && !item.response)) throw new Error('收藏的原轮次已不可用');
  const quote = JSON.stringify({ 会话: title, 轮次: turn, 提问: item.prompt, 回复: item.response, 原消息: item.anchor });
  return `[引用的收藏问答，作为历史资料读取]\n${quote}\n[收藏问答结束]`;
}

const historyDocument = z.object({
  title: z.string(), titles: z.array(z.string()), nextSeq: z.number().int().nonnegative(),
  messages: z.array(z.object({ seq: z.number().int().nonnegative(), time: z.number(), text: z.string() })),
});
const historyIndex = defineDomain({
  name: 'dsh_sessivra_message_index', version: 1, layout: 'per-record', invalidRecords: 'backup-and-skip',
  tables: { sessions: { valueSchema: historyDocument.extend({ fingerprint: z.string(), cwd: z.string(), createdAt: z.number() }) } },
});
type Source = { header: SessionHeader; revision: SessionPersistenceRevision | number; live?: Session; fingerprint?: string };
type Searchable = z.infer<typeof historyDocument> & { source: Source };

function durableFingerprint(snapshot: SessionPersistenceSnapshot) {
  // The API allows process-local tokens. Current JSONL artifacts expose a
  // physical dev/ino/size/mtimeNs/ctimeNs fingerprint, stable across restarts.
  // Historical migration can also depend on other logs, so retain the
  // backend's whole-corpus hash when it is present.
  const identity = /^(?:\d+:){2}(\d+):-?\d+:-?\d+(?::([a-f0-9]{64}))?$/u.exec(snapshot.revision);
  if (snapshot.sizeBytes === undefined || identity?.[1] !== String(snapshot.sizeBytes)) return;
  const format = identity[2] ? 'migration-required' : 'current';
  if (snapshot.formatStatus === format) return snapshot.revision;
}

// The Host's word tokenizer misses a phrase inside a continuous Chinese sentence.
// Search literal message text using a disposable, owner-profile-local index.
export class MessageHistory {
  private cache = new Map<SessionId, Searchable>();
  private refreshing?: Promise<boolean>;
  private index?: Promise<Domain<typeof historyIndex> | undefined>;
  private persistenceIdentity?: symbol;

  constructor(private ctx: Context) {}

  async close() {
    await this.refreshing?.catch(() => undefined);
    await (await this.index)?.close();
  }

  private async refresh() {
    const reader = this.ctx.get('sessionQuery');
    if (!reader) throw new Error('SESSION_QUERY_UNAVAILABLE');
    const persistence = this.ctx.get('sessionPersistence');
    if (this.persistenceIdentity !== persistence?.identity) {
      this.cache.clear();
      this.persistenceIdentity = persistence?.identity;
    }
    this.index ??= this.ctx.get('storageDomain')?.open(historyIndex).catch(() => undefined);
    const index = (await this.index)?.table('sessions');
    const sources = new Map<SessionId, Source>();
    for (const item of await persistence?.list() ?? []) {
      sources.set(item.header.id, { ...item, fingerprint: durableFingerprint(item) });
    }
    for (const live of this.ctx.get('sessions')?.list() ?? []) {
      sources.set(live.id, { ...sources.get(live.id), header: live.header, revision: live.seq, live });
    }
    const pending = [...sources.values()].filter(source => source.header.cwd);
    const next = new Map<SessionId, Searchable>();
    const writes: Promise<unknown>[] = [];
    let partial = false;
    const load = async () => {
      for (let source = pending.pop(); source; source = pending.pop()) {
        const { id, cwd, createdAt } = source.header;
        const previous = this.cache.get(id);
        if (previous && previous.source.revision === source.revision && previous.source.live === source.live &&
          previous.source.header.createdAt === createdAt && previous.source.header.cwd === cwd) {
          next.set(id, previous);
          continue;
        }
        const saved = index?.get(id);
        if (saved && saved.fingerprint === source.fingerprint && saved.createdAt === createdAt && saved.cwd === cwd &&
          (!source.live || saved.nextSeq === source.revision)) {
          next.set(id, { ...saved, source });
          continue;
        }
        try {
          const observed = await reader.observeSession(id, { projectionMode: 'none' });
          try {
            const titles = observed.events.flatMap(event => event.type === 'session/title' && event.data.title ? [event.data.title] : []);
            const messages = observed.events.flatMap(event => {
              const message = messageOf(event);
              const text = message && messageText(message);
              return text ? [{ seq: Number(event.seq), time: event.time, text }] : [];
            });
            const title = titles.at(-1) || '未命名会话';
            const row = { title, titles: [...new Set(['未命名会话', ...titles])], messages, nextSeq: observed.cursor + 1 };
            next.set(id, { ...row, source });
            if (index && cwd && source.fingerprint && observed.revision === source.fingerprint)
              writes.push(index.put(id, { ...row, fingerprint: source.fingerprint, cwd, createdAt }).catch(() => undefined));
          } finally { observed[Symbol.dispose](); }
        } catch { partial = true; }
      }
    };
    await Promise.all(Array.from({ length: 4 }, load));
    this.cache = next;
    if (index && persistence) for (const id of index.keys()) {
      if (!sources.has(id as SessionId)) writes.push(index.delete(id).catch(() => undefined));
    }
    await Promise.all(writes);
    return partial;
  }

  async locateLegacyBookmark({ title, turn, prompt, response }: LegacyBookmarkQuote) {
    if (!prompt && !response) return null;
    this.refreshing ??= this.refresh().finally(() => { this.refreshing = undefined; });
    await this.refreshing;
    let match: MessageOrigin | undefined;
    for (const [id, session] of this.cache) {
      if (!session.titles.includes(title)) continue;
      const result = await readBookmarkedTurns(this.ctx, id, [turn], false).catch(() => undefined);
      const item = result?.items.find(item => item.prompt === prompt && item.response === response);
      if (!item) continue;
      if (match) return null;
      match = item.anchor;
    }
    return match ?? null;
  }

  async search(query: string) {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return { items: [], more: false, partial: false };
    this.refreshing ??= this.refresh().finally(() => { this.refreshing = undefined; });
    const partial = await this.refreshing;
    let more = false;
    const matches = [...this.cache.values()].flatMap(({ source: { header }, title, messages }) => {
      const hits: { sessionId: string; seq: number; time: number; snippet: string; title: string; cwd: string; child: boolean }[] = [];
      for (let index = messages.length - 1; index >= 0; index--) {
        const { seq, time, text } = messages[index];
        const match = text.toLocaleLowerCase().indexOf(term);
        if (match < 0) continue;
        if (hits.length === 4) { more = true; break; }
        const start = Math.max(0, match - 48), end = match + term.length + 72;
        const snippet = (start ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ') + (end < text.length ? '…' : '');
        hits.push({ sessionId: header.id, seq, time, snippet, title, cwd: header.cwd!, child: header.origin === 'subagent' || !!header.parentSession });
      }
      return hits;
    });
    matches.sort((a, b) => b.time - a.time || b.seq - a.seq || a.sessionId.localeCompare(b.sessionId));
    return { items: matches.slice(0, 48), more: more || matches.length > 48, partial };
  }
}

export async function readMessageOrigin(ctx: Context, location: MessageLocation, expectedId?: string) {
  const reader = ctx.get('sessionQuery');
  if (!reader) throw new Error('SESSION_QUERY_UNAVAILABLE');
  const sessionId = location.sessionId as SessionId;
  const { session, target } = await reader.readEvent({ sessionId, seq: location.seq as SessionSeq, before: 0, after: 0 });
  const message = target && messageOf(target);
  if (session.id !== sessionId || !session.cwd || !target || !message) {
    throw new Error('原消息已不可用');
  }
  if (expectedId !== undefined && expectedId !== message.id) throw new Error('原消息已变化');
  let child: { parentSessionId: string; mode: 'continuable' | 'one-shot' } | undefined;
  if (session.origin === 'subagent') {
    const observation = await reader.observeSession(sessionId);
    try {
      const identity = observation.projections?.values.subagent;
      if (!session.parentSession || (identity?.mode !== 'continuable' && identity?.mode !== 'one-shot')) {
        throw new Error('子会话历史入口不可用');
      }
      child = { parentSessionId: session.parentSession, mode: identity.mode };
    } finally { observation[Symbol.dispose](); }
  }
  return {
    origin: { ...location, messageId: message.id } satisfies MessageOrigin,
    ...(child ? { child } : {}),
    cwd: session.cwd,
    title: (await reader.readTitle(sessionId).catch(() => undefined))?.title || '未命名会话',
    excerpt: messageText(message).slice(0, 800),
    ...(target.type === 'assistant/message' ? { turn: target.data.turn } : {}),
    nodeKey: target.type === 'assistant/message'
      ? `14:assistant-step${target.data.turn}:${target.data.step}` : `13:input-message${message.id}`,
  };
}

export type ResolvedMessage = Awaited<ReturnType<typeof readMessageOrigin>>;
export type HistoryResults = Awaited<ReturnType<MessageHistory['search']>>;
