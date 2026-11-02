import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { TreeSession } from './collaboration.js';
import type { SessionCandidate } from './recipient-source.js';

export type TreeNode = TreeSession & { children: TreeNode[] };
export function sessionForest(sessions: TreeSession[]): TreeNode[] {
  const offered = new Map(sessions.map(session => [session.id, session]));
  const rooted = (session: TreeSession) => {
    if (!session.subagent) return true;
    if (!['teammate','standalone','unknown'].includes(session.subagentKind)) return false;
    const seen = new Set([session.id]);
    let parent = offered.get(session.parentId);
    while (parent) {
      if (seen.has(parent.id)) return false;
      if (!parent.subagent) return true;
      seen.add(parent.id); parent = offered.get(parent.parentId);
    }
    return false;
  };
  const nodes = new Map(sessions.filter(rooted).map(session => [session.id, { ...session, children: [] } as TreeNode]));
  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    const seen = new Set([node.id]);
    let parent = node.parentId && nodes.get(node.parentId);
    let cursor = parent;
    while (cursor) {
      if (seen.has(cursor.id)) { parent = undefined; break; }
      seen.add(cursor.id);
      cursor = cursor.parentId ? nodes.get(cursor.parentId) : undefined;
    }
    if (parent) parent.children.push(node); else roots.push(node);
  }
  return roots;
}

export interface TreeApi { tree(): Promise<RemoteResult<TreeSession[]>>; candidates(sourceId: string, query: string): Promise<RemoteResult<SessionCandidate[]>> }
interface NativeRow { sessionId: string; row: HTMLElement; children: HTMLElement }
interface Snapshot { nodes: Map<string, TreeNode>; parents: Map<string, string>; rows: Set<NativeRow>; problem: string }

// One read-only poll for all native rows, and no polling while no rows are mounted.
export function createSessionTreeStore(api: TreeApi) {
  let snapshot: Snapshot = { nodes: new Map(), parents: new Map(), rows: new Set(), problem: '' };
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined, inFlight = false, disposed = false;
  const emit = (patch: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  };
  const refresh = async () => {
    if (inFlight || disposed || !listeners.size) return;
    inFlight = true;
    try {
      const result = await api.tree();
      if (disposed || !listeners.size) return;
      if (!result.ok) { emit({ problem: '读取子会话失败，请稍后重试' }); return; }
      const nodes = new Map<string, TreeNode>(), parents = new Map<string, string>();
      const visit = (node: TreeNode) => {
        nodes.set(node.id, node);
        for (const child of node.children) { parents.set(child.id, node.id); visit(child); }
      };
      sessionForest(result.value).forEach(visit);
      emit({ nodes, parents, problem: '' });
    } catch { if (!disposed && listeners.size) emit({ problem: '子会话列表连接中断' }); }
    finally { inFlight = false; }
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      if (!timer && !disposed) { void refresh(); timer = setInterval(() => void refresh(), 2000); }
      return () => { listeners.delete(listener); if (!listeners.size) { clearInterval(timer); timer = undefined; } };
    },
    attach: (target: NativeRow) => {
      emit({ rows: new Set([...snapshot.rows, target]) });
      return () => { const rows = new Set(snapshot.rows); rows.delete(target); emit({ rows }); };
    },
    dispose: () => { disposed = true; clearInterval(timer); timer = undefined; listeners.clear(); },
  };
}

type TreeStore = ReturnType<typeof createSessionTreeStore>;
interface Props { sessionId: string; store: TreeStore; openSession(session: TreeSession): void }
const styles = `
[data-dshsm-nested=true]{display:none!important}
.dshsm-native-children{font:inherit;color:var(--dsw-alias-label-primary);min-width:0;margin-left:20px}
.dshsm-native-children *{box-sizing:border-box}
.dshsm-native-children button,.dshsm-native-toggle{font:inherit;color:inherit;border:0;background:transparent;cursor:pointer}
.dshsm-native-toggle{position:absolute;left:-3px;top:6px;width:12px;height:20px;padding:0;display:flex;align-items:center;justify-content:center;z-index:1;color:var(--dsw-alias-label-tertiary)}
.dshsm-native-children button:focus-visible,.dshsm-native-toggle:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.dshsm-tree-row{display:flex;align-items:center;height:32px;min-width:0;padding:0 8px;border-radius:var(--dsw-radius-md);font-size:14px;line-height:20px;user-select:none}
.dshsm-tree-row:hover,.dshsm-tree-row[data-selected=true]{background:var(--dsw-alias-interactive-bg-hover)}
.dshsm-native-children .dshsm-tree-toggle{display:flex;align-items:center;justify-content:center;flex:0 0 16px;width:16px;height:24px;padding:0;color:var(--dsw-alias-label-tertiary)}
.dshsm-tree-spacer{flex:0 0 16px;width:16px}
.dshsm-native-children .dshsm-tree-name{display:flex;align-items:center;gap:6px;flex:1;min-width:0;height:100%;margin:0 6px 0 4px;padding:0;text-align:left;line-height:20px}
.dshsm-tree-label{display:block;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dshsm-tree-running{flex:0 0 6px;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-business-primary)}
.dshsm-tree-member{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.dshsm-native-children .dshsm-tree-name:disabled{cursor:default;opacity:.75}
.dshsm-tree-children{margin-left:20px}
.dshsm-tree-notice{font-size:12px;line-height:18px;padding:8px;color:var(--dsw-alias-label-tertiary)}
`;
const Chevron = ({ expanded }: { expanded: boolean }) => <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" style={{ transform: expanded ? 'rotate(90deg)' : undefined }}><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;

