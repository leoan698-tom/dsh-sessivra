import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ImportBatch, ImportBrowse, ImportFileChoice, ImportJob, ImportPreview, ImportQuery, ImportedFile } from './import-contract.js';
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        'sessivra-import-memory': {
            kind: 'sessivra-import-memory';
            form: 'recall';
        };
    }
}
export declare class SessionImport extends TypertRemoteService {
    private linkImported;
    private previews;
    private readonly operation;
    private readonly jobs;
    private readonly fileDialog;
    private download?;
    private loading;
    constructor(ctx: Context, linkImported: (id: string, parentId: string, title: string) => Promise<void>);
    private owner;
    private persistence;
    preview(query: ImportQuery): Promise<ImportPreview>;
    browse(browse: ImportBrowse): Promise<import("./import-contract.js").ImportListing>;
    pickFile(query: ImportFileChoice): Promise<{
        native: boolean;
        path: string | null;
    }>;
    commit(token: string, keys: string[]): Promise<ImportBatch>;
    commitCatalog(token: string, keys: string[], includeGlobalMemory: boolean): Promise<ImportBatch>;
    startCatalogImport(token: string, keys: string[], includeGlobalMemory: boolean): Promise<`${string}-${string}-${string}-${string}-${string}`>;
    catalogImportStatus(id: string): Promise<ImportJob>;
    private family;
    private commitSelection;
    private importOne;
    private completed;
    private result;
    archive(id: string): Promise<ImportedFile[]>;
    chunk(id: string, offset: number): Promise<string>;
    private loadArchive;
}
