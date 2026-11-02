import type { Context } from '@deepseek-ai/cordis';
import type { SessionEvent, SessionSeq } from '@deepseek-ai/dsh-session';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { z } from 'zod';
import { type Messenger } from './core.js';
export declare const progressInput: z.ZodObject<{
    target: z.ZodOptional<z.ZodString>;
    after: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
/** Whitelist observable facts. Never return raw request headers, arguments, tool output or reasoning. */
export declare function progressEvent(event: SessionEvent): {
    seq: number;
    time: number;
    type: string;
} | {
    tool: string | undefined;
    callId: string | undefined;
    seq: number;
    time: number;
    type: string;
} | {
    callId: string | undefined;
    isError: boolean;
    errorCode: string | undefined;
    seq: number;
    time: number;
    type: string;
} | {
    turn: unknown;
    step: unknown;
    seq: number;
    time: number;
    type: string;
} | {
    turn: unknown;
    outcome: string | undefined;
    errorCode: string | undefined;
    seq: number;
    time: number;
    type: string;
} | {
    provider: string | undefined;
    model: string | undefined;
    reasoningEffort: string | undefined;
    seq: number;
    time: number;
    type: string;
} | {
    sourceKind: string | undefined;
    seq: number;
    time: number;
    type: string;
} | {
    textExcerpt: string | undefined;
    textTruncated: boolean;
    seq: number;
    time: number;
    type: string;
};
/** Bounded, cold-safe observations. No resume, dispatch, grant, acknowledgement or state writes. */
export declare class ProgressReader {
    private ctx;
    private messenger;
    constructor(ctx: Context, messenger: Messenger);
    read(caller: Agent, input: z.output<typeof progressInput>, signal: AbortSignal): Promise<{
        target: string;
        sampledAt: string;
        startedAt: string;
        trust: string;
        source: {
            events: string;
            availability: "live" | "prepared";
            activation: string;
            transport: string;
        };
        runtime: {
            status: string;
            queue: {
                nextTurn: number;
                nextStep: number;
            } | null;
        };
        waitingForUser: {
            state: string;
            reason: string;
        };
        businessCompletion: string;
        coverage: {
            sampledThroughSeq: number;
            fromSeq: SessionSeq;
            toSeq: SessionSeq | null;
            maxEvents: number;
            recentHorizon: number;
            omittedBeforeSeq: number;
            skippedSinceCursor: number;
            hasMore: boolean;
            coldReadMayReplayWholeLogInternally: boolean;
            transportLimit: number;
            transportReturned: number;
            transportTotalAtSample: number;
            transportTruncated: boolean;
            transportScope: string;
        };
        events: ({
            seq: number;
            time: number;
            type: string;
        } | {
            tool: string | undefined;
            callId: string | undefined;
            seq: number;
            time: number;
            type: string;
        } | {
            callId: string | undefined;
            isError: boolean;
            errorCode: string | undefined;
            seq: number;
            time: number;
            type: string;
        } | {
            turn: unknown;
            step: unknown;
            seq: number;
            time: number;
            type: string;
        } | {
            turn: unknown;
            outcome: string | undefined;
            errorCode: string | undefined;
            seq: number;
            time: number;
            type: string;
        } | {
            provider: string | undefined;
            model: string | undefined;
            reasoningEffort: string | undefined;
            seq: number;
            time: number;
            type: string;
        } | {
            sourceKind: string | undefined;
            seq: number;
            time: number;
            type: string;
        } | {
            textExcerpt: string | undefined;
            textTruncated: boolean;
            seq: number;
            time: number;
            type: string;
        })[];
        messages: {
            id: string;
            created: number;
            status: import("./core.js").Status;
            replyTo: string | undefined;
            associatedReply: {
                state: string;
                id?: undefined;
                status?: undefined;
            } | {
                state: string;
                id: string;
                status: import("./core.js").Status;
            };
            direction: string;
            reason: string | undefined;
            textExcerpt: string;
            textTruncated: boolean;
            meaning: string;
        }[];
        nextCursor: string;
    }>;
}
