import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client';
import { treePresentation, type TreeStore } from './session-tree.js';

export type MentionQuery = { query: string; quoted: boolean; signal: AbortSignal };
export type MentionRow = { name: string; value: string; description?: string; section?: string; icon?: 'session' };
const categories = { sessions: '会话', bookmarks: '收藏', files: '文件' };
type Category = keyof typeof categories;
const previewCount = 5;

export function mentionQuery(query: string) {
  const match = /^(会话|收藏|文件)[:：](.*)$/u.exec(query);
  const category = match && (Object.keys(categories) as Category[]).find(key => categories[key] === match[1]);
  return { category, text: match ? match[2] : query };
}

export function compactMentions(rows: MentionRow[], category: Category, query: string) {
  if (mentionQuery(query).category === category || rows.length <= previewCount) return rows;
  return [...rows.slice(0, previewCount), {
    name: `展开其余 ${rows.length - previewCount} 项`,
    section: rows[0].section, value: `@${categories[category]}:${query}`,
  }];
}

interface WorkspaceState {
  items: readonly { sessionIds: readonly string[] }[];
  pinnedSessionIds: readonly string[];
  archivedSessionIds: readonly string[];
}
type ArchiveFilter = 'default' | 'show' | 'only';

export function createSidebarMentionSource(sessions: Pick<ISessions, 'list'>, store: TreeStore, workspace: () => WorkspaceState, archive: () => ArchiveFilter | undefined) {
  return {
    name: 'sessivra-sidebar-session', trigger: '@', order: -20, showGroupTitle: false,
    async candidates(session: { sessionId?: string }, request: MentionQuery): Promise<MentionRow[]> {
      const { category, text } = mentionQuery(request.query);
      if (request.quoted || (category && category !== 'sessions')) return [];
      const { ids, byId } = sessions.list.getSnapshot();
      const { archivedSessionIds, pinnedSessionIds, items } = workspace();
      const archived = new Set(archivedSessionIds), filter = archive();
      const tree = store.getSnapshot();
      const terms = text.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/u).filter(Boolean);
      const members = new Set(items.flatMap(item => item.sessionIds));
      const ordered = [...pinnedSessionIds, ...ids.filter(id => members.has(id)), ...ids, ...tree.nodes.keys()];
      const rows: MentionRow[] = [...new Set(ordered)].flatMap(id => {
        const summary = byId[id as keyof typeof byId], node = tree.nodes.get(id);
        if (id === session.sessionId) return [];
        if (tree.hiddenSessions.has(id) || (!summary && !node) || (summary?.origin === 'subagent' && !node)) return [];
        if (summary?.blank && !summary.retainedBy.mainView) return [];
        let root = id;
        while (tree.parents.has(root)) root = tree.parents.get(root)!;
        const isArchived = archived.has(id) || archived.has(root);
        if (filter === 'only' ? !isArchived : filter !== 'show' && isArchived) return [];
        const name = node && (node.subagent || tree.parents.has(id)) ? treePresentation(node, undefined, tree.aliases.get(id)).label : summary?.displayTitle ?? node!.label;
        const haystack = [name, byId[root as keyof typeof byId]?.displayTitle].join(' ').normalize('NFKC').toLocaleLowerCase();
        if (!terms.every(term => haystack.includes(term))) return [];
        return [{ name, icon: 'session' as const, section: '会话', description: node?.subagent ? '队员' : tree.parents.has(id) ? '子会话' : undefined,
          value: id }];
      });
      const compact = compactMentions(rows, 'sessions', request.query);
      if (!category && !text) compact.push({ name: '浏览文件与文件夹', section: '文件', value: '@文件:' });
      return compact;
    },
    onPick({ candidate }: { candidate: MentionRow }) {
      if (!candidate.icon) return { text: candidate.value, continue: true };
      const bytes = new TextEncoder().encode(JSON.stringify(candidate.value));
      const encoded = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
      const label = candidate.name.replace(/[\r\n\]]/gu, ' ').trim();
      const ref = `@[${label}](dsh-session:${encoded})`;
      return { insert: { source: 'reference', appearance: 'session', ref, label: candidate.name, clipboardText: ref } };
    },
  };
}

interface NativeSource {
  name: string;
  trigger: string;
  candidates(session: unknown, request: MentionQuery): Promise<MentionRow[]>;
  header?(session: unknown, request: MentionQuery): unknown;
}

export interface MentionRegistry {
  live?: { sources: NativeSource[] };
  registerSource<T>(source: T): () => void;
}

// rc.1 combines files and sessions in one source. Keep its file pick/codec
// intact, while local sidebar sessions render independently of its file RPC.
export function compactNativeReferences(registry: MentionRegistry) {
  if (!Array.isArray(registry.live?.sources)) return () => {};
  const restore: (() => void)[] = [];
  const wrap = (source: NativeSource) => {
    if (source.name !== 'reference' || source.trigger !== '@') return;
    const original = source.candidates;
    const header = source.header;
    const projected = (request: MentionQuery) => request.quoted ? { category: undefined, text: request.query } : mentionQuery(request.query);
    source.candidates = async (session, request) => {
      const { category, text } = projected(request);
      if ((category && category !== 'files') || (!category && !text && !request.quoted)) return [];
      if (!category && !request.quoted) {
        await new Promise<void>(resolve => {
          const finish = () => { clearTimeout(timer); request.signal.removeEventListener('abort', finish); resolve(); };
          const timer = setTimeout(finish, 150);
          request.signal.addEventListener('abort', finish, { once: true });
          if (request.signal.aborted) finish();
        });
      }
      if (request.signal.aborted) return [];
      const rows = await original.call(source, session, { ...request, query: text });
      return rows.filter(row => row.icon !== 'session').slice(0, category || request.quoted ? 40 : 4);
    };
    if (header) source.header = (session, request) => {
      const { category, text } = projected(request);
      return category && category !== 'files' ? undefined : header.call(source, session, { ...request, query: text });
    };
    restore.push(() => { source.candidates = original; if (header) source.header = header; });
  };
  registry.live.sources.forEach(wrap);
  const register = registry.registerSource;
  registry.registerSource = function <T>(source: T) {
    wrap(source as NativeSource);
    return register.call(this, source);
  };
  return () => { registry.registerSource = register; restore.forEach(dispose => dispose()); };
}
