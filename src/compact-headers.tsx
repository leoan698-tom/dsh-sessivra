import React, { useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { Menu as HostMenu } from '@deepseek-ai/dsh-client-ui-primitives';
import { MAIN_PANE } from './split-layout.js';
import type { HeaderViews } from './header-views.js';

interface Seat { header: HTMLElement; id: string; menu: HTMLElement | null; corner: HTMLElement; tabs: HTMLButtonElement[] }
const css = `
[data-sessivra-compact]{height:40px!important;min-height:40px!important;padding:4px 12px!important;overflow:hidden}
[data-sessivra-compact] [data-sessivra-tab-row]{display:none!important}
[data-sessivra-compact] [data-conversation-header-corner]{margin-right:0!important}
[data-sessivra-compact] nav[aria-label]{min-width:0}
.sessivra-header-menu{display:inline-flex;align-items:center;flex:none}
.sessivra-header-menu button.sessivra-pane-close{width:24px;height:28px}
`;

function ViewMenu({ seat, label, Menu, headerViews, sessionId }: { seat: Seat; label: string; Menu: typeof HostMenu; headerViews: HeaderViews; sessionId?: string }) {
  const [open, setOpen] = useState(false);
  const registry = useSyncExternalStore(headerViews.subscribe, headerViews.getSnapshot, headerViews.getSnapshot);
  const native = sessionId ? registry.get(sessionId) : undefined;
  const views = native?.views ?? seat.tabs.map((tab, index) => ({ id: String(index), label: tab.textContent?.trim() ?? '' }));
  if (!views.length) return null;
  return <span className="sessivra-header-menu" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
    <Menu open={open} portal autoFocus align="start" onClose={() => setOpen(false)}
      anchor={<button type="button" draggable={false} className="sessivra-pane-close" title="切换会话视图" aria-label={`视图菜单：${label}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>}
      items={views.map(view => ({ id: view.id, label: view.label, icon: (native ? view.id === (native.current ?? 'chat') : seat.tabs[Number(view.id)]?.getAttribute('aria-selected') === 'true') ? <span aria-label="当前视图">✓</span> : <span /> }))}
      onSelect={id => { setOpen(false); if (native) native.selectView(id); else seat.tabs[Number(id)]?.click(); }} />
  </span>;
}

/** Keep native title/actions and tab click handlers; only move view selection into a compact menu. */
export function CompactHeaders({ host, Menu, labelFor, close, headerViews, current }: {
  host: HTMLElement; Menu: typeof HostMenu; labelFor(id: string): string; close(id: string): void; headerViews: HeaderViews; current?: string;
}) {
  const [seats, setSeats] = useState<Seat[]>([]);
  useLayoutEffect(() => {
    const markedHeaders = new Set<HTMLElement>(), markedTabs = new Set<HTMLElement>();
    const scan = () => {
      const headers = [...host.querySelectorAll<HTMLElement>('[data-sessivra-main-header],.sessivra-pane-native-header header')];
      const next = headers.flatMap(header => {
        const corner = header.querySelector<HTMLElement>('[data-conversation-header-corner]');
        if (!corner) return [];
        header.dataset.sessivraCompact = ''; markedHeaders.add(header);
        const tabs = [...header.querySelectorAll<HTMLButtonElement>('[data-conversation-tabs] [role=tab]')];
        const row = header.querySelector<HTMLElement>('[data-conversation-tabs]')?.parentElement;
        if (row) { row.dataset.sessivraTabRow = ''; markedTabs.add(row); }
        return [{ header, id: header.closest<HTMLElement>('[data-sessivra-pane]')?.dataset.sessivraPane ?? MAIN_PANE, menu: header.querySelector<HTMLElement>('nav[aria-label]'), corner, tabs }];
      });
      setSeats(previous => previous.length === next.length && next.every((seat, index) => {
        const old = previous[index];
        return old.header === seat.header && old.menu === seat.menu && old.corner === seat.corner && old.id === seat.id && old.tabs.length === seat.tabs.length && old.tabs.every((tab, index) => tab === seat.tabs[index]);
      }) ? previous : next);
    };
    scan();
    const observer = new MutationObserver(scan); observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-sessivra-main-header'] });
    return () => { observer.disconnect(); for (const header of markedHeaders) delete header.dataset.sessivraCompact; for (const row of markedTabs) delete row.dataset.sessivraTabRow; };
  }, [host]);
  return <><style>{css}</style>{seats.map(seat => <React.Fragment key={seat.id}>
    {seat.menu && createPortal(<ViewMenu seat={seat} label={labelFor(seat.id)} Menu={Menu} headerViews={headerViews} sessionId={seat.id === MAIN_PANE ? current : seat.id} />, seat.menu)}
    {createPortal(<button type="button" className="sessivra-pane-close" draggable={false} title="关闭视图" aria-label={`关闭视图：${labelFor(seat.id)}`} onPointerDown={event => event.stopPropagation()} onDragStart={event => { event.preventDefault(); event.stopPropagation(); }} onClick={event => { event.stopPropagation(); close(seat.id); }}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></button>, seat.corner)}
  </React.Fragment>)}</>;
}
