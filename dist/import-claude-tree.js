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
import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const regular = async (path) => (await lstat(path).catch(() => null))?.isFile();
export async function sessionBridgeDataRoot(root) {
    const nested = join(root, 'Data');
    return await regular(join(nested, 'sessions.sqlite')) ? nested : root;
}
export async function bridgeClaudeTree(root) {
    const tree = new Map();
    const data = await sessionBridgeDataRoot(root);
    const devices = join(data, 'devices');
    const children = await readdir(devices, { withFileTypes: true }).catch(() => []);
    const indexes = [data, ...children.filter(entry => entry.isDirectory()).map(entry => join(devices, entry.name))]
        .map(path => join(path, 'sessions.sqlite'));
    const available = (await Promise.all(indexes.map(async (path) => await regular(path) ? path : null))).filter(path => path !== null);
    if (!available.length)
        return tree;
    const { DatabaseSync } = await import('node:sqlite').catch(() => ({ DatabaseSync: undefined }));
    if (!DatabaseSync)
        return tree;
    const worktrees = new Map();
    for (const path of available) {
        try {
            const env_1 = { stack: [], error: void 0, hasError: false };
            try {
                const db = __addDisposableResource(env_1, new DatabaseSync(path, { readOnly: true }), false);
                const rows = db.prepare(`SELECT native_id, title, cwd, first_at, sha256
        FROM sessions WHERE platform = 'claude' AND present = 1 AND sidechain = 0
        AND lower(cwd) LIKE '%worktrees%' LIMIT 20000`).all();
                for (const row of rows) {
                    if (typeof row.native_id !== 'string' || !uuid.test(row.native_id) ||
                        typeof row.cwd !== 'string' || typeof row.first_at !== 'string')
                        continue;
                    const cwd = row.cwd.replace(/\\/g, '/');
                    const match = /^(.*)\/\.claude\/worktrees\/([^/]+)/i.exec(cwd);
                    const first = Date.parse(row.first_at);
                    if (!match || !Number.isFinite(first))
                        continue;
                    const [, projectPath, worktree] = match;
                    const key = (projectPath + '/' + worktree).toLowerCase();
                    const sourceId = row.native_id.toLowerCase();
                    let group = worktrees.get(key);
                    if (!group)
                        worktrees.set(key, group = {
                            project: { key: 'claude:' + projectPath.toLowerCase(), name: projectPath.split('/').at(-1) },
                            rows: new Map(),
                        });
                    const title = typeof row.title === 'string' ? row.title.trim().slice(0, 160) : '';
                    const prior = group.rows.get(sourceId);
                    const archiveNames = prior?.archiveNames ?? new Set();
                    if (typeof row.sha256 === 'string' && /^[a-f\d]{64}$/i.test(row.sha256))
                        archiveNames.add(row.sha256.toLowerCase() + '.jsonl');
                    if (!prior || first < prior.first)
                        group.rows.set(sourceId, { sourceId, title: title || '未命名会话', first, archiveNames });
                }
            }
            catch (e_1) {
                env_1.error = e_1;
                env_1.hasError = true;
            }
            finally {
                __disposeResources(env_1);
            }
        }
        catch { /* Older or incomplete indexes still leave their raw archives available. */ }
    }
    for (const { project, rows } of worktrees.values()) {
        const ordered = [...rows.values()].sort((a, b) => a.first - b.first || a.sourceId.localeCompare(b.sourceId));
        const [first, second] = ordered;
        // With no explicit fork link, only a unique oldest session can anchor a shared Claude worktree.
        for (const row of ordered)
            tree.set(row.sourceId, {
                project, title: row.title, archiveNames: [...row.archiveNames], ...(first && second && first.first < second.first && row !== first
                    ? { parent: { sourceId: first.sourceId, title: first.title } } : {}),
            });
    }
    return tree;
}
