import { z } from 'zod';
import { defineDomain } from '@deepseek-ai/dsh-storage-domain';
import { emptyState } from './core.js';

import { policyInput } from './validation.js';
export { policyInput } from './validation.js';
const policy = policyInput.extend({ workspace: z.string().nullable() });
const childAddress = z.object({ parentId: z.string(), childId: z.string(), kind: z.enum(['teammate','standalone']) }).strict();
const message = z.object({ id: z.string(), sender: z.string(), target: z.string(), text: z.string().max(8000), created: z.number().int(), expires: z.number().int(), status: z.enum(['queued','dispatching','delivered','claimed','processed','received','failed','expired','uncertain']), replyTo: z.string().optional(), hops: z.number().int().min(0), hostId: z.string(), reason: z.string().optional(), acknowledgedAt: z.number().int().optional(), origin: z.enum(['operator','agent']).optional(), sourceRoot: z.string().optional(), sourceWorkspace: z.string().nullable().optional(), targetWorkspace: z.string().nullable().optional(), deliveryMode: z.enum(['queue','insert']).optional(), child: childAddress.optional() }).strict();
const selectedRecipient = z.object({ targetId: z.string(), label: z.string(), sourceWorkspace: z.string().nullable(), targetWorkspace: z.string().nullable(), revision: z.string(), selectedAt: z.number().int(), deliveryMode: z.enum(['queue','insert']).optional(), child: childAddress.optional() }).strict();
const pairGrant = z.object({ sourceId: z.string(), targetId: z.string(), sourceWorkspace: z.string(), targetWorkspace: z.string(), grantedAt: z.number().int() }).strict();
// Legacy v1 records remain readable. New optional delivery fields require an
// installation-time data backup before downgrading to an older strict reader.
export const stateSchema = z.object({ policies: z.record(z.string(), policy), messages: z.record(z.string(), message), budgets: z.record(z.string(), z.object({ start: z.number(), sent: z.number().int().min(0), wakes: z.number().int().min(0) })) }).strict();
export const domainSpec = defineDomain({ name: 'dsh_session_messenger', version: 1, tables: {}, global: { schema: stateSchema, initial: emptyState() } });
export const recipientStateSchema = z.object({ selectedRecipients: z.record(z.string(), selectedRecipient), pairGrants: z.record(z.string(), pairGrant).default({}) }).strict();
export const recipientDomainSpec = defineDomain({ name: 'dsh_session_messenger_recipients', version: 1, tables: {}, global: { schema: recipientStateSchema, initial: { selectedRecipients: {}, pairGrants: {} } } });
export const conversationRelationSchema = z.object({ parentId: z.string(), label: z.string(), createdAt: z.number().int(), requestHash: z.string().optional() }).strict();
export type ConversationRelations = Record<string, z.infer<typeof conversationRelationSchema>>;
export const conversationDomainSpec = defineDomain({ name: 'dsh_session_messenger_conversations', version: 1, tables: {}, global: { schema: z.object({ relations: z.record(z.string(), conversationRelationSchema) }).strict(), initial: { relations: {} } } });
