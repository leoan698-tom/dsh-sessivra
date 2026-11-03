import React from 'react';
export declare function createSessionDialogStore(): {
    getSnapshot: () => React.ReactNode;
    subscribe: (listener: () => void) => () => void;
    show: (key: symbol, next: React.ReactNode) => void;
    hide: (key: symbol) => void;
    dispose: () => void;
};
export type SessionDialogStore = ReturnType<typeof createSessionDialogStore>;
export declare function SessionDialogRequest({ dialogs, children }: {
    dialogs: SessionDialogStore;
    children: React.ReactNode;
}): null;
export declare function SessionDialogOutlet({ dialogs }: {
    dialogs: SessionDialogStore;
}): React.JSX.Element;
