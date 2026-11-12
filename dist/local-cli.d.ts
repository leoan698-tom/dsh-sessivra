import type { Context } from '@deepseek-ai/cordis';
import { z } from 'zod';
import { externalProvider, type externalCliSchema } from './external-cli.js';
type Provider = z.output<typeof externalProvider>;
type Config = z.output<typeof externalCliSchema>;
type Auth = 'signed-in' | 'signed-out' | 'unknown';
export type LocalCliStatus = {
    provider: Provider;
    installed: boolean;
    version: string | null;
    auth: Auth;
    dispatchConfigured: boolean;
    loginRunning: boolean;
    launchFailed: boolean;
    authUnverified?: boolean;
};
declare const statusRecord: z.ZodObject<{
    provider: z.ZodEnum<{
        claude: "claude";
        codex: "codex";
        grok: "grok";
    }>;
    installed: z.ZodBoolean;
    version: z.ZodNullable<z.ZodString>;
    auth: z.ZodEnum<{
        unknown: "unknown";
        "signed-in": "signed-in";
        "signed-out": "signed-out";
    }>;
    dispatchConfigured: z.ZodBoolean;
    authUnverified: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
type CachedStatus = z.output<typeof statusRecord>;
export declare function openLocalCli(ctx: Context, config: Config): Promise<LocalCli>;
export declare class LocalCli {
    private config;
    private cached;
    private save?;
    private scan?;
    private logins;
    private failures;
    private saving;
    private closed;
    constructor(config: Config, cached?: CachedStatus[], save?: ((rows: CachedStatus[]) => Promise<void>) | undefined);
    close(): Promise<void>;
    chatProviders(): ("codex" | "grok")[];
    status(refresh?: boolean): Promise<LocalCliStatus[]>;
    private commit;
    private detect;
    login(raw: Provider): Promise<'started' | 'already-running' | 'terminal-required' | 'missing'>;
}
export {};
