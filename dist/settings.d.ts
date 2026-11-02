import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { Messenger, DeliveryMode } from './core.js';
/** Only authenticated Host operator UI; no corresponding model tool. */
export declare class MessengerSettings extends TypertRemoteService {
    readonly messenger: Messenger;
    constructor(ctx: Context, messenger: Messenger);
    view(): Promise<{
        directory: {
            policy: import("./core.js").Policy;
            id: string;
            workspace: string | null;
            status: string;
            alias: string;
            mode: import("./core.js").Mode;
            permission: "pairGrant" | "policy";
        }[];
        state: import("./core.js").State;
        limits: import("./core.js").Limits;
    }>;
    selectedFor(sourceId: string): {
        permission: "granted" | "ready" | "needsConsent" | "blocked";
        lastReceipt: {
            replyTo?: string | undefined;
            child?: import("./core.js").ChildAddress | undefined;
            reason?: string | undefined;
            deliveryMode?: DeliveryMode | undefined;
            id: string;
            sender: string;
            target: string;
            status: import("./core.js").Status;
        } | null;
        lastReply: {
            replyTo?: string | undefined;
            child?: import("./core.js").ChildAddress | undefined;
            reason?: string | undefined;
            deliveryMode?: DeliveryMode | undefined;
            id: string;
            sender: string;
            target: string;
            status: import("./core.js").Status;
        } | null;
        targetId: string;
        label: string;
        sourceWorkspace: string | null;
        targetWorkspace: string | null;
        revision: string;
        selectedAt: number;
        deliveryMode?: DeliveryMode;
        child?: import("./core.js").ChildAddress;
    } | null;
    selectRecipient(sourceId: string, targetId: string, label: string): Promise<import("./core.js").RecipientSelection>;
    authorizeSelected(sourceId: string, revision: string): Promise<{
        permission: "granted";
    }>;
    revokeSelected(sourceId: string, revision: string): Promise<{
        revoked: boolean;
    }>;
    clearSelected(sourceId: string): Promise<{
        cleared: boolean;
    }>;
    setDeliveryMode(sourceId: string, revision: string, mode: DeliveryMode): Promise<import("./core.js").RecipientSelection>;
    sendOperator(sourceId: string, input: {
        target: string;
        text: string;
        id?: string;
        ttl?: number;
    }): Promise<{
        replyTo?: string | undefined;
        child?: import("./core.js").ChildAddress | undefined;
        reason?: string | undefined;
        deliveryMode?: DeliveryMode | undefined;
        id: string;
        sender: string;
        target: string;
        status: import("./core.js").Status;
    }>;
    conversation(sourceId: string, targetId: string): Promise<import("./core.js").Message[]>;
    policy(id: string, input: unknown): Promise<import("./core.js").Policy>;
    release(id: string): Promise<{
        replyTo?: string | undefined;
        child?: import("./core.js").ChildAddress | undefined;
        reason?: string | undefined;
        deliveryMode?: DeliveryMode | undefined;
        id: string;
        sender: string;
        target: string;
        status: import("./core.js").Status;
    }>;
    backup(includeText: boolean): import("./core.js").State;
    clear(confirmation: string): Promise<void>;
}
