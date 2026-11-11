import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
export function sessionForest(sessions) {
    const offered = new Map(sessions.map(session => [session.id, session]));
    const rooted = (session) => {
        if (!session.subagent)
            return true;
        if (!['teammate', 'standalone', 'unknown'].includes(session.subagentKind))
            return false;
        const seen = new Set([session.id]);
        let parent = offered.get(session.parentId);
        while (parent) {
            if (seen.has(parent.id))
                return false;
            if (!parent.subagent)
                return true;
            seen.add(parent.id);
            parent = offered.get(parent.parentId);
        }
        return false;
    };
    const nodes = new Map(sessions.filter(rooted).map(session => [session.id, { ...session, children: [] }]));
    const roots = [];
    for (const node of nodes.values()) {
        const seen = new Set([node.id]);
        let parent = node.parentId && nodes.get(node.parentId);
        let cursor = parent;
        while (cursor) {
            if (seen.has(cursor.id)) {
                parent = undefined;
                break;
            }
            seen.add(cursor.id);
            cursor = cursor.parentId ? nodes.get(cursor.parentId) : undefined;
        }
        if (parent)
            parent.children.push(node);
        else
            roots.push(node);
    }
    return roots;
}
const expansionKey = 'sessivra.tree.expansion.v1';
const aliasesKey = 'sessivra.tree.aliases.v1';
function browserStorage() {
    try {
        return globalThis.localStorage;
    }
    catch {
        return undefined;
    }
}
// One read-only poll for all native rows, and no polling while no rows are mounted.
export function createSessionTreeStore(api, storage = browserStorage()) {
    let expansion = new Map();
    try {
        const saved = JSON.parse(storage?.getItem(expansionKey) ?? '[]');
        if (Array.isArray(saved))
            expansion = new Map(saved.filter((entry) => Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string' && typeof entry[1] === 'boolean').slice(-2000));
    }
    catch { /* A corrupt or unavailable preference never blocks navigation. */ }
    let aliases = new Map();
    try {
        const saved = JSON.parse(storage?.getItem(aliasesKey) ?? '[]');
        if (Array.isArray(saved))
            aliases = new Map(saved.filter((entry) => Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string' && typeof entry[1] === 'string' && entry[1].trim().length > 0 && entry[1].length <= 60));
    }
    catch { /* Ignore corrupt local display preferences. */ }
    let snapshot = { nodes: new Map(), parents: new Map(), hiddenSessions: new Set(), rows: new Set(), problem: '', loaded: false, refreshing: false, expansion, aliases };
    const listeners = new Set();
    let timer, inFlight = false, disposed = false, lastRevealed;
    const emit = (patch) => {
        snapshot = { ...snapshot, ...patch };
        for (const listener of listeners)
            listener();
    };
    const refresh = async () => {
        if (inFlight || disposed || !listeners.size)
            return;
        inFlight = true;
        emit({ refreshing: true });
        try {
            const result = await api.tree();
            if (disposed || !listeners.size)
                return;
            if (!result.ok) {
                emit({ problem: '读取子会话失败，请稍后重试' });
                return;
            }
            const nodes = new Map(), parents = new Map();
            const visit = (node) => {
                nodes.set(node.id, node);
                for (const child of node.children) {
                    parents.set(child.id, node.id);
                    visit(child);
                }
            };
            // Sidebar visibility is separate from discovery, references and messaging.
            // Filter before building the forest so subagent descendants of hidden nodes
            // cannot be promoted to unrelated roots or reparented to a visible member.
            sessionForest(result.value.filter(session => !session.subagent || session.subagentKind === 'teammate')).forEach(visit);
            const hiddenSessions = new Set(result.value.filter(session => session.subagent && !nodes.has(session.id)).map(session => session.id));
            emit({ nodes, parents, hiddenSessions, problem: '', loaded: true });
        }
        catch {
            if (!disposed && listeners.size)
                emit({ problem: '子会话列表连接中断' });
        }
        finally {
            inFlight = false;
            if (!disposed)
                emit({ refreshing: false });
        }
    };
    const saveExpansion = (next) => {
        const bounded = new Map([...next].slice(-2000));
        try {
            storage?.setItem(expansionKey, JSON.stringify([...bounded]));
        }
        catch { /* Keep in-memory preferences when storage is blocked/full. */ }
        emit({ expansion: bounded });
    };
    const isExpanded = (id) => snapshot.expansion.get(id) ?? !snapshot.parents.has(snapshot.parents.get(id) ?? '');
    return {
        getSnapshot: () => snapshot,
        refresh,
        isExpanded,
        setAlias: (id, name) => {
            const node = snapshot.nodes.get(id);
            if (!node?.subagent || node.subagentKind !== 'teammate')
                throw new Error('仅团队队员支持显示名称');
            const value = name.trim();
            if (value.length > 60)
                throw new Error('显示名称最多 60 个字符');
            const next = new Map(snapshot.aliases);
            if (value)
                next.set(id, value);
            else
                next.delete(id);
            if (!storage)
                throw new Error('无法保存本机显示名称');
            storage.setItem(aliasesKey, JSON.stringify([...next]));
            emit({ aliases: next });
        },
        toggle: (id) => { const next = new Map(snapshot.expansion); next.delete(id); next.set(id, !isExpanded(id)); saveExpansion(next); },
        reveal: (id, force = false) => {
            if (!id) {
                lastRevealed = undefined;
                return;
            }
            if ((!force && id === lastRevealed) || !snapshot.nodes.has(id))
                return;
            lastRevealed = id;
            const next = new Map(snapshot.expansion);
            let parent = snapshot.parents.get(id), changed = false;
            while (parent) {
                if (!isExpanded(parent)) {
                    next.set(parent, true);
                    changed = true;
                }
                parent = snapshot.parents.get(parent);
            }
            if (changed)
                saveExpansion(next);
        },
        subscribe: (listener) => {
            listeners.add(listener);
            if (!timer && !disposed) {
                void refresh();
                timer = setInterval(() => void refresh(), 2000);
            }
            return () => { listeners.delete(listener); if (!listeners.size) {
                clearInterval(timer);
                timer = undefined;
            } };
        },
        attach: (target) => {
            emit({ rows: new Set([...snapshot.rows, target]) });
            return () => { const rows = new Set(snapshot.rows); rows.delete(target); emit({ rows }); };
        },
        dispose: () => { disposed = true; clearInterval(timer); timer = undefined; listeners.clear(); },
    };
}
export function treePresentation(child, status, alias) {
    const description = child.subagent ? child.description?.trim() : undefined;
    // Some Host titles are merely the shared beginning of the initial prompt.
    // Keep the distinct member name in that case instead of identical "You are…" rows.
    const label = alias || (description && description.length <= 60 && !/[\r\n]/.test(description) && !/^(你是|你将|you\s+(are|will)\b)/i.test(description) ? description : child.label);
    const kind = status?.pendingInteraction?.kind;
    const waiting = kind === 'approval' ? '等待批准' : kind === 'plan-review' ? '等待方案确认' : kind === 'question' ? '等待回答' : '';
    const taskState = child.task && `${child.task.label}${child.task.pendingUpdate && child.task.appliedRevision > 0 ? ' · 待同步' : ''}`;
    const state = waiting || taskState || (child.subagent && child.note !== '只读' ? child.note : '') || ((status?.running ?? child.running) ? '运行中' : '') || (child.subagent && child.subagentMode === 'continuable' && child.parentAvailable === false ? '需先打开父会话' : '') || (child.subagent ? child.note : '') || '';
    return { label, state, waiting: Boolean(waiting) || Boolean(child.task && ['waiting-decision', 'blocked', 'review'].includes(child.task.status)), title: [label, child.subagent && `队员：${child.subagentKind === 'teammate' ? child.teammateName || child.label : child.label}`, description !== label && description, state, child.task && `${child.task.title} · 已采用 v${child.task.appliedRevision} / 当前 v${child.task.revision}${child.task.queued ? ` · 后续 ${child.task.queued} 项` : ''}`].filter(Boolean).join(' · ') };
}
const styles = `
[data-dshsm-nested=true],[data-dshsm-hidden=true]{display:none!important}
/* The host renders a display:contents slot anchor even when no leading item exists. */
[data-dshsm-parent=true]{position:relative;--dshsm-tree-toggle-width:28px}
[data-dshsm-parent=true]>span:first-child+span{font-weight:500}
[data-dshsm-parent=true]:has(> span:first-child > :not([data-slot]),> span:first-child > [data-slot] > *){padding-inline-start:calc(var(--dshsm-tree-toggle-width) + var(--dsh-workspace-indent,0px))!important}
.dshsm-native-children{font:inherit;color:var(--dsw-alias-label-primary);min-width:0;margin-inline-start:calc(28px + var(--dsh-workspace-indent,0px));--dshsm-tree-guide:var(--dsw-alias-border-l2,var(--dsw-alias-label-tertiary))}
.dshsm-native-children *{box-sizing:border-box}
.dshsm-native-children button,.dshsm-native-toggle{font:inherit;color:inherit;border:0;background:transparent;cursor:pointer}
.dshsm-native-toggle{position:absolute;inset-inline-start:var(--dsh-workspace-indent,0px);top:2px;width:var(--dshsm-tree-toggle-width);height:28px;padding:0;display:flex;align-items:center;justify-content:center;z-index:1;color:var(--dsw-alias-label-secondary);border-radius:var(--dsw-radius-sm,4px)}
.dshsm-native-toggle:hover,.dshsm-native-children .dshsm-tree-toggle:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dshsm-native-toggle:active,.dshsm-native-children .dshsm-tree-toggle:active{background:var(--dsw-alias-interactive-bg-hover);box-shadow:inset 0 0 0 1px currentColor}
.dshsm-native-children button:focus-visible,.dshsm-native-toggle:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.dshsm-tree-branch{position:relative;min-width:0}
.dshsm-tree-branch::before{content:"";position:absolute;inset-inline-start:0;top:0;bottom:0;border-inline-start:1px solid var(--dshsm-tree-guide);pointer-events:none}
.dshsm-tree-branch:last-child::before{bottom:auto;height:16px}
.dshsm-tree-branch::after{content:"";position:absolute;inset-inline-start:0;top:16px;width:8px;border-top:1px solid var(--dshsm-tree-guide);pointer-events:none}
.dshsm-tree-row{position:relative;display:flex;align-items:center;gap:4px;height:32px;min-width:0;padding:0 4px 0 8px;border-radius:var(--dsw-radius-md);font-size:14px;line-height:20px;user-select:none}
.dshsm-tree-row[data-selected=true]{background:var(--dsw-alias-interactive-bg-hover)}
.dshsm-native-children .dshsm-tree-toggle{display:flex;align-items:center;justify-content:center;flex:0 0 28px;width:28px;height:28px;padding:0;border-radius:var(--dsw-radius-sm,4px);color:var(--dsw-alias-label-secondary)}
.dshsm-tree-spacer{display:flex;align-items:center;justify-content:center;flex:0 0 4px;width:4px;height:28px}
.dshsm-tree-spacer::before{content:"";width:4px;height:4px;border-radius:50%;background:var(--dshsm-tree-guide)}
.dshsm-native-children .dshsm-tree-name{display:flex;align-items:center;gap:6px;flex:1;min-width:0;height:100%;margin:0;padding:0 4px;text-align:left;line-height:20px;border-radius:var(--dsw-radius-sm,4px)}
.dshsm-native-children .dshsm-tree-name:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dshsm-tree-label{display:block;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dshsm-tree-label[data-long=true]{display:flex;text-overflow:clip}
.dshsm-tree-label-start{min-width:0;overflow:hidden;text-overflow:ellipsis}
.dshsm-tree-label-end{flex:none;max-width:50%;overflow:hidden}
.dshsm-tree-running{flex:0 0 6px;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-business-primary)}
.dshsm-tree-member{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.dshsm-tree-status{flex:none;max-width:5em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--dsw-alias-label-secondary)}
.dshsm-tree-status[data-attention=true]{color:var(--dsw-alias-state-warning,#aa6700)}
.dshsm-tree-current{flex:none;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-business-primary);pointer-events:none}
.dshsm-native-current{position:absolute;inset-inline-start:calc(var(--dshsm-tree-toggle-width) + var(--dsh-workspace-indent,0px) - 6px);top:4px}
.dshsm-tree-row .dshsm-session-actions{display:none}
.dshsm-tree-row:hover .dshsm-session-actions,.dshsm-tree-row:focus-within .dshsm-session-actions,.dshsm-tree-row .dshsm-session-actions[data-open=true]{display:inline-flex}
@media(hover:none){.dshsm-tree-row .dshsm-session-actions{display:inline-flex}}
.dshsm-tree-pin{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.dshsm-tree-notice button{margin-inline-start:8px;text-decoration:underline}
.dshsm-native-children .dshsm-tree-name:disabled{cursor:default;opacity:.75}
.dshsm-tree-children{margin-inline-start:28px}
.dshsm-tree-notice{font-size:12px;line-height:18px;padding:8px;color:var(--dsw-alias-label-tertiary)}
`;
const Chevron = ({ expanded }) => _jsx("svg", { "aria-hidden": "true", width: "14", height: "14", viewBox: "0 0 16 16", style: { transform: expanded ? 'rotate(90deg)' : undefined }, children: _jsx("path", { d: "m6 4 4 4-4 4", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }) });
function TreeLabel({ label }) {
    const chars = Array.from(label), long = chars.length > 18;
    return _jsx("span", { className: "dshsm-tree-label", "data-long": long, children: long ? _jsxs(_Fragment, { children: [_jsx("span", { className: "dshsm-tree-label-start", children: chars.slice(0, -6).join('') }), _jsx("span", { className: "dshsm-tree-label-end", children: chars.slice(-6).join('') })] }) : label });
}
// Keep pointer gestures and keyboard activation inside the disclosure control.
// Native rows also support opening, renaming and dragging the session.
function TreeToggle({ expanded, label, className, onToggle }) {
    // A draggable ancestor can become the drag source even with draggable=false.
    // Cancel the mouse default, then restore button focus without starting a drag.
    return _jsx("button", { type: "button", className: className, "aria-label": `${expanded ? '收起' : '展开'}${label}的子会话`, "aria-expanded": expanded, title: `${expanded ? '收起' : '展开'}子会话`, draggable: false, onPointerDown: event => event.stopPropagation(), onMouseDown: event => { event.stopPropagation(); if (event.button === 0) {
            event.preventDefault();
            event.currentTarget.focus();
        } }, onDoubleClick: event => event.stopPropagation(), onDragStart: event => { event.preventDefault(); event.stopPropagation(); }, onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ')
            event.stopPropagation(); }, onKeyUp: event => { if (event.key === 'Enter' || event.key === ' ')
            event.stopPropagation(); }, onClick: event => { event.stopPropagation(); onToggle(); }, children: _jsx(Chevron, { expanded: expanded }) });
}
// rc.5 has row action seats, but no row-children seat. The local DOM bridge uses
// its stable data-row-key and never alters the native header, store or handlers.
// Each inserted sibling belongs to this component and is removed on disposal.
export function NativeSessionChildren({ sessionId, store, openSession, currentId, statuses, pinnedIds, renderActions, openTask }) {
    const anchor = useRef(null);
    const [target, setTarget] = useState();
    const revealed = useRef();
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const node = snapshot.nodes.get(sessionId);
    const hidden = snapshot.hiddenSessions.has(sessionId);
    useEffect(() => {
        const row = anchor.current?.closest('[data-row-key]');
        if (!row || row.dataset.rowKey !== `session:${sessionId}`)
            return;
        const children = row.ownerDocument.createElement('div');
        children.className = 'dshsm-native-children';
        const mounted = { sessionId, row, children };
        const position = () => { if (row.isConnected && row.nextSibling !== children)
            row.after(children); };
        position();
        // Observe only the owning list: native sort/filter can move its row while
        // preserving this slot component. Do not observe or modify the header.
        const observer = new MutationObserver(position);
        if (row.parentElement)
            observer.observe(row.parentElement, { childList: true });
        setTarget(mounted);
        const detach = store.attach(mounted);
        return () => { observer.disconnect(); detach(); delete row.dataset.dshsmNested; delete row.dataset.dshsmHidden; delete row.dataset.dshsmParent; children.remove(); };
    }, [sessionId, store]);
    let nested = false;
    let parentId = snapshot.parents.get(sessionId);
    while (parentId) {
        if ([...snapshot.rows].some(item => item.sessionId === parentId && item.row.isConnected)) {
            nested = true;
            break;
        }
        parentId = snapshot.parents.get(parentId);
    }
    // One notice for the whole list, including initial failure and folded trees.
    const noticeOwner = [...snapshot.rows].find(item => item.row.isConnected && !snapshot.hiddenSessions.has(item.sessionId) && !snapshot.parents.has(item.sessionId)) ?? [...snapshot.rows].find(item => item.row.isConnected && !snapshot.hiddenSessions.has(item.sessionId));
    const showNotice = !hidden && !nested && noticeOwner === target && Boolean(snapshot.problem || !snapshot.loaded);
    useEffect(() => {
        if (!target)
            return;
        if (nested)
            target.row.dataset.dshsmNested = 'true';
        else
            delete target.row.dataset.dshsmNested;
        if (hidden)
            target.row.dataset.dshsmHidden = 'true';
        else
            delete target.row.dataset.dshsmHidden;
        if (!hidden && !nested && node?.children.length)
            target.row.dataset.dshsmParent = 'true';
        else
            delete target.row.dataset.dshsmParent;
        target.children.hidden = hidden || nested || (!node?.children.length && !showNotice);
    }, [target, hidden, nested, node, showNotice]);
    useEffect(() => { store.reveal(currentId); }, [store, currentId, snapshot.nodes]);
    useEffect(() => {
        if (!currentId) {
            revealed.current = undefined;
            return;
        }
        if (!target || hidden || nested || revealed.current === currentId)
            return;
        const selected = [...target.children.querySelectorAll('[data-session-id]')].find(element => element.dataset.sessionId === currentId);
        if (selected) {
            selected.scrollIntoView?.({ block: 'nearest' });
            revealed.current = currentId;
        }
    }, [target, currentId, hidden, nested, snapshot.expansion, snapshot.nodes]);
    const ordered = (children) => pinnedIds ? [...children].sort((a, b) => Number(pinnedIds.has(b.id)) - Number(pinnedIds.has(a.id))) : children;
    const containsCurrent = (id) => {
        let parent = currentId && snapshot.parents.get(currentId);
        while (parent) {
            if (parent === id)
                return true;
            parent = snapshot.parents.get(parent);
        }
        return false;
    };
    const marker = (native = false) => _jsx("span", { className: `dshsm-tree-current${native ? ' dshsm-native-current' : ''}`, role: "img", "aria-label": "\u5305\u542B\u5F53\u524D\u4F1A\u8BDD", title: "\u5305\u542B\u5F53\u524D\u4F1A\u8BDD\uFF0C\u5C55\u5F00\u53EF\u5B9A\u4F4D" });
    const branch = (child) => {
        const expanded = store.isExpanded(child.id), selected = currentId === child.id;
        const display = treePresentation(child, statuses?.get(child.id), snapshot.aliases.get(child.id));
        return _jsxs("div", { role: "listitem", className: "dshsm-tree-branch", children: [_jsxs("div", { className: "dshsm-tree-row", "data-session-id": child.id, "data-selected": selected, draggable: !child.subagent || child.openable, onDragStart: event => { event.stopPropagation(); event.dataTransfer.setData('text/plain', child.id); event.dataTransfer.effectAllowed = 'copy'; }, children: [child.children.length ? _jsx(TreeToggle, { className: "dshsm-tree-toggle", label: display.label, expanded: expanded, onToggle: () => store.toggle(child.id) }) : _jsx("span", { className: "dshsm-tree-spacer", "aria-hidden": "true" }), _jsxs("button", { type: "button", className: "dshsm-tree-name", disabled: child.subagent && !child.openable, "aria-current": selected ? 'page' : undefined, "aria-label": `${child.subagent && !child.openable ? child.note ?? '暂不可打开' : '打开会话'}：${display.label}`, title: display.title, onClick: event => { event.stopPropagation(); openSession(child); }, children: [_jsx(TreeLabel, { label: display.label }), pinnedIds?.has(child.id) && _jsx("span", { className: "dshsm-tree-pin", title: "\u5DF2\u7F6E\u9876", children: "\u7F6E\u9876" }), child.subagent && _jsx("span", { className: "dshsm-tree-member", children: "\u961F\u5458" }), display.state && _jsx("span", { className: "dshsm-tree-status", "data-attention": display.waiting, title: display.state, children: display.state === '需先打开父会话' ? '需开父会话' : display.state })] }), !expanded && containsCurrent(child.id) && marker(), renderActions?.(child)] }), child.children.length > 0 && expanded && _jsx("div", { role: "list", "aria-label": `${display.label}的子会话`, className: "dshsm-tree-children", children: ordered(child.children).map(branch) })] }, child.id);
    };
    const expanded = store.isExpanded(sessionId), hasChildren = Boolean(node?.children.length);
    return _jsxs(_Fragment, { children: [_jsx("span", { ref: anchor, hidden: true }), target && _jsxs(_Fragment, { children: [createPortal(_jsxs(_Fragment, { children: [_jsx("style", { children: styles }), showNotice && _jsxs("div", { role: snapshot.problem ? 'alert' : 'status', className: "dshsm-tree-notice", children: [snapshot.problem ? `${snapshot.problem}${snapshot.loaded ? '，当前显示上次结果' : ''}` : '正在读取子会话…', snapshot.problem && _jsx("button", { type: "button", disabled: snapshot.refreshing, onClick: () => void store.refresh(), children: snapshot.refreshing ? '重试中…' : '重试' })] }), !hidden && !nested && expanded && _jsx(_Fragment, { children: hasChildren && _jsx("div", { role: "list", "aria-label": `${node.label}的子会话`, onPointerOverCapture: event => event.stopPropagation(), onPointerOutCapture: event => event.stopPropagation(), onDoubleClick: event => event.stopPropagation(), onPointerDown: event => event.stopPropagation(), children: ordered(node.children).map(branch) }) })] }), target.children), !hidden && !nested && node?.task && openTask && _jsx("button", { type: "button", title: node.task.title, "aria-label": '查看任务 ' + node.task.title, onClick: event => { event.stopPropagation(); openTask(node.task.id); }, children: node.task.label }), !hidden && !nested && hasChildren && createPortal(_jsx(TreeToggle, { className: "dshsm-native-toggle", label: node.label, expanded: expanded, onToggle: () => store.toggle(sessionId) }), target.row), !hidden && !nested && !expanded && containsCurrent(sessionId) && createPortal(marker(true), target.row)] })] });
}
