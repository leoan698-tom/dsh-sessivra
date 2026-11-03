import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
// A dialog is rendered by shell.overlay, outside every session row's React
// ancestry. A body portal alone does not provide that event boundary.
export function createSessionDialogStore() {
    let owner;
    let content = null;
    const listeners = new Set();
    const emit = () => listeners.forEach(listener => listener());
    return {
        getSnapshot: () => content,
        subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
        show: (key, next) => { owner = key; content = next; emit(); },
        hide: (key) => { if (owner === key) {
            owner = undefined;
            content = null;
            emit();
        } },
        dispose: () => { owner = undefined; content = null; emit(); listeners.clear(); },
    };
}
export function SessionDialogRequest({ dialogs, children }) {
    const owner = useRef(Symbol('session-dialog')).current;
    useLayoutEffect(() => { if (children)
        dialogs.show(owner, children);
    else
        dialogs.hide(owner); }, [dialogs, owner, children]);
    useLayoutEffect(() => () => dialogs.hide(owner), [dialogs, owner]);
    return null;
}
export function SessionDialogOutlet({ dialogs }) {
    const content = useSyncExternalStore(dialogs.subscribe, dialogs.getSnapshot, dialogs.getSnapshot);
    return _jsx(_Fragment, { children: content });
}
