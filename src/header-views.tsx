import { useEffect } from 'react';
import type { StoredEntry } from '@deepseek-ai/dsh-client-ui-slots';

interface View { id: string; label: string }
interface ViewState { views: readonly View[]; current?: string | null; selectView(id: string): void }
export function createHeaderViews() {
  let snapshot = new Map<string, ViewState>();
  const listeners = new Set<() => void>();
  const emit = () => { for (const listener of listeners) listener(); };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    register(id: string, state: ViewState) {
      snapshot = new Map(snapshot).set(id, state); emit();
      return () => { if (snapshot.get(id) === state) { snapshot = new Map(snapshot); snapshot.delete(id); emit(); } };
    },
  };
}
export type HeaderViews = ReturnType<typeof createHeaderViews>;
interface BridgeProps {
  sessionId: string; headerViews: HeaderViews;
  useConversationViews<T>(selector: (views: readonly View[]) => T): T;
  useStore<T>(selector: (state: { view?: string | null }) => T): T;
  selectView(id: string): void;
}
function HeaderViewsBridge(props: BridgeProps) {
  const views = props.useConversationViews(views => views), current = props.useStore(state => state.view);
  useEffect(() => props.headerViews.register(props.sessionId, { views, current, selectView: props.selectView }), [props.headerViews, props.sessionId, views, current, props.selectView]);
  return null;
}

/** Share the native header's scoped Store and injected view actions through its public action seat. */
export function wireHeaderViews(slots: {
  entriesOfSlot(name: string): readonly StoredEntry[]; subscribe(name: string, listener: () => void): () => void;
  register(options: object, component: React.ComponentType<never>): () => void;
}, headerViews: HeaderViews) {
  let remove: (() => void) | undefined;
  const bind = () => {
    remove?.(); remove = undefined;
    const native = slots.entriesOfSlot('conversation.session.header')[0];
    if (!native?.store || !native.inject) return;
    const inject = native.inject as (...args: unknown[]) => Record<string, unknown>;
    remove = slots.register({ name: 'conversation.session.header.actions', id: 'sessivra-header-views', store: native.store,
      inject: (...args: unknown[]) => ({ ...inject(...args), headerViews }),
    }, HeaderViewsBridge);
  };
  bind();
  const unsubscribe = slots.subscribe('conversation.session.header', bind);
  return () => { unsubscribe(); remove?.(); };
}
