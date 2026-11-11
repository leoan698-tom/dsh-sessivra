import { createHash, randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { Context } from '@deepseek-ai/cordis';
import type { MessageId } from '@deepseek-ai/dsh-llm';
import type { SessionEvent, SessionEventMap, SessionEventType, SessionId, SessionSeq } from '@deepseek-ai/dsh-session';
import type { SessionHandle } from '@deepseek-ai/dsh-session-persistence';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { defineDomain } from '@deepseek-ai/dsh-storage-domain';
import { z } from 'zod';
import type { ImportBatch, ImportBrowse, ImportCatalogRelation, ImportFileChoice, ImportJob, ImportPreview, ImportQuery, ImportedFile, ImportedSession } from './import-contract.js';
import { importSessionPrefix } from './import-contract.js';
import { pickImportFile } from './import-native-file.js';
import { browseImport, globalImportMemory, importTitle, maxMemoryBytes, readTranscript, readVersion, scanImport, type FileVersion, type SourceCandidate } from './import-source.js';
import { persistWithContentionRetry } from './storage-write.js';
import { resolveImportWorkspace } from './import-workspace.js';

const manifestType = 'plugin:sessivra/import-manifest';
const completeType = 'plugin:sessivra/import-complete';
const chunkBytes = 192 * 1024;
const maxHistoryChars = 120_000;
const maxMemoryChars = 24_000;
const previewLifetime = 15 * 60_000;
const sessionIdFor = (source: ImportQuery['source'], id: string) => `${importSessionPrefix}${digest(`${source}:${id}`).slice(0, 32)}` as SessionId;
interface PreviewState {
  source: ImportQuery['source'];
  workspace?: string;
  expires: number;
  rows: Map<string, SourceCandidate>;
  query: ImportQuery;
  root: string;
  nextOffset?: number;
  snapshot?: FileVersion[];
  relations: Map<string, ImportCatalogRelation>;
}

interface Manifest {
  title: string;
  digest: string;
  files: ImportedFile[];
  end: number;
  projectedMessages: number;
  limited: boolean;
}

function payload<T>(event: SessionEvent | undefined, type: string) {
  return (event?.type as string) === type ? event!.data as T : undefined;
}

const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const archiveSchema = z.object({ digest: z.string(), chunks: z.array(z.string()) }).strict();
type Archive = z.infer<typeof archiveSchema>;
const archiveSpec = (id: string) => defineDomain({
  name: 'dsh_sessivra_import_' + id.slice(-32), version: 1, tables: {},
  global: { schema: archiveSchema, initial: { digest: '', chunks: [] } },
});

function appendEvents(source: ImportQuery['source'], candidate: SourceCandidate, created: number,
  inputs: { name: string; data: Buffer }[], transcript: Awaited<ReturnType<typeof readTranscript>>) {
  const events: SessionEvent[] = [];
  const push = <K extends SessionEventType>(type: K, data: SessionEventMap[K], time = created, surface = false) => {
    events.push({ type, data, time, seq: events.length as SessionSeq, ...(surface ? { surfaceOp: 'append' } : {}) } as SessionEvent);
  };
  const privateEvent = (type: string, data: unknown) => {
    events.push({ type, data, time: created, seq: events.length, ignorable: true } as unknown as SessionEvent);
  };

  const manifest: Manifest = { title: candidate.title, digest: '', files: [], end: 0, projectedMessages: 0, limited: false };
  privateEvent(manifestType, manifest);
  const chunks: string[] = [];
  for (const { name, data } of inputs) {
    const offset = chunks.length;
    for (let start = 0; start < data.length; start += chunkBytes) {
      chunks.push(data.subarray(start, start + chunkBytes).toString('base64'));
    }
    manifest.files.push({ name, size: data.length, offset, chunks: chunks.length - offset });
  }
  const budget = { memory: maxMemoryChars, history: maxHistoryChars };
  const memory = inputs.slice(1).flatMap(({ name, data }) => {
    const text = data.toString('utf8');
    const excerpt = text.slice(0, budget.memory);
    budget.memory -= excerpt.length;
    if (excerpt.length !== text.length) manifest.limited = true;
    return excerpt ? [{ name, text: excerpt }] : [];
  });
  const recent: typeof transcript.messages = [];
  for (let index = transcript.messages.length - 1; index >= 0; index--) {
    const message = transcript.messages[index]!;
    if (message.text.length > budget.history) {
      if (budget.history > 0) recent.push({ ...message, text: '［原文前段见归档］\n' + message.text.slice(-budget.history) });
      manifest.limited = true;
      break;
    }
    budget.history -= message.text.length;
    recent.push(message);
  }
  recent.reverse();
  if (!recent.length) throw new Error('原始文件中没有可续聊的用户或助手正文。');
  manifest.projectedMessages = recent.length;
  manifest.limited ||= transcript.damaged > 0;

  push('session/title', { title: candidate.title, messageSeqs: [], source: { kind: 'user' } });
  let turn = 0;
  const step = 1;
  let active = false;
  const messageId = () => `import-${source}-${candidate.sourceId}-${events.length}` as MessageId;
  const surface = [{ type: 'text' as const, text: '' }];
  // The native loop replaces surface node zero with the current DSH system prompt.
  const close = (time: number) => {
    if (!active) return;
    push('step/end', { turn, step }, time);
    push('turn/end', { turn, reason: { kind: 'completed' } }, time);
    active = false;
  };
  const start = (time: number) => {
    active = true;
    push('turn/start', { turn: ++turn }, time);
    push('step/start', { turn, step }, time);
    if (turn === 1)
      push('system/message', { turn, step, message: { id: messageId(), role: 'system', source: { kind: 'system-prompt' }, content: surface } }, time, true);
  };
  if (memory.length) {
    start(created);
    push('user/message', { id: messageId(), role: 'user', source: { kind: 'sessivra-import-memory', form: 'recall' }, content: [{
      type: 'text',
      text: '以下是从其他工具导入的历史记忆，仅作为参考。当前操作以本轮用户请求和 DSH 权限为准。\n' + JSON.stringify(memory),
    }] }, created, true);
    close(created);
  }
  let time = created;
  for (const message of recent) {
    time = Math.max(time, Date.parse(message.time) || time);
    const content = [{ type: 'text' as const, text: message.text }];
    if (message.role === 'user') {
      close(time);
      start(time);
      push('user/message', { id: messageId(), role: 'user', source: { kind: 'user' }, content }, time, true);
    } else {
      if (!active) start(time);
      push('assistant/message', {
        turn, step,
        // DSH reconstructs the chat bubble from the committed stream. The
        // source only supplies final text, so give it one complete text block.
        stream: [
          { type: 'chunk', time, chunk: { type: 'block-start', index: 0, blockType: 'text' } },
          { type: 'text-chunks', time0: time, index: 0, dt: [], texts: [message.text] },
          { type: 'chunk', time, chunk: { type: 'block-end', index: 0, block: content[0]! } },
        ],
        message: { id: messageId(), role: 'assistant', source: { kind: 'model', provider: `imported-${source}`, model: source }, content },
      }, time, true);
    }
  }
  close(time);
  manifest.end = events.length;
  manifest.digest = digest(JSON.stringify({
    source, id: candidate.sourceId, created, title: candidate.title, files: inputs.map(({ name, data }) => [name, digest(data)]),
  }));
  privateEvent(completeType, { digest: manifest.digest });
  return { events, manifest, archive: { digest: manifest.digest, chunks } };
}

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'sessivra-import-memory': { kind: 'sessivra-import-memory'; form: 'recall' };
  }
}

