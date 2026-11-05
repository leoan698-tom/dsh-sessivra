import { useEffect } from 'react';
export function createHeaderViews() {
    let snapshot = new Map();
    const listeners = new Set();
    const emit = () => { for (const listener of listeners)
        listener(); };
    return {
        getSnapshot: () => snapshot,
        subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
        register(id, state) {
            snapshot = new Map(snapshot).set(id, state);
            emit();
            return () => { if (snapshot.get(id) === state) {
                snapshot = new Map(snapshot);
                snapshot.delete(id);
                emit();
            } };
        },
    };
}
function HeaderViewsBridge(props) {
    const views = props.useConversationViews(views => views), current = props.useStore(state => state.view);
    useEffect(() => props.headerViews.register(props.sessionId, { views, current, selectView: props.selectView }), [props.headerViews, props.sessionId, views, current, props.selectView]);
    return null;
}
/** Share the native header's scoped Store and injected view actions through its public action seat. */
export function wireHeaderViews(slots, headerViews) {
    let remove;
    const bind = () => {
        remove?.();
        remove = undefined;
        const native = slots.entriesOfSlot('conversation.session.header')[0];
        if (!native?.store || !native.inject)
            return;
        const inject = native.inject;
        remove = slots.register({ name: 'conversation.session.header.actions', id: 'sessivra-header-views', store: native.store,
            inject: (...args) => ({ ...inject(...args), headerViews }),
        }, HeaderViewsBridge);
    };
    bind();
    const unsubscribe = slots.subscribe('conversation.session.header', bind);
    return () => { unsubscribe(); remove?.(); };
}
