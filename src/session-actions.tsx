import React, { useRef, useState } from 'react';
import type { Button, Menu, Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import type { TreeSession } from './collaboration.js';
import { SessionDialogRequest, type SessionDialogStore } from './session-dialog.js';

export interface SessionActions {
  rename(id: string, title: string): Promise<void>;
  pin(id: string, pinned: boolean): Promise<void>;
  archive(id: string): Promise<void>;
}
export interface SessionControls { Menu: typeof Menu; Modal: typeof Modal; Button: typeof Button }

// The host owns the actual changes and its running-session archive guard.
// These controls only expose those operations for ordinary nested sessions.
export function SessionActionsMenu({ session, pinned, actions, controls, dialogs, onChanged, alias, setAlias }: {
  session: TreeSession; pinned: boolean; actions: SessionActions; controls: SessionControls; onChanged(): void;
  dialogs: SessionDialogStore;
  alias?: string; setAlias?(name: string): void;
}) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<'rename' | 'archive' | 'error'>();
  const [title, setTitle] = useState(session.label);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const composing = useRef(false);
  const { Menu, Modal, Button } = controls;
  const member = session.subagent && session.subagentKind === 'teammate';
  const close = () => { if (!busy) { setDialog(undefined); setError(''); } };
  const run = async (operation: () => Promise<void>, failure = '操作未完成，请重试。') => {
    if (busy) return;
    setBusy(true); setError('');
    try { await operation(); setDialog(undefined); onChanged(); }
    catch { setError(failure); setDialog(current => current ?? 'error'); }
    finally { setBusy(false); }
  };
  if (session.subagent && (!member || !setAlias)) return null;
  const blocked = busy || (!member && dialog === 'rename' && !title.trim());
  const confirm = () => {
    if (blocked || composing.current) return;
    if (dialog === 'rename') void run(() => member ? Promise.resolve(setAlias!(title.trim())) : actions.rename(session.id, title.trim()), member ? '显示名称保存失败，请重试。' : undefined);
    else if (dialog === 'archive') void run(() => actions.archive(session.id), '归档未完成。会话若正在运行，请先停止后再重试。');
  };
  // Menu portals retain this React ancestry inside the native row's
  // HoverCard. Stop pointer-over/out during capture, before React synthesizes the
  // ancestor's pointer-enter; otherwise the parent card reopens behind a modal.
  // Keep pointer-down/click capture intact so an already-open native card closes.
  return <span className="dshsm-session-actions" data-open={open || Boolean(dialog)} onPointerOverCapture={event => event.stopPropagation()} onPointerOutCapture={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
    <style>{`.dshsm-session-actions{flex:none}.dshsm-native-children .dshsm-session-menu{width:28px;height:28px;padding:0;border-radius:var(--dsw-radius-sm)}.dshsm-session-menu:hover{background:var(--dsw-alias-interactive-bg-hover)}.dshsm-session-form{margin:0}.dshsm-session-form input{box-sizing:border-box;width:100%;height:44px;padding:7px 14px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;font-weight:400;line-height:22px;outline:none}.dshsm-session-form input:focus-visible{border-color:var(--dsw-alias-label-secondary)}.dshsm-session-form input:disabled{color:var(--dsw-alias-label-dimmed)}.dshsm-session-form [role=alert]{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;margin:8px 0 0}.dshsm-session-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin:8px 0 0}`}</style>
    <Menu open={open} portal align="end" autoFocus onClose={() => setOpen(false)}
      anchor={<button type="button" className="dshsm-session-menu" disabled={busy} aria-label={`管理会话：${alias || session.label}`} title={member ? '设置显示名称' : '管理会话'} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>···</button>}
      items={member ? [{ id: 'rename', label: '设置显示名称' }] : [{ id: 'rename', label: '重命名' }, { id: 'pin', label: pinned ? '取消置顶' : '置顶' }, { id: 'archive', label: '归档', disabled: session.running }]}
      onSelect={id => {
        setOpen(false); setError('');
        if (id === 'pin') { void run(() => actions.pin(session.id, !pinned)); return; }
        setTitle(member ? alias ?? '' : session.label); setDialog(id === 'rename' ? 'rename' : 'archive');
      }} />
    <SessionDialogRequest dialogs={dialogs}>{dialog && <Modal open title={dialog === 'rename' ? member ? '设置队员显示名称' : '重命名会话' : dialog === 'archive' ? '归档会话' : '操作未完成'} closeLabel="关闭" onClose={close}
      footer={<><Button variant="outline" disabled={busy} onClick={close}>{dialog === 'error' ? '关闭' : '取消'}</Button>{dialog !== 'error' && <Button variant="primary" disabled={blocked} onClick={confirm}>{busy ? '处理中…' : dialog === 'rename' ? member ? '保存' : '重命名' : '归档'}</Button>}</>}>
      <form className="dshsm-session-form" onSubmit={event => { event.preventDefault(); confirm(); }}>
        {dialog === 'rename' ? <><input data-modal-autofocus aria-label={member ? '队员显示名称' : '会话名称'} placeholder={member ? session.label : undefined} maxLength={member ? 60 : undefined} value={title} disabled={busy} onFocus={event => event.target.select()} onChange={event => { setTitle(event.target.value); setError(''); }} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (!event.nativeEvent.isComposing) confirm(); } }} />{member && <p className="dshsm-session-hint">原名：{session.label}。显示名称仅保存在本机，留空恢复默认名称。</p>}</> : dialog === 'archive' ? <p>归档“{session.label}”后可在宿主的归档列表中恢复。</p> : null}
        {error && <p role="alert">{error}</p>}
      </form>
    </Modal>}</SessionDialogRequest>
  </span>;
}
