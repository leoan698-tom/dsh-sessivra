import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
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
// Geometry and theme tokens match the shipped rc.5 WorkspaceRows / SessionList.
// Keep local selectors: never depend on the Host's generated CSS class names.
const styles = `
.dshsm-session-tree{font-family:var(--dsw-font-family);font-size:14px;font-weight:400;line-height:20px;color:var(--dsw-alias-label-primary);min-width:0;min-height:0;flex:1;display:flex;flex-direction:column;padding:0 var(--dsh-sidebar-inline-padding,12px) 0 0;box-sizing:border-box}
.dshsm-session-tree *{box-sizing:border-box}
.dshsm-session-tree button,.dshsm-session-tree input{font:inherit;color:inherit}
.dshsm-session-tree button{border:0;background:transparent;cursor:pointer}
.dshsm-tree-toolbar{display:flex;align-items:center;gap:4px;flex:none;height:36px;margin:2px -4px 4px 0;padding-left:4px;color:var(--dsw-alias-label-tertiary)}
.dshsm-tree-toolbar-label{margin-right:auto}
.dshsm-tree-toolbar .dshsm-tree-manage{padding:0 4px;height:28px;font-size:12px;border-radius:var(--dsw-radius-sm)}
.dshsm-tree-toolbar .dshsm-tree-search-toggle{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;padding:0;border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-secondary)}
.dshsm-tree-toolbar button:hover,.dshsm-tree-row:hover,.dshsm-tree-row[data-selected=true]{background:var(--dsw-alias-interactive-bg-hover)}
.dshsm-session-tree .dshsm-session-search{flex:1;min-width:0;width:100%;height:30px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:transparent;font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary)}
.dshsm-session-search::placeholder{color:var(--dsw-alias-label-tertiary)}
.dshsm-session-tree button:focus-visible,.dshsm-session-search:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.dshsm-tree-list{min-height:0;flex:1;overflow-y:auto;scrollbar-gutter:stable;padding-bottom:16px}
.dshsm-tree-row{position:relative;display:flex;align-items:center;height:32px;min-width:0;padding:0 8px;border-radius:var(--dsw-radius-md);font-size:14px;line-height:20px;user-select:none}
.dshsm-session-tree .dshsm-tree-toggle{display:flex;align-items:center;justify-content:center;flex:0 0 16px;width:16px;height:20px;padding:0;color:var(--dsw-alias-label-tertiary)}
.dshsm-tree-spacer{flex:0 0 16px;width:16px;height:20px}
.dshsm-session-tree .dshsm-tree-name{display:flex;align-items:center;gap:6px;flex:1;min-width:0;height:100%;margin:0 6px 0 4px;padding:0;text-align:left;line-height:20px}
.dshsm-tree-label{display:block;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dshsm-tree-group-label{height:34px}
.dshsm-session-tree .dshsm-tree-group-label .dshsm-tree-name{margin:0 0 0 6px}
.dshsm-tree-folder .dshsm-tree-folder-arrow{display:none}
.dshsm-tree-group-label:hover .dshsm-tree-folder-icon,.dshsm-tree-folder:focus-visible .dshsm-tree-folder-icon{display:none}
.dshsm-tree-group-label:hover .dshsm-tree-folder-arrow,.dshsm-tree-folder:focus-visible .dshsm-tree-folder-arrow{display:inline-flex}
.dshsm-tree-running{flex:0 0 6px;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-business-primary)}
.dshsm-tree-member{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.dshsm-session-tree .dshsm-tree-name:disabled{cursor:default;opacity:.75}
.dshsm-tree-children{margin-left:20px}
.dshsm-tree-group+.dshsm-tree-group{margin-top:4px}
.dshsm-tree-list [role=list]>[role=listitem]+[role=listitem]{margin-top:2px}
.dshsm-tree-notice{font-size:12px;line-height:18px;padding:10px 12px;color:var(--dsw-alias-label-tertiary)}
`;
const Chevron = ({ expanded }) => _jsx("svg", { "aria-hidden": "true", width: "16", height: "16", viewBox: "0 0 16 16", style: { transform: expanded ? 'rotate(90deg)' : undefined }, children: _jsx("path", { d: "m6 4 4 4-4 4", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }) });
const Folder = () => _jsx("svg", { "aria-hidden": "true", width: "16", height: "16", viewBox: "0 0 16 16", children: _jsx("path", { d: "M2 4h4l1.5 1.5H14V13H2zM2 4V2.5h4l1.5 1.5H14v1.5", fill: "none", stroke: "currentColor", strokeWidth: "1.1", strokeLinejoin: "round" }) });
export function SessionTree({ api, openSession, standardList }) {
    const [sessions, setSessions] = useState([]);
    const [problem, setProblem] = useState('');
    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(() => new Set());
    const [selected, setSelected] = useState('');
    useEffect(() => {
        let alive = true, inFlight = false;
        const refresh = async () => {
            if (inFlight)
                return;
            inFlight = true;
            try {
                const result = await api.tree();
                if (alive) {
                    if (result.ok) {
                        setSessions(result.value);
                        setProblem('');
                    }
                    else
                        setProblem('读取会话列表失败，请稍后重试');
                }
            }
            catch {
                if (alive)
                    setProblem('会话列表连接中断');
            }
            finally {
                inFlight = false;
            }
        };
        void refresh();
        const timer = setInterval(() => void refresh(), 2000);
        return () => { alive = false; clearInterval(timer); };
    }, [api]);
    const toggle = (id) => setCollapsed(previous => { const next = new Set(previous); if (next.has(id))
        next.delete(id);
    else
        next.add(id); return next; });
    const forest = sessionForest(sessions);
    const matches = (node) => `${node.label} ${node.id} ${node.workspace ?? ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()) || node.children.some(matches);
    const branch = (node) => {
        const children = node.children.filter(matches), expanded = Boolean(query) || !collapsed.has(node.id);
        return _jsxs("div", { role: "listitem", children: [_jsxs("div", { className: "dshsm-tree-row", "data-selected": selected === node.id, children: [children.length ? _jsx("button", { type: "button", className: "dshsm-tree-toggle", "aria-label": `${expanded ? '收起' : '展开'}${node.label}的子会话`, "aria-expanded": expanded, onClick: () => toggle(node.id), children: _jsx(Chevron, { expanded: expanded }) }) : _jsx("span", { className: "dshsm-tree-spacer" }), _jsxs("button", { type: "button", className: "dshsm-tree-name", disabled: node.subagent && !node.openable, "aria-label": `${node.subagent && !node.openable ? node.note ?? '暂不可打开' : '打开会话'}：${node.label}`, title: [node.label, node.subagent && node.note, node.subagent && node.description].filter(Boolean).join(' · '), onClick: () => { setSelected(node.id); openSession(node); }, children: [_jsx("span", { className: "dshsm-tree-label", children: node.label }), node.subagent && _jsxs("span", { className: "dshsm-tree-member", title: node.subagentKind === 'teammate' ? '智能体团队队员' : node.subagentKind === 'unknown' ? '子智能体，团队归属待核对' : '团队外子智能体', children: [node.subagentKind === 'teammate' ? '队员' : '子智能体', node.note ? ` · ${node.note}` : ''] }), node.running && _jsx("span", { className: "dshsm-tree-running", "aria-label": "\u8FD0\u884C\u4E2D" })] })] }), children.length > 0 && expanded && _jsx("div", { role: "list", "aria-label": `${node.label}的子会话`, className: "dshsm-tree-children", children: children.map(branch) })] }, node.id);
    };
    const groups = new Map();
    for (const node of forest.filter(matches)) {
        const path = node.workspace ?? '未分组';
        groups.set(path, [...(groups.get(path) ?? []), node]);
    }
    return _jsxs("section", { "aria-label": "\u5DE5\u4F5C\u533A\u4F1A\u8BDD\u6811", className: "dshsm-session-tree", children: [_jsx("style", { children: styles }), _jsxs("div", { className: "dshsm-tree-toolbar", children: [searchOpen ? _jsx("input", { autoFocus: true, "aria-label": "\u641C\u7D22\u4F1A\u8BDD\u6811", className: "dshsm-session-search", placeholder: "\u641C\u7D22\u4F1A\u8BDD", value: query, onChange: event => setQuery(event.target.value), onKeyDown: event => { if (event.key === 'Escape') {
                            setQuery('');
                            setSearchOpen(false);
                        } } }) : _jsxs(_Fragment, { children: [_jsx("span", { className: "dshsm-tree-toolbar-label", children: "\u4F1A\u8BDD" }), _jsx("button", { type: "button", className: "dshsm-tree-manage", onClick: standardList, children: "\u5DE5\u4F5C\u533A\u7BA1\u7406" })] }), _jsx("button", { type: "button", className: "dshsm-tree-search-toggle", "aria-label": searchOpen ? '关闭会话搜索' : '搜索会话', "aria-expanded": searchOpen, onClick: () => { setSearchOpen(!searchOpen); setQuery(''); }, children: _jsxs("svg", { "aria-hidden": "true", width: "16", height: "16", viewBox: "0 0 16 16", children: [_jsx("circle", { cx: "7", cy: "7", r: "4.5", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }), _jsx("path", { d: "m10.5 10.5 3 3", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })] }) })] }), _jsxs("div", { className: "dshsm-tree-list", children: [problem && _jsx("p", { role: "alert", className: "dshsm-tree-notice", children: problem }), !problem && sessions.length === 0 && _jsx("p", { role: "status", className: "dshsm-tree-notice", children: "\u6682\u65E0\u4F1A\u8BDD" }), [...groups].map(([path, roots]) => {
                        const expanded = Boolean(query) || !collapsed.has(`workspace:${path}`), name = path.split(/[\\/]/u).filter(Boolean).pop() ?? path;
                        return _jsxs("div", { className: "dshsm-tree-group", children: [_jsxs("div", { className: "dshsm-tree-row dshsm-tree-group-label", children: [_jsxs("button", { type: "button", className: "dshsm-tree-toggle dshsm-tree-folder", "aria-label": `${expanded ? '收起' : '展开'}工作区${name}`, "aria-expanded": expanded, onClick: () => toggle(`workspace:${path}`), children: [_jsx("span", { className: "dshsm-tree-folder-icon", children: _jsx(Folder, {}) }), _jsx("span", { className: "dshsm-tree-folder-arrow", children: _jsx(Chevron, { expanded: expanded }) })] }), _jsx("button", { type: "button", className: "dshsm-tree-name", title: path, onClick: () => toggle(`workspace:${path}`), children: _jsx("span", { className: "dshsm-tree-label", children: name }) })] }), expanded && _jsx("div", { role: "list", "aria-label": path, children: roots.map(branch) })] }, path);
                    })] })] });
}
