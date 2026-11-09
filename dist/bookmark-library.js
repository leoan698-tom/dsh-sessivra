import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { listTurnBookmarks, turnBookmarksChanged } from './turn-bookmarks.js';
const styles = `
.sessivra-bookmark-library{display:flex;flex-direction:column;height:100%;min-height:0;color:var(--dsw-alias-label-primary)}
.sessivra-bookmark-library header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex:none;height:40px;padding-inline:16px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.sessivra-bookmark-library h1{flex:none;font-size:14px;font-weight:500;margin:0}
.sessivra-bookmark-library .bookmark-filter{min-width:0;max-width:min(65%,260px)}
.sessivra-bookmark-library .bookmark-filter button{display:flex;align-items:center;gap:6px;min-width:0;max-width:100%;min-height:28px;font:inherit;font-size:13px;color:var(--dsw-alias-label-secondary);background:transparent;border:0;padding:4px 8px;border-radius:var(--dsw-radius-sm);cursor:pointer}
.sessivra-bookmark-library .bookmark-filter svg{flex:none}
.sessivra-bookmark-library .bookmark-filter span,.sessivra-bookmark-filter-label{display:block;min-width:0;max-width: min(50vw,300px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sessivra-bookmark-library .bookmark-filter button:hover,.sessivra-bookmark-library .bookmark-filter button[aria-expanded=true],.sessivra-bookmark-library li>button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.sessivra-bookmark-library .bookmark-body{flex:1;min-height:0;overflow:auto;padding:8px 8px 16px}
.sessivra-bookmark-library ul{list-style:none;padding:0;margin:0}
.sessivra-bookmark-library li+li{border-top:1px solid var(--dsw-alias-border-l2)}
.sessivra-bookmark-library li>button{box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;text-align:start;width:100%;font:inherit;color:inherit;background:transparent;border:0;border-radius:6px;padding:9px 8px;cursor:pointer}
.sessivra-bookmark-library :focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.sessivra-bookmark-library .bookmark-summary{min-width:0;display:grid;gap:2px}
.sessivra-bookmark-library small,.sessivra-bookmark-library p,.sessivra-bookmark-library .bookmark-response,.sessivra-bookmark-library .bookmark-arrow{color:var(--dsw-alias-label-secondary)}
.sessivra-bookmark-library small,.sessivra-bookmark-library .bookmark-response{font-size:12px;line-height:17px}
.sessivra-bookmark-library .bookmark-prompt{font-size:14px;line-height:20px}
.sessivra-bookmark-library small,.sessivra-bookmark-library .bookmark-response,.sessivra-bookmark-library .bookmark-prompt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sessivra-bookmark-library p{margin:6px 8px;font-size:13px}
.sessivra-bookmark-library li>button:disabled{cursor:default}
`;
export function BookmarkLibrary({ load, jump, Menu }) {
    const [saved, setSaved] = useState(() => listTurnBookmarks(window));
    const [filter, setFilter] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const [sessions, setSessions] = useState(() => new Map());
    useEffect(() => {
        const refresh = () => setSaved(listTurnBookmarks(window));
        window.addEventListener('storage', refresh);
        window.addEventListener(turnBookmarksChanged, refresh);
        return () => { window.removeEventListener('storage', refresh); window.removeEventListener(turnBookmarksChanged, refresh); };
    }, []);
    const sessionIds = [...new Set(saved.map(item => item.sessionId))];
    const selected = sessionIds.includes(filter) ? filter : '';
    useEffect(() => {
        let disposed = false;
        const groups = new Map();
        for (const { sessionId, turn } of saved) {
            if (!groups.has(sessionId))
                groups.set(sessionId, []);
            groups.get(sessionId).push(turn);
        }
        setSessions(new Map());
        const pending = [...groups];
        const read = async () => {
            for (let group = pending.shift(); group && !disposed; group = pending.shift()) {
                const [id, turns] = group;
                let result = null;
                try {
                    result = await load(id, turns.slice(0, 100));
                    for (let i = 100; i < turns.length && !disposed; i += 100) {
                        result.items.push(...(await load(id, turns.slice(i, i + 100))).items);
                    }
                }
                catch { /* Preserve the bookmark if the original history is unavailable. */ }
                if (!disposed)
                    setSessions(previous => new Map(previous).set(id, result));
            }
        };
        void Promise.all(Array.from({ length: Math.min(4, pending.length) }, read));
        return () => { disposed = true; };
    }, [saved, load]);
    return _jsxs("section", { className: "sessivra-bookmark-library", "aria-label": "\u6536\u85CF", children: [_jsx("style", { children: styles }), _jsxs("header", { children: [_jsx("h1", { children: "\u6536\u85CF" }), saved.length > 0 && _jsx(Menu, { className: "bookmark-filter", portal: true, align: "end", compact: true, autoFocus: true, open: filterOpen, onClose: () => setFilterOpen(false), selectedId: selected ? `session:${selected}` : 'all', anchor: _jsxs("button", { type: "button", "aria-label": "\u6309\u4F1A\u8BDD\u7B5B\u9009", "aria-haspopup": "menu", "aria-expanded": filterOpen, onClick: () => setFilterOpen(!filterOpen), children: [_jsx("span", { children: selected ? sessions.get(selected)?.title ?? '会话' : '全部会话' }), _jsx(Chevron, { path: "m3 4.5 3 3 3-3" })] }), items: [{ id: 'all', label: '全部会话' }, ...sessionIds.map((id, index) => ({
                                id: `session:${id}`, label: _jsx("span", { className: "sessivra-bookmark-filter-label", children: sessions.get(id)?.title ?? `会话 ${index + 1}` }),
                            }))], onSelect: id => { setFilter(id === 'all' ? '' : id.slice('session:'.length)); setFilterOpen(false); } })] }), _jsx("div", { className: "bookmark-body", children: saved.length === 0 ? _jsx("p", { children: "\u8FD8\u6CA1\u6709\u6536\u85CF\u3002\u70B9\u51FB\u4EFB\u610F\u8F6E\u6B21\u7684\u9C7C\u5F62\u6309\u94AE\uFF0C\u5C31\u53EF\u4EE5\u5728\u8FD9\u91CC\u627E\u5230\u5B83\u3002" }) :
                    _jsx("ul", { children: saved.filter(item => !selected || item.sessionId === selected).map(({ sessionId, turn }) => {
                            const session = sessions.get(sessionId), item = session?.items.find(entry => entry.turn === turn);
                            return _jsx("li", { children: _jsxs("button", { type: "button", disabled: !item, onClick: () => item && jump(item.anchor), children: [_jsxs("span", { className: "bookmark-summary", children: [_jsxs("small", { children: [session?.title ?? '会话', " \u00B7 \u7B2C ", turn, " \u8F6E"] }), _jsx("span", { className: "bookmark-prompt", children: item ? item.prompt || '本轮问答' : session === undefined ? '正在读取问答…' : '原轮次暂不可用' }), item?.response && _jsx("span", { className: "bookmark-response", children: item.response })] }), item && _jsx("span", { className: "bookmark-arrow", children: _jsx(Chevron, { path: "m4.5 3 3 3-3 3" }) })] }) }, JSON.stringify([sessionId, turn]));
                        }) }) })] });
}
function Chevron({ path }) {
    return _jsx("svg", { "aria-hidden": "true", width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", children: _jsx("path", { d: path, stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round" }) });
}
