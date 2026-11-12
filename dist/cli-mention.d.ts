import type { MentionQuery } from './mention-menu.js';
export declare const cliChatNames: {
    readonly codex: "Codex";
    readonly grok: "Grok Build";
    readonly deepseek: "DeepSeek";
    readonly auto: "自动选择";
};
export type CliChatTarget = keyof typeof cliChatNames;
export type CliChatProvider = 'codex' | 'grok';
export declare function cliMarker(target: CliChatTarget): string;
export declare function cliPrompt(text: string): {
    prompt: string;
    targets: ("codex" | "grok" | "deepseek" | "auto")[];
};
export declare const cliUserText: {
    id: string;
    order: number;
    match(text: string, from: number): {
        id: string;
        start: number;
        end: number;
        data: {
            label: string;
        };
    } | undefined;
};
export declare function createCliMentionSource(load: () => Promise<readonly CliChatProvider[]>): {
    name: string;
    trigger: string;
    order: number;
    showGroupTitle: boolean;
    candidates(_session: unknown, { query, quoted, signal }: MentionQuery): Promise<{
        name: "Codex" | "Grok Build" | "DeepSeek" | "自动选择";
        value: "codex" | "grok" | "deepseek" | "auto";
        section: string;
        description: string;
    }[]>;
    onPick({ candidate }: {
        candidate: {
            value: CliChatTarget;
        };
    }): {
        insert: {
            source: string;
            ref: "codex" | "grok" | "deepseek" | "auto";
            label: "Codex" | "Grok Build" | "DeepSeek" | "自动选择";
            appearance: string;
            clipboardText: string;
        };
    };
    codec: {
        clipboardText(ref: CliChatTarget): string;
        serialize(ref: CliChatTarget, signal: AbortSignal): string;
    };
};
