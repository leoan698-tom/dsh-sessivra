import type { Context } from '@deepseek-ai/cordis';
import '@deepseek-ai/dsh-agent';
import { type Limits, type Root } from './core.js';
import { MessengerSettings } from './settings.js';
import '@deepseek-ai/dsh-typert-registry';
import { type TreeSessionSummary } from './collaboration.js';
export declare const name = "dsh-session-messenger";
export declare const inject: string[];
interface SessionControllerAccess {
    create(request: {
        sessionId: string;
        cwd: string;
    }): Promise<{
        sessionId: string;
    }>;
    rename(request: {
        sessionId: string;
        title: string;
    }): Promise<unknown>;
    list(request: {
        cursor?: string;
    }, signal: AbortSignal): Promise<{
        items: TreeSessionSummary[];
    }>;
    resolveAgent(id: string): Promise<{
        agent: Root;
    } | {
        error: Error;
    }>;
    inspect(id: string): Promise<{
        meta: {
            id: string;
            cwd?: string | null;
            origin?: 'subagent';
            delegationDepth?: number;
            parentSession?: string;
        };
    } | null>;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        sessionMessenger: MessengerSettings;
        sessionController: SessionControllerAccess;
    }
}
export declare function apply(ctx: Context, config?: Partial<Limits>): Promise<void>;
export {};
