import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { MAIN_PANE } from './split-layout.js';
const css = `
[data-sessivra-compact]{height:40px!important;min-height:40px!important;padding:4px 12px!important;overflow:hidden}
[data-sessivra-compact] [data-sessivra-tab-row]{display:none!important}
[data-sessivra-compact] [data-conversation-header-corner]{margin-right:0!important}
[data-sessivra-compact] nav[aria-label]{min-width:0}
.sessivra-header-menu{display:inline-flex;align-items:center;flex:none}
.sessivra-header-menu button.sessivra-pane-close{width:24px;height:28px}
`;
function ViewMenu({ seat, label, Menu, headerViews, sessionId }) {
    const [open, setOpen] = useState(false);
    const registry = useSyncExternalStore(headerViews.subscribe, headerViews.getSnapshot, headerViews.getSnapshot);
    const native = sessionId ? registry.get(sessionId) : undefined;
    const views = native?.views ?? seat.tabs.map((tab, index) => ({ id: String(index), label: tab.textContent?.trim() ?? '' }));
    if (!views.length)
        return null;
    return _jsx("span", { className: "sessivra-header-menu", onPointerDown: event => event.stopPropagation(), onClick: event => event.stopPropagation(), children: _jsx(Menu, { open: open, portal: true, autoFocus: true, align: "start", onClose: () => setOpen(false), anchor: _jsx("button", { type: "button", draggable: false, className: "sessivra-pane-close", title: "\u5207\u6362\u4F1A\u8BDD\u89C6\u56FE", "aria-label": `视图菜单：${label}`, "aria-haspopup": "menu", "aria-expanded": open, onClick: () => setOpen(!open), children: _jsx("svg", { "aria-hidden": "true", width: "14", height: "14", viewBox: "0 0 16 16", children: _jsx("path", { d: "m4 6 4 4 4-4", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }) }) }), items: views.map(view => ({ id: view.id, label: view.label, icon: (native ? view.id === (native.current ?? 'chat') : seat.tabs[Number(view.id)]?.getAttribute('aria-selected') === 'true') ? _jsx("span", { "aria-label": "\u5F53\u524D\u89C6\u56FE", children: "\u2713" }) : _jsx("span", {}) })), onSelect: id => { setOpen(false); if (native)
                native.selectView(id);
            else
                seat.tabs[Number(id)]?.click(); } }) });
}
/** Keep native title/actions and tab click handlers; only move view selection into a compact menu. */
export function CompactHeaders({ host, Menu, labelFor, close, headerViews, current }) {
    const [seats, setSeats] = useState([]);
    useLayoutEffect(() => {
        const markedHeaders = new Set(), markedTabs = new Set();
        const scan = () => {
            const headers = [...host.querySelectorAll('[data-sessivra-main-header],.sessivra-pane-native-header header')];
            const next = headers.flatMap(header => {
                const corner = header.querySelector('[data-conversation-header-corner]');
                if (!corner)
                    return [];
                header.dataset.sessivraCompact = '';
                markedHeaders.add(header);
                const tabs = [...header.querySelectorAll('[data-conversation-tabs] [role=tab]')];
                const row = header.querySelector('[data-conversation-tabs]')?.parentElement;
                if (row) {
                    row.dataset.sessivraTabRow = '';
                    markedTabs.add(row);
                }
                return [{ header, id: header.closest('[data-sessivra-pane]')?.dataset.sessivraPane ?? MAIN_PANE, menu: header.querySelector('nav[aria-label]'), corner, tabs }];
            });
            setSeats(previous => previous.length === next.length && next.every((seat, index) => {
                const old = previous[index];
                return old.header === seat.header && old.menu === seat.menu && old.corner === seat.corner && old.id === seat.id && old.tabs.length === seat.tabs.length && old.tabs.every((tab, index) => tab === seat.tabs[index]);
            }) ? previous : next);
        };
        scan();
        const observer = new MutationObserver(scan);
        observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-sessivra-main-header'] });
        return () => { observer.disconnect(); for (const header of markedHeaders)
            delete header.dataset.sessivraCompact; for (const row of markedTabs)
            delete row.dataset.sessivraTabRow; };
    }, [host]);
    return _jsxs(_Fragment, { children: [_jsx("style", { children: css }), seats.map(seat => _jsxs(React.Fragment, { children: [seat.menu && createPortal(_jsx(ViewMenu, { seat: seat, label: labelFor(seat.id), Menu: Menu, headerViews: headerViews, sessionId: seat.id === MAIN_PANE ? current : seat.id }), seat.menu), createPortal(_jsx("button", { type: "button", className: "sessivra-pane-close", draggable: false, title: "\u5173\u95ED\u89C6\u56FE", "aria-label": `关闭视图：${labelFor(seat.id)}`, onPointerDown: event => event.stopPropagation(), onDragStart: event => { event.preventDefault(); event.stopPropagation(); }, onClick: event => { event.stopPropagation(); close(seat.id); }, children: _jsx("svg", { "aria-hidden": "true", width: "14", height: "14", viewBox: "0 0 16 16", children: _jsx("path", { d: "m4 4 8 8M12 4l-8 8", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }) }) }), seat.corner)] }, seat.id))] });
}
