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
interface Props {
    api: TreeApi;
    openSession(session: TreeSession): void;
    startSession(): void;
    standardList(): void;
}
export declare function SessionTree({ api, openSession, standardList }: Props): React.JSX.Element;
export {};
