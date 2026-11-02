import { z } from 'zod';
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol';
import { policyInput } from './validation.js';

// Explicit strict protocol contribution, shared by Host and browser. No source-mode fallback.
const codec = (name: string, schema: z.ZodType) => ({ mode: 'strict' as const, typeSymbol: `dsh-session-messenger#${name}`, create: () => schema });
const parameter = (name: string, schema: z.ZodType) => ({ name, wire: name, source: 'json' as const, codec: codec(name, schema) });
const endpoints = [
  { method: 'view', parameters: [] },
  { method: 'selectedFor', parameters: [parameter('sourceId', z.string())] },
  { method: 'selectRecipient', parameters: [parameter('sourceId', z.string()), parameter('targetId', z.string()), parameter('label', z.string().min(1).max(160))] },
  { method: 'authorizeSelected', parameters: [parameter('sourceId', z.string()), parameter('revision', z.string())] },
  { method: 'revokeSelected', parameters: [parameter('sourceId', z.string()), parameter('revision', z.string())] },
  { method: 'clearSelected', parameters: [parameter('sourceId', z.string())] },
  { method: 'setDeliveryMode', parameters: [parameter('sourceId', z.string()), parameter('revision', z.string()), parameter('mode', z.enum(['queue', 'insert']))] },
  { method: 'sendOperator', parameters: [parameter('sourceId', z.string()), parameter('input', z.object({ target: z.string(), text: z.string().min(1).max(8000), id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional(), ttl: z.number().int().positive().optional() }).strict())] },
  { method: 'conversation', parameters: [parameter('sourceId', z.string()), parameter('targetId', z.string())] },
  { method: 'policy', parameters: [parameter('id', z.string()), parameter('input', policyInput)] },
  { method: 'release', parameters: [parameter('id', z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/))] },
  { method: 'backup', parameters: [parameter('includeText', z.boolean())] },
  { method: 'clear', parameters: [parameter('confirmation', z.literal('DELETE MESSENGER DATA'))] },
];
export const descriptors: InvocationDescriptor[] = [
  ...endpoints.map(e => ({ ...e, id: `dsh-session-messenger#sessionMessenger/${e.method}`, service: 'sessionMessenger', namespace: 'sessionMessenger', invocation: { kind: 'direct' as const }, result: codec('result', z.json()) })),
  { method: 'tree', parameters: [], id: 'dsh-session-messenger#sessionCollaboration/tree', service: 'sessionCollaboration', namespace: 'sessionCollaboration', invocation: { kind: 'direct' as const }, result: codec('tree-result', z.json()) },
  { method: 'candidates', parameters: [parameter('sourceId', z.string()), parameter('query', z.string().max(256))], id: 'dsh-session-messenger#sessionCollaboration/candidates', service: 'sessionCollaboration', namespace: 'sessionCollaboration', invocation: { kind: 'direct' as const }, result: codec('candidate-result', z.json()) },
];
export const remoteContribution = { package: 'dsh-session-messenger', descriptors };
export const hostContribution = { package: 'dsh-session-messenger', face: 'host' as const, schemas: [], model: { services: [], events: [], objects: [] }, invocations: descriptors };
