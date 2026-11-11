import { z } from 'zod';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
export declare const importQuery: z.ZodObject<{
    source: z.ZodEnum<{
        claude: "claude";
        codex: "codex";
    }>;
    scope: z.ZodEnum<{
        session: "session";
        catalog: "catalog";
        directory: "directory";
        project: "project";
    }>;
    target: z.ZodOptional<z.ZodString>;
    home: z.ZodOptional<z.ZodString>;
    cwd: z.ZodOptional<z.ZodString>;
    memory: z.ZodOptional<z.ZodString>;
    includeAutomaticMemory: z.ZodOptional<z.ZodBoolean>;
    includeGlobalMemory: z.ZodOptional<z.ZodBoolean>;
    catalogOffset: z.ZodOptional<z.ZodNumber>;
    catalogToken: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const importToken: z.ZodString;
export declare const importBrowse: z.ZodObject<{
    source: z.ZodEnum<{
        claude: "claude";
        codex: "codex";
    }>;
    kind: z.ZodEnum<{
        session: "session";
        directory: "directory";
        memory: "memory";
    }>;
    path: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type ImportBrowse = z.infer<typeof importBrowse>;
export declare const importFileChoice: z.ZodObject<{
    source: z.ZodEnum<{
        claude: "claude";
        codex: "codex";
    }>;
    path: z.ZodOptional<z.ZodString>;
    kind: z.ZodEnum<{
        session: "session";
        memory: "memory";
    }>;
}, z.core.$strict>;
export type ImportFileChoice = z.infer<typeof importFileChoice>;
export interface ImportListing {
    path: string;
    parent: string | null;
    entries: {
        name: string;
        path: string;
        kind: 'file' | 'directory';
    }[];
    truncated: boolean;
}
export declare const importSelection: z.ZodArray<z.ZodString>;
export declare const importedId: z.ZodString;
export type ImportQuery = z.infer<typeof importQuery>;
export type ImportSource = ImportQuery['source'];
export interface ImportSessionParent {
    sourceId: string;
    title: string;
}
export interface ImportSessionPlacement {
    project?: {
        key: string;
        name: string;
    };
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
    failures: {
        key: string;
        message: string;
        title?: string;
    }[];
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
    pickFile(query: ImportFileChoice): Promise<RemoteResult<{
        native: boolean;
        path: string | null;
    }>>;
    preview(query: ImportQuery): Promise<RemoteResult<ImportPreview>>;
    commit(token: string, keys: string[]): Promise<RemoteResult<ImportBatch>>;
    commitCatalog(token: string, keys: string[], includeGlobalMemory: boolean): Promise<RemoteResult<ImportBatch>>;
    startCatalogImport(token: string, keys: string[], includeGlobalMemory: boolean): Promise<RemoteResult<string>>;
    catalogImportStatus(id: string): Promise<RemoteResult<ImportJob>>;
    archive(id: string): Promise<RemoteResult<ImportedFile[]>>;
    chunk(id: string, offset: number): Promise<RemoteResult<string>>;
}
export declare const importSessionPrefix = "sessivra-import-";
export declare function isImportedSession(id: string): boolean;