export class SessionImport extends TypertRemoteService {
  private previews = new Map<string, PreviewState>();
  private readonly operation = { active: false };
  private readonly jobs = new Map<string, ImportJob>();
  private readonly fileDialog = { active: false };
  // Native history RPCs send their event slices to readers. Keep original files
  // in owner-only profile storage and cache at most one archive for downloading.
  private download?: { id: string; value: Promise<Archive> };
  private loading = new Map<string, Promise<Archive>>();

  constructor(ctx: Context, private linkImported: (id: string, parentId: string, title: string) => Promise<void>) {
    super(ctx, 'sessivraImport');
  }

  private owner() {
    if (this.ctx.invocation?.peer.principal.kind !== 'owner') throw new Error('IMPORT_OWNER_REQUIRED');
  }

  private persistence() {
    const persistence = this.ctx.get('sessionPersistence');
    if (!persistence) throw new Error('当前 DSH 宿主未启用会话持久层。');
    return persistence;
  }

  @Remote async preview(query: ImportQuery): Promise<ImportPreview> {
    this.owner();
    const prior = query.catalogToken ? this.previews.get(query.catalogToken) : undefined;
    if (query.catalogToken && (!prior || prior.expires < Date.now() || prior.nextOffset === undefined ||
      prior.nextOffset !== query.catalogOffset || prior.source !== query.source || query.scope !== 'catalog'))
      throw new Error('会话列表已过期，请刷新。');
    const pageQuery = prior ? { ...prior.query, catalogOffset: prior.nextOffset } : query;
    const { candidates, warnings, workspace, describe, nextOffset, unavailable, root, snapshot, relations } = await scanImport(pageQuery, prior?.snapshot);
    if (prior && this.previews.get(query.catalogToken!) !== prior)
      throw new Error('会话列表已更新，请刷新。');
    for (const [key, entry] of this.previews) if (entry.expires < Date.now()) this.previews.delete(key);
    if (!prior && this.previews.size >= 12) this.previews.delete(this.previews.keys().next().value!);
    const token = query.catalogToken ?? randomUUID();
    const rows = prior?.rows ?? new Map<string, SourceCandidate>();
    const known = new Set([...rows.values()].map(row => row.sourceId));
    const added = candidates.filter(row => !known.has(row.sourceId)).map(row => [randomUUID(), row] as const);
    for (const [key, row] of added) rows.set(key, row);
    const expires = Date.now() + previewLifetime;
    this.previews.set(token, { source: query.source, workspace, rows, expires, query: pageQuery, root, nextOffset, snapshot, relations });
    const available = new Set([...rows.values()].map(row => row.sourceId));
    return {
      token, warnings,
      ...(nextOffset !== undefined ? { nextOffset } : {}),
      ...(unavailable.length ? { unavailable: unavailable.filter(row => !available.has(row.sourceId)) } : {}),
      rows: added.map(([key, row]) => ({
        key, sourceId: row.sourceId, file: row.path, title: row.title, cwd: workspace ?? (row.cwd || null),
        updated: row.updated, size: row.size, memory: row.memory.map(file => file.path),
        ...describe?.(row),
      })),
    };
  }

