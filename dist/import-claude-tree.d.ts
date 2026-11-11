import type { ImportCatalogRelation } from './import-contract.js';
export declare function sessionBridgeDataRoot(root: string): Promise<string>;
export declare function bridgeClaudeTree(root: string): Promise<Map<string, ImportCatalogRelation>>;
