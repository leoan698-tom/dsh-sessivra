import type { Context } from '@deepseek-ai/cordis';
import { z } from 'zod';
import { type externalCliSchema } from './external-cli.js';
type Config = z.output<typeof externalCliSchema>;
export declare function installCliChat(ctx: Context, config: Config): Promise<void>;
export {};
