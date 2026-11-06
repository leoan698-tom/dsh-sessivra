import { type UserMessage } from '@deepseek-ai/dsh-llm';
export { operatorAddress } from './identity.js';
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        'plugin:dsh-session-messenger': {
            kind: 'plugin:dsh-session-messenger';
            actor?: 'operator';
            sender?: string;
            messageId?: string;
        };
    }
}
export type Mode = 'accept' | 'hold' | 'refuse';
export type DeliveryMode = 'queue' | 'insert';
export type Status = 'queued' | 'dispatching' | 'delivered' | 'claimed' | 'processed' | 'received' | 'failed' | 'expired' | 'uncertain';
export interface Policy {
    mode: Mode;
    senders: string[];
    operatorSources?: string[];
    crossWorkspace: boolean;
    workspace: string | null;
    alias: string;
}
export interface ChildAddress {
    parentId: string;
    childId: string;
    kind: 'teammate' | 'standalone';
}
export interface Message {
    id: string;
    sender: string;
    target: string;
    text: string;
    created: number;
    expires: number;
    status: Status;
    replyTo?: string;
    hops: number;
    hostId: string;
    reason?: string;
    acknowledgedAt?: number;
    origin?: 'operator' | 'agent';
    sourceRoot?: string;
    sourceWorkspace?: string | null;
    targetWorkspace?: string | null;
    deliveryMode?: DeliveryMode;
    child?: ChildAddress;
}
export interface RecipientSelection {
    targetId: string;
    label: string;
    sourceWorkspace: string | null;
    targetWorkspace: string | null;
    revision: string;
    selectedAt: number;
    deliveryMode?: DeliveryMode;
    child?: ChildAddress;
}
export interface PairGrant {
    sourceId: string;
    targetId: string;
    sourceWorkspace: string;
    targetWorkspace: string;
    grantedAt: number;
}
export interface State {
    policies: Record<string, Policy>;
    messages: Record<string, Message>;
    budgets: Record<string, {
        start: number;
        sent: number;
        wakes: number;
    }>;
    selectedRecipients?: Record<string, RecipientSelection>;
    pairGrants?: Record<string, PairGrant>;
}
export interface SessionAddress {
    id: string;
    agentPreset?: string;
    cwd?: string | null;
    origin?: 'subagent';
    delegationDepth?: number;
    parentSession?: string;
}
export interface Root {
    id: string;
    status: string;
    session: {
        header: {
            cwd?: string | null;
            origin?: 'subagent';
            delegationDepth?: number;
            parentSession?: string;
        };
    };
    followup(message: UserMessage): void;
    steer(message: UserMessage): void;
}
export interface ChildRecipient extends SessionAddress {
    child: ChildAddress;
}
export interface ChildTransport {
    inspect(parent: Root, childId: string, signal?: AbortSignal): Promise<ChildRecipient | undefined>;
    send(parent: Root, recipient: ChildRecipient, input: UserMessage, deliveryMode: DeliveryMode, signal: AbortSignal, beforeDispatch?: () => void): Promise<string>;
    reply(child: Root, parentId: string, input: UserMessage, signal: AbortSignal): Promise<string>;
}
export interface Runtime {
    roots(): Root[];
    get(id: string): Root | undefined;
    resolve?(id: string): Promise<Root | undefined>;
    inspect?(id: string): Promise<SessionAddress | undefined>;
    children?: ChildTransport;
}
export interface Store {
    read(): State;
    write(state: State): Promise<void>;
}
export interface Limits {
    maxLength: number;
    maxQueue: number;
    maxRecords: number;
    ratePerMinute: number;
    wakesPerMinute: number;
    maxHops: number;
    maxTTL: number;
}
export declare const defaults: Limits;
export declare const emptyState: () => State;
export declare function workspace(cwd?: string | null): string | null;
/** Single writer per Host; persistence commits before delivery; no automatic retry after ambiguous dispatch. */
export declare class Messenger {
    private runtime;
    private store;
    readonly limits: Limits;
    private clock;
    private tail;
    private closed;
    private causality;
    constructor(runtime: Runtime, store: Store, limits?: Limits, clock?: () => number);
    private serial;
    private live;
    private policy;
    private policyAt;
    private grant;
    private readyFor;
    directory(caller?: Root): {
        id: string;
        workspace: string | null;
        status: string;
        alias: string;
        mode: Mode;
        permission: "pairGrant" | "policy";
    }[];
    /** Read-only progress uses existing exact-pair/policy admission; never grant here. */
    assertProgressAccess(caller: Root, target: SessionAddress): void;
    /** Task scopes extend one explicitly established pair, never a general sender grant.
     * The task transport separately checks live identities, ownership and archive state. */
    taskPair(source: SessionAddress, target: SessionAddress): number;
    progressMessages(caller: Root, target: SessionAddress): {
        total: number;
        messages: {
            associatedReply: {
                state: string;
                id?: undefined;
                status?: undefined;
            } | {
                state: string;
                id: string;
                status: Status;
            };
            id: string;
            sender: string;
            target: string;
            text: string;
            created: number;
            expires: number;
            status: Status;
            replyTo?: string;
            hops: number;
            hostId: string;
            reason?: string;
            acknowledgedAt?: number;
            origin?: "operator" | "agent";
            sourceRoot?: string;
            sourceWorkspace?: string | null;
            targetWorkspace?: string | null;
            deliveryMode?: DeliveryMode;
            child?: ChildAddress;
        }[];
    };
    inspectPolicy(id: string): Policy;
    selectedFor(sourceId: string): {
        permission: "granted" | "ready" | "needsConsent" | "blocked";
        lastReceipt: {
            replyTo?: string | undefined;
            child?: ChildAddress | undefined;
            reason?: string | undefined;
            deliveryMode?: DeliveryMode | undefined;
            id: string;
            sender: string;
            target: string;
            status: Status;
        } | null;
        lastReply: {
            replyTo?: string | undefined;
            child?: ChildAddress | undefined;
            reason?: string | undefined;
            deliveryMode?: DeliveryMode | undefined;
            id: string;
            sender: string;
            target: string;
            status: Status;
        } | null;
        targetId: string;
        label: string;
        sourceWorkspace: string | null;
        targetWorkspace: string | null;
        revision: string;
        selectedAt: number;
        deliveryMode?: DeliveryMode;
        child?: ChildAddress;
    } | null;
    /** A direct user composer mention selects a destination; it never dispatches. */
    selectRecipientById(sourceId: string, targetId: string, label: string): Promise<RecipientSelection>;
    selectRecipient(caller: Root, targetId: string, label: string, referenceRevision?: string, rememberSelection?: boolean): Promise<RecipientSelection>;
    /** The visible composer can clear its own recipient without touching policy. */
    clearSelected(sourceId: string): Promise<{
        cleared: boolean;
    }>;
    setDeliveryMode(sourceId: string, revision: string, deliveryMode: DeliveryMode): Promise<RecipientSelection>;
    /** The authenticated composer grants exactly one A→B pair; browsing and model tools cannot grant. */
    authorizeSelected(sourceId: string, revision: string): Promise<{
        permission: "granted";
    }>;
    revokeSelected(sourceId: string, revision: string): Promise<{
        revoked: boolean;
    }>;
    /** Trusted human UI only. Never register policy mutation as a model tool. */
    setPolicy(id: string, input: Omit<Policy, 'workspace'>): Promise<Policy>;
    /** The settings RPC is an operator action. The selected root supplies workspace context, never agent identity. */
    sendOperator(sourceId: string, args: {
        target: string;
        text: string;
        id?: string;
        ttl?: number;
    }): Promise<{
        replyTo?: string | undefined;
        child?: ChildAddress | undefined;
        reason?: string | undefined;
        deliveryMode?: DeliveryMode | undefined;
        id: string;
        sender: string;
        target: string;
        status: Status;
    }>;
    send(caller: Root, args: {
        target?: string;
        text: string;
        id?: string;
        ttl?: number;
        replyTo?: string;
        selectionRevision?: string;
        deliveryMode?: DeliveryMode;
    }, signal?: AbortSignal): Promise<{
        replyTo?: string | undefined;
        child?: ChildAddress | undefined;
        reason?: string | undefined;
        deliveryMode?: DeliveryMode | undefined;
        id: string;
        sender: string;
        target: string;
        status: Status;
    }>;
    /** Child Agents may only answer their own recorded parent request. They do
     * not become root senders, operator identities, or policy administrators. */
    private replyFromChild;
    private childParticipant;
    /** Shared ledger, quotas and explicit-pair admission; called only while this
     * Messenger's writer is held. Native delivery owns child residency/queues. */
    private sendChildRecord;
    private deliverChild;
    private pairGrantForAt;
    private acceptsAt;
    private accepts;
    private admissionAt;
    private admission;
    private workspaceAllowed;
    private workspaceAllowedAt;
    private deliver;
    private input;
    release(id: string): Promise<{
        replyTo?: string | undefined;
        child?: ChildAddress | undefined;
        reason?: string | undefined;
        deliveryMode?: DeliveryMode | undefined;
        id: string;
        sender: string;
        target: string;
        status: Status;
    }>;
    /** Claim proves inbox consumption only, never a model response. */
    claimed(root: Root, hostId: string, messageId?: string): Promise<void>;
    userInput(root: Root): void;
    acknowledge(root: Root, id: string): Promise<{
        replyTo?: string | undefined;
        child?: ChildAddress | undefined;
        reason?: string | undefined;
        deliveryMode?: DeliveryMode | undefined;
        id: string;
        sender: string;
        target: string;
        status: Status;
    }>;
    status(root: Root, id: string): {
        replyTo?: string | undefined;
        child?: ChildAddress | undefined;
        reason?: string | undefined;
        deliveryMode?: DeliveryMode | undefined;
        id: string;
        sender: string;
        target: string;
        status: Status;
    };
    recover(): Promise<void>;
    sweep(): Promise<void>;
    discarded(root: Root, hostId: string): Promise<void>;
    disposed(root: Root): Promise<void>;
    snapshot(includeText?: boolean): State;
    clear(): Promise<void>;
    close(): Promise<void>;
    private receipt;
}
