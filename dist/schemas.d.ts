import { z } from 'zod';
export { policyInput } from './validation.js';
export declare const stateSchema: z.ZodObject<{
    policies: z.ZodRecord<z.ZodString, z.ZodObject<{
        mode: z.ZodEnum<{
            accept: "accept";
            hold: "hold";
            refuse: "refuse";
        }>;
        senders: z.ZodArray<z.ZodString>;
        operatorSources: z.ZodOptional<z.ZodArray<z.ZodString>>;
        crossWorkspace: z.ZodBoolean;
        alias: z.ZodString;
        workspace: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>>;
    messages: z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        sender: z.ZodString;
        target: z.ZodString;
        text: z.ZodString;
        created: z.ZodNumber;
        expires: z.ZodNumber;
        status: z.ZodEnum<{
            queued: "queued";
            dispatching: "dispatching";
            delivered: "delivered";
            claimed: "claimed";
            processed: "processed";
            received: "received";
            failed: "failed";
            expired: "expired";
            uncertain: "uncertain";
        }>;
        replyTo: z.ZodOptional<z.ZodString>;
        hops: z.ZodNumber;
        hostId: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
        acknowledgedAt: z.ZodOptional<z.ZodNumber>;
        origin: z.ZodOptional<z.ZodEnum<{
            operator: "operator";
            agent: "agent";
        }>>;
        sourceRoot: z.ZodOptional<z.ZodString>;
        sourceWorkspace: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        targetWorkspace: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        deliveryMode: z.ZodOptional<z.ZodEnum<{
            queue: "queue";
            insert: "insert";
        }>>;
        child: z.ZodOptional<z.ZodObject<{
            parentId: z.ZodString;
            childId: z.ZodString;
            kind: z.ZodEnum<{
                teammate: "teammate";
                standalone: "standalone";
            }>;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    budgets: z.ZodRecord<z.ZodString, z.ZodObject<{
        start: z.ZodNumber;
        sent: z.ZodNumber;
        wakes: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strict>;
export declare const domainSpec: {
    name: string;
    version: number;
    tables: {};
    global: {
        schema: z.ZodObject<{
            policies: z.ZodRecord<z.ZodString, z.ZodObject<{
                mode: z.ZodEnum<{
                    accept: "accept";
                    hold: "hold";
                    refuse: "refuse";
                }>;
                senders: z.ZodArray<z.ZodString>;
                operatorSources: z.ZodOptional<z.ZodArray<z.ZodString>>;
                crossWorkspace: z.ZodBoolean;
                alias: z.ZodString;
                workspace: z.ZodNullable<z.ZodString>;
            }, z.core.$strict>>;
            messages: z.ZodRecord<z.ZodString, z.ZodObject<{
                id: z.ZodString;
                sender: z.ZodString;
                target: z.ZodString;
                text: z.ZodString;
                created: z.ZodNumber;
                expires: z.ZodNumber;
                status: z.ZodEnum<{
                    queued: "queued";
                    dispatching: "dispatching";
                    delivered: "delivered";
                    claimed: "claimed";
                    processed: "processed";
                    received: "received";
                    failed: "failed";
                    expired: "expired";
                    uncertain: "uncertain";
                }>;
                replyTo: z.ZodOptional<z.ZodString>;
                hops: z.ZodNumber;
                hostId: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
                acknowledgedAt: z.ZodOptional<z.ZodNumber>;
                origin: z.ZodOptional<z.ZodEnum<{
                    operator: "operator";
                    agent: "agent";
                }>>;
                sourceRoot: z.ZodOptional<z.ZodString>;
                sourceWorkspace: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                targetWorkspace: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                deliveryMode: z.ZodOptional<z.ZodEnum<{
                    queue: "queue";
                    insert: "insert";
                }>>;
                child: z.ZodOptional<z.ZodObject<{
                    parentId: z.ZodString;
                    childId: z.ZodString;
                    kind: z.ZodEnum<{
                        teammate: "teammate";
                        standalone: "standalone";
                    }>;
                }, z.core.$strict>>;
            }, z.core.$strict>>;
            budgets: z.ZodRecord<z.ZodString, z.ZodObject<{
                start: z.ZodNumber;
                sent: z.ZodNumber;
                wakes: z.ZodNumber;
            }, z.core.$strip>>;
        }, z.core.$strict>;
        initial: import("./core.js").State;
    };
};
export declare const recipientStateSchema: z.ZodObject<{
    selectedRecipients: z.ZodRecord<z.ZodString, z.ZodObject<{
        targetId: z.ZodString;
        label: z.ZodString;
        sourceWorkspace: z.ZodNullable<z.ZodString>;
        targetWorkspace: z.ZodNullable<z.ZodString>;
        revision: z.ZodString;
        selectedAt: z.ZodNumber;
        deliveryMode: z.ZodOptional<z.ZodEnum<{
            queue: "queue";
            insert: "insert";
        }>>;
        child: z.ZodOptional<z.ZodObject<{
            parentId: z.ZodString;
            childId: z.ZodString;
            kind: z.ZodEnum<{
                teammate: "teammate";
                standalone: "standalone";
            }>;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    pairGrants: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        sourceId: z.ZodString;
        targetId: z.ZodString;
        sourceWorkspace: z.ZodString;
        targetWorkspace: z.ZodString;
        grantedAt: z.ZodNumber;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export declare const recipientDomainSpec: {
    name: string;
    version: number;
    tables: {};
    global: {
        schema: z.ZodObject<{
            selectedRecipients: z.ZodRecord<z.ZodString, z.ZodObject<{
                targetId: z.ZodString;
                label: z.ZodString;
                sourceWorkspace: z.ZodNullable<z.ZodString>;
                targetWorkspace: z.ZodNullable<z.ZodString>;
                revision: z.ZodString;
                selectedAt: z.ZodNumber;
                deliveryMode: z.ZodOptional<z.ZodEnum<{
                    queue: "queue";
                    insert: "insert";
                }>>;
                child: z.ZodOptional<z.ZodObject<{
                    parentId: z.ZodString;
                    childId: z.ZodString;
                    kind: z.ZodEnum<{
                        teammate: "teammate";
                        standalone: "standalone";
                    }>;
                }, z.core.$strict>>;
            }, z.core.$strict>>;
            pairGrants: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
                sourceId: z.ZodString;
                targetId: z.ZodString;
                sourceWorkspace: z.ZodString;
                targetWorkspace: z.ZodString;
                grantedAt: z.ZodNumber;
            }, z.core.$strict>>>;
        }, z.core.$strict>;
        initial: {
            selectedRecipients: {};
            pairGrants: {};
        };
    };
};
export declare const conversationRelationSchema: z.ZodObject<{
    parentId: z.ZodString;
    label: z.ZodString;
    createdAt: z.ZodNumber;
    requestHash: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type ConversationRelations = Record<string, z.infer<typeof conversationRelationSchema>>;
export declare const conversationDomainSpec: {
    name: string;
    version: number;
    tables: {};
    global: {
        schema: z.ZodObject<{
            relations: z.ZodRecord<z.ZodString, z.ZodObject<{
                parentId: z.ZodString;
                label: z.ZodString;
                createdAt: z.ZodNumber;
                requestHash: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>>;
        }, z.core.$strict>;
        initial: {
            relations: {};
        };
    };
};
