import { z } from 'zod';
export declare const taskStatus: z.ZodEnum<{
    queued: "queued";
    failed: "failed";
    blocked: "blocked";
    running: "running";
    cancelled: "cancelled";
    "waiting-decision": "waiting-decision";
    review: "review";
    completed: "completed";
    dispatched: "dispatched";
    pausing: "pausing";
    paused: "paused";
    cancelling: "cancelling";
}>;
export declare const checkpointSchema: z.ZodObject<{
    summary: z.ZodString;
    done: z.ZodArray<z.ZodString>;
    remaining: z.ZodArray<z.ZodString>;
    artifacts: z.ZodArray<z.ZodString>;
    at: z.ZodNumber;
}, z.core.$strict>;
export declare const taskSchema: z.ZodObject<{
    id: z.ZodString;
    requestHash: z.ZodString;
    scopeId: z.ZodString;
    title: z.ZodString;
    coordinator: z.ZodObject<{
        id: z.ZodString;
        cwd: z.ZodString;
        child: z.ZodBoolean;
    }, z.core.$strict>;
    assignee: z.ZodObject<{
        id: z.ZodString;
        cwd: z.ZodString;
        child: z.ZodBoolean;
    }, z.core.$strict>;
    grantAt: z.ZodNumber;
    goal: z.ZodString;
    acceptance: z.ZodArray<z.ZodString>;
    resources: z.ZodArray<z.ZodString>;
    revision: z.ZodNumber;
    appliedRevision: z.ZodNumber;
    decisionRevision: z.ZodNumber;
    appliedDecisionRevision: z.ZodNumber;
    status: z.ZodEnum<{
        queued: "queued";
        failed: "failed";
        blocked: "blocked";
        running: "running";
        cancelled: "cancelled";
        "waiting-decision": "waiting-decision";
        review: "review";
        completed: "completed";
        dispatched: "dispatched";
        pausing: "pausing";
        paused: "paused";
        cancelling: "cancelling";
    }>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    checkpoint: z.ZodObject<{
        summary: z.ZodString;
        done: z.ZodArray<z.ZodString>;
        remaining: z.ZodArray<z.ZodString>;
        artifacts: z.ZodArray<z.ZodString>;
        at: z.ZodNumber;
    }, z.core.$strict>;
    questionIds: z.ZodArray<z.ZodString>;
    panelReceipts: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    scopeLabel: z.ZodOptional<z.ZodString>;
    origin: z.ZodOptional<z.ZodObject<{
        sessionId: z.ZodString;
        seq: z.ZodNumber;
        messageId: z.ZodString;
    }, z.core.$strict>>;
    result: z.ZodOptional<z.ZodObject<{
        summary: z.ZodString;
        evidence: z.ZodArray<z.ZodString>;
        revision: z.ZodNumber;
        decisionRevision: z.ZodNumber;
        at: z.ZodNumber;
    }, z.core.$strict>>;
    review: z.ZodOptional<z.ZodObject<{
        resultId: z.ZodOptional<z.ZodString>;
        checked: z.ZodOptional<z.ZodArray<z.ZodBoolean>>;
        accepted: z.ZodBoolean;
        explanation: z.ZodString;
        evidence: z.ZodArray<z.ZodString>;
        by: z.ZodString;
        at: z.ZodNumber;
    }, z.core.$strict>>;
    reason: z.ZodOptional<z.ZodString>;
    pendingUserMessage: z.ZodOptional<z.ZodString>;
    history: z.ZodArray<z.ZodObject<{
        at: z.ZodNumber;
        actor: z.ZodString;
        action: z.ZodString;
        revision: z.ZodNumber;
        detail: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const questionSchema: z.ZodObject<{
    id: z.ZodString;
    scopeId: z.ZodString;
    coordinator: z.ZodString;
    topic: z.ZodString;
    context: z.ZodString;
    question: z.ZodString;
    options: z.ZodArray<z.ZodString>;
    taskIds: z.ZodArray<z.ZodString>;
    status: z.ZodEnum<{
        open: "open";
        "awaiting-user": "awaiting-user";
        resolved: "resolved";
    }>;
    version: z.ZodNumber;
    decision: z.ZodOptional<z.ZodObject<{
        answer: z.ZodString;
        authority: z.ZodEnum<{
            user: "user";
            coordinator: "coordinator";
        }>;
        actor: z.ZodString;
        userMessageId: z.ZodOptional<z.ZodString>;
        userQuote: z.ZodOptional<z.ZodString>;
        at: z.ZodNumber;
    }, z.core.$strict>>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    presentationRequestedAt: z.ZodOptional<z.ZodNumber>;
    mergedInto: z.ZodOptional<z.ZodString>;
    previous: z.ZodArray<z.ZodObject<{
        answer: z.ZodString;
        version: z.ZodNumber;
        at: z.ZodNumber;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const eventKind: z.ZodEnum<{
    cancel: "cancel";
    pause: "pause";
    start: "start";
    question: "question";
    review: "review";
    resume: "resume";
    result: "result";
    decision: "decision";
    update: "update";
    attention: "attention";
}>;
export declare const eventSchema: z.ZodObject<{
    id: z.ZodString;
    taskId: z.ZodString;
    target: z.ZodString;
    kind: z.ZodEnum<{
        cancel: "cancel";
        pause: "pause";
        start: "start";
        question: "question";
        review: "review";
        resume: "resume";
        result: "result";
        decision: "decision";
        update: "update";
        attention: "attention";
    }>;
    revision: z.ZodNumber;
    decisionRevision: z.ZodNumber;
    questionId: z.ZodOptional<z.ZodString>;
    messageId: z.ZodString;
    text: z.ZodString;
    createdAt: z.ZodNumber;
    status: z.ZodEnum<{
        dispatching: "dispatching";
        delivered: "delivered";
        uncertain: "uncertain";
        blocked: "blocked";
        pending: "pending";
        observed: "observed";
        superseded: "superseded";
    }>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const taskStateSchema: z.ZodObject<{
    tasks: z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        requestHash: z.ZodString;
        scopeId: z.ZodString;
        title: z.ZodString;
        coordinator: z.ZodObject<{
            id: z.ZodString;
            cwd: z.ZodString;
            child: z.ZodBoolean;
        }, z.core.$strict>;
        assignee: z.ZodObject<{
            id: z.ZodString;
            cwd: z.ZodString;
            child: z.ZodBoolean;
        }, z.core.$strict>;
        grantAt: z.ZodNumber;
        goal: z.ZodString;
        acceptance: z.ZodArray<z.ZodString>;
        resources: z.ZodArray<z.ZodString>;
        revision: z.ZodNumber;
        appliedRevision: z.ZodNumber;
        decisionRevision: z.ZodNumber;
        appliedDecisionRevision: z.ZodNumber;
        status: z.ZodEnum<{
            queued: "queued";
            failed: "failed";
            blocked: "blocked";
            running: "running";
            cancelled: "cancelled";
            "waiting-decision": "waiting-decision";
            review: "review";
            completed: "completed";
            dispatched: "dispatched";
            pausing: "pausing";
            paused: "paused";
            cancelling: "cancelling";
        }>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
        checkpoint: z.ZodObject<{
            summary: z.ZodString;
            done: z.ZodArray<z.ZodString>;
            remaining: z.ZodArray<z.ZodString>;
            artifacts: z.ZodArray<z.ZodString>;
            at: z.ZodNumber;
        }, z.core.$strict>;
        questionIds: z.ZodArray<z.ZodString>;
        panelReceipts: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        scopeLabel: z.ZodOptional<z.ZodString>;
        origin: z.ZodOptional<z.ZodObject<{
            sessionId: z.ZodString;
            seq: z.ZodNumber;
            messageId: z.ZodString;
        }, z.core.$strict>>;
        result: z.ZodOptional<z.ZodObject<{
            summary: z.ZodString;
            evidence: z.ZodArray<z.ZodString>;
            revision: z.ZodNumber;
            decisionRevision: z.ZodNumber;
            at: z.ZodNumber;
        }, z.core.$strict>>;
        review: z.ZodOptional<z.ZodObject<{
            resultId: z.ZodOptional<z.ZodString>;
            checked: z.ZodOptional<z.ZodArray<z.ZodBoolean>>;
            accepted: z.ZodBoolean;
            explanation: z.ZodString;
            evidence: z.ZodArray<z.ZodString>;
            by: z.ZodString;
            at: z.ZodNumber;
        }, z.core.$strict>>;
        reason: z.ZodOptional<z.ZodString>;
        pendingUserMessage: z.ZodOptional<z.ZodString>;
        history: z.ZodArray<z.ZodObject<{
            at: z.ZodNumber;
            actor: z.ZodString;
            action: z.ZodString;
            revision: z.ZodNumber;
            detail: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    questions: z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        scopeId: z.ZodString;
        coordinator: z.ZodString;
        topic: z.ZodString;
        context: z.ZodString;
        question: z.ZodString;
        options: z.ZodArray<z.ZodString>;
        taskIds: z.ZodArray<z.ZodString>;
        status: z.ZodEnum<{
            open: "open";
            "awaiting-user": "awaiting-user";
            resolved: "resolved";
        }>;
        version: z.ZodNumber;
        decision: z.ZodOptional<z.ZodObject<{
            answer: z.ZodString;
            authority: z.ZodEnum<{
                user: "user";
                coordinator: "coordinator";
            }>;
            actor: z.ZodString;
            userMessageId: z.ZodOptional<z.ZodString>;
            userQuote: z.ZodOptional<z.ZodString>;
            at: z.ZodNumber;
        }, z.core.$strict>>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
        presentationRequestedAt: z.ZodOptional<z.ZodNumber>;
        mergedInto: z.ZodOptional<z.ZodString>;
        previous: z.ZodArray<z.ZodObject<{
            answer: z.ZodString;
            version: z.ZodNumber;
            at: z.ZodNumber;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    events: z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        taskId: z.ZodString;
        target: z.ZodString;
        kind: z.ZodEnum<{
            cancel: "cancel";
            pause: "pause";
            start: "start";
            question: "question";
            review: "review";
            resume: "resume";
            result: "result";
            decision: "decision";
            update: "update";
            attention: "attention";
        }>;
        revision: z.ZodNumber;
        decisionRevision: z.ZodNumber;
        questionId: z.ZodOptional<z.ZodString>;
        messageId: z.ZodString;
        text: z.ZodString;
        createdAt: z.ZodNumber;
        status: z.ZodEnum<{
            dispatching: "dispatching";
            delivered: "delivered";
            uncertain: "uncertain";
            blocked: "blocked";
            pending: "pending";
            observed: "observed";
            superseded: "superseded";
        }>;
        reason: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    sequence: z.ZodNumber;
}, z.core.$strict>;
export declare const archiveSchema: z.ZodObject<{
    task: z.ZodObject<{
        id: z.ZodString;
        requestHash: z.ZodString;
        scopeId: z.ZodString;
        title: z.ZodString;
        coordinator: z.ZodObject<{
            id: z.ZodString;
            cwd: z.ZodString;
            child: z.ZodBoolean;
        }, z.core.$strict>;
        assignee: z.ZodObject<{
            id: z.ZodString;
            cwd: z.ZodString;
            child: z.ZodBoolean;
        }, z.core.$strict>;
        grantAt: z.ZodNumber;
        goal: z.ZodString;
        acceptance: z.ZodArray<z.ZodString>;
        resources: z.ZodArray<z.ZodString>;
        revision: z.ZodNumber;
        appliedRevision: z.ZodNumber;
        decisionRevision: z.ZodNumber;
        appliedDecisionRevision: z.ZodNumber;
        status: z.ZodEnum<{
            queued: "queued";
            failed: "failed";
            blocked: "blocked";
            running: "running";
            cancelled: "cancelled";
            "waiting-decision": "waiting-decision";
            review: "review";
            completed: "completed";
            dispatched: "dispatched";
            pausing: "pausing";
            paused: "paused";
            cancelling: "cancelling";
        }>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
        checkpoint: z.ZodObject<{
            summary: z.ZodString;
            done: z.ZodArray<z.ZodString>;
            remaining: z.ZodArray<z.ZodString>;
            artifacts: z.ZodArray<z.ZodString>;
            at: z.ZodNumber;
        }, z.core.$strict>;
        questionIds: z.ZodArray<z.ZodString>;
        panelReceipts: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        scopeLabel: z.ZodOptional<z.ZodString>;
        origin: z.ZodOptional<z.ZodObject<{
            sessionId: z.ZodString;
            seq: z.ZodNumber;
            messageId: z.ZodString;
        }, z.core.$strict>>;
        result: z.ZodOptional<z.ZodObject<{
            summary: z.ZodString;
            evidence: z.ZodArray<z.ZodString>;
            revision: z.ZodNumber;
            decisionRevision: z.ZodNumber;
            at: z.ZodNumber;
        }, z.core.$strict>>;
        review: z.ZodOptional<z.ZodObject<{
            resultId: z.ZodOptional<z.ZodString>;
            checked: z.ZodOptional<z.ZodArray<z.ZodBoolean>>;
            accepted: z.ZodBoolean;
            explanation: z.ZodString;
            evidence: z.ZodArray<z.ZodString>;
            by: z.ZodString;
            at: z.ZodNumber;
        }, z.core.$strict>>;
        reason: z.ZodOptional<z.ZodString>;
        pendingUserMessage: z.ZodOptional<z.ZodString>;
        history: z.ZodArray<z.ZodObject<{
            at: z.ZodNumber;
            actor: z.ZodString;
            action: z.ZodString;
            revision: z.ZodNumber;
            detail: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>;
    questions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        scopeId: z.ZodString;
        coordinator: z.ZodString;
        topic: z.ZodString;
        context: z.ZodString;
        question: z.ZodString;
        options: z.ZodArray<z.ZodString>;
        taskIds: z.ZodArray<z.ZodString>;
        status: z.ZodEnum<{
            open: "open";
            "awaiting-user": "awaiting-user";
            resolved: "resolved";
        }>;
        version: z.ZodNumber;
        decision: z.ZodOptional<z.ZodObject<{
            answer: z.ZodString;
            authority: z.ZodEnum<{
                user: "user";
                coordinator: "coordinator";
            }>;
            actor: z.ZodString;
            userMessageId: z.ZodOptional<z.ZodString>;
            userQuote: z.ZodOptional<z.ZodString>;
            at: z.ZodNumber;
        }, z.core.$strict>>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
        presentationRequestedAt: z.ZodOptional<z.ZodNumber>;
        mergedInto: z.ZodOptional<z.ZodString>;
        previous: z.ZodArray<z.ZodObject<{
            answer: z.ZodString;
            version: z.ZodNumber;
            at: z.ZodNumber;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        taskId: z.ZodString;
        target: z.ZodString;
        kind: z.ZodEnum<{
            cancel: "cancel";
            pause: "pause";
            start: "start";
            question: "question";
            review: "review";
            resume: "resume";
            result: "result";
            decision: "decision";
            update: "update";
            attention: "attention";
        }>;
        revision: z.ZodNumber;
        decisionRevision: z.ZodNumber;
        questionId: z.ZodOptional<z.ZodString>;
        messageId: z.ZodString;
        text: z.ZodString;
        createdAt: z.ZodNumber;
        status: z.ZodEnum<{
            dispatching: "dispatching";
            delivered: "delivered";
            uncertain: "uncertain";
            blocked: "blocked";
            pending: "pending";
            observed: "observed";
            superseded: "superseded";
        }>;
        reason: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    archivedAt: z.ZodNumber;
}, z.core.$strict>;
export type ArchivedTask = z.infer<typeof archiveSchema>;
export declare const archiveDomainSpec: {
    name: string;
    version: number;
    layout: "per-record";
    tables: {
        history: {
            valueSchema: z.ZodObject<{
                task: z.ZodObject<{
                    id: z.ZodString;
                    requestHash: z.ZodString;
                    scopeId: z.ZodString;
                    title: z.ZodString;
                    coordinator: z.ZodObject<{
                        id: z.ZodString;
                        cwd: z.ZodString;
                        child: z.ZodBoolean;
                    }, z.core.$strict>;
                    assignee: z.ZodObject<{
                        id: z.ZodString;
                        cwd: z.ZodString;
                        child: z.ZodBoolean;
                    }, z.core.$strict>;
                    grantAt: z.ZodNumber;
                    goal: z.ZodString;
                    acceptance: z.ZodArray<z.ZodString>;
                    resources: z.ZodArray<z.ZodString>;
                    revision: z.ZodNumber;
                    appliedRevision: z.ZodNumber;
                    decisionRevision: z.ZodNumber;
                    appliedDecisionRevision: z.ZodNumber;
                    status: z.ZodEnum<{
                        queued: "queued";
                        failed: "failed";
                        blocked: "blocked";
                        running: "running";
                        cancelled: "cancelled";
                        "waiting-decision": "waiting-decision";
                        review: "review";
                        completed: "completed";
                        dispatched: "dispatched";
                        pausing: "pausing";
                        paused: "paused";
                        cancelling: "cancelling";
                    }>;
                    createdAt: z.ZodNumber;
                    updatedAt: z.ZodNumber;
                    checkpoint: z.ZodObject<{
                        summary: z.ZodString;
                        done: z.ZodArray<z.ZodString>;
                        remaining: z.ZodArray<z.ZodString>;
                        artifacts: z.ZodArray<z.ZodString>;
                        at: z.ZodNumber;
                    }, z.core.$strict>;
                    questionIds: z.ZodArray<z.ZodString>;
                    panelReceipts: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    scopeLabel: z.ZodOptional<z.ZodString>;
                    origin: z.ZodOptional<z.ZodObject<{
                        sessionId: z.ZodString;
                        seq: z.ZodNumber;
                        messageId: z.ZodString;
                    }, z.core.$strict>>;
                    result: z.ZodOptional<z.ZodObject<{
                        summary: z.ZodString;
                        evidence: z.ZodArray<z.ZodString>;
                        revision: z.ZodNumber;
                        decisionRevision: z.ZodNumber;
                        at: z.ZodNumber;
                    }, z.core.$strict>>;
                    review: z.ZodOptional<z.ZodObject<{
                        resultId: z.ZodOptional<z.ZodString>;
                        checked: z.ZodOptional<z.ZodArray<z.ZodBoolean>>;
                        accepted: z.ZodBoolean;
                        explanation: z.ZodString;
                        evidence: z.ZodArray<z.ZodString>;
                        by: z.ZodString;
                        at: z.ZodNumber;
                    }, z.core.$strict>>;
                    reason: z.ZodOptional<z.ZodString>;
                    pendingUserMessage: z.ZodOptional<z.ZodString>;
                    history: z.ZodArray<z.ZodObject<{
                        at: z.ZodNumber;
                        actor: z.ZodString;
                        action: z.ZodString;
                        revision: z.ZodNumber;
                        detail: z.ZodString;
                    }, z.core.$strict>>;
                }, z.core.$strict>;
                questions: z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    scopeId: z.ZodString;
                    coordinator: z.ZodString;
                    topic: z.ZodString;
                    context: z.ZodString;
                    question: z.ZodString;
                    options: z.ZodArray<z.ZodString>;
                    taskIds: z.ZodArray<z.ZodString>;
                    status: z.ZodEnum<{
                        open: "open";
                        "awaiting-user": "awaiting-user";
                        resolved: "resolved";
                    }>;
                    version: z.ZodNumber;
                    decision: z.ZodOptional<z.ZodObject<{
                        answer: z.ZodString;
                        authority: z.ZodEnum<{
                            user: "user";
                            coordinator: "coordinator";
                        }>;
                        actor: z.ZodString;
                        userMessageId: z.ZodOptional<z.ZodString>;
                        userQuote: z.ZodOptional<z.ZodString>;
                        at: z.ZodNumber;
                    }, z.core.$strict>>;
                    createdAt: z.ZodNumber;
                    updatedAt: z.ZodNumber;
                    presentationRequestedAt: z.ZodOptional<z.ZodNumber>;
                    mergedInto: z.ZodOptional<z.ZodString>;
                    previous: z.ZodArray<z.ZodObject<{
                        answer: z.ZodString;
                        version: z.ZodNumber;
                        at: z.ZodNumber;
                    }, z.core.$strict>>;
                }, z.core.$strict>>;
                events: z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    taskId: z.ZodString;
                    target: z.ZodString;
                    kind: z.ZodEnum<{
                        cancel: "cancel";
                        pause: "pause";
                        start: "start";
                        question: "question";
                        review: "review";
                        resume: "resume";
                        result: "result";
                        decision: "decision";
                        update: "update";
                        attention: "attention";
                    }>;
                    revision: z.ZodNumber;
                    decisionRevision: z.ZodNumber;
                    questionId: z.ZodOptional<z.ZodString>;
                    messageId: z.ZodString;
                    text: z.ZodString;
                    createdAt: z.ZodNumber;
                    status: z.ZodEnum<{
                        dispatching: "dispatching";
                        delivered: "delivered";
                        uncertain: "uncertain";
                        blocked: "blocked";
                        pending: "pending";
                        observed: "observed";
                        superseded: "superseded";
                    }>;
                    reason: z.ZodOptional<z.ZodString>;
                }, z.core.$strict>>;
                archivedAt: z.ZodNumber;
            }, z.core.$strict>;
        };
    };
};
export type Task = z.infer<typeof taskSchema>;
export type TaskQuestion = z.infer<typeof questionSchema>;
export type TaskEvent = z.infer<typeof eventSchema>;
export type TaskState = z.infer<typeof taskStateSchema>;
export declare const emptyTaskState: () => TaskState;
export declare const taskDomainSpec: {
    name: string;
    version: number;
    tables: {};
    global: {
        schema: z.ZodObject<{
            tasks: z.ZodRecord<z.ZodString, z.ZodObject<{
                id: z.ZodString;
                requestHash: z.ZodString;
                scopeId: z.ZodString;
                title: z.ZodString;
                coordinator: z.ZodObject<{
                    id: z.ZodString;
                    cwd: z.ZodString;
                    child: z.ZodBoolean;
                }, z.core.$strict>;
                assignee: z.ZodObject<{
                    id: z.ZodString;
                    cwd: z.ZodString;
                    child: z.ZodBoolean;
                }, z.core.$strict>;
                grantAt: z.ZodNumber;
                goal: z.ZodString;
                acceptance: z.ZodArray<z.ZodString>;
                resources: z.ZodArray<z.ZodString>;
                revision: z.ZodNumber;
                appliedRevision: z.ZodNumber;
                decisionRevision: z.ZodNumber;
                appliedDecisionRevision: z.ZodNumber;
                status: z.ZodEnum<{
                    queued: "queued";
                    failed: "failed";
                    blocked: "blocked";
                    running: "running";
                    cancelled: "cancelled";
                    "waiting-decision": "waiting-decision";
                    review: "review";
                    completed: "completed";
                    dispatched: "dispatched";
                    pausing: "pausing";
                    paused: "paused";
                    cancelling: "cancelling";
                }>;
                createdAt: z.ZodNumber;
                updatedAt: z.ZodNumber;
                checkpoint: z.ZodObject<{
                    summary: z.ZodString;
                    done: z.ZodArray<z.ZodString>;
                    remaining: z.ZodArray<z.ZodString>;
                    artifacts: z.ZodArray<z.ZodString>;
                    at: z.ZodNumber;
                }, z.core.$strict>;
                questionIds: z.ZodArray<z.ZodString>;
                panelReceipts: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                scopeLabel: z.ZodOptional<z.ZodString>;
                origin: z.ZodOptional<z.ZodObject<{
                    sessionId: z.ZodString;
                    seq: z.ZodNumber;
                    messageId: z.ZodString;
                }, z.core.$strict>>;
                result: z.ZodOptional<z.ZodObject<{
                    summary: z.ZodString;
                    evidence: z.ZodArray<z.ZodString>;
                    revision: z.ZodNumber;
                    decisionRevision: z.ZodNumber;
                    at: z.ZodNumber;
                }, z.core.$strict>>;
                review: z.ZodOptional<z.ZodObject<{
                    resultId: z.ZodOptional<z.ZodString>;
                    checked: z.ZodOptional<z.ZodArray<z.ZodBoolean>>;
                    accepted: z.ZodBoolean;
                    explanation: z.ZodString;
                    evidence: z.ZodArray<z.ZodString>;
                    by: z.ZodString;
                    at: z.ZodNumber;
                }, z.core.$strict>>;
                reason: z.ZodOptional<z.ZodString>;
                pendingUserMessage: z.ZodOptional<z.ZodString>;
                history: z.ZodArray<z.ZodObject<{
                    at: z.ZodNumber;
                    actor: z.ZodString;
                    action: z.ZodString;
                    revision: z.ZodNumber;
                    detail: z.ZodString;
                }, z.core.$strict>>;
            }, z.core.$strict>>;
            questions: z.ZodRecord<z.ZodString, z.ZodObject<{
                id: z.ZodString;
                scopeId: z.ZodString;
                coordinator: z.ZodString;
                topic: z.ZodString;
                context: z.ZodString;
                question: z.ZodString;
                options: z.ZodArray<z.ZodString>;
                taskIds: z.ZodArray<z.ZodString>;
                status: z.ZodEnum<{
                    open: "open";
                    "awaiting-user": "awaiting-user";
                    resolved: "resolved";
                }>;
                version: z.ZodNumber;
                decision: z.ZodOptional<z.ZodObject<{
                    answer: z.ZodString;
                    authority: z.ZodEnum<{
                        user: "user";
                        coordinator: "coordinator";
                    }>;
                    actor: z.ZodString;
                    userMessageId: z.ZodOptional<z.ZodString>;
                    userQuote: z.ZodOptional<z.ZodString>;
                    at: z.ZodNumber;
                }, z.core.$strict>>;
                createdAt: z.ZodNumber;
                updatedAt: z.ZodNumber;
                presentationRequestedAt: z.ZodOptional<z.ZodNumber>;
                mergedInto: z.ZodOptional<z.ZodString>;
                previous: z.ZodArray<z.ZodObject<{
                    answer: z.ZodString;
                    version: z.ZodNumber;
                    at: z.ZodNumber;
                }, z.core.$strict>>;
            }, z.core.$strict>>;
            events: z.ZodRecord<z.ZodString, z.ZodObject<{
                id: z.ZodString;
                taskId: z.ZodString;
                target: z.ZodString;
                kind: z.ZodEnum<{
                    cancel: "cancel";
                    pause: "pause";
                    start: "start";
                    question: "question";
                    review: "review";
                    resume: "resume";
                    result: "result";
                    decision: "decision";
                    update: "update";
                    attention: "attention";
                }>;
                revision: z.ZodNumber;
                decisionRevision: z.ZodNumber;
                questionId: z.ZodOptional<z.ZodString>;
                messageId: z.ZodString;
                text: z.ZodString;
                createdAt: z.ZodNumber;
                status: z.ZodEnum<{
                    dispatching: "dispatching";
                    delivered: "delivered";
                    uncertain: "uncertain";
                    blocked: "blocked";
                    pending: "pending";
                    observed: "observed";
                    superseded: "superseded";
                }>;
                reason: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>>;
            sequence: z.ZodNumber;
        }, z.core.$strict>;
        initial: {
            tasks: Record<string, {
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
            }>;
            questions: Record<string, {
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
            }>;
            events: Record<string, {
                id: string;
                taskId: string;
                target: string;
                kind: "cancel" | "pause" | "start" | "question" | "review" | "resume" | "result" | "decision" | "update" | "attention";
                revision: number;
                decisionRevision: number;
                messageId: string;
                text: string;
                createdAt: number;
                status: "dispatching" | "delivered" | "uncertain" | "blocked" | "pending" | "observed" | "superseded";
                questionId?: string | undefined;
                reason?: string | undefined;
            }>;
            sequence: number;
        };
    };
};
