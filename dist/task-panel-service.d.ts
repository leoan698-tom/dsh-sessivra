import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { type LegacyBookmarkQuote, type MessageLocation, type MessageOrigin } from './message-history.js';
import type { Collaboration } from './collaboration.js';
import { type Messenger } from './core.js';
import type { Tasks } from './tasks.js';
type Item = ReturnType<Tasks['panelTasks']>[number];
export declare const labels: Record<Item['status'], string>;
export declare class SessivraPanel extends TypertRemoteService {
    private tasks;
    private collaboration;
    private messenger;
    private history;
    constructor(ctx: Context, tasks: Tasks, collaboration: Collaboration, messenger: Messenger);
    private owner;
    searchHistory(query: string): Promise<{
        items: {
            sessionId: string;
            seq: number;
            time: number;
            snippet: string;
            title: string;
            cwd: string;
            child: boolean;
        }[];
        more: boolean;
        partial: boolean;
    }>;
    locateMessage(location: MessageLocation, expectedId: string): Promise<{
        nodeKey: string;
        turn?: number | undefined;
        cwd: string;
        title: string;
        excerpt: string;
        child?: {
            parentSessionId: string;
            mode: "continuable" | "one-shot";
        } | undefined;
        origin: {
            messageId: import("@deepseek-ai/dsh-llm").MessageId;
            sessionId: string;
            seq: number;
        };
    }>;
    bookmarkedTurns(sessionId: string, turns: number[]): Promise<{
        title: string;
        items: import("./message-history.js").BookmarkedTurn[];
    }>;
    bookmarkReference(origin: MessageOrigin, turn: number): Promise<string>;
    locateLegacyBookmark(quote: LegacyBookmarkQuote): Promise<{
        sessionId: string;
        seq: number;
        messageId: string;
    } | null>;
    private header;
    participants(): Promise<{
        id: string;
        label: string;
        workspace: string | null;
        child: boolean;
        parent: string | null;
    }[]>;
    list(raw: unknown): {
        attention: {
            key: string;
            taskId: string;
            kind: string;
            title: string;
            affected: string[];
        }[];
        groups: {
            id: string;
            label: string;
            coordinator: string;
        }[];
        workspaces: string[];
        total: number;
        next: {
            priority: number;
            updatedAt: number;
            id: string;
        } | null;
        items: {
            id: string;
            title: string;
            status: "queued" | "failed" | "blocked" | "running" | "cancelled" | "waiting-decision" | "review" | "completed" | "dispatched" | "pausing" | "paused" | "cancelling";
            label: string;
            coordinator: string;
            assignee: string;
            updatedAt: number;
            revision: number;
            appliedRevision: number;
            wait: unknown;
        }[];
    };
    operation(id: string): {
        id: string;
    } | null;
    preview(id: string, index: number): Promise<{
        name: string;
        text: string;
        truncated: boolean;
    }>;
    detail(id: string): {
        actions: string[];
        uncertain: boolean;
        queueReason: string | null;
        token: string;
        runtime: string;
        sampledAt: number;
        adopted: boolean;
        questions: {
            id: string;
            scopeId: string;
            coordinator: string;
            topic: string;
            context: string;
            question: string;
            options: string[];
            taskIds: string[];
            status: "open" | "awaiting-user" | "resolved";
            version: number;
            createdAt: number;
            updatedAt: number;
            previous: {
                answer: string;
                version: number;
                at: number;
            }[];
            decision?: {
                answer: string;
                authority: "user" | "coordinator";
                actor: string;
                at: number;
                userMessageId?: string | undefined;
                userQuote?: string | undefined;
            } | undefined;
            presentationRequestedAt?: number | undefined;
            mergedInto?: string | undefined;
        }[];
        decisions: {
            id: string;
            scopeId: string;
            coordinator: string;
            topic: string;
            context: string;
            question: string;
            options: string[];
            taskIds: string[];
            status: "open" | "awaiting-user" | "resolved";
            version: number;
            createdAt: number;
            updatedAt: number;
            previous: {
                answer: string;
                version: number;
                at: number;
            }[];
            decision?: {
                answer: string;
                authority: "user" | "coordinator";
                actor: string;
                at: number;
                userMessageId?: string | undefined;
                userQuote?: string | undefined;
            } | undefined;
            presentationRequestedAt?: number | undefined;
            mergedInto?: string | undefined;
        }[];
        deliveries: {
            id: string;
            taskId: string;
            target: string;
            kind: "cancel" | "pause" | "start" | "question" | "review" | "result" | "decision" | "update" | "attention" | "resume";
            revision: number;
            decisionRevision: number;
            messageId: string;
            text: string;
            createdAt: number;
            status: "dispatching" | "delivered" | "uncertain" | "blocked" | "pending" | "observed" | "superseded";
            questionId?: string | undefined;
            reason?: string | undefined;
        }[];
        completionMeaning: string;
        id: string;
        requestHash: string;
        scopeId: string;
        title: string;
        coordinator: {
            id: string;
            cwd: string;
            child: boolean;
        };
        assignee: {
            id: string;
            cwd: string;
            child: boolean;
        };
        grantAt: number;
        goal: string;
        acceptance: string[];
        resources: string[];
        revision: number;
        appliedRevision: number;
        decisionRevision: number;
        appliedDecisionRevision: number;
        status: "queued" | "failed" | "blocked" | "running" | "cancelled" | "waiting-decision" | "review" | "completed" | "dispatched" | "pausing" | "paused" | "cancelling";
        createdAt: number;
        updatedAt: number;
        checkpoint: {
            summary: string;
            done: string[];
            remaining: string[];
            artifacts: string[];
            at: number;
        };
        questionIds: string[];
        history: {
            at: number;
            actor: string;
            action: string;
            revision: number;
            detail: string;
        }[];
        panelReceipts?: Record<string, string> | undefined;
        scopeLabel?: string | undefined;
        origin?: {
            sessionId: string;
            seq: number;
            messageId: string;
        } | undefined;
        result?: {
            summary: string;
            evidence: string[];
            revision: number;
            decisionRevision: number;
            at: number;
        } | undefined;
        review?: {
            accepted: boolean;
            explanation: string;
            evidence: string[];
            by: string;
            at: number;
            resultId?: string | undefined;
            checked?: boolean[] | undefined;
        } | undefined;
        reason?: string | undefined;
        pendingUserMessage?: string | undefined;
    } | {
        questions: {
            id: string;
            scopeId: string;
            coordinator: string;
            topic: string;
            context: string;
            question: string;
            options: string[];
            taskIds: string[];
            status: "open" | "awaiting-user" | "resolved";
            version: number;
            createdAt: number;
            updatedAt: number;
            previous: {
                answer: string;
                version: number;
                at: number;
            }[];
            decision?: {
                answer: string;
                authority: "user" | "coordinator";
                actor: string;
                at: number;
                userMessageId?: string | undefined;
                userQuote?: string | undefined;
            } | undefined;
            presentationRequestedAt?: number | undefined;
            mergedInto?: string | undefined;
        }[];
        deliveries: {
            id: string;
            taskId: string;
            target: string;
            kind: "cancel" | "pause" | "start" | "question" | "review" | "result" | "decision" | "update" | "attention" | "resume";
            revision: number;
            decisionRevision: number;
            messageId: string;
            text: string;
            createdAt: number;
            status: "dispatching" | "delivered" | "uncertain" | "blocked" | "pending" | "observed" | "superseded";
            questionId?: string | undefined;
            reason?: string | undefined;
        }[];
        archivedAt: number;
        actions: string[];
        token: string;
        runtime: string;
        uncertain: boolean;
        queueReason: null;
        adopted: boolean;
        id: string;
        requestHash: string;
        scopeId: string;
        title: string;
        coordinator: {
            id: string;
            cwd: string;
            child: boolean;
        };
        assignee: {
            id: string;
            cwd: string;
            child: boolean;
        };
        grantAt: number;
        goal: string;
        acceptance: string[];
        resources: string[];
        revision: number;
        appliedRevision: number;
        decisionRevision: number;
        appliedDecisionRevision: number;
        status: "queued" | "failed" | "blocked" | "running" | "cancelled" | "waiting-decision" | "review" | "completed" | "dispatched" | "pausing" | "paused" | "cancelling";
        createdAt: number;
        updatedAt: number;
        checkpoint: {
            summary: string;
            done: string[];
            remaining: string[];
            artifacts: string[];
            at: number;
        };
        questionIds: string[];
        history: {
            at: number;
            actor: string;
            action: string;
            revision: number;
            detail: string;
        }[];
        panelReceipts?: Record<string, string> | undefined;
        scopeLabel?: string | undefined;
        origin?: {
            sessionId: string;
            seq: number;
            messageId: string;
        } | undefined;
        result?: {
            summary: string;
            evidence: string[];
            revision: number;
            decisionRevision: number;
            at: number;
        } | undefined;
        review?: {
            accepted: boolean;
            explanation: string;
            evidence: string[];
            by: string;
            at: number;
            resultId?: string | undefined;
            checked?: boolean[] | undefined;
        } | undefined;
        reason?: string | undefined;
        pendingUserMessage?: string | undefined;
    };
    private coordinator;
    private create;
    command(raw: unknown): Promise<{
        id: string;
    }>;
}
export {};
