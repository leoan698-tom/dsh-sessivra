import { z } from 'zod';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';

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
export type ImportBrowse = z.infer<typeof importBrowse>;
export const importFileChoice = importBrowse.extend({ kind: z.enum(['session', 'memory']) });
export type ImportFileChoice = z.infer<typeof importFileChoice>;
export interface ImportListing {
  path: string;
  parent: string | null;
  entries: { name: string; path: string; kind: 'file' | 'directory' }[];
  truncated: boolean;
}
export const importSelection = z.array(importToken).min(1).max(20);
export const importedId = z.string().regex(/^sessivra-import-[a-f0-9]{32}$/);
export type ImportQuery = z.infer<typeof importQuery>;
export type ImportSource = ImportQuery['source'];

export interface ImportSessionParent { sourceId: string; title: string }
export interface ImportSessionPlacement {
  project?: { key: string; name: string };
  parent?: ImportSessionParent;
}
export interface ImportCatalogRelation extends ImportSessionPlacement {
  title?: string;
  archiveNames?: string[];
}
export interface ImportUnavailable extends ImportSessionPlacement {
  sourceId: string;
  title: string;
  updated: number;
}
export interface ImportCandidate extends ImportSessionPlacement {
  key: string;
  sourceId: string;
  file: string;
  title: string;
  displayTitle?: string;
  cwd: string | null;
  size: number;
  updated: number;
  memory: string[];
}
export interface ImportPreview {
  token: string;
  rows: ImportCandidate[];
  warnings: string[];
  nextOffset?: number;
  unavailable?: ImportUnavailable[];
}
export interface ImportedFile {
  name: string;
  size: number;
  offset: number;
  chunks: number;
}
export interface ImportedSession {
  key: string;
  id: string;
  title: string;
  files: ImportedFile[];
  status: 'imported' | 'existing';
  projectedMessages: number;
  limited: boolean;
  parentId?: string;
  rootKey?: string;
}
export interface ImportBatch {
  sessions: ImportedSession[];
  failures: { key: string; message: string; title?: string }[];
}
export interface ImportJob {
  phase: 'discovering' | 'importing' | 'done' | 'failed';
  completed: number;
  total: number;
  title?: string;
  result?: ImportBatch;
  error?: string;
}
export interface ImportApi {
  browse(query: ImportBrowse): Promise<RemoteResult<ImportListing>>;
  pickFile(query: ImportFileChoice): Promise<RemoteResult<{ native: boolean; path: string | null }>>;
  preview(query: ImportQuery): Promise<RemoteResult<ImportPreview>>;
  commit(token: string, keys: string[]): Promise<RemoteResult<ImportBatch>>;
  commitCatalog(token: string, keys: string[], includeGlobalMemory: boolean): Promise<RemoteResult<ImportBatch>>;
  startCatalogImport(token: string, keys: string[], includeGlobalMemory: boolean): Promise<RemoteResult<string>>;
  catalogImportStatus(id: string): Promise<RemoteResult<ImportJob>>;
  archive(id: string): Promise<RemoteResult<ImportedFile[]>>;
  chunk(id: string, offset: number): Promise<RemoteResult<string>>;
}
export const importSessionPrefix = 'sessivra-import-';

export function isImportedSession(id: string) {
  return id.startsWith(importSessionPrefix) && /^[a-f0-9]{32}$/u.test(id.slice(importSessionPrefix.length));
}
