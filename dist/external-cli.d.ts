import { type ChildProcess } from 'node:child_process';
import { z } from 'zod';
export declare const externalProviders: readonly ["claude", "codex", "grok"];
export declare const externalProvider: z.ZodEnum<{
    claude: "claude";
    codex: "codex";
    grok: "grok";
}>;
export declare const externalTaskSchema: z.ZodObject<{
    provider: z.ZodEnum<{
        claude: "claude";
        codex: "codex";
        grok: "grok";
    }>;
    prompt: z.ZodString;
    sessionId: z.ZodOptional<z.ZodUUID>;
}, z.core.$strict>;
declare const cliConfig: z.ZodObject<{
    executable: z.ZodString;
    timeoutSeconds: z.ZodDefault<z.ZodNumber>;
    dispatchApproval: z.ZodDefault<z.ZodEnum<{
        ask: "ask";
        direct: "direct";
    }>>;
}, z.core.$strict>;
export declare const externalCliSchema: z.ZodRecord<z.ZodEnum<{
    claude: "claude";
    codex: "codex";
    grok: "grok";
}> & z.core.$partial, z.ZodObject<{
    executable: z.ZodString;
    timeoutSeconds: z.ZodDefault<z.ZodNumber>;
    dispatchApproval: z.ZodDefault<z.ZodEnum<{
        ask: "ask";
        direct: "direct";
    }>>;
}, z.core.$strict>>;
type Task = z.output<typeof externalTaskSchema>;
type Cli = z.output<typeof cliConfig>;
export declare function externalWorkspace(cwd: string | null | undefined): Promise<string>;
export declare function terminateCliProcess(child: ChildProcess): void;
export declare function runCliProcess(executable: string, args: string[], cwd: string, input: string | undefined, signal: AbortSignal, timeoutSeconds: number): Promise<{
    exitCode: number | null;
    stopped?: "cancelled" | "timed-out" | "outcome-unknown";
    stdout: ReturnType<() => {
        text: string;
        truncated: boolean;
    }>;
    stderr: ReturnType<() => {
        text: string;
        truncated: boolean;
    }>;
}>;
export declare function runExternalTask(task: Task, cli: Cli, cwd: string, signal: AbortSignal): Promise<{
    provider: "claude" | "codex" | "grok";
    status: string;
    sessionId: string | null;
    exitCode: number | null;
    output: string;
    outputTruncated: boolean;
    diagnostic: string;
}>;
export {};
