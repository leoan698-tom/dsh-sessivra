import type { ImportFileChoice } from './import-contract.js';
export declare function pickImportFile(query: ImportFileChoice, signal: AbortSignal | undefined): Promise<string | null>;
