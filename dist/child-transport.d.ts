import type { Context } from '@deepseek-ai/cordis';
import type { ChildTransport } from './core.js';
/** rc.5's own Team mailbox uses these exported host adapters. They retain
 * plugin attribution and queue/steer semantics under native child ownership. */
export declare function childTransport(ctx: Context): ChildTransport;
