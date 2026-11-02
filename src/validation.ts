import { z } from 'zod';
export const policyInput = z.object({ mode: z.enum(['accept', 'hold', 'refuse']), senders: z.array(z.string()).max(64), operatorSources: z.array(z.string()).max(64).optional(), crossWorkspace: z.boolean(), alias: z.string().max(80) }).strict();
