import React from 'react';
import type { ImportApi, ImportPreview, ImportSource } from './import-contract.js';
export declare function createImportCatalogState(): {
    source: ImportSource;
    folders: Partial<Record<ImportSource, string>>;
    pages: Map<string, {
        page?: ImportPreview;
        updated: number;
        pending?: Promise<ImportPreview>;
    }>;
    jobs: Map<string, {
        id: string;
        selected: string[];
    }>;
};
export declare function ImportPanel({ api, open, archiveId, back, catalog, pickDirectory }: {
    api: ImportApi;
    open(id: string): Promise<void>;
    archiveId?: string;
    back(): void;
    catalog: ReturnType<typeof createImportCatalogState>;
    pickDirectory?(): Promise<string | null>;
}): React.JSX.Element;
