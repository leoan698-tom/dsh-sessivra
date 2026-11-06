import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { SessionCandidate } from './recipient-source.js';
import type { Messenger } from './core.js';
import type { ConversationRelations } from './schemas.js';
interface TreeSessionBase {
    id: string;
    parentId?: string;
    workspace: string | null;
    label: string;
    running: boolean;
    task?: {
        id: string;
        title: string;
        status: string;
        label: string;
        revision: number;
        appliedRevision: number;
        pendingUpdate: boolean;
        queued: number;
        updatedAt: number;
    };
}
export type TreeSession = TreeSessionBase & ({
    subagent: false;
} | ({
    subagent: true;
    parentId: string;
    description?: string;
    childWorkspace?: string | null;
    subagentMode: 'continuable' | 'one-shot' | 'external' | 'unknown';
    openable: boolean;
    canMessage: boolean;
    parentAvailable?: boolean;
    note?: string;
} & ({
    subagentKind: 'teammate';
    teammateName: string;
} | {
    subagentKind: 'standalone' | 'unknown';
})));
/** Public rc.5 Session-list projections used for navigation, never Team mutation. */
export interface TreeSessionProjections {
    title?: string | null;
    subagent?: {
        label?: string;
        mode?: string;
    } | null;
    subagentCatalog?: {
        id: string;
        label?: string;
        mode: string;
    }[];
    agentTeam?: {
        members: {
            id: string;
            name: string;
            role: string;
            phase: string;
        }[];
        failure?: string;
    } | null;
}
export interface TreeSessionSummary {
    sessionId: string;
    parentSessionId?: string;
    cwd?: string;
    running: boolean;
    agentAvailable?: boolean;
    blank?: boolean;
    origin?: 'subagent';
    delegationDepth?: number;
    projections?: {
        values: TreeSessionProjections;
    };
}
interface RelationsStore {
    read(): ConversationRelations;
    write(relations: ConversationRelations): Promise<void>;
}
/** Display discovery is broader than navigation and messaging capabilities. */
export declare class Collaboration extends TypertRemoteService {
    private messenger;
    private relations;
    private tail;
    taskSummary?: (id: string) => TreeSessionBase['task'];
    constructor(ctx: Context, messenger: Messenger, relations: RelationsStore);
    tree(): Promise<TreeSession[]>;
    private treeProjections;
    candidates(sourceId: string, query: string): Promise<SessionCandidate[]>;
    createChild(parent: Agent, input: {
        label: string;
        prompt: string;
        cwd?: string;
        reasoningEffort?: string;
        requestId?: string;
    }, signal: AbortSignal, managed?: (targetId: string, selectionRevision: string) => Promise<{
        id: string;
        status: string;
        taskId: string;
        reason?: string;
    }>, rememberSelection?: boolean): Promise<{
        reasoningEffort?: string | undefined;
        messageId: string;
        reason?: string | undefined;
        id: string;
        parentId: import("@deepseek-ai/dsh-session").SessionId;
        kind: string;
        reused: boolean;
        status: import("./core.js").Status;
        created?: undefined;
        error?: undefined;
        recovery?: undefined;
    } | {
        reasoningEffort?: string | undefined;
        taskId?: string | undefined;
        id: string;
        parentId: import("@deepseek-ai/dsh-session").SessionId;
        kind: string;
        reused: boolean;
        status: string;
        messageId: string;
        created?: undefined;
        error?: undefined;
        recovery?: undefined;
    } | {
        id: string;
        parentId: import("@deepseek-ai/dsh-session").SessionId;
        kind: string;
        created: boolean;
        reused: boolean;
        status: string;
        messageId: string;
        error: string;
        recovery: string;
    }>;
    close(): Promise<void>;
}
export {};