// rc.5 has row action seats, but no row-children seat. The local DOM bridge uses
// its stable data-row-key and never alters the native header, store or handlers.
// Each inserted sibling belongs to this component and is removed on disposal.
export function NativeSessionChildren({ sessionId, store, openSession }: Props) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [target, setTarget] = useState<NativeRow>();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState('');
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const node = snapshot.nodes.get(sessionId);
  useEffect(() => {
    const row = anchor.current?.closest<HTMLElement>('[data-row-key]');
    if (!row || row.dataset.rowKey !== `session:${sessionId}`) return;
    const children = row.ownerDocument.createElement('div');
    children.className = 'dshsm-native-children';
    const mounted = { sessionId, row, children };
    const position = () => { if (row.isConnected && row.nextSibling !== children) row.after(children); };
    position();
    // Observe only the owning list: native sort/filter can move its row while
    // preserving this slot component. Do not observe or modify the header.
    const observer = new MutationObserver(position);
    if (row.parentElement) observer.observe(row.parentElement, { childList: true });
    setTarget(mounted);
    const detach = store.attach(mounted);
    return () => { observer.disconnect(); detach(); delete row.dataset.dshsmNested; children.remove(); };
  }, [sessionId, store]);
  let nested = false;
  let parentId = snapshot.parents.get(sessionId);
  while (parentId) {
    if ([...snapshot.rows].some(item => item.sessionId === parentId && item.row.isConnected)) { nested = true; break; }
    parentId = snapshot.parents.get(parentId);
  }
  useEffect(() => {
    if (!target) return;
    if (nested) target.row.dataset.dshsmNested = 'true'; else delete target.row.dataset.dshsmNested;
    target.children.hidden = nested || !node?.children.length;
  }, [target, nested, node]);
  const toggle = (id: string) => setCollapsed(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const branch = (child: TreeNode): React.ReactNode => {
    const expanded = !collapsed.has(child.id);
    return <div key={child.id} role="listitem">
      <div className="dshsm-tree-row" data-selected={selected === child.id}>
        {child.children.length ? <button type="button" className="dshsm-tree-toggle" aria-label={`${expanded ? '收起' : '展开'}${child.label}的子会话`} aria-expanded={expanded} onClick={event => { event.stopPropagation(); toggle(child.id); }}><Chevron expanded={expanded} /></button> : <span className="dshsm-tree-spacer" />}
        <button type="button" className="dshsm-tree-name" disabled={child.subagent && !child.openable} aria-label={`${child.subagent && !child.openable ? child.note ?? '暂不可打开' : '打开会话'}：${child.label}`} title={[child.label, child.subagent && child.note, child.subagent && child.description].filter(Boolean).join(' · ')} onClick={event => { event.stopPropagation(); setSelected(child.id); openSession(child); }}>
          <span className="dshsm-tree-label">{child.label}</span>{child.subagent && <span className="dshsm-tree-member" title={child.subagentKind === 'teammate' ? '智能体团队队员' : child.subagentKind === 'unknown' ? '子智能体，团队归属待核对' : '团队外子智能体'}>{child.subagentKind === 'teammate' ? '队员' : '子智能体'}{child.note ? ` · ${child.note}` : ''}</span>}{child.running && <span className="dshsm-tree-running" aria-label="运行中" />}
        </button>
      </div>
      {child.children.length > 0 && expanded && <div role="list" aria-label={`${child.label}的子会话`} className="dshsm-tree-children">{child.children.map(branch)}</div>}
    </div>;
  };
  const expanded = !collapsed.has(sessionId), hasChildren = Boolean(node?.children.length);
  return <><span ref={anchor} hidden />{target && <>
    {createPortal(<><style>{styles}</style>{!nested && expanded && <>
      {snapshot.problem && <div role="alert" className="dshsm-tree-notice">{snapshot.problem}</div>}
      {hasChildren && <div role="list" aria-label={`${node!.label}的子会话`}>{node!.children.map(branch)}</div>}
    </>}</>, target.children)}
    {!nested && hasChildren && createPortal(<button type="button" className="dshsm-native-toggle" aria-label={`${expanded ? '收起' : '展开'}${node!.label}的子会话`} aria-expanded={expanded} onClick={event => { event.stopPropagation(); toggle(sessionId); }}><Chevron expanded={expanded} /></button>, target.row)}
  </>}</>;
}
