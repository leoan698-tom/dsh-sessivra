import { z } from 'zod';
const path = z.string().trim().min(1).max(4096);
export const importQuery = z.object({
    source: z.enum(['claude', 'codex']),
    scope: z.enum(['catalog', 'directory', 'project', 'session']),
    target: path.optional(),
    home: path.optional(),
    cwd: path.optional(),
    memory: path.optional(),
    includeAutomaticMemory: z.boolean().optional(),
    includeGlobalMemory: z.boolean().optional(),
    catalogOffset: z.number().int().min(0).max(40_000).optional(),
    catalogToken: z.string().uuid().optional(),
}).strict().refine(query => query.scope === 'catalog' || !!query.target, { path: ['target'], message: '请选择导入位置。' });
export const importToken = z.string().uuid();
export const importBrowse = z.object({
    source: z.enum(['claude', 'codex']),
    kind: z.enum(['directory', 'session', 'memory']),
    path: path.optional(),
}).strict();
export const importFileChoice = importBrowse.extend({ kind: z.enum(['session', 'memory']) });
export const importSelection = z.array(importToken).min(1).max(20);
export const importedId = z.string().regex(/^sessivra-import-[a-f0-9]{32}$/);
export const importSessionPrefix = 'sessivra-import-';
export function isImportedSession(id) {
    return id.startsWith(importSessionPrefix) && /^[a-f0-9]{32}$/u.test(id.slice(importSessionPrefix.length));
}
