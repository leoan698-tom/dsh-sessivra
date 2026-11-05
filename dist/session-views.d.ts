import React from 'react';
import type { ISessions, SessionReference, SessionTarget } from '@deepseek-ai/dsh-api-session-controller/client';
import type { PropsRenderFactories, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { TreeStore } from './session-tree.js';
import type { createSessionReferenceDrop } from './session-reference-drop.js';
import type { Menu as HostMenu } from '@deepseek-ai/dsh-client-ui-primitives';
import type { HeaderViews } from './header-views.js';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        'sessivra.conversation.pane': {
            kind: 'single';
            scope: 'session';
        };
        'sessivra.conversation.header': {
            kind: 'single';
            scope: 'session';
        };
    }
}
declare module '@deepseek-ai/dsh-api-session-controller/client' {
    interface SessionReferenceSourceMap {
        sessivraView: unknown;
    }
}
export declare function SessionViewContent(props: PropsRuntime<'sessivra.conversation.pane'> & PropsRenderFactories): React.JSX.Element;
export declare function createSessionViews(sessions: Pick<ISessions, 'retain'>): {
    getSnapshot: () => {
        id: string;
        label: string;
        reference: SessionReference;
        error?: string;
        ready: boolean;
    }[];
    subscribe: (listener: () => void) => () => void;
    open(target: SessionTarget, label: string): import("@deepseek-ai/dsh-session").SessionId;
    close: (id: string) => void;
    dispose(): void;
};
type Views = ReturnType<typeof createSessionViews>;
type ViewProps = PropsRuntime<'shell.overlay'> & PropsRenderSlots<'sessivra.conversation.pane' | 'sessivra.conversation.header'> & {
    views: Views;
    store: TreeStore;
    referenceDrop: ReturnType<typeof createSessionReferenceDrop>;
    Menu: typeof HostMenu;
    selectSession(target: SessionTarget): void;
    startSession(): void;
    headerViews: HeaderViews;
};
export declare function SessionViews(props: ViewProps): React.ReactPortal | null;
export {};