  @Remote async browse(browse: ImportBrowse) {
    this.owner();
    return browseImport(browse);
  }

  @Remote async pickFile(query: ImportFileChoice) {
    this.owner();
    const picker = this.ctx.get('directoryPicker') as { capability(): { kind: string } } | undefined;
    if (process.platform !== 'win32' || picker?.capability().kind !== 'native') return { native: false, path: null };
    if (this.fileDialog.active) throw new Error('请先完成已打开的文件选择。');
    this.fileDialog.active = true;
    try {
      return { native: true, path: await pickImportFile(query, this.ctx.invocation?.signal) };
    } finally { this.fileDialog.active = false; }
  }

  @Remote async commit(token: string, keys: string[]): Promise<ImportBatch> {
    this.owner();
    return this.commitSelection(token, keys, false, false);
  }

  @Remote async commitCatalog(token: string, keys: string[], includeGlobalMemory: boolean): Promise<ImportBatch> {
    this.owner();
    return this.commitSelection(token, keys, includeGlobalMemory, true);
  }

  @Remote async startCatalogImport(token: string, keys: string[], includeGlobalMemory: boolean) {
    this.owner();
    if (this.operation.active) throw new Error('正在导入另一批会话，请稍后重试。');
    if (this.jobs.size >= 8) this.jobs.delete(this.jobs.keys().next().value!);
    const id = randomUUID();
    const job: ImportJob = { phase: 'discovering', completed: 0, total: 0 };
    this.jobs.set(id, job);
    void this.commitSelection(token, keys, includeGlobalMemory, true, job).then(result => {
      job.phase = 'done';
      job.result = result;
    }, error => {
      job.phase = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
    });
    return id;
  }

  @Remote async catalogImportStatus(id: string) {
    this.owner();
    const job = this.jobs.get(id);
    if (!job) throw new Error('找不到这批导入任务。');
    return job;
  }

  private async family(preview: PreviewState, keys: string[], expand: boolean) {
    const available = new Map([...preview.rows].map(([key, row]) => [row.sourceId, { key, row }]));
    const branches = new Map<string, string[]>();
    if (expand) for (const [id, relation] of preview.relations) {
      if (!relation.parent) continue;
      const siblings = branches.get(relation.parent.sourceId) ?? [];
      siblings.push(id);
      branches.set(relation.parent.sourceId, siblings);
    }
    const pending: { sourceId: string; rootKey: string; parent?: string }[] = [];
    const visited = new Set<string>();
    for (const key of new Set(keys)) {
      const row = preview.rows.get(key)!;
      if (row.parent) continue;
      const queue = [{ sourceId: row.sourceId, rootKey: key }] as typeof pending;
      for (const item of queue) {
        if (visited.has(item.sourceId)) continue;
        visited.add(item.sourceId);
        pending.push(item);
        for (const child of branches.get(item.sourceId) ?? []) queue.push({ sourceId: child, rootKey: key, parent: item.sourceId });
        if (pending.length > 256) throw new Error('一次最多导入 256 条主子会话，请减少所选主会话。');
      }
    }
    const wanted = new Set(pending.filter(item => !available.has(item.sourceId)).map(item => item.sourceId));
    if (wanted.size && preview.snapshot) {
      const filenames = new Set([...wanted].flatMap(id => [id + '.jsonl', ...(preview.relations.get(id)?.archiveNames ?? [])]));
      const files = preview.snapshot.filter(file => filenames.has(basename(file.path).toLowerCase()));
      if (files.length) {
        const scan = await scanImport({ ...preview.query, catalogOffset: 0 }, files, wanted);
        for (const row of scan.candidates) available.set(row.sourceId, { key: row.sourceId, row });
      }
    }
    return { pending, available };
  }

