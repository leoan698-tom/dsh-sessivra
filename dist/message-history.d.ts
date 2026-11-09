import type { Context } from '@deepseek-ai/cordis';
import { z } from 'zod';
export declare const messageLocation: z.ZodObject<{
    sessionId: z.ZodString;
    seq: z.ZodNumber;
}, z.core.$strict>;
export declare const messageOrigin: z.ZodObject<{
    sessionId: z.ZodString;
    seq: z.ZodNumber;
    messageId: z.ZodString;
}, z.core.$strict>;
export type MessageLocation = z.infer<typeof messageLocation>;
export type MessageOrigin = z.infer<typeof messageOrigin>;
export declare const bookmarkedTurnNumbers: z.ZodArray<z.ZodNumber>;
export interface BookmarkedTurn {
    turn: number;
    prompt: string;
    response: string;
    anchor: MessageOrigin;
}
export declare function readBookmarkedTurns(ctx: Context, id: string, turns: readonly number[], textForPreview?: boolean): Promise<{
    title: string;
    items: BookmarkedTurn[];
}>;
export type BookmarkedSession = Awaited<ReturnType<typeof readBookmarkedTurns>>;
export declare const bookmarkedTurn: z.ZodNumber;
export declare const legacyBookmarkQuote: z.ZodObject<{
    title: z.ZodString;
    turn: z.ZodNumber;
    prompt: z.ZodString;
    response: z.ZodString;
}, z.core.$strict>;
export type LegacyBookmarkQuote = z.infer<typeof legacyBookmarkQuote>;
export declare function readBookmarkReference(ctx: Context, origin: MessageOrigin, turn: number): Promise<string>;
export declare class MessageHistory {
    private ctx;
    private cache;
    private refreshing?;
    constructor(ctx: Context);
    private refresh;
    locateLegacyBookmark({ title, turn, prompt, response }: LegacyBookmarkQuote): Promise<{
        sessionId: string;
        seq: number;
        messageId: string;
    } | null>;
}
export declare function readMessageOrigin(ctx: Context, location: MessageLocation, expectedId?: string): Promise<{
    nodeKey: string;
    turn?: number | undefined;
    cwd: string;
    title: string;
    excerpt: string;
    child?: {
        parentSessionId: string;
        mode: "continuable" | "one-shot";
    } | undefined;
    origin: {
        messageId: import("@deepseek-ai/dsh-llm").MessageId;
        sessionId: string;
        seq: number;
    };
}>;
export type ResolvedMessage = Awaited<ReturnType<typeof readMessageOrigin>>;
