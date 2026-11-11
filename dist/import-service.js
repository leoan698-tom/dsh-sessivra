var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
import { createHash, randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { defineDomain } from '@deepseek-ai/dsh-storage-domain';
import { z } from 'zod';
import { importSessionPrefix } from './import-contract.js';
import { pickImportFile } from './import-native-file.js';
import { browseImport, globalImportMemory, importTitle, maxMemoryBytes, readTranscript, readVersion, scanImport } from './import-source.js';
import { persistWithContentionRetry } from './storage-write.js';
import { resolveImportWorkspace } from './import-workspace.js';
const manifestType = 'plugin:sessivra/import-manifest';
const completeType = 'plugin:sessivra/import-complete';
const chunkBytes = 192 * 1024;
const maxHistoryChars = 120_000;
const maxMemoryChars = 24_000;
const previewLifetime = 15 * 60_000;
const sessionIdFor = (source, id) => `${importSessionPrefix}${digest(`${source}:${id}`).slice(0, 32)}`;
function payload(event, type) {
    return event?.type === type ? event.data : undefined;
}
const digest = (value) => createHash('sha256').update(value).digest('hex');
const archiveSchema = z.object({ digest: z.string(), chunks: z.array(z.string()) }).strict();
const archiveSpec = (id) => defineDomain({
    name: 'dsh_sessivra_import_' + id.slice(-32), version: 1, tables: {},
    global: { schema: archiveSchema, initial: { digest: '', chunks: [] } },
});
function appendEvents(source, candidate, created, inputs, transcript) {
    const events = [];
    const push = (type, data, time = created, surface = false) => {
        events.push({ type, data, time, seq: events.length, ...(surface ? { surfaceOp: 'append' } : {}) });
    };
    const privateEvent = (type, data) => {
        events.push({ type, data, time: created, seq: events.length, ignorable: true });
    };
    const manifest = { title: candidate.title, digest: '', files: [], end: 0, projectedMessages: 0, limited: false };
    privateEvent(manifestType, manifest);
    const chunks = [];
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
        if (excerpt.length !== text.length)
            manifest.limited = true;
        return excerpt ? [{ name, text: excerpt }] : [];
    });
    const recent = [];
    for (let index = transcript.messages.length - 1; index >= 0; index--) {
        const message = transcript.messages[index];
        if (message.text.length > budget.history) {
            if (budget.history > 0)
                recent.push({ ...message, text: '［原文前段见归档］\n' + message.text.slice(-budget.history) });
            manifest.limited = true;
            break;
        }
        budget.history -= message.text.length;
        recent.push(message);
    }
    recent.reverse();
    if (!recent.length)
        throw new Error('原始文件中没有可续聊的用户或助手正文。');
    manifest.projectedMessages = recent.length;
    manifest.limited ||= transcript.damaged > 0;
    push('session/title', { title: candidate.title, messageSeqs: [], source: { kind: 'user' } });
    let turn = 0;
    const step = 1;
    let active = false;
    const messageId = () => `import-${source}-${candidate.sourceId}-${events.length}`;
    const surface = [{ type: 'text', text: '' }];
    // The native loop replaces surface node zero with the current DSH system prompt.
    const close = (time) => {
        if (!active)
            return;
        push('step/end', { turn, step }, time);
        push('turn/end', { turn, reason: { kind: 'completed' } }, time);
        active = false;
    };
    const start = (time) => {
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
        const content = [{ type: 'text', text: message.text }];
        if (message.role === 'user') {
            close(time);
            start(time);
            push('user/message', { id: messageId(), role: 'user', source: { kind: 'user' }, content }, time, true);
        }
        else {
            if (!active)
                start(time);
            push('assistant/message', {
                turn, step,
                // DSH reconstructs the chat bubble from the committed stream. The
                // source only supplies final text, so give it one complete text block.
                stream: [
                    { type: 'chunk', time, chunk: { type: 'block-start', index: 0, blockType: 'text' } },
                    { type: 'text-chunks', time0: time, index: 0, dt: [], texts: [message.text] },
                    { type: 'chunk', time, chunk: { type: 'block-end', index: 0, block: content[0] } },
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
let SessionImport = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _preview_decorators;
    let _browse_decorators;
    let _pickFile_decorators;
    let _commit_decorators;
    let _commitCatalog_decorators;
    let _startCatalogImport_decorators;
    let _catalogImportStatus_decorators;
    let _archive_decorators;
    let _chunk_decorators;
    return class SessionImport extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _preview_decorators = [Remote];
            _browse_decorators = [Remote];
            _pickFile_decorators = [Remote];
            _commit_decorators = [Remote];
            _commitCatalog_decorators = [Remote];
            _startCatalogImport_decorators = [Remote];
            _catalogImportStatus_decorators = [Remote];
            _archive_decorators = [Remote];
            _chunk_decorators = [Remote];
            __esDecorate(this, null, _preview_decorators, { kind: "method", name: "preview", static: false, private: false, access: { has: obj => "preview" in obj, get: obj => obj.preview }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _browse_decorators, { kind: "method", name: "browse", static: false, private: false, access: { has: obj => "browse" in obj, get: obj => obj.browse }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _pickFile_decorators, { kind: "method", name: "pickFile", static: false, private: false, access: { has: obj => "pickFile" in obj, get: obj => obj.pickFile }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _commit_decorators, { kind: "method", name: "commit", static: false, private: false, access: { has: obj => "commit" in obj, get: obj => obj.commit }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _commitCatalog_decorators, { kind: "method", name: "commitCatalog", static: false, private: false, access: { has: obj => "commitCatalog" in obj, get: obj => obj.commitCatalog }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _startCatalogImport_decorators, { kind: "method", name: "startCatalogImport", static: false, private: false, access: { has: obj => "startCatalogImport" in obj, get: obj => obj.startCatalogImport }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _catalogImportStatus_decorators, { kind: "method", name: "catalogImportStatus", static: false, private: false, access: { has: obj => "catalogImportStatus" in obj, get: obj => obj.catalogImportStatus }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _archive_decorators, { kind: "method", name: "archive", static: false, private: false, access: { has: obj => "archive" in obj, get: obj => obj.archive }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _chunk_decorators, { kind: "method", name: "chunk", static: false, private: false, access: { has: obj => "chunk" in obj, get: obj => obj.chunk }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        linkImported = __runInitializers(this, _instanceExtraInitializers);
        previews = new Map();
        operation = { active: false };
        jobs = new Map();
        fileDialog = { active: false };
        // Native history RPCs send their event slices to readers. Keep original files
        // in owner-only profile storage and cache at most one archive for downloading.
        download;
        loading = new Map();
        constructor(ctx, linkImported) {
            super(ctx, 'sessivraImport');
            this.linkImported = linkImported;
        }
        owner() {
            if (this.ctx.invocation?.peer.principal.kind !== 'owner')
                throw new Error('IMPORT_OWNER_REQUIRED');
        }
        persistence() {
            const persistence = this.ctx.get('sessionPersistence');
            if (!persistence)
                throw new Error('当前 DSH 宿主未启用会话持久层。');
            return persistence;
        }
        async preview(query) {
            this.owner();
            const prior = query.catalogToken ? this.previews.get(query.catalogToken) : undefined;
            if (query.catalogToken && (!prior || prior.expires < Date.now() || prior.nextOffset === undefined ||
                prior.nextOffset !== query.catalogOffset || prior.source !== query.source || query.scope !== 'catalog'))
                throw new Error('会话列表已过期，请刷新。');
            const pageQuery = prior ? { ...prior.query, catalogOffset: prior.nextOffset } : query;
            const { candidates, warnings, workspace, describe, nextOffset, unavailable, root, snapshot, relations } = await scanImport(pageQuery, prior?.snapshot);
            if (prior && this.previews.get(query.catalogToken) !== prior)
                throw new Error('会话列表已更新，请刷新。');
            for (const [key, entry] of this.previews)
                if (entry.expires < Date.now())
                    this.previews.delete(key);
            if (!prior && this.previews.size >= 12)
                this.previews.delete(this.previews.keys().next().value);
            const token = query.catalogToken ?? randomUUID();
            const rows = prior?.rows ?? new Map();
            const known = new Set([...rows.values()].map(row => row.sourceId));
            const added = candidates.filter(row => !known.has(row.sourceId)).map(row => [randomUUID(), row]);
            for (const [key, row] of added)
                rows.set(key, row);
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
        async browse(browse) {
            this.owner();
            return browseImport(browse);
        }
        async pickFile(query) {
            this.owner();
            const picker = this.ctx.get('directoryPicker');
            if (process.platform !== 'win32' || picker?.capability().kind !== 'native')
                return { native: false, path: null };
            if (this.fileDialog.active)
                throw new Error('请先完成已打开的文件选择。');
            this.fileDialog.active = true;
            try {
                return { native: true, path: await pickImportFile(query, this.ctx.invocation?.signal) };
            }
            finally {
                this.fileDialog.active = false;
            }
        }
        async commit(token, keys) {
            this.owner();
            return this.commitSelection(token, keys, false, false);
        }
        async commitCatalog(token, keys, includeGlobalMemory) {
            this.owner();
            return this.commitSelection(token, keys, includeGlobalMemory, true);
        }
        async startCatalogImport(token, keys, includeGlobalMemory) {
            this.owner();
            if (this.operation.active)
                throw new Error('正在导入另一批会话，请稍后重试。');
            if (this.jobs.size >= 8)
                this.jobs.delete(this.jobs.keys().next().value);
            const id = randomUUID();
            const job = { phase: 'discovering', completed: 0, total: 0 };
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
        async catalogImportStatus(id) {
            this.owner();
            const job = this.jobs.get(id);
            if (!job)
                throw new Error('找不到这批导入任务。');
            return job;
        }
        async family(preview, keys, expand) {
            const available = new Map([...preview.rows].map(([key, row]) => [row.sourceId, { key, row }]));
            const branches = new Map();
            if (expand)
                for (const [id, relation] of preview.relations) {
                    if (!relation.parent)
                        continue;
                    const siblings = branches.get(relation.parent.sourceId) ?? [];
                    siblings.push(id);
                    branches.set(relation.parent.sourceId, siblings);
                }
            const pending = [];
            const visited = new Set();
            for (const key of new Set(keys)) {
                const row = preview.rows.get(key);
                if (row.parent)
                    continue;
                const queue = [{ sourceId: row.sourceId, rootKey: key }];
                for (const item of queue) {
                    if (visited.has(item.sourceId))
                        continue;
                    visited.add(item.sourceId);
                    pending.push(item);
                    for (const child of branches.get(item.sourceId) ?? [])
                        queue.push({ sourceId: child, rootKey: key, parent: item.sourceId });
                    if (pending.length > 256)
                        throw new Error('一次最多导入 256 条主子会话，请减少所选主会话。');
                }
            }
            const wanted = new Set(pending.filter(item => !available.has(item.sourceId)).map(item => item.sourceId));
            if (wanted.size && preview.snapshot) {
                const filenames = new Set([...wanted].flatMap(id => [id + '.jsonl', ...(preview.relations.get(id)?.archiveNames ?? [])]));
                const files = preview.snapshot.filter(file => filenames.has(basename(file.path).toLowerCase()));
                if (files.length) {
                    const scan = await scanImport({ ...preview.query, catalogOffset: 0 }, files, wanted);
                    for (const row of scan.candidates)
                        available.set(row.sourceId, { key: row.sourceId, row });
                }
            }
            return { pending, available };
        }
        async commitSelection(token, keys, includeGlobalMemory, expand, job) {
            const preview = this.previews.get(token);
            if (!preview || preview.expires < Date.now())
                throw new Error('预览已过期，请重新扫描。');
            if (keys.some(key => !preview.rows.has(key)))
                throw new Error('选择包含不属于当前预览的会话。');
            if (this.operation.active)
                throw new Error('正在导入另一批会话，请稍后重试。');
            const result = { sessions: [], failures: [] };
            let global;
            const catalog = preview.query.scope === 'catalog';
            const readGlobal = includeGlobalMemory && catalog
                ? () => global ??= globalImportMemory(preview.root, preview.source)
                : undefined;
            this.operation.active = true;
            try {
                const { pending, available } = await this.family(preview, keys, catalog && expand);
                for (const key of new Set(keys))
                    if (preview.rows.get(key)?.parent)
                        result.failures.push({ key, message: '请选择主会话，子会话会随主会话一起导入。' });
                if (job) {
                    job.phase = 'importing';
                    job.total = pending.length;
                }
                const completed = new Set();
                for (const item of pending) {
                    const entry = available.get(item.sourceId);
                    const title = entry?.row.catalogTitle || preview.relations.get(item.sourceId)?.title || entry?.row.title || '未命名子会话';
                    if (job)
                        job.title = title;
                    try {
                        if (!entry)
                            throw new Error('缺少本机原档。');
                        if (item.parent && !completed.has(item.parent))
                            throw new Error('父会话尚未导入，重试主会话后继续。');
                        const parentId = item.parent ? sessionIdFor(preview.source, item.parent) : undefined;
                        const row = catalog && entry.row.catalogTitle ? { ...entry.row, title } : entry.row;
                        const session = await this.importOne(preview.source, row, preview.workspace, catalog, readGlobal, parentId);
                        result.sessions.push({ key: entry.key, rootKey: item.rootKey, ...session, ...(parentId ? { parentId } : {}) });
                        completed.add(item.sourceId);
                    }
                    catch (error) {
                        result.failures.push({ key: item.rootKey, title, message: error instanceof Error ? error.message : String(error) });
                    }
                    finally {
                        if (job)
                            job.completed++;
                    }
                }
                return result;
            }
            finally {
                this.operation.active = false;
            }
        }
        async importOne(source, candidate, workspace, catalog, readGlobal, parentId) {
            const env_1 = { stack: [], error: void 0, hasError: false };
            try {
                const persistence = this.persistence();
                const registry = this.ctx.get('workspaceRegistry');
                const id = sessionIdFor(source, candidate.sourceId);
                const stored = await persistence.stat(id);
                if (stored) {
                    const env_2 = { stack: [], error: void 0, hasError: false };
                    try {
                        const reader = __addDisposableResource(env_2, await persistence.open(id, 'read'), true);
                        const manifest = await this.completed(reader);
                        if (manifest) {
                            const { events } = await reader.read(manifest.end + 1);
                            const title = events.findLast(event => event.type === 'session/title')?.data.title;
                            if (parentId && reader.header.parentSession !== parentId) {
                                if (reader.header.parentSession)
                                    throw new Error('该会话已经关联到另一个父会话。');
                                await this.linkImported(id, parentId, title ?? manifest.title);
                            }
                            const existing = await resolveImportWorkspace({ original: '', explicit: reader.header.cwd });
                            if (registry && existing)
                                await (await registry.resolveByPath(existing.cwd))?.attachSession(id);
                            return this.result(id, title ? { ...manifest, title } : manifest, 'existing');
                        }
                    }
                    catch (e_1) {
                        env_2.error = e_1;
                        env_2.hasError = true;
                    }
                    finally {
                        const result_1 = __disposeResources(env_2);
                        if (result_1)
                            await result_1;
                    }
                }
                const fallback = this.ctx.get('workingDirectory');
                const location = await resolveImportWorkspace({
                    original: candidate.cwd, explicit: workspace, declared: candidate.projectRoots,
                    registered: registry?.list().map(item => item.path), fallback: catalog ? fallback?.defaultDirectory : undefined,
                });
                if (!location)
                    throw new Error(catalog ? '原工作目录与 DSH 默认工作目录均不可用。'
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
                for (const file of memory)
                    inputs.push({ name: basename(file.path), data: await readVersion(file, maxMemoryBytes) });
                const createdAt = Math.max(0, Date.parse(candidate.timestamp) || Math.floor(candidate.updated));
                const { events, manifest, archive } = appendEvents(source, resolved, createdAt, inputs, transcript);
                const header = this.ctx.sessions.prepare(id, { meta: { cwd, createdAt, ...(parentId ? { parentSession: parentId } : {}) } }).header;
                const handle = __addDisposableResource(env_1, stored ? await persistence.open(id, 'write') : await persistence.create(header), true);
                const { events: prefix } = await handle.read();
                if (handle.header.cwd !== cwd || handle.header.parentSession !== parentId || prefix.some((event, index) => !isDeepStrictEqual(event, events[index])))
                    throw new Error('上次导入未完成，且源快照或工作目录已经变化。请用上次的来源和工作目录重试。');
                const domain = await this.ctx.storageDomain.open(archiveSpec(id));
                try {
                    if (domain.global.get().digest !== archive.digest)
                        await persistWithContentionRetry(() => domain.global.set(archive));
                }
                finally {
                    await domain.close();
                }
                await handle.append(events.slice(prefix.length));
                await handle.flush();
                await destination?.attachSession(id);
                return this.result(id, manifest, 'imported');
            }
            catch (e_2) {
                env_1.error = e_2;
                env_1.hasError = true;
            }
            finally {
                const result_2 = __disposeResources(env_1);
                if (result_2)
                    await result_2;
            }
        }
        async completed(handle) {
            const { events: [first] } = await handle.read(0, 1);
            const manifest = payload(first, manifestType);
            if (!manifest)
                return;
            const { events: [last] } = await handle.read(manifest.end, 1);
            return payload(last, completeType)?.digest === manifest.digest ? manifest : undefined;
        }
        result(id, manifest, status) {
            return { id, status, title: manifest.title, files: manifest.files, projectedMessages: manifest.projectedMessages, limited: manifest.limited };
        }
        async archive(id) {
            const env_3 = { stack: [], error: void 0, hasError: false };
            try {
                this.owner();
                const handle = __addDisposableResource(env_3, await this.persistence().open(id, 'read'), true);
                const manifest = await this.completed(handle);
                if (!manifest)
                    throw new Error('该会话没有完整的导入归档。');
                return manifest.files;
            }
            catch (e_3) {
                env_3.error = e_3;
                env_3.hasError = true;
            }
            finally {
                const result_3 = __disposeResources(env_3);
                if (result_3)
                    await result_3;
            }
        }
        async chunk(id, offset) {
            this.owner();
            if (this.download?.id !== id) {
                let value = this.loading.get(id);
                if (!value) {
                    value = this.loadArchive(id).finally(() => this.loading.delete(id));
                    this.loading.set(id, value);
                }
                const current = { id, value };
                this.download = current;
                void value.catch(() => { if (this.download === current)
                    this.download = undefined; });
            }
            const { chunks } = await this.download.value;
            if (chunks[offset] === undefined)
                throw new Error('归档分片不存在。');
            return chunks[offset];
        }
        async loadArchive(id) {
            const env_4 = { stack: [], error: void 0, hasError: false };
            try {
                const handle = __addDisposableResource(env_4, await this.persistence().open(id, 'read'), true);
                const manifest = await this.completed(handle);
                if (!manifest)
                    throw new Error('该会话没有完整的导入归档。');
                const domain = await this.ctx.storageDomain.open(archiveSpec(id));
                try {
                    const archive = domain.global.get();
                    if (archive.digest !== manifest.digest)
                        throw new Error('归档文件缺失或与会话记录不匹配。');
                    return archive;
                }
                finally {
                    await domain.close();
                }
            }
            catch (e_4) {
                env_4.error = e_4;
                env_4.hasError = true;
            }
            finally {
                const result_4 = __disposeResources(env_4);
                if (result_4)
                    await result_4;
            }
        }
    };
})();
export { SessionImport };