  private async commitSelection(token: string, keys: string[], includeGlobalMemory: boolean, expand: boolean, job?: ImportJob): Promise<ImportBatch> {
    const preview = this.previews.get(token);
    if (!preview || preview.expires < Date.now()) throw new Error('预览已过期，请重新扫描。');
    if (keys.some(key => !preview.rows.has(key))) throw new Error('选择包含不属于当前预览的会话。');
    if (this.operation.active) throw new Error('正在导入另一批会话，请稍后重试。');
    const result: ImportBatch = { sessions: [], failures: [] };
    let global: ReturnType<typeof globalImportMemory> | undefined;
    const catalog = preview.query.scope === 'catalog';
    const readGlobal = includeGlobalMemory && catalog
      ? () => global ??= globalImportMemory(preview.root, preview.source)
      : undefined;
    this.operation.active = true;
    try {
      const { pending, available } = await this.family(preview, keys, catalog && expand);
      for (const key of new Set(keys)) if (preview.rows.get(key)?.parent)
        result.failures.push({ key, message: '请选择主会话，子会话会随主会话一起导入。' });
      if (job) {
        job.phase = 'importing';
        job.total = pending.length;
      }
      const completed = new Set<string>();
      for (const item of pending) {
        const entry = available.get(item.sourceId);
        const title = entry?.row.catalogTitle || preview.relations.get(item.sourceId)?.title || entry?.row.title || '未命名子会话';
        if (job) job.title = title;
        try {
          if (!entry) throw new Error('缺少本机原档。');
          if (item.parent && !completed.has(item.parent)) throw new Error('父会话尚未导入，重试主会话后继续。');
          const parentId = item.parent ? sessionIdFor(preview.source, item.parent) : undefined;
          const row = catalog && entry.row.catalogTitle ? { ...entry.row, title } : entry.row;
          const session = await this.importOne(preview.source, row, preview.workspace, catalog, readGlobal, parentId);
          result.sessions.push({ key: entry.key, rootKey: item.rootKey, ...session, ...(parentId ? { parentId } : {}) });
          completed.add(item.sourceId);
        } catch (error) {
          result.failures.push({ key: item.rootKey, title, message: error instanceof Error ? error.message : String(error) });
        } finally {
          if (job) job.completed++;
        }
      }
      return result;
    } finally {
      this.operation.active = false;
    }
  }

