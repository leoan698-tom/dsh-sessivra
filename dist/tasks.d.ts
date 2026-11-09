import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent';
import { type UserMessage } from '@deepseek-ai/dsh-llm';
import type { ArchivedTask, Task, TaskState } from './task-schema.js';
import type { TaskTransport } from './task-transport.js';
export interface TaskStore {
    read(): TaskState;
    write(state: TaskState): Promise<void>;
}
export interface TaskArchive {
    get(id: string): ArchivedTask | undefined;
    entries(): IterableIterator<[string, ArchivedTask]>;
    put(id: string, item: ArchivedTask): Promise<void>;
}
export interface PanelAction {
    operationId: string;
    fingerprint: string;
    taskId: string;
    expected: string;
}
export interface RequiredQuestion {
    topic: string;
    context: string;
    question: string;
    options: string[];
}
export interface Assignment {
    requestId: string;
    target: string;
    title: string;
    goal: string;
    acceptance: string[];
    scope?: string;
    resources?: string[];
    requiredQuestions?: RequiredQuestion[];
}
export interface TaskReport {
    taskId: string;
    revision: number;
    decisionRevision: number;
    phase: 'running' | 'progress' | 'blocked' | 'result';
    summary: string;
    done?: string[];
    remaining?: string[];
    artifacts?: string[];
    evidence?: string[];
}
export declare const taskIdFor: (owner: string, requestId: string) => string;
/** Durable task state and outbox share one atomic commit. Runtime delivery is
 * deliberately outside that transaction; ambiguous delivery is reconciled,
 * never blindly retried. The single writer spans tools and Host event hooks. */
export declare class Tasks {
    private store;
    readonly transport: TaskTransport;
    private clock;
    private archive?;
    private tail;
    private closed;
    private manual;
    private activeExecution;
    private admittedUserMessage;
    lastBackgroundError?: string;
    constructor(store: TaskStore, transport: TaskTransport, clock?: () => number, archive?: TaskArchive | undefined);
    private serial;
    private state;
    private save;
    private task;
    private member;
    private access;
    private revision;
    private record;
    private refreshInitialCheckpoint;
    private event;
    private waiting;
    private lane;
    private resourcesBlocked;
    private view;
    panelItem(state: TaskState, task: Task): {
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
    panelTasks(): {
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
    }[];
    panelDetail(id: string): {
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
    } | undefined;
    archivedTask(id: string): {
        task: {
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
        events: {
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
    } | undefined;
    panelHistory(): {
        task: {
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
        events: {
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
    }[];
    panelOperation(id: string): {
        id: string;
    } | null;
    panelLookup(id: string): {
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
    private panelCheck;
    private removeArchived;
    archiveTask(op: PanelAction): Promise<void>;
    exists(owner: string, requestId: string): boolean;
    authorizeParticipant(agent: Agent, target: string, scopeId?: string): Promise<boolean>;
    assign(agent: Agent, input: Assignment, operator?: {
        scopeLabel?: string;
        fingerprint: string;
    }): Promise<{
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
    }>;
    get(agent: Agent, id: string): Promise<{
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
    }>;
    list(agent: Agent, offset?: number): Promise<{
        items: ({
            reason?: string | undefined;
            id: string;
            scopeId: string;
            title: string;
            coordinator: string;
            assignee: string;
            status: "queued" | "failed" | "blocked" | "running" | "cancelled" | "waiting-decision" | "review" | "completed" | "dispatched" | "pausing" | "paused" | "cancelling";
            revision: number;
            appliedRevision: number;
            decisionRevision: number;
            appliedDecisionRevision: number;
            updatedAt: number;
        } | {
            id: string;
            status: string;
            reason: string;
        })[];
        nextOffset: number | null;
        total: number;
        lastBackgroundError: string | null;
    }>;
    update(agent: Agent, input: {
        taskId: string;
        revision: number;
        goal: string;
        acceptance: string[];
        explanation: string;
        title?: string;
    }, op?: PanelAction): Promise<{
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
    }>;
    report(agent: Agent, input: TaskReport): Promise<{
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
    }>;
    question(agent: Agent, input: {
        taskId: string;
        revision: number;
        decisionRevision: number;
        topic: string;
        context: string;
        question: string;
        options: string[];
    }): Promise<{
        question: {
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
        };
        waiting: boolean;
        reused: boolean;
        task: {
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
    }>;
    private ownedQuestion;
    mergeQuestions(agent: Agent, input: {
        questionId: string;
        into: string;
        version: number;
        targetVersion: number;
        reason: string;
    }): Promise<{
        question: {
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
        };
        reused: boolean;
    }>;
    escalate(agent: Agent, input: {
        questionId: string;
        version: number;
    }): Promise<{
        present: boolean;
        question: {
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
        };
        instruction?: undefined;
    } | {
        present: boolean;
        question: {
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
        };
        instruction: string;
    }>;
    decide(agent: Agent, input: {
        questionId: string;
        version: number;
        answer: string;
        authority: 'coordinator' | 'user';
        userMessageId?: string;
        userQuote?: string;
    }, op?: PanelAction): Promise<{
        question: {
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
        };
        reused: boolean;
        decisionRevision?: undefined;
    } | {
        question: {
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
        };
        reused: boolean;
        decisionRevision: number;
    }>;
    review(agent: Agent, input: {
        taskId: string;
        revision: number;
        decisionRevision: number;
        accepted: boolean;
        explanation: string;
        evidence: string[];
        remaining?: string[];
        checked?: boolean[];
    }, op?: PanelAction): Promise<{
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
    }>;
    control(agent: Agent, input: {
        taskId: string;
        revision: number;
        action: 'pause' | 'resume' | 'cancel';
        reason: string;
    }, op?: PanelAction): Promise<{
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
    }>;
    /** Only pending, known-not-dispatched work is sent. Each effect has a durable
     * reservation first and retains its identity across reloads. */
    private pump;
    preStep(agent: Agent, messages: UserMessage[], next: () => Promise<PreStepDecision>): Promise<PreStepDecision>;
    guard(agent: Agent, name: string): string | undefined;
    idle(agent: Agent): Promise<void>;
    reconcile(agent: Agent, id: string, op?: PanelAction): Promise<{
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
    }>;
    recover(): Promise<void>;
    busyTask(target: string): string | undefined;
    progressSummary(agent: Agent, target: string): {
        taskId: string;
        status: "queued" | "failed" | "blocked" | "running" | "cancelled" | "waiting-decision" | "review" | "completed" | "dispatched" | "pausing" | "paused" | "cancelling";
        revision: number;
        appliedRevision: number;
        decisionRevision: number;
        appliedDecisionRevision: number;
        pendingQuestionIds: string[];
        updatedAt: number;
        completionMeaning: string;
    }[];
    snapshot(agent: Agent): string;
    treeSummary(sessionId: string): {
        id: string;
        title: string;
        status: "queued" | "failed" | "blocked" | "running" | "cancelled" | "waiting-decision" | "review" | "completed" | "dispatched" | "pausing" | "paused" | "cancelling";
        label: string;
        revision: number;
        appliedRevision: number;
        pendingUpdate: boolean;
        queued: number;
        updatedAt: number;
    } | undefined;
    close(): Promise<void>;
}
