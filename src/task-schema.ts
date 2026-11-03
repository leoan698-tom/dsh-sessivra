import { z } from 'zod';
import { defineDomain } from '@deepseek-ai/dsh-storage-domain';

const text = z.string().trim().min(1).max(8000);
const short = z.string().trim().min(1).max(500);
const strings = z.array(short).max(32);
export const taskStatus = z.enum(['queued', 'dispatched', 'running', 'waiting-decision', 'blocked', 'pausing', 'paused', 'cancelling', 'review', 'completed', 'cancelled', 'failed']);
export const checkpointSchema = z.object({ summary: text, done: strings, remaining: strings, artifacts: strings, at: z.number() }).strict();
const endpoint = z.object({ id: z.string(), cwd: z.string(), child: z.boolean() }).strict();
export const taskSchema = z.object({
  id: z.string(), requestHash: z.string(), scopeId: z.string(), title: short,
  coordinator: endpoint, assignee: endpoint, grantAt: z.number(),
  goal: text, acceptance: strings, resources: strings,
  revision: z.number().int().positive(), appliedRevision: z.number().int().nonnegative(),
  decisionRevision: z.number().int().nonnegative(), appliedDecisionRevision: z.number().int().nonnegative(),
  status: taskStatus, createdAt: z.number(), updatedAt: z.number(),
  checkpoint: checkpointSchema, questionIds: z.array(z.string()).max(128),
  result: z.object({ summary: text, evidence: strings, revision: z.number(), decisionRevision: z.number(), at: z.number() }).strict().optional(),
  review: z.object({ accepted: z.boolean(), explanation: text, evidence: strings, by: z.string(), at: z.number() }).strict().optional(),
  reason: z.string().max(600).optional(), pendingUserMessage: z.string().optional(),
  history: z.array(z.object({ at: z.number(), actor: z.string(), action: z.string(), revision: z.number(), detail: z.string().max(600) }).strict()).max(64),
}).strict();
export const questionSchema = z.object({
  id: z.string(), scopeId: z.string(), coordinator: z.string(), topic: short, context: short,
  question: text, options: z.array(short).min(2).max(8), taskIds: z.array(z.string()).max(128),
  status: z.enum(['open', 'awaiting-user', 'resolved']), version: z.number().int().positive(),
  decision: z.object({ answer: text, authority: z.enum(['coordinator', 'user']), actor: z.string(), userMessageId: z.string().optional(), userQuote: text.optional(), at: z.number() }).strict().optional(),
  createdAt: z.number(), updatedAt: z.number(), presentationRequestedAt: z.number().optional(),
  mergedInto: z.string().optional(),
  previous: z.array(z.object({ answer: text, version: z.number(), at: z.number() }).strict()).max(32),
}).strict();
export const eventKind = z.enum(['start', 'update', 'decision', 'question', 'result', 'review', 'attention', 'pause', 'cancel', 'resume']);
export const eventSchema = z.object({
  id: z.string(), taskId: z.string(), target: z.string(), kind: eventKind,
  revision: z.number(), decisionRevision: z.number(), questionId: z.string().optional(),
  messageId: z.string(), text: z.string().max(2000), createdAt: z.number(),
  status: z.enum(['pending', 'dispatching', 'delivered', 'observed', 'uncertain', 'blocked', 'superseded']),
  reason: z.string().max(600).optional(),
}).strict();
export const taskStateSchema = z.object({ tasks: z.record(z.string(), taskSchema), questions: z.record(z.string(), questionSchema), events: z.record(z.string(), eventSchema), sequence: z.number().int().nonnegative() }).strict();
export type Task = z.infer<typeof taskSchema>;
export type TaskQuestion = z.infer<typeof questionSchema>;
export type TaskEvent = z.infer<typeof eventSchema>;
export type TaskState = z.infer<typeof taskStateSchema>;
export const emptyTaskState = (): TaskState => ({ tasks: {}, questions: {}, events: {}, sequence: 0 });
// Separate domain: upgrading never rewrites the three legacy Messenger domains.
export const taskDomainSpec = defineDomain({ name: 'dsh_sessivra_tasks', version: 1, tables: {}, global: { schema: taskStateSchema, initial: emptyTaskState() } });
