import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
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
                        publish(bookmark ? {} : { row, message });
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
export function MessageJumpNotice({ navigator, organize }) {
    const { row, message, loading, error } = useSyncExternalStore(navigator.subscribe, navigator.snapshot);
    if (row && message)
        return createPortal(_jsxs("div", { className: "sessivra-message-origin", children: [_jsx("style", { children: `.sessivra-message-origin{padding:6px 8px;margin:4px 0;border-inline-start:3px solid var(--dsw-alias-state-business-primary);background:var(--dsw-alias-bg-layer-1);display:flex;align-items:center;gap:10px}.sessivra-message-origin button{cursor:pointer;color:inherit;font:inherit}` }), _jsx("span", { children: "\u5DF2\u5B9A\u4F4D\u539F\u6D88\u606F" }), organize && _jsx("button", { type: "button", onClick: () => { navigator.dismiss(); organize(message); }, children: "\u6574\u7406\u6210\u4EFB\u52A1" })] }), row);
    if (!loading && !error)
        return null;
    return _jsxs("div", { role: error ? 'alert' : 'status', style: { position: 'fixed', bottom: 24, right: 24, zIndex: 100, padding: 12, borderRadius: 8, background: 'var(--dsw-alias-bg-layer-1)', boxShadow: 'var(--dsw-elevation-soft)' }, children: [error ?? '正在定位原消息…', ' ', _jsx("button", { type: "button", onClick: () => navigator.dismiss(), children: "\u5173\u95ED" })] });
}
