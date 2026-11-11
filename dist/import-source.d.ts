import type { ImportBrowse, ImportCatalogRelation, ImportListing, ImportQuery, ImportSessionPlacement, ImportSource } from './import-contract.js';
export declare const maxLogBytes: number;
export declare const maxMemoryBytes: number;
type Row = Record<string, unknown>;
export declare function importHome(source: ImportSource): string;
export declare function globalImportMemory(root: string, source: ImportSource): Promise<FileVersion[]>;
export declare function absolutePath(path: string): Promise<string>;
export declare function browseImport(query: ImportBrowse): Promise<ImportListing>;
declare function transcript(source: ImportSource, parsed: Row[], id: string): {
    role: "user" | "assistant";
    text: string;
    time: string;
}[];
export interface FileVersion {
    path: string;
    size: number;
    updated: number;
}
export interface SourceCandidate extends FileVersion, ImportSessionPlacement {
    sourceId: string;
    title: string;
    cwd: string;
    timestamp: string;
    memory: FileVersion[];
    resolveTitle?: boolean;
    catalogTitle?: string;
    sidechain?: boolean;
    projectRoots?: string[];
}
export declare function readVersion(file: FileVersion, max: number): Promise<Buffer<ArrayBuffer>>;
export declare function importTitle(source: ImportSource, id: string, messages: ReturnType<typeof transcript>): {
    title: string;
    hasPrompt: boolean;
};
export declare function scanImport(query: ImportQuery, snapshot?: FileVersion[], wanted?: ReadonlySet<string>): Promise<{
    candidates: SourceCandidate[];
    warnings: string[];
    workspace: string | undefined;
    describe: ((file: SourceCandidate) => {
        displayTitle: string;
        project?: {
            key: string;
            name: string;
        } | undefined;
        parent?: import("./import-contract.js").ImportSessionParent | undefined;
    }) | undefined;
    nextOffset: number | undefined;
    unavailable: {
        parent?: {
            sourceId: string;
            title: string;
        } | undefined;
        sourceId: string;
        title: string;
        updated: number;
    }[];
    root: string;
    snapshot: FileVersion[] | undefined;
    relations: Map<string, ImportCatalogRelation>;
}>;
export declare function readTranscript(source: ImportSource, candidate: SourceCandidate): Promise<{
    raw: Buffer<ArrayBuffer>;
    messages: {
        role: "user" | "assistant";
        text: string;
        time: string;
    }[];
    damaged: number;
}>;
export {};
