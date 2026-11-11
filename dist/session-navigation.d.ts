import React from 'react';
import type { Button as HostButton } from '@deepseek-ai/dsh-client-ui-primitives';
import type { TreeSession } from './collaboration.js';
import { treePresentation, type TreeStore } from './session-tree.js';
import type { HistoryResults, MessageLocation } from './message-history.js';
interface HistorySearchProps {
    searchHistory?(query: string): Promise<HistoryResults>;
    openMessage?(location: MessageLocation): void;
    taskAction?: {
        Button: typeof HostButton;
        open(location: MessageLocation, signal: AbortSignal): Promise<void>;
    };
    showTeam?: boolean;
}
export interface WorkspaceItem {
    workspaceId: string;
    path: string;
    sessionIds: readonly string[];
}
interface NavigationProps {
    store: TreeStore;
    openSession(session: TreeSession): void;
}
type ArchiveFilter = 'default' | 'show' | 'only';
export interface WorkspaceViewSlots {
    entriesOfSlot(name: string): readonly {
        locale?: string;
        children?: Readonly<Record<string, unknown>>;
        store?: unknown;
    }[];
    subscribe(name: string, listener: () => void): () => void;
}
export declare function createWorkspaceArchiveSource(slots: WorkspaceViewSlots): {
    getSnapshot: () => ArchiveFilter | undefined;
    subscribe: (listener: () => void) => () => void;
};
export declare function searchTeamMembers(store: TreeStore, query: string, archivedIds?: readonly string[]): {
    node: Extract<TreeSession, {
        subagent: true;
        subagentKind: 'teammate';
    }>;
    display: ReturnType<typeof treePresentation>;
    path: string;
}[];
export declare function findNativeSearch(doc: Document): {
    input: HTMLInputElement;
    workspace: HTMLElement;
    results: HTMLElement;
} | undefined;
export declare function revealNativeBranch(doc: Document, store: TreeStore, id: string, workspaces: readonly WorkspaceItem[]): () => void;
export declare function NativeTeamSearch(props: NavigationProps & HistorySearchProps & {
    useWorkspaces: <T>(selector: (snapshot: {
        items: readonly WorkspaceItem[];
        archivedSessionIds: readonly string[];
    }) => T) => T;
    useArchiveFilter: <T>(selector: (filter: ArchiveFilter | undefined) => T) => T;
}): React.JSX.Element | null;
interface ComposerOwner {
    session?: {
        running?: boolean;
        subagent?: {
            address: {
                mode: string;
                parentSessionId: string;
            };
            parentAvailable?: boolean;
        } | null;
    } | null;
}
export declare function selectParentUnavailable(owner: ComposerOwner): {
    parentId: string;
} | null;
export declare function ParentUnavailableComposer({ store, openSession, matched, Button }: NavigationProps & {
    matched: {
        parentId: string;
    };
    Button: typeof HostButton;
}): React.JSX.Element;
export {};
