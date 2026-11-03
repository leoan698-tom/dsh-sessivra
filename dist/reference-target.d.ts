import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { Collaboration } from './collaboration.js';
import type { Messenger } from './core.js';
/** Exact ids from Host-prepared context metadata, never from snapshot prose. */
export declare function latestSessionReferences(agent: Agent): {
    id: import("@deepseek-ai/dsh-llm").MessageId;
    references: {
        target: string;
        label: string;
    }[];
} | undefined;
/** A reference is background context until an explicit message tool is invoked. */
export declare class ReferenceTargets {
    private ctx;
    private collaboration;
    private messenger;
    constructor(ctx: Context, collaboration: Collaboration, messenger: Messenger);
    resolve(agent: Agent, target?: string): Promise<{
        source: "session-reference";
        requiresTarget: true;
        candidates: {
            reason?: string | undefined;
            canReference: boolean;
            canMessage: boolean;
            target: string;
            label: string;
        }[];
    } | {
        child?: import("./core.js").ChildAddress | undefined;
        lastReceipt?: {
            replyTo?: string | undefined;
            child?: import("./core.js").ChildAddress | undefined;
            reason?: string | undefined;
            deliveryMode?: import("./core.js").DeliveryMode | undefined;
            id: string;
            sender: string;
            target: string;
            status: import("./core.js").Status;
        } | null | undefined;
        lastReply?: {
            replyTo?: string | undefined;
            child?: import("./core.js").ChildAddress | undefined;
            reason?: string | undefined;
            deliveryMode?: import("./core.js").DeliveryMode | undefined;
            id: string;
            sender: string;
            target: string;
            status: import("./core.js").Status;
        } | null | undefined;
        selectionRevision: string;
        permission: string;
        targetStatus: string;
        reason?: string | undefined;
        canReference: boolean;
        canMessage: boolean;
        target: string;
        label: string;
        source: "session-reference";
        requiresTarget: false;
        candidates?: undefined;
    } | undefined>;
    send(agent: Agent, args: Parameters<Messenger['send']>[1], signal: AbortSignal): Promise<{
        replyTo?: string | undefined;
        child?: import("./core.js").ChildAddress | undefined;
        reason?: string | undefined;
        deliveryMode?: import("./core.js").DeliveryMode | undefined;
        id: string;
        sender: string;
        target: string;
        status: import("./core.js").Status;
    }>;
    /** Explicit task admission uses the same exact reference and consent boundary as send. */
    prepareTask(agent: Agent, target: string | undefined, selectionRevision: string | undefined, signal: AbortSignal): Promise<import("./core.js").RecipientSelection>;
}
