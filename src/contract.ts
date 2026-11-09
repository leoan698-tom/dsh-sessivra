import { z } from 'zod';
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol';
import { panelCommand, panelQuery } from './panel-contract.js';
import { policyInput } from './validation.js';
import { bookmarkedTurn, bookmarkedTurnNumbers, legacyBookmarkQuote, messageLocation, messageOrigin } from './message-history.js';

// Keep legacy wire IDs stable across the package rename. Host and browser share
// the new package identity; existing messages, tool names and storage stay valid.
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
  ...[
    {method:'list',parameters:[parameter('query',panelQuery)]},
    {method:'participants',parameters:[]},
    {method:'operation',parameters:[parameter('id',z.string().uuid())]},
    {method:'detail',parameters:[parameter('id',z.string().max(160))]},
    {method:'preview',parameters:[parameter('id',z.string().max(160)),parameter('index',z.number().int().min(0).max(63))]},
    {method:'command',parameters:[parameter('command',panelCommand)]},
    {method:'locateMessage',parameters:[parameter('location',messageLocation),parameter('expectedId',z.string().max(256))]},
    {method:'bookmarkedTurns',parameters:[parameter('sessionId',z.string().min(1).max(256)),parameter('turns',bookmarkedTurnNumbers)]},
    {method:'bookmarkReference',parameters:[parameter('origin',messageOrigin),parameter('turn',bookmarkedTurn)]},
    {method:'locateLegacyBookmark',parameters:[parameter('quote',legacyBookmarkQuote)]},
  ].map(e => ({...e,id:'dsh-plugin-sessivra#sessivraTaskPanel/'+e.method,service:'sessivraTaskPanel',namespace:'sessivraTaskPanel',invocation:{kind:'direct' as const},result:codec('panel-result',z.json())})),
  ...endpoints.map(e => ({ ...e, id: `dsh-session-messenger#sessionMessenger/${e.method}`, service: 'sessionMessenger', namespace: 'sessionMessenger', invocation: { kind: 'direct' as const }, result: codec('result', z.json()) })),
  { method: 'tree', parameters: [], id: 'dsh-session-messenger#sessionCollaboration/tree', service: 'sessionCollaboration', namespace: 'sessionCollaboration', invocation: { kind: 'direct' as const }, result: codec('tree-result', z.json()) },
  { method: 'candidates', parameters: [parameter('sourceId', z.string()), parameter('query', z.string().max(256))], id: 'dsh-session-messenger#sessionCollaboration/candidates', service: 'sessionCollaboration', namespace: 'sessionCollaboration', invocation: { kind: 'direct' as const }, result: codec('candidate-result', z.json()) },
];
export const remoteContribution = { package: 'dsh-plugin-sessivra', descriptors };
export const hostContribution = { package: 'dsh-plugin-sessivra', face: 'host' as const, schemas: [], model: { services: [], events: [], objects: [] }, invocations: descriptors };
