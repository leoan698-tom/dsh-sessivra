import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { ISessions, SessionTarget } from '@deepseek-ai/dsh-api-session-controller/client';
import type { SessionId, SessionSeq } from '@deepseek-ai/dsh-session';
import type { MessageLocation, ResolvedMessage } from './message-history.js';

interface JumpState { loading?: boolean; error?: string; row?: HTMLElement; message?: ResolvedMessage }

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
            publish(bookmark ? {} : { row, message });
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

export function MessageJumpNotice({ navigator, organize }: {
  navigator: ReturnType<typeof createMessageNavigator>;
  organize?(message: ResolvedMessage): void;
}) {
  const { row, message, loading, error } = useSyncExternalStore(navigator.subscribe, navigator.snapshot);
  if (row && message) return createPortal(<div className="sessivra-message-origin">
    <style>{`.sessivra-message-origin{padding:6px 8px;margin:4px 0;border-inline-start:3px solid var(--dsw-alias-state-business-primary);background:var(--dsw-alias-bg-layer-1);display:flex;align-items:center;gap:10px}.sessivra-message-origin button{cursor:pointer;color:inherit;font:inherit}`}</style>
    <span>已定位原消息</span>{organize && <button type="button" onClick={() => { navigator.dismiss(); organize(message); }}>整理成任务</button>}
  </div>, row);
  if (!loading && !error) return null;
  return <div role={error ? 'alert' : 'status'} style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100, padding: 12, borderRadius: 8, background: 'var(--dsw-alias-bg-layer-1)', boxShadow: 'var(--dsw-elevation-soft)' }}>
    {error ?? '正在定位原消息…'}{' '}<button type="button" onClick={() => navigator.dismiss()}>关闭</button>
  </div>;
}
