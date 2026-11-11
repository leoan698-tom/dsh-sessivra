import React, { useEffect, useSyncExternalStore } from 'react';
import type { ISessions, SessionTarget } from '@deepseek-ai/dsh-api-session-controller/client';
import type { SessionId, SessionSeq } from '@deepseek-ai/dsh-session';
import type { Button as HostButton } from '@deepseek-ai/dsh-client-ui-primitives';
import type { MessageLocation, ResolvedMessage } from './message-history.js';

interface JumpState { loading?: boolean; error?: string; row?: HTMLElement }

function findRow(message: ResolvedMessage, mainOnly: boolean) {
  const chat = [...document.querySelectorAll<HTMLElement>('[data-conversation-session]')].find(
    element => element.dataset.conversationSession === message.origin.sessionId &&
      (!mainOnly || !element.closest('[data-sessivra-pane]')) &&
      !element.closest('[hidden], [inert]') && element.getClientRects().length > 0,
  );
  if (!chat) return;
  const rows = [...chat.querySelectorAll<HTMLElement>('[data-chat-node-key]')];
  const turn = 'turn' in message ? message.turn : undefined;
  return rows.find(row => row.dataset.chatNodeKey === message.nodeKey && row.getClientRects().length > 0)
    ?? rows.find(row => turn !== undefined && row.dataset.chatTurn === String(turn) &&
      row.getClientRects().length > 0);
}

export function createMessageNavigator(
  sessions: ISessions,
  open: (target: SessionTarget) => void,
  resolve: (location: MessageLocation, expectedId: string) => Promise<ResolvedMessage>,
) {
  const listeners = new Set<() => void>();
  let state: JumpState = {};
  let active: AbortController | undefined;
  const publish = (next: JumpState) => {
    state = next;
    listeners.forEach(notify => notify());
  };
  return {
    subscribe(notify: () => void) { listeners.add(notify); return () => { listeners.delete(notify); }; },
    snapshot: () => state,
    dismiss() { active?.abort(); publish({}); },
    async jump(location: MessageLocation, expectedId = '', bookmark = false) {
      active?.abort();
      const controller = new AbortController();
      active = controller;
      const { signal } = controller;
      publish({ loading: true });
      try {
        const message = await resolve(location, expectedId);
        signal.throwIfAborted();
        const childSessionId = message.origin.sessionId as SessionId;
        const target: SessionTarget = message.child
          ? { childSessionId, parentSessionId: message.child.parentSessionId as SessionId, mode: message.child.mode }
          : childSessionId;
        open(target);
        await sessions.using(target, { source: 'workspaceOperation', signal }, async reference => {
          await reference.ready;
          signal.throwIfAborted();
          await reference.binding.session.loadThrough(message.origin.seq as SessionSeq);
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
        if (!signal.aborted) publish({ error: '已打开会话，原消息未能定位。' });
      } catch (error) {
        if (!signal.aborted) publish({ error: error instanceof Error ? error.message : '无法打开原消息' });
      }
    },
  };
}

export function MessageJumpNotice({ navigator, Button }: {
  navigator: ReturnType<typeof createMessageNavigator>;
  Button: typeof HostButton;
}) {
  const state = useSyncExternalStore(navigator.subscribe, navigator.snapshot);
  const { row, loading, error } = state;
  useEffect(() => {
    if (!row) return;
    row.setAttribute('data-sessivra-message-highlight', '');
    const timer = setTimeout(() => {
      if (navigator.snapshot() === state) navigator.dismiss();
    }, 2400);
    return () => {
      clearTimeout(timer);
      row.removeAttribute('data-sessivra-message-highlight');
    };
  }, [navigator, row, state]);
  if (row) return <style>{`
    [data-sessivra-message-highlight]{
      outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));
      outline-offset:3px;border-radius:var(--dsw-radius-md);
    }
  `}</style>;
  if (!loading && !error) return null;
  return <div style={{
    position: 'fixed', bottom: 24, right: 24, zIndex: 100, maxWidth: 'calc(100vw - 48px)',
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px 6px 12px',
    fontSize: 13, borderRadius: 'var(--dsw-radius-md)', color: 'var(--dsw-alias-label-primary)',
    background: 'var(--dsw-alias-bg-layer-1)', boxShadow: 'var(--dsw-elevation-soft)',
  }}>
    <span role={error ? 'alert' : 'status'}>{error ?? '正在定位原消息…'}</span>
    <Button size="sm" variant="ghost" onClick={() => navigator.dismiss()}>{error ? '关闭' : '取消'}</Button>
  </div>;
}
