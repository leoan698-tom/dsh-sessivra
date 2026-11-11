import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { treePresentation } from './session-tree.js';
// rc.5 declares a shared store handle on the native browser's public Slot entry.
// Its create() returns the existing instance. Subscribe read-only; never call its
// actions, create a replacement view store, or read persisted browser internals.
export function createWorkspaceArchiveSource(slots) {
    let entry;
    let source;
    const current = () => {
        const next = slots.entriesOfSlot('sidebar.workspaces')[0];
        if (next !== entry) {
            entry = next;
            source = undefined;
            if (next?.locale === 'workspace' && next.children?.['sidebar.workspaces.session.row.action'] && next.store && typeof next.store === 'object' && 'create' in next.store && typeof next.store.create === 'function') {
                const instance = next.store.create();
                if (instance && typeof instance === 'object' && 'getSnapshot' in instance && typeof instance.getSnapshot === 'function' && 'subscribe' in instance && typeof instance.subscribe === 'function')
                    source = instance;
            }
        }
        return source;
    };
    return {
        getSnapshot: () => {
            const view = current()?.getSnapshot();
            if (!view)
                return undefined;
            const filter = view.archivedFilter ?? 'default';
            return filter === 'default' || filter === 'show' || filter === 'only' ? filter : undefined;
        },
        subscribe: (listener) => {
            let subscribed, unsubscribe;
            const bind = () => { const next = current(); if (next !== subscribed) {
                unsubscribe?.();
                subscribed = next;
                unsubscribe = next?.subscribe(listener);
            } };
            const unsubscribeSlots = slots.subscribe('sidebar.workspaces', () => { bind(); listener(); });
            bind();
            return () => { unsubscribeSlots(); unsubscribe?.(); };
        },
    };
}
export function searchTeamMembers(store, query, archivedIds = []) {
    const snapshot = store.getSnapshot(), terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const archived = new Set(archivedIds);
    if (!terms.length)
        return [];
    return [...snapshot.nodes.values()].flatMap(node => {
        if (!node.subagent || node.subagentKind !== 'teammate' || archived.has(node.id))
            return [];
        const display = treePresentation(node, undefined, snapshot.aliases.get(node.id));
        const parents = [], originalParents = [];
        let parent = snapshot.nodes.get(node.parentId);
        while (parent) {
            if (archived.has(parent.id))
                return [];
            parents.unshift(treePresentation(parent, undefined, snapshot.aliases.get(parent.id)).label);
            originalParents.push(parent.label);
            parent = parent.parentId ? snapshot.nodes.get(parent.parentId) : undefined;
        }
        const path = parents.join(' / ');
        const text = [display.label, treePresentation(node).label, node.teammateName, node.label, path, ...originalParents, node.workspace].join(' ').toLocaleLowerCase();
        return terms.every(term => text.includes(term)) ? [{ node, display, path }] : [];
    });
}
const searchLabels = ['搜索会话名称', 'Search session names'];
const resultLabels = ['搜索结果', 'Search results'];
const emptyLabels = ['无匹配会话', 'No matching sessions'];
// rc.5 has no search-result extension seat. Keep its search input and native
// results intact, and own only one supplemental sibling inside the same scroller.
// The bridge is deliberately gated on the verified semantic labels/structure.
export function findNativeSearch(doc) {
    const input = [...doc.querySelectorAll('input[placeholder]')].find(element => searchLabels.includes(element.placeholder));
    const workspace = input?.parentElement?.parentElement?.parentElement?.parentElement;
    const results = workspace && [...workspace.querySelectorAll('[role="tree"][aria-label]')].find(element => resultLabels.includes(element.getAttribute('aria-label') ?? ''));
    return input && workspace && results ? { input, workspace, results } : undefined;
}
export function revealNativeBranch(doc, store, id, workspaces) {
    const snapshot = store.getSnapshot();
    let root = snapshot.nodes.get(id);
    while (root?.parentId && snapshot.nodes.has(root.parentId))
        root = snapshot.nodes.get(root.parentId);
    if (!root)
        return () => { };
    const workspace = workspaces.find(item => item.sessionIds.includes(root.id));
    const normalize = (path) => path.replaceAll('\\', '/').replace(/\/$/, '').toLocaleLowerCase();
    const path = workspace && normalize(workspace.path);
    const groupIds = workspace ? workspaces.filter(item => item.workspaceId === workspace.workspaceId || path.startsWith(`${normalize(item.path)}/`)).map(item => item.workspaceId) : [''];
    let stopped = false;
    const attempted = new WeakSet();
    const reveal = () => {
        if (stopped)
            return;
        store.reveal(id, true);
        const selected = [...doc.querySelectorAll('[data-session-id]')].find(element => element.dataset.sessionId === id);
        if (selected) {
            selected.scrollIntoView?.({ block: 'nearest' });
            selected.querySelector('.dshsm-tree-name')?.focus({ preventScroll: true });
            stop();
            return;
        }
        const rows = [...doc.querySelectorAll('[data-row-key]')];
        for (const key of groupIds) {
            const group = rows.find(row => row.dataset.rowKey === `workspace:${key}` && row.getAttribute('aria-expanded') === 'false');
            if (group && !attempted.has(group)) {
                attempted.add(group);
                group.click();
                return;
            }
        }
        if (!rows.some(row => row.dataset.rowKey === `session:${root.id}`)) {
            const overflow = rows.find(row => row.dataset.rowKey === `overflow:${workspace?.workspaceId ?? ''}` && row.getAttribute('aria-expanded') === 'false');
            if (overflow && !attempted.has(overflow)) {
                attempted.add(overflow);
                overflow.click();
            }
        }
    };
    const observer = new MutationObserver(reveal);
    const cancelOnInput = (event) => { if (event.isTrusted)
        stop(); };
    const stop = () => { stopped = true; observer.disconnect(); clearTimeout(timeout); doc.removeEventListener('pointerdown', cancelOnInput, true); doc.removeEventListener('keydown', cancelOnInput, true); };
    const timeout = setTimeout(stop, 5000);
    doc.addEventListener('pointerdown', cancelOnInput, true);
    doc.addEventListener('keydown', cancelOnInput, true);
    observer.observe(doc.body, { childList: true, subtree: true });
    reveal();
    return stop;
}
function HistoryTaskAction({ action: { Button, open }, location, onOpen }) {
    const request = React.useRef();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => () => request.current?.abort(), []);
    const start = async () => {
        const controller = new AbortController();
        request.current = controller;
        setBusy(true);
        setError('');
        try {
            await open(location, controller.signal);
            if (!controller.signal.aborted)
                onOpen();
        }
        catch {
            if (!controller.signal.aborted)
                setError('无法读取原消息，请重试。');
        }
        finally {
            if (!controller.signal.aborted)
                setBusy(false);
        }
    };
    return _jsxs(_Fragment, { children: [_jsx("span", { className: "dshsm-search-task", title: "\u6574\u7406\u6210\u4EFB\u52A1", children: _jsx(Button, { size: "sm", variant: "ghost", "aria-label": "\u6574\u7406\u6210\u4EFB\u52A1", disabled: busy, onClick: () => void start(), children: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", "aria-hidden": "true", children: _jsx("path", { d: "M4 6h14M4 12h9M4 18h9M18 13v8m-4-4h8" }) }) }) }), error && _jsx("div", { role: "alert", className: "dshsm-search-heading", style: { gridColumn: '1 / -1' }, children: error })] });
}
function SearchMatches({ store, openSession, target, query, reveal, archivedIds, searchHistory, openMessage, taskAction, showTeam = true }) {
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const matches = showTeam ? searchTeamMembers(store, query, archivedIds) : [];
    const [history, setHistory] = useState();
    useEffect(() => {
        if (!searchHistory)
            return;
        let active = true;
        const timer = setTimeout(() => {
            void searchHistory(query.slice(0, 250)).then(results => { if (active)
                setHistory({ query, results }); }, error => { if (active)
                setHistory({ query, error: error instanceof Error ? error.message : '搜索失败' }); });
        }, 280);
        return () => { active = false; clearTimeout(timer); };
    }, [query, searchHistory]);
    const currentHistory = history?.query === query ? history : undefined;
    const hasSupplement = Boolean(searchHistory) || matches.length > 0 || (showTeam && (!snapshot.loaded || Boolean(snapshot.problem)));
    const [container] = useState(() => target.results.ownerDocument.createElement('div'));
    useEffect(() => {
        container.dataset.dshsmSearch = 'true';
        target.results.after(container);
        return () => container.remove();
    }, [target.results, container]);
    useEffect(() => {
        const marked = new Set();
        const mark = () => {
            if (hasSupplement)
                for (const sibling of target.results.parentElement?.children ?? []) {
                    if (sibling instanceof target.results.ownerDocument.defaultView.HTMLElement && emptyLabels.includes(sibling.textContent?.trim() ?? '')) {
                        sibling.dataset.dshsmSearchEmpty = 'true';
                        marked.add(sibling);
                    }
                }
        };
        const observer = new MutationObserver(mark);
        if (target.results.parentElement)
            observer.observe(target.results.parentElement, { childList: true });
        mark();
        return () => { observer.disconnect(); marked.forEach(element => { delete element.dataset.dshsmSearchEmpty; }); };
    }, [hasSupplement, target.results]);
    const clearSearch = () => {
        // The native clear button runs its own React handler and restores its list.
        const clear = [...target.workspace.querySelectorAll('button[aria-label]')].find(button => ['清除搜索', 'Clear search'].includes(button.getAttribute('aria-label') ?? ''));
        clear?.click();
    };
    const open = (node) => {
        clearSearch();
        store.reveal(node.id, true);
        openSession(node);
        // SearchMatches unmounts when clear is processed, so this one bounded reveal
        // owns its observer until it locates the branch or times out.
        reveal(node.id);
    };
    return createPortal(_jsxs(_Fragment, { children: [_jsx("style", { children: `[data-dshsm-search-empty=true]{display:none!important}.dshsm-search-heading{color:var(--dsw-alias-label-tertiary);font-size:12px;padding:8px 12px 4px}.dshsm-search-result{display:block;width:100%;border:0;background:transparent;color:var(--dsw-alias-label-primary);text-align:left;padding:8px 12px;border-radius:var(--dsw-radius-md);font:inherit;cursor:pointer}.dshsm-search-result:hover,.dshsm-search-result:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}.dshsm-search-result:focus-visible{outline:2px solid var(--dsw-focus-ring-color);outline-offset:-2px}.dshsm-search-result:disabled{opacity:.65;cursor:default}.dshsm-search-result span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dshsm-search-result small{display:block;font-size:12px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}` }), _jsx("style", { children: `
      .dshsm-search-hit{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;padding-inline-end:4px}
      .dshsm-search-task button{color:var(--dsw-alias-label-secondary)}
      @media (hover:hover){
        .dshsm-search-task{opacity:0}
        .dshsm-search-hit:hover .dshsm-search-task,.dshsm-search-hit:focus-within .dshsm-search-task{opacity:1}
      }
    ` }), matches.length > 0 && _jsxs("section", { "aria-label": "\u961F\u5458\u641C\u7D22\u7ED3\u679C", children: [_jsxs("div", { className: "dshsm-search-heading", children: ["\u961F\u5458 \u00B7 ", matches.length] }), matches.slice(0, 50).map(({ node, display, path }) => _jsxs("button", { type: "button", className: "dshsm-search-result", disabled: !node.openable, title: `${display.title}\n${path}`, onClick: () => open(node), children: [_jsx("span", { children: display.label }), _jsxs("small", { children: [node.teammateName, display.state ? ` · ${display.state}` : ''] }), _jsx("small", { children: path })] }, node.id)), matches.length > 50 && _jsx("p", { className: "dshsm-search-heading", children: "\u4EC5\u663E\u793A\u524D 50 \u4E2A\u961F\u5458\uFF0C\u8BF7\u7F29\u5C0F\u641C\u7D22\u8303\u56F4\u3002" })] }), showTeam && !snapshot.loaded && !snapshot.problem && _jsx("div", { role: "status", className: "dshsm-search-heading", children: "\u6B63\u5728\u641C\u7D22\u961F\u5458\u2026" }), showTeam && snapshot.problem && _jsxs("div", { role: "alert", className: "dshsm-search-heading", children: ["\u961F\u5458\u641C\u7D22\u6682\u672A\u66F4\u65B0\uFF0C", snapshot.problem, _jsx("button", { type: "button", onClick: () => void store.refresh(), children: "\u91CD\u8BD5" })] }), searchHistory && _jsxs("section", { "aria-label": "\u6D88\u606F\u6B63\u6587\u641C\u7D22\u7ED3\u679C", children: [_jsx("div", { className: "dshsm-search-heading", title: currentHistory?.error, "aria-live": "polite", children: !currentHistory ? '正在搜索消息正文…' : currentHistory.error ? '消息正文暂时无法搜索' : currentHistory.results?.items.length ? '消息正文' : '没有匹配的消息正文' }), currentHistory?.results?.items.map(hit => {
                        const location = { sessionId: hit.sessionId, seq: hit.seq };
                        return _jsxs("div", { className: "dshsm-search-hit", children: [_jsxs("button", { type: "button", className: "dshsm-search-result", title: hit.snippet, onClick: () => { clearSearch(); openMessage?.(location); }, children: [_jsx("span", { children: hit.snippet }), _jsxs("small", { children: [hit.child ? '子会话 · ' : '', snapshot.aliases.get(hit.sessionId) ?? hit.title] }), _jsx("small", { children: hit.cwd })] }), taskAction && _jsx(HistoryTaskAction, { action: taskAction, location: location, onOpen: clearSearch })] }, `${query}:${hit.sessionId}:${hit.seq}`);
                    }), currentHistory?.results?.more && _jsx("div", { className: "dshsm-search-heading", children: "\u8FD8\u6709\u66F4\u591A\u547D\u4E2D\uFF0C\u53EF\u7F29\u5C0F\u5173\u952E\u8BCD\u8303\u56F4\u3002" }), currentHistory?.results?.partial && _jsx("div", { className: "dshsm-search-heading", children: "\u90E8\u5206\u5386\u53F2\u6682\u4E0D\u53EF\u8BFB\u3002" })] })] }), container);
}
export function NativeTeamSearch(props) {
    const workspaces = props.useWorkspaces(state => state.items);
    const archivedIds = props.useWorkspaces(state => state.archivedSessionIds);
    const archiveFilter = props.useArchiveFilter(filter => filter);
    const pendingReveal = React.useRef();
    useEffect(() => () => pendingReveal.current?.(), []);
    const [search, setSearch] = useState();
    useEffect(() => {
        let queued = false, stopped = false;
        let workspace;
        const scan = () => {
            if (queued)
                return;
            queued = true;
            queueMicrotask(() => {
                queued = false;
                if (stopped)
                    return;
                const target = findNativeSearch(document), query = target?.input.value.trim() ?? '';
                const input = [...document.querySelectorAll('input[placeholder]')].find(element => searchLabels.includes(element.placeholder));
                workspace = input?.parentElement?.parentElement?.parentElement?.parentElement ?? undefined;
                setSearch(current => !target || !query ? current ? undefined : current : current?.target.results === target.results && current.query === query ? current : { target, query });
            });
        };
        const observer = new MutationObserver(records => {
            // Streaming messages outside the workspace must not rescan the sidebar.
            if (workspace?.isConnected) {
                if (records.some(record => workspace.contains(record.target)))
                    scan();
                return;
            }
            if (workspace || records.some(record => [...record.addedNodes].some(node => node instanceof document.defaultView.Element && (node.matches('input[placeholder]') || node.querySelector('input[placeholder]')))))
                scan();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('input', scan);
        scan();
        return () => { stopped = true; observer.disconnect(); document.removeEventListener('input', scan); };
    }, []);
    // Tree discovery contains active sessions only. Archived-only (or an unknown
    // Host view) must leave native results and their empty/error state untouched.
    const showTeam = archiveFilter === 'default' || archiveFilter === 'show';
    return search && (showTeam || props.searchHistory) ? _jsx(SearchMatches, { ...props, ...search, showTeam: showTeam, archivedIds: archivedIds, reveal: id => { pendingReveal.current?.(); pendingReveal.current = revealNativeBranch(document, props.store, id, workspaces); } }) : null;
}
export function selectParentUnavailable(owner) {
    const child = owner.session?.subagent;
    return child?.address.mode === 'continuable' && child.parentAvailable === false && owner.session?.running !== true ? { parentId: child.address.parentSessionId } : null;
}
export function ParentUnavailableComposer({ store, openSession, matched, Button }) {
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const parent = snapshot.nodes.get(matched.parentId);
    return _jsxs("div", { role: "status", className: "dshsm-parent-notice", children: [_jsx("style", { children: `.dshsm-parent-notice{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1);min-height:54px;color:var(--dsw-alias-label-tertiary);display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px;margin:0 24px 20px;padding:10px 16px;font-size:13px;line-height:20px}.dshsm-parent-notice strong{color:var(--dsw-alias-label-primary);font-weight:510}` }), _jsx("strong", { children: "\u6B64\u961F\u5458\u6682\u65F6\u53EA\u8BFB" }), _jsx("span", { children: "\u7236\u4F1A\u8BDD\u5F53\u524D\u4E0D\u5728\u7EBF\uFF0C\u8BF7\u5148\u6253\u5F00\u7236\u4F1A\u8BDD\uFF0C\u518D\u8FD4\u56DE\u6B64\u961F\u5458\u3002" }), _jsx(Button, { variant: "outline", size: "sm", disabled: !parent || (parent.subagent && !parent.openable), onClick: () => { if (parent)
                    openSession(parent); }, children: "\u6253\u5F00\u7236\u4F1A\u8BDD" })] });
}
