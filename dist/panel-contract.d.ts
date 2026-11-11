import { z } from 'zod';
export declare const panelCommand: z.ZodDiscriminatedUnion<[z.ZodObject<{
    action: z.ZodLiteral<"create">;
    coordinator: z.ZodOptional<z.ZodString>;
    coordinatorDirectory: z.ZodOptional<z.ZodString>;
    assignee: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    goal: z.ZodString;
    acceptance: z.ZodArray<z.ZodString>;
    scope: z.ZodOptional<z.ZodString>;
    scopeLabel: z.ZodOptional<z.ZodString>;
    resources: z.ZodOptional<z.ZodArray<z.ZodString>>;
    cwd: z.ZodOptional<z.ZodString>;
    reasoningEffort: z.ZodOptional<z.ZodString>;
    origin: z.ZodOptional<z.ZodObject<{
        sessionId: z.ZodString;
        seq: z.ZodNumber;
        messageId: z.ZodString;
    }, z.core.$strict>>;
    requiredQuestions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        topic: z.ZodString;
        context: z.ZodString;
        question: z.ZodString;
        options: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>>;
    operationId: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    action: z.ZodLiteral<"update">;
    title: z.ZodString;
    goal: z.ZodString;
    acceptance: z.ZodArray<z.ZodString>;
    explanation: z.ZodString;
    taskId: z.ZodString;
    expected: z.ZodString;
    operationId: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    action: z.ZodLiteral<"answer">;
    questionId: z.ZodString;
    version: z.ZodNumber;
    answer: z.ZodString;
    taskId: z.ZodString;
    expected: z.ZodString;
    operationId: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    action: z.ZodLiteral<"review">;
    checked: z.ZodArray<z.ZodBoolean>;
    accepted: z.ZodBoolean;
    explanation: z.ZodString;
    evidence: z.ZodArray<z.ZodString>;
    remaining: z.ZodOptional<z.ZodArray<z.ZodString>>;
    taskId: z.ZodString;
    expected: z.ZodString;
    operationId: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    action: z.ZodEnum<{
        cancel: "cancel";
        pause: "pause";
        resume: "resume";
    }>;
    reason: z.ZodString;
    taskId: z.ZodString;
    expected: z.ZodString;
    operationId: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    action: z.ZodEnum<{
        archive: "archive";
        reconcile: "reconcile";
    }>;
    taskId: z.ZodString;
    expected: z.ZodString;
    operationId: z.ZodString;
}, z.core.$strict>], "action">;
export type PanelCommand = z.infer<typeof panelCommand>;
export declare const panelQuery: z.ZodObject<{
    view: z.ZodEnum<{
        all: "all";
        history: "history";
        attention: "attention";
    }>;
    search: z.ZodOptional<z.ZodString>;
    workspace: z.ZodOptional<z.ZodString>;
    coordinator: z.ZodOptional<z.ZodString>;
    assignee: z.ZodOptional<z.ZodString>;
    scope: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    sort: z.ZodOptional<z.ZodEnum<{
        attention: "attention";
        recent: "recent";
    }>>;
    cursor: z.ZodOptional<z.ZodObject<{
        priority: z.ZodNumber;
        updatedAt: z.ZodNumber;
        id: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type PanelQuery = z.infer<typeof panelQuery>;
