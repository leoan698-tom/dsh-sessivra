import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useSyncExternalStore } from 'react';
function findRow(message, mainOnly) {
    const chat = [...document.querySelectorAll('[data-conversation-session]')].find(element => element.dataset.conversationSession === message.origin.sessionId &&
        (!mainOnly || !element.closest('[data-sessivra-pane]')) &&
        !element.closest('[hidden], [inert]') && element.getClientRects().length > 0);
    if (!chat)
        return;
    const rows = [...chat.querySelectorAll('[data-chat-node-key]')];
    const turn = 'turn' in message ? message.turn : undefined;
    return rows.find(row => row.dataset.chatNodeKey === message.nodeKey && row.getClientRects().length > 0)
        ?? rows.find(row => turn !== undefined && row.dataset.chatTurn === String(turn) &&
            row.getClientRects().length > 0);
}
export function createMessageNavigator(sessions, open, resolve) {
    const listeners = new Set();
    let state = {};
    let active;
    const publish = (next) => {
        state = next;
        listeners.forEach(notify => notify());
    };
    return {
        subscribe(notify) { listeners.add(notify); return () => { listeners.delete(notify); }; },
        snapshot: () => state,
        dismiss() { active?.abort(); publish({}); },
        async jump(location, expectedId = '', bookmark = false) {
            active?.abort();
            const controller = new AbortController();
            active = controller;
            const { signal } = controller;
            publish({ loading: true });
            try {
                const message = await resolve(location, expectedId);
                signal.throwIfAborted();
                const childSessionId = message.origin.sessionId;
                const target = message.child
                    ? { childSessionId, parentSessionId: message.child.parentSessionId, mode: message.child.mode }
                    : childSessionId;
                open(target);
                await sessions.using(target, { source: 'workspaceOperation', signal }, async (reference) => {
                    await reference.ready;
                    signal.throwIfAborted();
                    await reference.binding.session.loadThrough(message.origin.seq);
                });
                // History can finish paging before React commits the newly loaded rows.
                const until = Date.now() + 4000;
                while (!signal.aborted && Date.now() < until) {
                    const row = findRow(message, bookmark);
                    if (row) {
                        row.scrollIntoView({ block: 'center' });
                        publish({ row });
                        return;
                    }
                    await new Promise(resolve => setTimeout(resolve, 70));
                }
                if (!signal.aborted)
                    publish({ error: '已打开会话，原消息未能定位。' });
            }
            catch (error) {
                if (!signal.aborted)
                    publish({ error: error instanceof Error ? error.message : '无法打开原消息' });
            }
        },
    };
}
export function MessageJumpNotice({ navigator, Button }) {
    const state = useSyncExternalStore(navigator.subscribe, navigator.snapshot);
    const { row, loading, error } = state;
    useEffect(() => {
        if (!row)
            return;
        row.setAttribute('data-sessivra-message-highlight', '');
        const timer = setTimeout(() => {
            if (navigator.snapshot() === state)
                navigator.dismiss();
        }, 2400);
        return () => {
            clearTimeout(timer);
            row.removeAttribute('data-sessivra-message-highlight');
        };
    }, [navigator, row, state]);
    if (row)
        return _jsx("style", { children: `
    [data-sessivra-message-highlight]{
      outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));
      outline-offset:3px;border-radius:var(--dsw-radius-md);
    }
  ` });
    if (!loading && !error)
        return null;
    return _jsxs("div", { style: {
            position: 'fixed', bottom: 24, right: 24, zIndex: 100, maxWidth: 'calc(100vw - 48px)',
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px 6px 12px',
            fontSize: 13, borderRadius: 'var(--dsw-radius-md)', color: 'var(--dsw-alias-label-primary)',
            background: 'var(--dsw-alias-bg-layer-1)', boxShadow: 'var(--dsw-elevation-soft)',
        }, children: [_jsx("span", { role: error ? 'alert' : 'status', children: error ?? '正在定位原消息…' }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => navigator.dismiss(), children: error ? '关闭' : '取消' })] });
}