  private async importOne(source: ImportQuery['source'], candidate: SourceCandidate, workspace: string | undefined,
    catalog: boolean, readGlobal?: () => ReturnType<typeof globalImportMemory>, parentId?: SessionId): Promise<Omit<ImportedSession, 'key'>> {
    const persistence = this.persistence();
    const registry = this.ctx.get('workspaceRegistry');
    const id = sessionIdFor(source, candidate.sourceId);
    const stored = await persistence.stat(id);
    if (stored) {
      await using reader = await persistence.open(id, 'read');
      const manifest = await this.completed(reader);
      if (manifest) {
        const { events } = await reader.read(manifest.end + 1);
        const title = events.findLast(event => event.type === 'session/title')?.data.title;
        if (parentId && reader.header.parentSession !== parentId) {
          if (reader.header.parentSession) throw new Error('该会话已经关联到另一个父会话。');
          await this.linkImported(id, parentId, title ?? manifest.title);
        }
        const existing = await resolveImportWorkspace({ original: '', explicit: reader.header.cwd });
        if (registry && existing) await (await registry.resolveByPath(existing.cwd))?.attachSession(id);
        return this.result(id, title ? { ...manifest, title } : manifest, 'existing');
      }
    }
    const fallback = this.ctx.get('workingDirectory') as { defaultDirectory: string } | undefined;
    const location = await resolveImportWorkspace({
      original: candidate.cwd, explicit: workspace, declared: candidate.projectRoots,
      registered: registry?.list().map(item => item.path), fallback: catalog ? fallback?.defaultDirectory : undefined,
    });
    if (!location) throw new Error(catalog ? '原工作目录与 DSH 默认工作目录均不可用。'
      : '原工作目录在 DSH 宿主上不可用，请填写续聊工作目录后重新预览。');
    const { cwd } = location;
    const destination = registry && (location.recoveredProject ? await registry.create(cwd) : await registry.resolveByPath(cwd));
    const transcript = await readTranscript(source, candidate);
    const resolved = candidate.resolveTitle
      ? { ...candidate, title: importTitle(source, candidate.sourceId, transcript.messages).title } : candidate;
    const memory = [...new Map([...candidate.memory, ...(await readGlobal?.() ?? [])].map(file => [file.path, file])).values()];
    if (memory.length > 256 || memory.reduce((sum, file) => sum + file.size, 0) > maxMemoryBytes)
      throw new Error('该会话的记忆超过 256 个文件或合计 4 MiB。' + (readGlobal ? '可取消全局记忆后重试。' : ''));
    const inputs = [{ name: basename(candidate.path), data: transcript.raw }];
    for (const file of memory) inputs.push({ name: basename(file.path), data: await readVersion(file, maxMemoryBytes) });
    const createdAt = Math.max(0, Date.parse(candidate.timestamp) || Math.floor(candidate.updated));
    const { events, manifest, archive } = appendEvents(source, resolved, createdAt, inputs, transcript);
    const header = this.ctx.sessions.prepare(id, { meta: { cwd, createdAt, ...(parentId ? { parentSession: parentId } : {}) } }).header;
    await using handle = stored ? await persistence.open(id, 'write') : await persistence.create(header);
    const { events: prefix } = await handle.read();
    if (handle.header.cwd !== cwd || handle.header.parentSession !== parentId || prefix.some((event, index) => !isDeepStrictEqual(event, events[index])))
      throw new Error('上次导入未完成，且源快照或工作目录已经变化。请用上次的来源和工作目录重试。');
    const domain = await this.ctx.storageDomain.open(archiveSpec(id));
    try {
      if (domain.global.get().digest !== archive.digest)
        await persistWithContentionRetry(() => domain.global.set(archive));
    } finally { await domain.close(); }
    await handle.append(events.slice(prefix.length));
    await handle.flush();
    await destination?.attachSession(id);
    return this.result(id, manifest, 'imported');
  }

  private async completed(handle: SessionHandle) {
    const { events: [first] } = await handle.read(0, 1);
    const manifest = payload<Manifest>(first, manifestType);
    if (!manifest) return;
    const { events: [last] } = await handle.read(manifest.end, 1);
    return payload<{ digest: string }>(last, completeType)?.digest === manifest.digest ? manifest : undefined;
  }

  private result(id: string, manifest: Manifest, status: ImportedSession['status']) {
    return { id, status, title: manifest.title, files: manifest.files, projectedMessages: manifest.projectedMessages, limited: manifest.limited };
  }

  @Remote async archive(id: string): Promise<ImportedFile[]> {
    this.owner();
    await using handle = await this.persistence().open(id as SessionId, 'read');
    const manifest = await this.completed(handle);
    if (!manifest) throw new Error('该会话没有完整的导入归档。');
    return manifest.files;
  }

  @Remote async chunk(id: string, offset: number): Promise<string> {
    this.owner();
    if (this.download?.id !== id) {
      let value = this.loading.get(id);
      if (!value) {
        value = this.loadArchive(id).finally(() => this.loading.delete(id));
        this.loading.set(id, value);
      }
      const current = { id, value };
      this.download = current;
      void value.catch(() => { if (this.download === current) this.download = undefined; });
    }
    const { chunks } = await this.download.value;
    if (chunks[offset] === undefined) throw new Error('归档分片不存在。');
    return chunks[offset];
  }

  private async loadArchive(id: string) {
    await using handle = await this.persistence().open(id as SessionId, 'read');
    const manifest = await this.completed(handle);
    if (!manifest) throw new Error('该会话没有完整的导入归档。');
    const domain = await this.ctx.storageDomain.open(archiveSpec(id));
    try {
      const archive = domain.global.get();
      if (archive.digest !== manifest.digest) throw new Error('归档文件缺失或与会话记录不匹配。');
      return archive;
    } finally { await domain.close(); }
  }
}
