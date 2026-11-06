import { z } from 'zod';

const id = z.string().trim().min(1).max(160);
const short = z.string().trim().min(1).max(500);
const text = z.string().trim().min(1).max(8000);
const lines = z.array(short).max(32);
const request = { operationId: z.string().uuid() };
const target = { ...request, taskId: id, expected: z.string().regex(/^[a-f0-9]{64}$/) };
export const panelCommand = z.discriminatedUnion('action', [
  z
    .object({
      ...request,
      action: z.literal('create'),
      coordinator: id.optional(),
      coordinatorDirectory: short.optional(),
      assignee: id.optional(),
      title: short.max(160),
      goal: text.max(7800),
      acceptance: lines.min(1),
      scope: id.optional(),
      scopeLabel: short.optional(),
      resources: lines.optional(),
      cwd: short.optional(),
      reasoningEffort: short.max(40).optional(),
      requiredQuestions: z
        .array(z.object({ topic: short, context: short, question: text, options: lines.min(2).max(8) }).strict())
        .max(8)
        .optional(),
    })
    .strict(),
  z
    .object({
      ...target,
      action: z.literal('update'),
      title: short,
      goal: text,
      acceptance: lines.min(1),
      explanation: text,
    })
    .strict(),
  z
    .object({
      ...target,
      action: z.literal('answer'),
      questionId: id,
      version: z.number().int().positive(),
      answer: text,
    })
    .strict(),
  z
    .object({
      ...target,
      action: z.literal('review'),
      checked: z.array(z.boolean()).max(32),
      accepted: z.boolean(),
      explanation: text,
      evidence: lines.min(1),
      remaining: lines.optional(),
    })
    .strict(),
  z.object({ ...target, action: z.enum(['pause', 'resume', 'cancel']), reason: text }).strict(),
  z.object({ ...target, action: z.enum(['archive', 'reconcile']) }).strict(),
]);
export type PanelCommand = z.infer<typeof panelCommand>;
export const panelQuery = z
  .object({
    view: z.enum(['attention', 'all', 'history']),
    search: z.string().max(250).optional(),
    workspace: short.optional(),
    coordinator: id.optional(),
    assignee: id.optional(),
    scope: id.optional(),
    status: short.optional(),
    sort: z.enum(['attention', 'recent']).optional(),
    cursor: z.object({ priority: z.number().int(), updatedAt: z.number(), id }).strict().optional(),
  })
  .strict();
export type PanelQuery = z.infer<typeof panelQuery>;
