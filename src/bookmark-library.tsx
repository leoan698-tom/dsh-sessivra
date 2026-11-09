import React, { useEffect, useState } from 'react';
import type { Menu as HostMenu } from '@deepseek-ai/dsh-client-ui-primitives';
import type { BookmarkedSession, MessageOrigin } from './message-history.js';
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

export function BookmarkLibrary({ load, jump, Menu }: {
  load(sessionId: string, turns: number[]): Promise<BookmarkedSession>;
  jump(origin: MessageOrigin): void;
  Menu: typeof HostMenu;
}) {
  const [saved, setSaved] = useState(() => listTurnBookmarks(window));
  const [filter, setFilter] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sessions, setSessions] = useState<Map<string, BookmarkedSession | null>>(() => new Map());
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
    const groups = new Map<string, number[]>();
    for (const { sessionId, turn } of saved) {
      if (!groups.has(sessionId)) groups.set(sessionId, []);
      groups.get(sessionId)!.push(turn);
    }
    setSessions(new Map());
    const pending = [...groups];
    const read = async () => {
      for (let group = pending.shift(); group && !disposed; group = pending.shift()) {
        const [id, turns] = group;
        let result: BookmarkedSession | null = null;
        try {
          result = await load(id, turns.slice(0, 100));
          for (let i = 100; i < turns.length && !disposed; i += 100) {
            result.items.push(...(await load(id, turns.slice(i, i + 100))).items);
          }
        } catch { /* Preserve the bookmark if the original history is unavailable. */ }
        if (!disposed) setSessions(previous => new Map(previous).set(id, result));
      }
    };
    void Promise.all(Array.from({ length: Math.min(4, pending.length) }, read));
    return () => { disposed = true; };
  }, [saved, load]);
  return <section className="sessivra-bookmark-library" aria-label="收藏"><style>{styles}</style>
    <header>
      <h1>收藏</h1>
      {saved.length > 0 && <Menu className="bookmark-filter" portal align="end" compact autoFocus
        open={filterOpen} onClose={() => setFilterOpen(false)} selectedId={selected ? `session:${selected}` : 'all'}
        anchor={<button type="button" aria-label="按会话筛选" aria-haspopup="menu" aria-expanded={filterOpen} onClick={() => setFilterOpen(!filterOpen)}>
          <span>{selected ? sessions.get(selected)?.title ?? '会话' : '全部会话'}</span><Chevron path="m3 4.5 3 3 3-3" />
        </button>}
        items={[{ id: 'all', label: '全部会话' }, ...sessionIds.map((id, index) => ({
          id: `session:${id}`, label: <span className="sessivra-bookmark-filter-label">{sessions.get(id)?.title ?? `会话 ${index + 1}`}</span>,
        }))]}
        onSelect={id => { setFilter(id === 'all' ? '' : id.slice('session:'.length)); setFilterOpen(false); }} />}
    </header>
    <div className="bookmark-body">
      {saved.length === 0 ? <p>还没有收藏。点击任意轮次的鱼形按钮，就可以在这里找到它。</p> :
        <ul>{saved.filter(item => !selected || item.sessionId === selected).map(({ sessionId, turn }) => {
          const session = sessions.get(sessionId), item = session?.items.find(entry => entry.turn === turn);
          return <li key={JSON.stringify([sessionId, turn])}><button type="button" disabled={!item} onClick={() => item && jump(item.anchor)}>
            <span className="bookmark-summary">
              <small>{session?.title ?? '会话'} · 第 {turn} 轮</small>
              <span className="bookmark-prompt">{item ? item.prompt || '本轮问答' : session === undefined ? '正在读取问答…' : '原轮次暂不可用'}</span>
              {item?.response && <span className="bookmark-response">{item.response}</span>}
            </span>
            {item && <span className="bookmark-arrow"><Chevron path="m4.5 3 3 3-3 3" /></span>}
          </button></li>;
        })}</ul>}
    </div>
  </section>;
}

function Chevron({ path }: { path: string }) {
  return <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d={path} stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
