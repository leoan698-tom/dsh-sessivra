import React from 'react';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { TreeSession } from './collaboration.js';
import type { SessionCandidate } from './recipient-source.js';
export type TreeNode = TreeSession & {
    children: TreeNode[];
};
export declare function sessionForest(sessions: TreeSession[]): TreeNode[];
export interface TreeApi {
    tree(): Promise<RemoteResult<TreeSession[]>>;
    candidates(sourceId: string, query: string): Promise<RemoteResult<SessionCandidate[]>>;
}
interface NativeRow {
    sessionId: string;
    row: HTMLElement;
    children: HTMLElement;
}
interface Snapshot {
    nodes: Map<string, TreeNode>;
    parents: Map<string, string>;
    rows: Set<NativeRow>;
    problem: string;
}
export declare function createSessionTreeStore(api: TreeApi): {
    getSnapshot: () => Snapshot;
    subscribe: (listener: () => void) => () => void;
    attach: (target: NativeRow) => () => void;
    dispose: () => void;
};
type TreeStore = ReturnType<typeof createSessionTreeStore>;
interface Props {
    sessionId: string;
    store: TreeStore;
    openSession(session: TreeSession): void;
}
export declare function NativeSessionChildren({ sessionId, store, openSession }: Props): React.JSX.Element;
export {};
