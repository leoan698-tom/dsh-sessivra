import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { ISessions, SessionReference, SessionTarget } from '@deepseek-ai/dsh-api-session-controller/client';
import type { PropsRenderFactories, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type {} from '@deepseek-ai/dsh-client-ui-session/client';
import type {} from '@deepseek-ai/dsh-client-ui-layout/client';
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
import { MAIN_PANE, mainLayout, paneIds, dockPane, removePane, resizeSplit, splitGeometry, nearestEdge, edgePreview, type SplitLayout, type Edge, type Rect } from './split-layout.js';
import type { TreeStore } from './session-tree.js';
import type { createSessionReferenceDrop } from './session-reference-drop.js';
import type { Menu as HostMenu } from '@deepseek-ai/dsh-client-ui-primitives';
import { CompactHeaders } from './compact-headers.js';
import { promotePane } from './split-layout.js';
import type { HeaderViews } from './header-views.js';
import { mountTurnBookmarks } from './turn-bookmarks.js';

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'sessivra.conversation.pane': { kind: 'single'; scope: 'session' };
    'sessivra.conversation.header': { kind: 'single'; scope: 'session' };
  }
}
declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap { sessivraView: unknown }
}

// Reuse the same content factory as the Host's embedded subagent chat. Each
// occurrence inherits the explicit SessionProvider, including its composer.
export function SessionViewContent(props: PropsRuntime<'sessivra.conversation.pane'> & PropsRenderFactories) {
  const session = props.useSession(value => value);
  const conversation = props.useConversation(value => value);
  const blank = props.useSessions(value => value.byId[props.sessionId]?.blank);
  const active = conversation.activeTargets.size > 0 || (!session.blank && !session.awaitingFirstTurn) || session.running;
  const pending = session.subagent?.address.mode === 'continuable' && session.subagent.parentAvailable === undefined;
  const settling = (!active && session.openState === 'loading' && blank !== true) || pending;
  const hero = !active && (session.openState === 'open' || blank === true);
  return <>{props.renderFactorySlot('conversation.content', { variant: 'embedded', phase: settling ? 'settling' : hero ? 'hero' : 'active', hero })}</>;
}

export function createSessionViews(sessions: Pick<ISessions, 'retain'>) {
  let snapshot: { id: string; label: string; reference: SessionReference; error?: string; ready: boolean }[] = [];
  const listeners = new Set<() => void>();
  const emit = () => { for (const listener of listeners) listener(); };
  const close = (id: string) => {
    const removed = snapshot.find(pane => pane.id === id);
    snapshot = snapshot.filter(pane => pane.id !== id); removed?.reference.release(); emit();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    open(target: SessionTarget, label: string) {
      const id = typeof target === 'string' ? target : target.childSessionId;
      if (snapshot.some(pane => pane.id === id)) return id;
      const reference = sessions.retain(target, { source: 'sessivraView' });
      snapshot = [...snapshot, { id, label, reference, ready: false }]; emit();
      void reference.ready.then(() => {
        snapshot = snapshot.map(pane => pane.reference === reference ? { ...pane, ready: true } : pane); emit();
      }, () => {
        snapshot = snapshot.map(pane => pane.reference === reference ? { ...pane, error: '会话打开失败，请关闭后重新打开' } : pane); emit();
      });
      return id;
    },
    close,
    dispose() { const old = snapshot; snapshot = []; old.forEach(pane => pane.reference.release()); emit(); listeners.clear(); },
  };
}

