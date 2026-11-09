import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client';
import { type TreeStore } from './session-tree.js';
export type MentionQuery = {
    query: string;
    quoted: boolean;
    signal: AbortSignal;
};
export type MentionRow = {
    name: string;
    value: string;
    description?: string;
    section?: string;
    icon?: 'session';
};
declare const categories: {
    sessions: string;
    bookmarks: string;
    files: string;
};
type Category = keyof typeof categories;
export declare function mentionQuery(query: string): {
    category: "sessions" | "bookmarks" | "files" | null | undefined;
    text: string;
};
export declare function compactMentions(rows: MentionRow[], category: Category, query: string): MentionRow[];
interface WorkspaceState {
    items: readonly {
        sessionIds: readonly string[];
    }[];
    pinnedSessionIds: readonly string[];
    archivedSessionIds: readonly string[];
}
type ArchiveFilter = 'default' | 'show' | 'only';
export declare function createSidebarMentionSource(sessions: Pick<ISessions, 'list'>, store: TreeStore, workspace: () => WorkspaceState, archive: () => ArchiveFilter | undefined): {
    name: string;
    trigger: string;
    order: number;
    showGroupTitle: boolean;
    candidates(session: {
        sessionId?: string;
    }, request: MentionQuery): Promise<MentionRow[]>;
    onPick({ candidate }: {
        candidate: MentionRow;
    }): {
        text: string;
        continue: boolean;
        insert?: undefined;
    } | {
        insert: {
            source: string;
            appearance: string;
            ref: string;
            label: string;
            clipboardText: string;
        };
        text?: undefined;
        continue?: undefined;
    };
};
interface NativeSource {
    name: string;
    trigger: string;
    candidates(session: unknown, request: MentionQuery): Promise<MentionRow[]>;
    header?(session: unknown, request: MentionQuery): unknown;
}
export interface MentionRegistry {
    live?: {
        sources: NativeSource[];
    };
    registerSource<T>(source: T): () => void;
}
export declare function compactNativeReferences(registry: MentionRegistry): () => void;
export {};
