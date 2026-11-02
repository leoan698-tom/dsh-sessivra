import React, { useEffect, useState } from 'react';
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
interface Props { api: TreeApi; openSession(session: TreeSession): void; startSession(): void; standardList(): void }
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
const Chevron = ({ expanded }: { expanded: boolean }) => <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={{ transform: expanded ? 'rotate(90deg)' : undefined }}><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Folder = () => <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><path d="M2 4h4l1.5 1.5H14V13H2zM2 4V2.5h4l1.5 1.5H14v1.5" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" /></svg>;

export function SessionTree({ api, openSession, standardList }: Props) {
  const [sessions, setSessions] = useState<TreeSession[]>([]);
  const [problem, setProblem] = useState('');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState('');
  useEffect(() => {
    let alive = true, inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await api.tree();
        if (alive) {
          if (result.ok) { setSessions(result.value); setProblem(''); }
          else setProblem('读取会话列表失败，请稍后重试');
        }
      } catch { if (alive) setProblem('会话列表连接中断'); }
      finally { inFlight = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 2000);
    return () => { alive = false; clearInterval(timer); };
  }, [api]);
  const toggle = (id: string) => setCollapsed(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const forest = sessionForest(sessions);
  const matches = (node: TreeNode): boolean => `${node.label} ${node.id} ${node.workspace ?? ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()) || node.children.some(matches);
  const branch = (node: TreeNode): React.ReactNode => {
    const children = node.children.filter(matches), expanded = Boolean(query) || !collapsed.has(node.id);
    return <div key={node.id} role="listitem">
      <div className="dshsm-tree-row" data-selected={selected === node.id}>
        {children.length ? <button type="button" className="dshsm-tree-toggle" aria-label={`${expanded ? '收起' : '展开'}${node.label}的子会话`} aria-expanded={expanded} onClick={() => toggle(node.id)}><Chevron expanded={expanded} /></button> : <span className="dshsm-tree-spacer" />}
        <button type="button" className="dshsm-tree-name" disabled={node.subagent && !node.openable} aria-label={`${node.subagent && !node.openable ? node.note ?? '暂不可打开' : '打开会话'}：${node.label}`} title={[node.label, node.subagent && node.note, node.subagent && node.description].filter(Boolean).join(' · ')} onClick={() => { setSelected(node.id); openSession(node); }}>
          <span className="dshsm-tree-label">{node.label}</span>{node.subagent && <span className="dshsm-tree-member" title={node.subagentKind === 'teammate' ? '智能体团队队员' : node.subagentKind === 'unknown' ? '子智能体，团队归属待核对' : '团队外子智能体'}>{node.subagentKind === 'teammate' ? '队员' : '子智能体'}{node.note ? ` · ${node.note}` : ''}</span>}{node.running && <span className="dshsm-tree-running" aria-label="运行中" />}
        </button>
      </div>
      {children.length > 0 && expanded && <div role="list" aria-label={`${node.label}的子会话`} className="dshsm-tree-children">{children.map(branch)}</div>}
    </div>;
  };
  const groups = new Map<string, TreeNode[]>();
  for (const node of forest.filter(matches)) {
    const path = node.workspace ?? '未分组';
    groups.set(path, [...(groups.get(path) ?? []), node]);
  }
  return <section aria-label="工作区会话树" className="dshsm-session-tree">
    <style>{styles}</style>
    <div className="dshsm-tree-toolbar">
      {searchOpen ? <input autoFocus aria-label="搜索会话树" className="dshsm-session-search" placeholder="搜索会话" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { setQuery(''); setSearchOpen(false); } }} /> : <><span className="dshsm-tree-toolbar-label">会话</span><button type="button" className="dshsm-tree-manage" onClick={standardList}>工作区管理</button></>}
      <button type="button" className="dshsm-tree-search-toggle" aria-label={searchOpen ? '关闭会话搜索' : '搜索会话'} aria-expanded={searchOpen} onClick={() => { setSearchOpen(!searchOpen); setQuery(''); }}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></button>
    </div>
    <div className="dshsm-tree-list">
    {problem && <p role="alert" className="dshsm-tree-notice">{problem}</p>}
    {!problem && sessions.length === 0 && <p role="status" className="dshsm-tree-notice">暂无会话</p>}
    {[...groups].map(([path, roots]) => {
      const expanded = Boolean(query) || !collapsed.has(`workspace:${path}`), name = path.split(/[\\/]/u).filter(Boolean).pop() ?? path;
      return <div key={path} className="dshsm-tree-group">
        <div className="dshsm-tree-row dshsm-tree-group-label">
          <button type="button" className="dshsm-tree-toggle dshsm-tree-folder" aria-label={`${expanded ? '收起' : '展开'}工作区${name}`} aria-expanded={expanded} onClick={() => toggle(`workspace:${path}`)}><span className="dshsm-tree-folder-icon"><Folder /></span><span className="dshsm-tree-folder-arrow"><Chevron expanded={expanded} /></span></button>
          <button type="button" className="dshsm-tree-name" title={path} onClick={() => toggle(`workspace:${path}`)}><span className="dshsm-tree-label">{name}</span></button>
        </div>
        {expanded && <div role="list" aria-label={path}>{roots.map(branch)}</div>}
      </div>;
    })}
    </div>
  </section>;
}
