import React from 'react';
import type { ImportApi, ImportBrowse } from './import-contract.js';
export declare function ImportPathPicker({ api, query, close, select }: {
    api: ImportApi;
    query: ImportBrowse;
    close(): void;
    select(path: string): void;
}): React.JSX.Element;
