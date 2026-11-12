import type { CliChatProvider } from './cli-mention.js';
export type CliQuestion = {
    id: string;
    header?: string;
    question: string;
    detail?: string;
    options?: {
        label: string;
        description?: string;
    }[];
};
type Bridge = {
    session: (id: string) => Promise<void>;
    write: (text: string) => void;
    approve: (tool: string, reason: string) => Promise<boolean>;
    ask: (questions: CliQuestion[]) => Promise<Record<string, string[]>>;
};
declare function codex(exe: string, cwd: string, previous: string | undefined, prompt: string, bridge: Bridge, signal: AbortSignal): Promise<void>;
export declare const cliChatTurn: Record<CliChatProvider, typeof codex>;
export {};
