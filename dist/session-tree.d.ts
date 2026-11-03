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
    hiddenSessions: Set<string>;
    rows: Set<NativeRow>;
    problem: string;
    loaded: boolean;
    refreshing: boolean;
    expansion: Map<string, boolean>;
    aliases: Map<string, string>;
}
interface ExpansionStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
export declare function createSessionTreeStore(api: TreeApi, storage?: ExpansionStorage | undefined): {
    getSnapshot: () => Snapshot;
    refresh: () => Promise<void>;
    isExpanded: (id: string) => boolean;
    setAlias: (id: string, name: string) => void;
    toggle: (id: string) => void;
    reveal: (id: string | undefined, force?: boolean) => void;
    subscribe: (listener: () => void) => () => void;
    attach: (target: NativeRow) => () => void;
    dispose: () => void;
};
export type TreeStore = ReturnType<typeof createSessionTreeStore>;
export interface TreeStatus {
    running?: boolean;
    pendingInteraction?: {
        kind: string;
    } | null;
}
export interface NativeTreeProps {
    sessionId: string;
    store: TreeStore;
    openSession(session: TreeSession): void;
    currentId?: string;
    statuses?: ReadonlyMap<string, TreeStatus>;
    pinnedIds?: ReadonlySet<string>;
    renderActions?(session: TreeSession): React.ReactNode;
}
export declare function treePresentation(child: TreeSession, status?: TreeStatus, alias?: string): {
    label: string;
    state: string;
    waiting: boolean;
    title: string;
};
export declare function NativeSessionChildren({ sessionId, store, openSession, currentId, statuses, pinnedIds, renderActions }: NativeTreeProps): React.JSX.Element;
export {};
