import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ImportCatalogRelation, ImportSessionPlacement } from './import-contract.js';

const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const regular = async (path: string) => (await lstat(path).catch(() => null))?.isFile();

export async function sessionBridgeDataRoot(root: string) {
  const nested = join(root, 'Data');
  return await regular(join(nested, 'sessions.sqlite')) ? nested : root;
}

export async function bridgeClaudeTree(root: string) {
  const tree = new Map<string, ImportCatalogRelation>();
  const data = await sessionBridgeDataRoot(root);
  const devices = join(data, 'devices');
  const children = await readdir(devices, { withFileTypes: true }).catch(() => []);
  const indexes = [data, ...children.filter(entry => entry.isDirectory()).map(entry => join(devices, entry.name))]
    .map(path => join(path, 'sessions.sqlite'));
  const available = (await Promise.all(indexes.map(async path => await regular(path) ? path : null))).filter(path => path !== null);
  if (!available.length) return tree;
  const { DatabaseSync } = await import('node:sqlite').catch(() => ({ DatabaseSync: undefined }));
  if (!DatabaseSync) return tree;
  const worktrees = new Map<string, { project: NonNullable<ImportSessionPlacement['project']>; rows: Map<string, { sourceId: string; title: string; first: number; archiveNames: Set<string> }> }>();
  for (const path of available) {
    try {
      using db = new DatabaseSync(path, { readOnly: true });
      const rows = db.prepare(`SELECT native_id, title, cwd, first_at, sha256
        FROM sessions WHERE platform = 'claude' AND present = 1 AND sidechain = 0
        AND lower(cwd) LIKE '%worktrees%' LIMIT 20000`).all();
      for (const row of rows) {
        if (typeof row.native_id !== 'string' || !uuid.test(row.native_id) ||
          typeof row.cwd !== 'string' || typeof row.first_at !== 'string') continue;
        const cwd = row.cwd.replace(/\\/g, '/');
        const match = /^(.*)\/\.claude\/worktrees\/([^/]+)/i.exec(cwd);
        const first = Date.parse(row.first_at);
        if (!match || !Number.isFinite(first)) continue;
        const [, projectPath, worktree] = match;
        const key = (projectPath + '/' + worktree).toLowerCase();
        const sourceId = row.native_id.toLowerCase();
        let group = worktrees.get(key);
        if (!group) worktrees.set(key, group = {
          project: { key: 'claude:' + projectPath!.toLowerCase(), name: projectPath!.split('/').at(-1)! },
          rows: new Map(),
        });
        const title = typeof row.title === 'string' ? row.title.trim().slice(0, 160) : '';
        const prior = group.rows.get(sourceId);
        const archiveNames = prior?.archiveNames ?? new Set<string>();
        if (typeof row.sha256 === 'string' && /^[a-f\d]{64}$/i.test(row.sha256)) archiveNames.add(row.sha256.toLowerCase() + '.jsonl');
        if (!prior || first < prior.first) group.rows.set(sourceId, { sourceId, title: title || '未命名会话', first, archiveNames });
      }
    } catch { /* Older or incomplete indexes still leave their raw archives available. */ }
  }
  for (const { project, rows } of worktrees.values()) {
    const ordered = [...rows.values()].sort((a, b) => a.first - b.first || a.sourceId.localeCompare(b.sourceId));
    const [first, second] = ordered;
    // With no explicit fork link, only a unique oldest session can anchor a shared Claude worktree.
    for (const row of ordered) tree.set(row.sourceId, {
      project, title: row.title, archiveNames: [...row.archiveNames], ...(first && second && first.first < second.first && row !== first
        ? { parent: { sourceId: first.sourceId, title: first.title } } : {}),
    });
  }
  return tree;
}
