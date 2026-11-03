import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { SessionDialogRequest } from './session-dialog.js';
// The host owns the actual changes and its running-session archive guard.
// These controls only expose those operations for ordinary nested sessions.
export function SessionActionsMenu({ session, pinned, actions, controls, dialogs, onChanged, alias, setAlias }) {
    const [open, setOpen] = useState(false);
    const [dialog, setDialog] = useState();
    const [title, setTitle] = useState(session.label);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const composing = useRef(false);
    const { Menu, Modal, Button } = controls;
    const member = session.subagent && session.subagentKind === 'teammate';
    const close = () => { if (!busy) {
        setDialog(undefined);
        setError('');
    } };
    const run = async (operation, failure = '操作未完成，请重试。') => {
        if (busy)
            return;
        setBusy(true);
        setError('');
        try {
            await operation();
            setDialog(undefined);
            onChanged();
        }
        catch {
            setError(failure);
            setDialog(current => current ?? 'error');
        }
        finally {
            setBusy(false);
        }
    };
    if (session.subagent && (!member || !setAlias))
        return null;
    const blocked = busy || (!member && dialog === 'rename' && !title.trim());
    const confirm = () => {
        if (blocked || composing.current)
            return;
        if (dialog === 'rename')
            void run(() => member ? Promise.resolve(setAlias(title.trim())) : actions.rename(session.id, title.trim()), member ? '显示名称保存失败，请重试。' : undefined);
        else if (dialog === 'archive')
            void run(() => actions.archive(session.id), '归档未完成。会话若正在运行，请先停止后再重试。');
    };
    // Menu portals retain this React ancestry inside the native row's
    // HoverCard. Stop pointer-over/out during capture, before React synthesizes the
    // ancestor's pointer-enter; otherwise the parent card reopens behind a modal.
    // Keep pointer-down/click capture intact so an already-open native card closes.
    return _jsxs("span", { className: "dshsm-session-actions", "data-open": open || Boolean(dialog), onPointerOverCapture: event => event.stopPropagation(), onPointerOutCapture: event => event.stopPropagation(), onClick: event => event.stopPropagation(), onDoubleClick: event => event.stopPropagation(), onPointerDown: event => event.stopPropagation(), children: [_jsx("style", { children: `.dshsm-session-actions{flex:none}.dshsm-native-children .dshsm-session-menu{width:28px;height:28px;padding:0;border-radius:var(--dsw-radius-sm)}.dshsm-session-menu:hover{background:var(--dsw-alias-interactive-bg-hover)}.dshsm-session-form{margin:0}.dshsm-session-form input{box-sizing:border-box;width:100%;height:44px;padding:7px 14px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;font-weight:400;line-height:22px;outline:none}.dshsm-session-form input:focus-visible{border-color:var(--dsw-alias-label-secondary)}.dshsm-session-form input:disabled{color:var(--dsw-alias-label-dimmed)}.dshsm-session-form [role=alert]{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;margin:8px 0 0}.dshsm-session-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin:8px 0 0}` }), _jsx(Menu, { open: open, portal: true, align: "end", autoFocus: true, onClose: () => setOpen(false), anchor: _jsx("button", { type: "button", className: "dshsm-session-menu", disabled: busy, "aria-label": `管理会话：${alias || session.label}`, title: member ? '设置显示名称' : '管理会话', "aria-haspopup": "menu", "aria-expanded": open, onClick: () => setOpen(!open), children: "\u00B7\u00B7\u00B7" }), items: member ? [{ id: 'rename', label: '设置显示名称' }] : [{ id: 'rename', label: '重命名' }, { id: 'pin', label: pinned ? '取消置顶' : '置顶' }, { id: 'archive', label: '归档', disabled: session.running }], onSelect: id => {
                    setOpen(false);
                    setError('');
                    if (id === 'pin') {
                        void run(() => actions.pin(session.id, !pinned));
                        return;
                    }
                    setTitle(member ? alias ?? '' : session.label);
                    setDialog(id === 'rename' ? 'rename' : 'archive');
                } }), _jsx(SessionDialogRequest, { dialogs: dialogs, children: dialog && _jsx(Modal, { open: true, title: dialog === 'rename' ? member ? '设置队员显示名称' : '重命名会话' : dialog === 'archive' ? '归档会话' : '操作未完成', closeLabel: "\u5173\u95ED", onClose: close, footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", disabled: busy, onClick: close, children: dialog === 'error' ? '关闭' : '取消' }), dialog !== 'error' && _jsx(Button, { variant: "primary", disabled: blocked, onClick: confirm, children: busy ? '处理中…' : dialog === 'rename' ? member ? '保存' : '重命名' : '归档' })] }), children: _jsxs("form", { className: "dshsm-session-form", onSubmit: event => { event.preventDefault(); confirm(); }, children: [dialog === 'rename' ? _jsxs(_Fragment, { children: [_jsx("input", { "data-modal-autofocus": true, "aria-label": member ? '队员显示名称' : '会话名称', placeholder: member ? session.label : undefined, maxLength: member ? 60 : undefined, value: title, disabled: busy, onFocus: event => event.target.select(), onChange: event => { setTitle(event.target.value); setError(''); }, onCompositionStart: () => { composing.current = true; }, onCompositionEnd: () => { composing.current = false; }, onKeyDown: event => { if (event.key === 'Enter') {
                                            event.preventDefault();
                                            if (!event.nativeEvent.isComposing)
                                                confirm();
                                        } } }), member && _jsxs("p", { className: "dshsm-session-hint", children: ["\u539F\u540D\uFF1A", session.label, "\u3002\u663E\u793A\u540D\u79F0\u4EC5\u4FDD\u5B58\u5728\u672C\u673A\uFF0C\u7559\u7A7A\u6062\u590D\u9ED8\u8BA4\u540D\u79F0\u3002"] })] }) : dialog === 'archive' ? _jsxs("p", { children: ["\u5F52\u6863\u201C", session.label, "\u201D\u540E\u53EF\u5728\u5BBF\u4E3B\u7684\u5F52\u6863\u5217\u8868\u4E2D\u6062\u590D\u3002"] }) : null, error && _jsx("p", { role: "alert", children: error })] }) }) })] });
}
