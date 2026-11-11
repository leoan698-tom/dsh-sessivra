import { treePresentation } from './session-tree.js';
import { isImportedSession } from './import-contract.js';
const categories = { sessions: '会话', bookmarks: '收藏', files: '文件' };
const previewCount = 5;
export function mentionQuery(query) {
    const match = /^(会话|收藏|文件)[:：](.*)$/u.exec(query);
    const category = match && Object.keys(categories).find(key => categories[key] === match[1]);
    return { category, text: match ? match[2] : query };
}
export function compactMentions(rows, category, query) {
    if (mentionQuery(query).category === category || rows.length <= previewCount)
        return rows;
    return [...rows.slice(0, previewCount), {
            name: `展开其余 ${rows.length - previewCount} 项`,
            section: rows[0].section, value: `@${categories[category]}:${query}`,
        }];
}
export function createSidebarMentionSource(sessions, store, workspace, archive) {
    return {
        name: 'sessivra-sidebar-session', trigger: '@', order: -20, showGroupTitle: false,
        async candidates(session, request) {
            const { category, text } = mentionQuery(request.query);
            if (request.quoted || (category && category !== 'sessions'))
                return [];
            const { ids, byId } = sessions.list.getSnapshot();
            const { archivedSessionIds, pinnedSessionIds, items } = workspace();
            const archived = new Set(archivedSessionIds), filter = archive();
            const tree = store.getSnapshot();
            const terms = text.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/u).filter(Boolean);
            const members = new Set(items.flatMap(item => item.sessionIds));
            const ordered = [...pinnedSessionIds, ...ids.filter(id => members.has(id)), ...ids, ...tree.nodes.keys()];
            const rows = [...new Set(ordered)].flatMap(id => {
                const summary = byId[id], node = tree.nodes.get(id);
                if (id === session.sessionId)
                    return [];
                if (tree.hiddenSessions.has(id) || (!summary && !node) || (summary?.origin === 'subagent' && !node))
                    return [];
                const imported = isImportedSession(id) && node && !node.subagent && node.label !== '未命名会话';
                if (summary?.blank && !summary.retainedBy.mainView && !imported)
                    return [];
                let root = id;
                while (tree.parents.has(root))
                    root = tree.parents.get(root);
                const isArchived = archived.has(id) || archived.has(root);
                if (filter === 'only' ? !isArchived : filter !== 'show' && isArchived)
                    return [];
                const name = node && (node.subagent || tree.parents.has(id) || imported)
                    ? treePresentation(node, undefined, tree.aliases.get(id)).label : summary?.displayTitle ?? node.label;
                const haystack = [name, tree.nodes.get(root)?.label, byId[root]?.displayTitle]
                    .join(' ').normalize('NFKC').toLocaleLowerCase();
                if (!terms.every(term => haystack.includes(term)))
                    return [];
                return [{ name, icon: 'session', section: '会话', description: node?.subagent ? '队员' : tree.parents.has(id) ? '子会话' : undefined,
                        value: id }];
            });
            const compact = compactMentions(rows, 'sessions', request.query);
            if (!category && !text)
                compact.push({ name: '浏览文件与文件夹', section: '文件', value: '@文件:' });
            return compact;
        },
        onPick({ candidate }) {
            if (!candidate.icon)
                return { text: candidate.value, continue: true };
            const bytes = new TextEncoder().encode(JSON.stringify(candidate.value));
            const encoded = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
            const label = candidate.name.replace(/[\r\n]/gu, ' ').trim().replace(/[\\\[\]]/gu, '\\$&');
            const ref = `@[${label}](dsh-session:${encoded})`;
            return { insert: { source: 'reference', appearance: 'session', ref, label: candidate.name, clipboardText: ref } };
        },
    };
}
// rc.1 combines files and sessions in one source. Keep its file pick/codec
// intact, while local sidebar sessions render independently of its file RPC.
export function compactNativeReferences(registry) {
    if (!Array.isArray(registry.live?.sources))
        return () => { };
    const restore = [];
    const wrap = (source) => {
        if (source.name !== 'reference' || source.trigger !== '@')
            return;
        const original = source.candidates;
        const header = source.header;
        const projected = (request) => request.quoted ? { category: undefined, text: request.query } : mentionQuery(request.query);
        source.candidates = async (session, request) => {
            const { category, text } = projected(request);
            if ((category && category !== 'files') || (!category && !text && !request.quoted))
                return [];
            if (!category && !request.quoted) {
                await new Promise(resolve => {
                    const finish = () => { clearTimeout(timer); request.signal.removeEventListener('abort', finish); resolve(); };
                    const timer = setTimeout(finish, 150);
                    request.signal.addEventListener('abort', finish, { once: true });
                    if (request.signal.aborted)
                        finish();
                });
            }
            if (request.signal.aborted)
                return [];
            const rows = await original.call(source, session, { ...request, query: text });
            return rows.filter(row => row.icon !== 'session').slice(0, category || request.quoted ? 40 : 4);
        };
        if (header)
            source.header = (session, request) => {
                const { category, text } = projected(request);
                return category && category !== 'files' ? undefined : header.call(source, session, { ...request, query: text });
            };
        restore.push(() => { source.candidates = original; if (header)
            source.header = header; });
    };
    registry.live.sources.forEach(wrap);
    const register = registry.registerSource;
    registry.registerSource = function (source) {
        wrap(source);
        return register.call(this, source);
    };
    return () => { registry.registerSource = register; restore.forEach(dispose => dispose()); };
}
