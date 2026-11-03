import React, { useLayoutEffect, useRef, useSyncExternalStore } from 'react';

// A dialog is rendered by shell.overlay, outside every session row's React
// ancestry. A body portal alone does not provide that event boundary.
export function createSessionDialogStore() {
  let owner: symbol | undefined;
  let content: React.ReactNode = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());
  return {
    getSnapshot: () => content,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    show: (key: symbol, next: React.ReactNode) => { owner = key; content = next; emit(); },
    hide: (key: symbol) => { if (owner === key) { owner = undefined; content = null; emit(); } },
    dispose: () => { owner = undefined; content = null; emit(); listeners.clear(); },
  };
}
export type SessionDialogStore = ReturnType<typeof createSessionDialogStore>;

export function SessionDialogRequest({ dialogs, children }: { dialogs: SessionDialogStore; children: React.ReactNode }) {
  const owner = useRef(Symbol('session-dialog')).current;
  useLayoutEffect(() => { if (children) dialogs.show(owner, children); else dialogs.hide(owner); }, [dialogs, owner, children]);
  useLayoutEffect(() => () => dialogs.hide(owner), [dialogs, owner]);
  return null;
}

export function SessionDialogOutlet({ dialogs }: { dialogs: SessionDialogStore }) {
  const content = useSyncExternalStore(dialogs.subscribe, dialogs.getSnapshot, dialogs.getSnapshot);
  return <>{content}</>;
}
