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
import { lstat, open, readdir, realpath, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path';
import { homedir } from 'node:os';
import { decodeImportFrames } from './import-zstd.js';
import { bridgeClaudeTree, sessionBridgeDataRoot } from './import-claude-tree.js';
const maxScan = 20_000;
export const maxLogBytes = 64 * 1024 * 1024;
export const maxMemoryBytes = 4 * 1024 * 1024;
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const markdown = /\.md$/i;
const jsonl = /\.jsonl$/i;
const codexLog = /\.jsonl(?:\.zst)?$/i;
const compressed = (path) => /\.jsonl\.zst$/i.test(path);
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const string = (value) => typeof value === 'string' ? value : '';
const missing = (error) => error.code === 'ENOENT';
const within = (root, path) => {
    const rel = relative(root, path);
    return !rel || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep));
};
export function importHome(source) {
    return source === 'codex' ? process.env.CODEX_HOME || join(homedir(), '.codex')
        : process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
}
async function catalogMetadata(root, source) {
    const titles = new Map();
    const readOptional = async (name) => {
        try {
            return (await readVersion(await version(join(root, name)), 16 * 1024 * 1024)).toString('utf8');
        }
        catch {
            return '';
        }
    };
    let projects = [];
    let assignments = {};
    const projectless = new Set();
    if (source === 'codex') {
        const [index, state] = await Promise.all([readOptional('session_index.jsonl'), readOptional('.codex-global-state.json')]);
        for (const row of rows(index, false).parsed) {
            const title = string(row.thread_name).trim();
            if (title && uuid.test(string(row.id)))
                titles.set(string(row.id).toLowerCase(), title.slice(0, 160));
        }
        try {
            const desktop = record(JSON.parse(state));
            assignments = record(desktop['thread-project-assignments']);
            const independent = desktop['projectless-thread-ids'];
            if (Array.isArray(independent)) {
                for (const id of independent)
                    if (uuid.test(string(id)))
                        projectless.add(string(id).toLowerCase());
            }
            projects = Object.entries(record(desktop['local-projects'])).flatMap(([key, value]) => {
                const project = record(value);
                const roots = Array.isArray(project.rootPaths) ? project.rootPaths.filter((root) => typeof root === 'string' && isAbsolute(root)) : [];
                const name = string(project.name);
                return name && roots.length ? [{ key, name, roots }] : [];
            });
        }
        catch { /* The desktop index is optional for CLI-only sources. */ }
    }
    const byKey = new Map(projects.map(project => [project.key, project]));
    const roots = projects.flatMap(project => project.roots.map(root => ({ root, project })))
        .sort((a, b) => b.root.length - a.root.length);
    const describe = (file) => {
        const assignment = record(assignments[file.sourceId]);
        const projectId = string(assignment.projectId);
        const named = projectless.has(file.sourceId) ? undefined
            : projectId ? byKey.get(projectId)
                : isAbsolute(file.cwd) ? roots.find(item => within(item.root, file.cwd))?.project : undefined;
        return { ...(named ? { project: { key: 'desktop:' + named.key, name: named.name } } : {}),
            displayTitle: titles.get(file.sourceId) ??
                (file.title.endsWith(file.sourceId) ? '未命名会话' : file.title.replace(/^(Codex|Claude) · /, '')) };
    };
    const projectRoots = (file) => {
        const key = describe(file).project?.key.slice('desktop:'.length);
        return key ? byKey.get(key)?.roots : undefined;
    };
    return { describe, titles, projectRoots };
}
async function claudeDesktopSessions() {
    const appData = process.env.LOCALAPPDATA;
    if (process.platform !== 'win32' || !appData)
        return [];
    const container = join(appData, 'Claude-Data');
    const profiles = await readdir(container, { withFileTypes: true }).catch(() => []);
    const roots = profiles.filter(profile => profile.isDirectory() && !profile.isSymbolicLink())
        .map(profile => join(container, profile.name, 'claude-code-sessions'));
    if (process.env.APPDATA)
        roots.push(join(process.env.APPDATA, 'Claude', 'claude-code-sessions'));
    const indexes = (await Promise.all(roots.map(root => files(root, /^local_[a-f\d-]+\.json$/i, true, true).catch(() => [])))).flat();
    const result = new Map();
    for (const path of indexes) {
        try {
            const index = record(JSON.parse((await readVersion(await version(path), 2 * 1024 * 1024)).toString('utf8')));
            const sourceId = string(index.cliSessionId).toLowerCase();
            const title = string(index.title).trim();
            if (!uuid.test(sourceId) || !title || index.isArchived === true)
                continue;
            const time = index.lastActivityAt ?? index.lastFocusedAt ?? index.createdAt;
            const updated = (typeof time === 'number' ? time : Date.parse(string(time))) || 0;
            if (!result.has(sourceId) || result.get(sourceId).updated < updated)
                result.set(sourceId, { sourceId, title: title.slice(0, 160), updated,
                    desktopId: string(index.sessionId), forkedFrom: string(index.forkedFromSessionId) });
        }
        catch { /* Ignore a stale or partial desktop index entry. */ }
    }
    const byDesktop = new Map([...result.values()].filter(row => row.desktopId).map(row => [row.desktopId, row]));
    return [...result.values()].sort((a, b) => b.updated - a.updated).map(({ sourceId, title, updated, forkedFrom }) => {
        const parent = byDesktop.get(forkedFrom);
        return { sourceId, title, updated, ...(parent && parent.sourceId !== sourceId
                ? { parent: { sourceId: parent.sourceId, title: parent.title } } : {}) };
    });
}
export async function globalImportMemory(root, source) {
    const paths = source === 'codex'
        ? (await Promise.all(['memories', 'memories_v2'].map(async (name) => (await files(join(root, name), markdown, false, true))
            .filter(path => /^(MEMORY|memory_summary|raw_memories)\.md$/i.test(basename(path)))))).flat()
        : [
            ...await files(root, /^CLAUDE\.md$/i, false, true),
            ...await files(join(root, 'rules'), markdown, true, true),
        ];
    return Promise.all([...new Set(paths)].map(version));
}
export async function absolutePath(path) {
    if (!isAbsolute(path))
        throw new Error('请填写 DSH 宿主机上的绝对路径。');
    return realpath(path);
}
export async function browseImport(query) {
    const selected = query.path ? await absolutePath(query.path) : homedir();
    const path = (await stat(selected)).isDirectory() ? selected : dirname(selected);
    const parent = dirname(path);
    const allowed = query.kind === 'memory' ? markdown : query.source === 'codex' ? codexLog : jsonl;
    const entries = (await readdir(path, { withFileTypes: true }))
        .filter(entry => entry.isDirectory() || (query.kind !== 'directory' && entry.isFile() && allowed.test(entry.name)))
        .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    return {
        path, parent: parent === path ? null : parent, truncated: entries.length > 500,
        entries: entries.slice(0, 500).map(entry => ({
            name: entry.name, path: join(path, entry.name), kind: entry.isDirectory() ? 'directory' : 'file',
        })),
    };
}
async function files(root, extension, recursive, optional = false) {
    const found = [];
    const pending = [root];
    let inspected = 0;
    while (pending.length) {
        const dir = pending.pop();
        const entries = await readdir(dir, { withFileTypes: true }).catch(error => {
            if (optional && missing(error))
                return [];
            throw error;
        });
        inspected += entries.length;
        if (inspected > maxScan)
            throw new Error('扫描范围超过 20,000 项，请缩小源目录。');
        for (const entry of entries) {
            if (entry.isSymbolicLink())
                continue;
            const path = join(dir, entry.name);
            if (entry.isDirectory() && recursive)
                pending.push(path);
            if (entry.isFile() && extension.test(entry.name))
                found.push(path);
        }
    }
    return found.sort();
}
async function catalogFiles(root, source, standard, extension, custom) {
    const native = (await Promise.all(standard.map(name => files(join(root, name), extension, true, true)))).flat();
    if (!custom || native.length)
        return native;
    const data = await sessionBridgeDataRoot(root);
    const devices = join(data, 'devices');
    const profiles = await readdir(devices, { withFileTypes: true }).catch(error => {
        if (missing(error))
            return [];
        throw error;
    });
    const bridgeRoots = [data, ...profiles.filter(profile => profile.isDirectory()).map(profile => join(devices, profile.name))]
        .map(base => join(base, 'raw', source));
    const bridge = (await Promise.all(bridgeRoots.map(path => files(path, extension, true, true)))).flat();
    if (bridge.length) {
        const seen = new Set();
        return bridge.filter(path => {
            const name = basename(path).toLowerCase();
            if (!/^[a-f\d]{64}\.jsonl(?:\.zst)?$/.test(name))
                return true;
            if (seen.has(name))
                return false;
            seen.add(name);
            return true;
        });
    }
    return files(root, extension, true);
}
function rows(text, strict) {
    const parsed = [];
    let damaged = 0;
    for (const line of text.split(/\r?\n/)) {
        if (!line.trim())
            continue;
        try {
            const value = JSON.parse(line.replace(/^\uFEFF/, ''));
            if (!value || typeof value !== 'object' || Array.isArray(value))
                throw new Error('invalid row');
            parsed.push(record(value));
        }
        catch {
            if (strict)
                damaged++;
        }
    }
    return { parsed, damaged };
}
function metadata(source, parsed, file) {
    if (source === 'codex') {
        const item = parsed.find(row => row.type === 'session_meta');
        const payload = record(item?.payload);
        const meta = payload.meta ? record(payload.meta) : payload;
        const id = string(meta.id || meta.session_id);
        if (!uuid.test(id))
            return;
        return { id: id.toLowerCase(), cwd: string(meta.cwd), timestamp: string(meta.timestamp || item?.timestamp) };
    }
    const fileId = basename(file, '.jsonl').toLowerCase();
    const messages = parsed.filter(row => (row.type === 'user' || row.type === 'assistant') && uuid.test(string(row.sessionId)));
    const item = messages.find(row => string(row.sessionId).toLowerCase() === fileId) ?? messages[0];
    if (!item)
        return;
    const id = string(item.sessionId).toLowerCase();
    const own = messages.filter(row => string(row.sessionId).toLowerCase() === id);
    const cwd = string(own.find(row => row.cwd)?.cwd);
    const catalogTitle = string(parsed.findLast(row => row.type === 'custom-title' && string(row.sessionId).toLowerCase() === id)?.customTitle)
        .trim().slice(0, 160);
    return { id, cwd, timestamp: string(item.timestamp), catalogTitle, sidechain: own.every(row => row.isSidechain === true) };
}
// Codex records companion-page state as user-role input even when no page
// was selected. Strip leading envelopes without discarding any prompt after them.
const codexPageMetadata = /^(?:\s*<(external_codex_apps_(?:open_page|selected_page_part_\d+_of_\d+))>[\s\S]*?<\/\1>)+\s*/i;
function plainText(content, stripPageMetadata) {
    const clean = (text) => stripPageMetadata ? text.replace(codexPageMetadata, '') : text;
    if (typeof content === 'string')
        return clean(content);
    if (!Array.isArray(content))
        return '';
    return clean(content.map(record).filter(block => ['text', 'input_text', 'output_text'].includes(string(block.type)))
        .map(block => clean(string(block.text))).filter(Boolean).join('\n'));
}
function claudeBranch(parsed, id) {
    const messages = parsed.filter(row => string(row.sessionId).toLowerCase() === id && row.isSidechain !== true);
    const byId = new Map(messages.filter(row => typeof row.uuid === 'string').map(row => [row.uuid, row]));
    let last = messages.findLast(row => row.type === 'user' || row.type === 'assistant');
    if (!last || !Object.hasOwn(last, 'parentUuid'))
        return messages;
    const chain = [];
    const seen = new Set();
    while (last && !seen.has(last)) {
        seen.add(last);
        chain.push(last);
        if (last.parentUuid == null)
            return chain.reverse();
        last = byId.get(last.parentUuid);
    }
    // Partial exports can omit ancestors. Keep their available message order.
    return messages;
}
function transcript(source, parsed, id) {
    const result = [];
    const visible = source === 'claude' ? claudeBranch(parsed, id) : parsed.filter(row => row.type === 'response_item');
    for (const row of visible) {
        if (source === 'claude' && (row.isMeta === true || row.isCompactSummary === true || row.isVisibleInTranscriptOnly === true))
            continue;
        const message = record(source === 'claude' ? row.message : row.payload);
        if (source === 'codex' && message.type !== 'message')
            continue;
        const role = message.role;
        if (role !== 'assistant' && role !== 'user')
            continue;
        const text = plainText(message.content, source === 'codex' && role === 'user');
        if (!text.trim())
            continue;
        if (role === 'user' && /^\s*(?:# AGENTS\.md instructions for\b|<environment_context>|<user_instructions>|<local-command-caveat>|<command-name>|<system-reminder>)/i.test(text))
            continue;
        result.push({ role, text, time: string(row.timestamp) });
    }
    return result;
}
async function version(path) {
    const info = await lstat(path);
    if (!info.isFile())
        throw new Error('来源必须是普通文件。');
    return { path, size: info.size, updated: info.mtimeMs };
}
export async function readVersion(file, max) {
    const env_1 = { stack: [], error: void 0, hasError: false };
    try {
        if (file.size > max)
            throw new Error(`文件超过 ${max / 1024 / 1024} MiB：${basename(file.path)}`);
        const handle = __addDisposableResource(env_1, await open(file.path, 'r'), true);
        const before = await handle.stat();
        if (!before.isFile() || before.size !== file.size || before.mtimeMs !== file.updated)
            throw new Error('预览后来源已变化，请重新预览。');
        const data = Buffer.alloc(file.size);
        let offset = 0;
        while (offset < data.length) {
            const { bytesRead } = await handle.read(data, offset, data.length - offset, offset);
            if (!bytesRead)
                throw new Error('读取时来源已变化，请重新预览。');
            offset += bytesRead;
        }
        const after = await handle.stat();
        if (after.size !== before.size || after.mtimeMs !== before.mtimeMs)
            throw new Error('读取时来源已变化，请重新预览。');
        return data;
    }
    catch (e_1) {
        env_1.error = e_1;
        env_1.hasError = true;
    }
    finally {
        const result_1 = __disposeResources(env_1);
        if (result_1)
            await result_1;
    }
}
async function decodeLog(raw, path) {
    if (!compressed(path))
        return raw;
    const chunks = [];
    for await (const frame of decodeImportFrames(raw, maxLogBytes))
        chunks.push(frame);
    return Buffer.concat(chunks);
}
export function importTitle(source, id, messages) {
    const excerpt = messages.find(message => message.role === 'user')?.text.replace(/\s+/g, ' ').trim().slice(0, 64);
    return { title: `${source === 'claude' ? 'Claude' : 'Codex'} · ${excerpt || id}`, hasPrompt: !!excerpt };
}
function previewRecord(source, file, parsed, indexed) {
    const meta = metadata(source, parsed, file.path);
    if (!meta)
        return;
    const identity = { ...file, sourceId: meta.id, cwd: meta.cwd, timestamp: meta.timestamp,
        catalogTitle: meta.catalogTitle, sidechain: meta.sidechain };
    const title = indexed?.get(meta.id);
    if (title)
        return { hasPrompt: true, candidate: { ...identity, title, resolveTitle: true } };
    const heading = importTitle(source, meta.id, transcript(source, parsed, meta.id));
    return { hasPrompt: heading.hasPrompt, candidate: { ...identity, title: heading.title } };
}
async function inspect(source, file, project, indexed) {
    const env_2 = { stack: [], error: void 0, hasError: false };
    try {
        if (compressed(file.path)) {
            const probeFrames = async (raw, complete) => {
                const chunks = [];
                let size = 0;
                let probeAt = 0;
                for await (const frame of decodeImportFrames(raw, maxLogBytes)) {
                    chunks.push(frame);
                    size += frame.length;
                    if (size < probeAt)
                        continue;
                    probeAt = Math.max(4096, size * 2);
                    const probe = previewRecord(source, file, rows(Buffer.concat(chunks, size).toString('utf8'), false).parsed, indexed);
                    if (probe && project && (!isAbsolute(probe.candidate.cwd) || !within(project, probe.candidate.cwd)))
                        return probe.candidate;
                    if (probe?.hasPrompt)
                        return probe.candidate;
                }
                const last = previewRecord(source, file, rows(Buffer.concat(chunks, size).toString('utf8'), false).parsed, indexed);
                if (complete || last?.hasPrompt)
                    return last?.candidate;
            };
            const prefixSize = 64 * 1024;
            if (file.size > prefixSize) {
                const env_3 = { stack: [], error: void 0, hasError: false };
                try {
                    // Rollouts usually put metadata and the first prompt in early frames.
                    // Only read the full file when the prefix ends before those frames.
                    const handle = __addDisposableResource(env_3, await open(file.path, 'r'), true);
                    const prefix = Buffer.alloc(prefixSize);
                    const { bytesRead } = await handle.read(prefix, 0, prefixSize, 0);
                    const preview = await probeFrames(prefix.subarray(0, bytesRead), false).catch(() => undefined);
                    if (preview)
                        return preview;
                }
                catch (e_2) {
                    env_3.error = e_2;
                    env_3.hasError = true;
                }
                finally {
                    const result_2 = __disposeResources(env_3);
                    if (result_2)
                        await result_2;
                }
            }
            return probeFrames(await readVersion(file, maxLogBytes), true);
        }
        const handle = __addDisposableResource(env_2, await open(file.path, 'r'), true);
        const buffer = Buffer.alloc(Math.min(file.size, 256 * 1024));
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        const { parsed } = rows(buffer.subarray(0, bytesRead).toString('utf8'), false);
        let probe = previewRecord(source, file, parsed, indexed);
        if (probe && !probe.hasPrompt && source === 'codex' && file.size > bytesRead) {
            const raw = await readVersion(file, maxLogBytes);
            probe = previewRecord(source, file, rows(raw.toString('utf8'), false).parsed, indexed);
        }
        return probe?.candidate;
    }
    catch (e_3) {
        env_2.error = e_3;
        env_2.hasError = true;
    }
    finally {
        const result_3 = __disposeResources(env_2);
        if (result_3)
            await result_3;
    }
}
async function explicitMemory(path) {
    if (!path)
        return [];
    const resolved = await absolutePath(path);
    if ((await stat(resolved)).isDirectory())
        return files(resolved, markdown, true);
    if (!markdown.test(resolved))
        throw new Error('记忆来源需为 Markdown 文件或目录。');
    return [resolved];
}
export async function scanImport(query, snapshot, wanted) {
    const root = query.home ? await absolutePath(query.home) : importHome(query.source);
    const catalog = query.scope === 'catalog';
    if (!catalog && !query.target)
        throw new Error('请选择导入位置。');
    const oneId = query.scope === 'session' && uuid.test(query.target) ? query.target.toLowerCase() : undefined;
    const target = oneId || catalog ? undefined : await absolutePath(query.target);
    const workspace = query.cwd ? await absolutePath(query.cwd) : undefined;
    if (workspace && !(await stat(workspace)).isDirectory())
        throw new Error('续聊工作目录必须是目录。');
    if (query.scope === 'project' && !(await stat(target)).isDirectory())
        throw new Error('项目路径必须是目录。');
    const standard = query.source === 'codex' ? ['sessions', 'archived_sessions'] : ['projects'];
    const extension = query.source === 'codex' ? codexLog : jsonl;
    let paths = [];
    if (snapshot) {
        // Pagination keeps the initial file order even while the source app writes new logs.
    }
    else if (query.scope === 'session' && !oneId) {
        if (!extension.test(target))
            throw new Error(query.source === 'codex'
                ? '请选择 .jsonl 或 .jsonl.zst 原档，或输入完整会话 ID。' : '请选择原始 JSONL 文件或输入完整会话 ID。');
        paths = [target];
    }
    else if (query.scope === 'directory') {
        const roots = await Promise.all(standard.map(name => files(join(target, name), extension, true, true)));
        paths = roots.some(list => list.length) ? roots.flat() : await files(target, extension, true);
    }
    else if (catalog) {
        paths = await catalogFiles(root, query.source, standard, extension, !!query.home);
    }
    else {
        paths = (await Promise.all(standard.map(name => files(join(root, name), extension, true, true)))).flat();
        if (oneId) {
            const named = paths.filter(path => basename(path).toLowerCase().includes(oneId));
            if (named.length)
                paths = named;
        }
    }
    const explicit = await explicitMemory(query.memory);
    const memoryRoots = [...new Set(query.scope === 'directory' ? [target, root] : [root])];
    const codexMemory = query.source === 'codex' && query.includeAutomaticMemory !== false
        ? await Promise.all(memoryRoots.flatMap(memoryRoot => ['memories', 'memories_v2'].map(async (name) => {
            const base = join(memoryRoot, name);
            const summaries = await files(join(base, 'rollout_summaries'), markdown, false, true);
            const global = query.includeGlobalMemory ? (await files(base, markdown, false, true)).filter(path => /^(MEMORY|memory_summary|raw_memories)\.md$/i.test(basename(path))) : [];
            return { summaries, global };
        }))) : [];
    const warnings = [];
    const describeCatalog = catalog ? await catalogMetadata(root, query.source) : undefined;
    const [desktop, bridge] = catalog && query.source === 'claude'
        ? await Promise.all([claudeDesktopSessions(), query.home ? bridgeClaudeTree(root) : new Map()])
        : [[], new Map()];
    const desktopById = new Map(desktop.map(row => [row.sourceId, row]));
    const relations = new Map([...bridge].filter(([, row]) => row.parent));
    for (const row of desktop)
        if (row.parent)
            relations.set(row.sourceId, { ...relations.get(row.sourceId), parent: row.parent, title: row.title });
    const describe = describeCatalog && ((file) => {
        const info = describeCatalog.describe(file);
        return { ...info, ...(file.parent ? { parent: file.parent } : {}), ...(file.project ? { project: file.project } : {}),
            displayTitle: desktopById.get(file.sourceId)?.title || file.catalogTitle || info.displayTitle };
    });
    const candidates = new Map();
    const memoryByDir = new Map();
    let unknown = 0;
    let unreadable = 0;
    const ordered = snapshot ?? (catalog ? (await Promise.all(paths.map(path => version(path).catch(error => {
        if (missing(error))
            return null;
        throw error;
    })))).filter(input => input !== null).sort((a, b) => b.updated - a.updated || a.path.localeCompare(b.path)) : undefined);
    const inputs = ordered ?? paths;
    const paged = catalog && query.catalogOffset !== undefined;
    const start = paged ? query.catalogOffset : 0;
    const deadline = Date.now() + 6000;
    let nextOffset;
    const inspectEntry = async (entry) => {
        const path = typeof entry === 'string' ? entry : entry.path;
        // Claude subagent files share the parent's session id.
        if (query.scope !== 'session' && query.source === 'claude' && /^agent-/i.test(basename(path)))
            return null;
        const input = typeof entry === 'string' ? await version(path) : entry;
        if (input.size > maxLogBytes) {
            if (!catalog)
                warnings.push(`${basename(path)} 超过 64 MiB，已跳过。`);
            else
                unreadable++;
            return null;
        }
        return inspect(query.source, input, query.scope === 'project' ? target : undefined, paged ? describeCatalog?.titles : undefined).catch(error => {
            if (!catalog && (!compressed(path) || (query.scope === 'session' && !oneId)))
                throw error;
            unreadable++;
            return null;
        });
    };
    let batch = [];
    for (let index = start; index < inputs.length; index++) {
        if (!wanted && paged && (candidates.size >= 120 || index > start && !batch.length && (index - start >= 1000 || Date.now() >= deadline))) {
            nextOffset = index;
            break;
        }
        if (!batch.length)
            batch = await Promise.all(inputs.slice(index, index + (paged ? 6 : 1)).map(inspectEntry));
        const file = batch.shift();
        if (file === null)
            continue;
        if (!file) {
            unknown++;
            continue;
        }
        if (wanted && !wanted.has(file.sourceId))
            continue;
        if (catalog && file.sidechain)
            continue;
        if (oneId && file.sourceId !== oneId)
            continue;
        if (query.scope === 'project' && (!isAbsolute(file.cwd) || !within(target, file.cwd)))
            continue;
        if ((candidates.get(file.sourceId)?.updated ?? -1) >= file.updated)
            continue;
        if (!wanted && catalog && candidates.size >= 500) {
            warnings.push('显示最近 500 条。更早的会话可按项目或原档查找。');
            break;
        }
        const automatic = [];
        if (query.source === 'claude' && query.includeAutomaticMemory !== false) {
            const dir = dirname(file.path);
            if (!memoryByDir.has(dir))
                memoryByDir.set(dir, files(join(dir, 'memory'), markdown, true, true));
            automatic.push(...await memoryByDir.get(dir));
        }
        else if (query.source === 'codex') {
            for (const { summaries, global } of codexMemory) {
                automatic.push(...summaries.filter(summary => basename(summary).toLowerCase().includes(file.sourceId)), ...global);
            }
        }
        const memory = await Promise.all([...new Set([...automatic, ...explicit])].map(version));
        const placement = bridge.get(file.sourceId);
        const parent = desktopById.get(file.sourceId)?.parent ?? placement?.parent;
        candidates.set(file.sourceId, { ...file, projectRoots: describeCatalog?.projectRoots(file),
            ...(placement?.project ? { project: placement.project } : {}),
            ...(parent ? { parent } : {}), memory });
    }
    if (unknown)
        warnings.push(`${unknown} 个记录文件未识别为所选来源的会话。`);
    if (unreadable)
        warnings.push(`${unreadable} 个${catalog ? '原档无法读取或过大。' : '压缩原档无法读取。可按文件单独预览以查看原因。'}`);
    const all = [...candidates.values()].sort((a, b) => b.updated - a.updated);
    if (all.length > 500)
        warnings.push('仅预览最近 500 条，请用更小的目录、项目或会话 ID 查找其余记录。');
    // An index entry can match an older log. Wait for the last page before
    // classifying any entry as missing, and let the client exclude loaded IDs.
    const unavailable = nextOffset === undefined && !query.home ? desktop.filter(row => !candidates.has(row.sourceId)) : [];
    return { candidates: wanted ? all : all.slice(0, 500), warnings, workspace, describe, nextOffset, unavailable, root,
        snapshot: ordered, relations };
}
export async function readTranscript(source, candidate) {
    const raw = await readVersion(candidate, maxLogBytes);
    const { parsed, damaged } = rows((await decodeLog(raw, candidate.path)).toString('utf8'), true);
    const meta = metadata(source, parsed, candidate.path);
    if (meta?.id !== candidate.sourceId)
        throw new Error('来源与预览不符，请重新预览。');
    return { raw, messages: transcript(source, parsed, meta.id), damaged };
}