type Views = ReturnType<typeof createSessionViews>;
type ViewProps = PropsRuntime<'shell.overlay'> & PropsRenderSlots<'sessivra.conversation.pane' | 'sessivra.conversation.header'> & {
  views: Views; store: TreeStore; referenceDrop: ReturnType<typeof createSessionReferenceDrop>;
  Menu: typeof HostMenu; selectSession(target: SessionTarget): void; startSession(): void;
  headerViews: HeaderViews;
  fish?: Parameters<typeof mountTurnBookmarks>[1];
};
const styles = `
[data-sessivra-views]{display:flex!important;flex-direction:column;position:relative!important;min-height:0;isolation:isolate;overflow:hidden}
[data-sessivra-views]>[data-conversation-content]{position:absolute!important;left:var(--sessivra-main-left,0px)!important;top:var(--sessivra-main-top,0px)!important;width:var(--sessivra-main-width,100%)!important;height:var(--sessivra-main-height,0px)!important;min-width:0!important;min-height:0!important;max-width:none!important;box-sizing:border-box;z-index:1;overflow:hidden}
[data-sessivra-views][data-sessivra-split=true] [data-sessivra-main-header]{position:absolute!important;left:var(--sessivra-main-left,0px);top:var(--sessivra-header-top,0px);width:var(--sessivra-main-width,100%);min-width:0;box-sizing:border-box;z-index:4}
[data-sessivra-visible=true]{background:var(--dsw-alias-interactive-bg-hover)!important}
/* DSH rc.1's native TurnNavigator owns the outline, previews and history jumps. */
@container (width >= 112px){
  [data-conversation-scroll] .SNx2jG_slot>.SNx2jG_frame{display:block;left:2px;right:auto;width:14px}
}
[data-conversation-scroll] .SNx2jG_mark::before{left:0;right:auto;width:12px;transform-origin:left center}
[data-conversation-scroll] .SNx2jG_mark:focus-visible::after{width:14px;inset:0}
[data-conversation-scroll] .SNx2jG_frame>.SNx2jG_preview{left:calc(100% + 6px);right:auto;width:min(300px,calc(100cqw - 8px))}
.sessivra-pane:focus-visible,.sessivra-pane-close:focus-visible,.sessivra-divider:focus-visible{outline:2px solid var(--dsw-focus-ring-color);outline-offset:-2px}
.sessivra-canvas{flex:1;min-height:0;min-width:0;position:relative;pointer-events:none;z-index:2}
.sessivra-pane{position:absolute;box-sizing:border-box;min-width:0;min-height:0;display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2);overflow:hidden;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);pointer-events:auto}
.sessivra-pane-header{position:relative;flex:none;min-width:0;min-height:40px;cursor:grab}
.sessivra-pane-native-header{min-width:0}
.sessivra-pane-header>.sessivra-pane-close{position:absolute;right:clamp(0px,calc(100% - 28px),8px);top:10px;width:min(28px,100%)}
.sessivra-pane-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:13px;font-weight:500}
.sessivra-pane-close{display:flex;align-items:center;justify-content:center;flex:none;width:28px;height:28px;padding:0;border:0;border-radius:var(--dsw-radius-sm,4px);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.sessivra-pane-close:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.sessivra-pane-body{display:flex;flex:1;min-height:0;min-width:0;flex-direction:column}
.sessivra-views-notice{position:absolute;top:8px;right:8px;z-index:6;pointer-events:auto;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:8px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px}
.sessivra-divider{position:absolute;pointer-events:auto;background:var(--dsw-alias-border-l2);touch-action:none;user-select:none;z-index:3}
.sessivra-divider[data-axis=x]{cursor:col-resize}.sessivra-divider[data-axis=y]{cursor:row-resize}
.sessivra-divider:hover,.sessivra-divider:focus-visible,.sessivra-divider[data-resizing=true]{background:var(--dsw-focus-ring-color)}
.sessivra-drop-preview{position:absolute;z-index:5;pointer-events:none;border:3px solid #3b82f6;box-sizing:border-box;background:transparent;border-radius:4px;box-shadow:0 0 0 1px rgb(59 130 246 / 20%)}
`;
const position = (rect: Rect): React.CSSProperties => ({ left: rect.x, top: rect.y, width: rect.width, height: rect.height });

// Flatten the split tree into stable sibling occurrences. Reparenting a pane in
// the layout changes only its geometry, never its React parent or draft DOM.
// Native main content stays mounted under its original Host-owned parent.
export function SessionViews(props: ViewProps) {
  const panes = useSyncExternalStore(props.views.subscribe, props.views.getSnapshot, props.views.getSnapshot);
  useSyncExternalStore(props.store.subscribe, props.store.getSnapshot, props.store.getSnapshot);
  const listedCurrent = props.useSessions(list => Object.values(list.byId).find(row => (row.retainedBy.mainView ?? 0) > 0)?.id);
  const [nativeCurrent, setNativeCurrent] = useState<string>();
  const current = listedCurrent ?? nativeCurrent;
  const panel = props.usePanelInfo(info => info.activePanelId);
  const [host, setHost] = useState<HTMLElement>();
  const { fish } = props;
  useEffect(() => host && fish && panel === null ? mountTurnBookmarks(host, fish) : undefined, [host, fish, panel]);
  const [canvas, setCanvas] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0, x: 0, y: 0, header: 0 });
  const [layout, setLayout] = useState<SplitLayout>(mainLayout);
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<{ target: string; edge: Edge }>();
  const drag = useRef<{ source?: string; consumed: boolean }>({ consumed: false });
  const resize = useRef<{ id: string; pointer: number; axis: 'x' | 'y'; start: number; length: number; ratio: number }>();
  const pointerDock = useRef<{ source: string; x: number; y: number; overCanvas: boolean }>();
  const suppressClick = useRef(0);
  const splitSerial = useRef(0);
  const promotion = useRef<{ closed: string; replacement: string }>();
  const [promoting, setPromoting] = useState<string>();
  const labelFor = (id: string) => props.store.getSnapshot().nodes.get(id === MAIN_PANE ? current ?? '' : id)?.label ?? panes.find(pane => pane.id === id)?.label ?? '会话';
  const close = (id: string) => {
    if (id !== MAIN_PANE) { props.views.close(id); return; }
    const replacement = panes.find(pane => pane.ready && !pane.error) ?? panes[0];
    if (!replacement) { props.startSession(); return; }
    promotion.current = { closed: current ?? '', replacement: replacement.id };
    setPromoting(replacement.id);
  };
  useEffect(() => {
    if (!promoting || promotion.current?.replacement !== promoting) return;
    // Unmount the old occurrence before navigation binds its shared native
    // editor to the main composer. Keep its Session retained throughout.
    const node = props.store.getSnapshot().nodes.get(promoting);
    props.selectSession((node?.subagent ? { parentSessionId: node.parentId, childSessionId: node.id, mode: node.subagentMode } : promoting) as SessionTarget);
    const timer = window.setTimeout(() => {
      if (promotion.current?.replacement !== promoting) return;
      promotion.current = undefined; setPromoting(undefined); setNotice('会话切换未完成，请重试关闭视图');
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [promoting, props.selectSession, props.store]);
  const geometry = useMemo(() => splitGeometry(layout, size.width, size.height), [layout, size.width, size.height]);
  const focus = (id: string) => queueMicrotask(() => [...document.querySelectorAll<HTMLElement>('[data-sessivra-pane]')].find(element => element.dataset.sessivraPane === id)?.focus());
  const dock = (id: string, destination: string, edge: Edge) => {
    const source = id === current ? MAIN_PANE : id;
    if (source === destination) return;
    if (!paneIds(layout).includes(destination)) return;
    if (source !== MAIN_PANE) {
      const existing = panes.find(pane => pane.id === source);
      const node = props.store.getSnapshot().nodes.get(source);
      if (!existing && (!node || (node.subagent && !node.openable))) return;
      try {
        if (!existing && node) props.views.open((node.subagent ? { parentSessionId: node.parentId, childSessionId: node.id, mode: node.subagentMode } : node.id) as SessionTarget, node.label);
      } catch (error) { setNotice(error instanceof Error ? error.message : '无法打开视图'); return; }
    }
    const splitId = `split-${++splitSerial.current}`;
    setLayout(previous => dockPane(previous, source, destination, edge, splitId));
    setNotice(''); focus(source);
  };
  useEffect(() => {
    let mounted: HTMLElement | undefined;
    const scan = () => {
      const content = [...document.querySelectorAll<HTMLElement>('[data-conversation-content]')].find(element => !element.closest('[data-sessivra-pane]') && element.parentElement?.hasAttribute('data-phase'));
      setNativeCurrent(content?.dataset.conversationSession);
      if (mounted?.isConnected && content?.parentElement === mounted) return;
      mounted = content?.parentElement ?? undefined;
      setHost(previous => previous === mounted ? previous : mounted);
    };
    const observer = new MutationObserver(scan); observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-conversation-session'] }); scan();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (!host || panel !== null) return;
    host.dataset.sessivraViews = 'true';
    return () => {
      delete host.dataset.sessivraViews;
      for (const name of ['left', 'top', 'width', 'height']) host.style.removeProperty(`--sessivra-main-${name}`);
    };
  }, [host, panel]);
  useLayoutEffect(() => {
    if (!host || panel !== null) return;
    const header = host.querySelector<HTMLElement>(':scope > [data-slot="conversation.header"] header') ?? host.querySelector<HTMLElement>(':scope > header');
    host.dataset.sessivraSplit = String(panes.length > 0);
    if (header) { header.dataset.sessivraMainHeader = ''; header.dataset.viewSource = MAIN_PANE; header.draggable = panes.length > 0; }
    return () => {
      delete host.dataset.sessivraSplit;
      if (header) { delete header.dataset.sessivraMainHeader; delete header.dataset.viewSource; header.removeAttribute('draggable'); }
    };
  }, [host, panel, panes.length, current]);
  useEffect(() => {
    const visible = new Set(panel === null ? [current, ...panes.map(pane => pane.id)] : []);
    const marked = new Set<HTMLElement>();
    const sync = () => {
      for (const row of document.querySelectorAll<HTMLElement>('[data-row-key],[data-session-id]')) {
        const id = row.dataset.rowKey?.replace(/^session:/, '') ?? row.dataset.sessionId;
        if (id && visible.has(id)) { if (row.dataset.sessivraVisible !== 'true') row.dataset.sessivraVisible = 'true'; marked.add(row); }
        else if (marked.delete(row)) delete row.dataset.sessivraVisible;
      }
    };
    sync();
    const observer = new MutationObserver(sync); observer.observe(document.body, { subtree: true, childList: true });
    return () => { observer.disconnect(); for (const row of marked) delete row.dataset.sessivraVisible; };
  }, [current, panes, panel]);
  useLayoutEffect(() => {
    if (!canvas || !host) return;
    const measure = () => {
      const rect = canvas.getBoundingClientRect(), outer = host.getBoundingClientRect();
      const next = { width: rect.width, height: rect.height, x: rect.left - outer.left - host.clientLeft, y: rect.top - outer.top - host.clientTop, header: host.querySelector<HTMLElement>('[data-sessivra-main-header]')?.getBoundingClientRect().height ?? 0 };
      setSize(previous => Object.keys(next).every(key => next[key as keyof typeof next] === previous[key as keyof typeof next]) ? previous : next);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(canvas); observer?.observe(host);
    const header = host.querySelector('[data-sessivra-main-header]'); if (header) observer?.observe(header);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [canvas, host, panes.length, current]);
  useLayoutEffect(() => {
    if (!host || panel !== null) return;
    const rect = geometry.panes.get(MAIN_PANE);
    if (!rect) return;
    const header = panes.length ? Math.min(size.header, rect.height) : 0;
    host.style.setProperty('--sessivra-header-top', `${rect.y + size.y}px`);
    for (const [name, value] of Object.entries({ left: rect.x + size.x, top: rect.y + size.y + header, width: rect.width, height: rect.height - header })) host.style.setProperty(`--sessivra-main-${name}`, `${value}px`);
    return () => { host.style.removeProperty('--sessivra-header-top'); };
  }, [host, panel, geometry, size.x, size.y, size.header, panes.length]);
  // Close/selection collapse only the removed leaf's parent, not the whole layout.
  useEffect(() => {
    const retained = new Set(panes.map(pane => pane.id));
    setLayout(previous => paneIds(previous).filter(id => id !== MAIN_PANE && !retained.has(id)).reduce((next, id) => removePane(next, id) ?? mainLayout(), previous));
  }, [panes]);
  useLayoutEffect(() => {
    if (current && promotion.current?.replacement === current) {
      setLayout(previous => promotePane(previous, current)); promotion.current = undefined; setPromoting(undefined);
    } else if (promotion.current && current !== promotion.current.closed) { promotion.current = undefined; setPromoting(undefined); }
    if (current) props.views.close(current);
  }, [current, props.views]);
  useEffect(() => {
    if (!host || !canvas || panel !== null) return;
    const hit = (event: MouseEvent) => {
      const bounds = canvas.getBoundingClientRect(), x = event.clientX - bounds.left, y = event.clientY - bounds.top;
      const entry = [...geometry.panes].find(([, rect]) => x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height);
      return entry ? { target: entry[0], edge: nearestEdge(entry[1], x, y) } : undefined;
    };
    const composerAt = (event: MouseEvent) => {
      const element = document.elementFromPoint?.(event.clientX, event.clientY) ?? (event.target instanceof Element ? event.target : null);
      const composer = element?.closest('[data-composer-card],[data-composer-input]');
      if (!composer || !host.contains(composer)) return undefined;
      const pane = composer.closest<HTMLElement>('[data-sessivra-pane]');
      return pane?.dataset.sessivraPane ?? current;
    };
    const place = (source: string, event: MouseEvent) => {
      const target = composerAt(event);
      if (target) {
        const id = source === MAIN_PANE ? current : source;
        const label = id && (props.store.getSnapshot().nodes.get(id)?.label ?? panes.find(pane => pane.id === id)?.label);
        if (!id || !label || !props.referenceDrop.insert(target, id, label)) setNotice('当前输入框暂时无法插入引用，请稍后重试');
        else setNotice('');
        return true;
      }
      const location = hit(event);
      if (!location) return false;
      dock(source, location.target, location.edge); return true;
    };
    const sourceAt = (event: Event) => {
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-view-source],[data-session-id],[data-row-key]') : null;
      const id = element?.dataset.viewSource ?? element?.dataset.sessionId ?? element?.dataset.rowKey?.replace(/^session:/, '');
      return id && (id === MAIN_PANE || props.store.getSnapshot().nodes.has(id) || panes.some(pane => pane.id === id)) ? id : undefined;
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button:not([data-view-source]),input,select,textarea,[contenteditable=true]'))) return;
      const source = sourceAt(event);
      pointerDock.current = source ? { source, x: event.clientX, y: event.clientY, overCanvas: false } : undefined;
    };
    const pointerMove = (event: PointerEvent) => {
      const active = pointerDock.current;
      if (!active || !(event.buttons & 1) || Math.hypot(event.clientX - active.x, event.clientY - active.y) < 8) return;
      const location = hit(event);
      active.overCanvas = Boolean(location);
      if (location && !composerAt(event)) setPreview(previous => previous?.target === location.target && previous.edge === location.edge ? previous : location);
      else setPreview(undefined);
    };
    const pointerUp = (event: PointerEvent) => {
      const active = pointerDock.current; pointerDock.current = undefined;
      if (!active?.overCanvas || Math.hypot(event.clientX - active.x, event.clientY - active.y) < 8) return;
      const location = hit(event);
      if (!location) return;
      event.preventDefault(); suppressClick.current = performance.now() + 200;
      place(active.source, event); drag.current = { consumed: true }; setPreview(undefined);
    };
    const pointerCancel = () => { pointerDock.current = undefined; setPreview(undefined); };
    const click = (event: MouseEvent) => { if (performance.now() < suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = 0; } };
    const start = (event: DragEvent) => {
      // A single fast pointer movement can cross straight into the canvas before
      // Windows begins its native drag loop. Keep that gesture in pointer mode;
      // otherwise Electron can lose both drop and dragend. Native sidebar-only
      // drags still take the unchanged Host drag path.
      if (pointerDock.current?.overCanvas) { event.preventDefault(); event.stopPropagation(); drag.current = { consumed: false }; return; }
      pointerDock.current = undefined;
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-view-source],[data-session-id],[data-row-key]') : null;
      const id = element?.dataset.viewSource ?? element?.dataset.sessionId ?? element?.dataset.rowKey?.replace(/^session:/, '');
      drag.current = { source: id && (id === MAIN_PANE || props.store.getSnapshot().nodes.has(id) || panes.some(pane => pane.id === id)) ? id : undefined, consumed: false };
    };
    const over = (event: DragEvent) => {
      if (!drag.current.source) return;
      const location = hit(event);
      if (!location) { setPreview(undefined); return; }
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = event.dataTransfer.effectAllowed === 'copy' ? 'copy' : 'move';
      if (composerAt(event)) setPreview(undefined);
      else setPreview(previous => previous?.target === location.target && previous.edge === location.edge ? previous : location);
    };
    const drop = (event: DragEvent) => {
      const location = hit(event), source = drag.current.source;
      if (!source || !location) return;
      event.preventDefault(); event.stopPropagation(); drag.current.consumed = true;
      place(source, event); setPreview(undefined);
    };
    const end = (event: DragEvent) => {
      // Native Windows/Electron drags may deliver dragstart and dragend without
      // a final dragover/drop. Resolve the actual release point in our canvas.
      // Escape clears source, and releases outside the Host never dock.
      if (!drag.current.consumed && drag.current.source) {
        const location = hit(event), underPointer = document.elementFromPoint?.(event.clientX, event.clientY);
        if (location && (!underPointer || host.contains(underPointer))) place(drag.current.source, event);
      }
      // Let the Host's own dragend clear its native sorting state.
      drag.current = { consumed: false }; setPreview(undefined);
    };
    const leave = (event: DragEvent) => { if (!(event.relatedTarget instanceof Node) || !host.contains(event.relatedTarget)) setPreview(undefined); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { drag.current.source = undefined; pointerDock.current = undefined; setPreview(undefined); } };
    document.addEventListener('pointerdown', pointerDown, true); document.addEventListener('pointermove', pointerMove, true); document.addEventListener('pointerup', pointerUp, true); document.addEventListener('pointercancel', pointerCancel, true); document.addEventListener('click', click, true);
    document.addEventListener('dragstart', start, true); document.addEventListener('dragend', end, true); document.addEventListener('keydown', escape);
    host.addEventListener('dragover', over, true); host.addEventListener('drop', drop, true); host.addEventListener('dragleave', leave);
    return () => { document.removeEventListener('pointerdown', pointerDown, true); document.removeEventListener('pointermove', pointerMove, true); document.removeEventListener('pointerup', pointerUp, true); document.removeEventListener('pointercancel', pointerCancel, true); document.removeEventListener('click', click, true); document.removeEventListener('dragstart', start, true); document.removeEventListener('dragend', end, true); document.removeEventListener('keydown', escape); host.removeEventListener('dragover', over, true); host.removeEventListener('drop', drop, true); host.removeEventListener('dragleave', leave); };
  }, [host, canvas, panel, current, panes, layout, geometry, props.store, props.views, props.referenceDrop]);
  const setRatio = (id: string, ratio: number) => setLayout(previous => resizeSplit(previous, id, ratio));
  const cancelResize = () => { if (resize.current) { setRatio(resize.current.id, resize.current.ratio); resize.current = undefined; } };
  const previewSource = drag.current.source ?? pointerDock.current?.source;
  if (!host || panel !== null) return null;
  return createPortal(<>
    <style>{styles}</style>
    <CompactHeaders host={host} Menu={props.Menu} labelFor={labelFor} close={close} headerViews={props.headerViews} current={current} />
    <div ref={setCanvas} className="sessivra-canvas" data-sessivra-canvas="true">
      {notice && <div className="sessivra-views-notice" role="status">{notice}</div>}
      {panes.map(pane => {
        const rect = geometry.panes.get(pane.id);
        if (!rect) return null;
        return <section key={pane.id} className="sessivra-pane" style={position(rect)} data-sessivra-pane={pane.id} aria-label={`会话视图：${pane.label}`} tabIndex={-1}>
          <header className="sessivra-pane-header" draggable data-view-source={pane.id} onDragStart={event => { event.dataTransfer.setData('text/plain', pane.id); event.dataTransfer.effectAllowed = 'move'; }}><div className="sessivra-pane-native-header">{pane.ready && !pane.error ? <props.SessionProvider session={pane.reference}>{props.renderSlot('sessivra.conversation.header', {})}</props.SessionProvider> : <span className="sessivra-pane-title">{pane.label}</span>}</div>{(!pane.ready || pane.error) && <button className="sessivra-pane-close" type="button" aria-label={`关闭视图：${pane.label}`} title="关闭视图" onPointerDown={event => event.stopPropagation()} onClick={() => close(pane.id)}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></button>}</header>
          <div className="sessivra-pane-body">{promoting === pane.id ? null : pane.error ? <p role="alert">{pane.error}</p> : !pane.ready ? <p role="status">正在打开会话…</p> : <props.SessionProvider session={pane.reference}>{props.renderSlot('sessivra.conversation.pane', {})}</props.SessionProvider>}</div>
        </section>;
      })}
      {geometry.dividers.map(({ node, rect, parent }, index) => <div key={node.id} role="separator" tabIndex={0} aria-label={`调整分隔线 ${index + 1}`} aria-orientation={node.axis === 'x' ? 'vertical' : 'horizontal'} aria-valuemin={10} aria-valuemax={90} aria-valuenow={Math.round(node.ratio * 100)} className="sessivra-divider" data-axis={node.axis} data-split-id={node.id} style={position(rect)}
        onPointerDown={event => {
          if (event.button !== 0 || !canvas) return;
          event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture?.(event.pointerId);
          const bounds = canvas.getBoundingClientRect();
          resize.current = { id: node.id, pointer: event.pointerId, axis: node.axis, start: node.axis === 'x' ? bounds.left + parent.x : bounds.top + parent.y, length: Math.max(1, (node.axis === 'x' ? parent.width : parent.height) - 6), ratio: node.ratio };
        }}
        onPointerMove={event => { const active = resize.current; if (active?.pointer === event.pointerId) setRatio(active.id, ((active.axis === 'x' ? event.clientX : event.clientY) - active.start - 3) / active.length); }}
        onPointerUp={event => { if (resize.current?.pointer === event.pointerId) { resize.current = undefined; event.currentTarget.releasePointerCapture?.(event.pointerId); } }}
        onPointerCancel={cancelResize} onLostPointerCapture={() => { resize.current = undefined; }}
        onKeyDown={event => {
          if (event.key === 'Escape') { cancelResize(); return; }
          const keys = node.axis === 'x' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
          if (keys.includes(event.key) || ['Home', 'End'].includes(event.key)) {
            event.preventDefault(); setRatio(node.id, event.key === 'Home' ? .1 : event.key === 'End' ? .9 : node.ratio + (event.key === keys[0] ? -1 : 1) * (event.shiftKey ? .1 : .02));
          }
        }} />)}
      {preview && preview.target !== (previewSource === current ? MAIN_PANE : previewSource) && geometry.panes.has(preview.target) && <div className="sessivra-drop-preview" aria-hidden="true" data-drop-edge={preview.edge} data-drop-target={preview.target} style={position(edgePreview(geometry.panes.get(preview.target)!, preview.edge))} />}
    </div>
  </>, host);
}
