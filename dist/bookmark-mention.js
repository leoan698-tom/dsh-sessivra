import { listTurnBookmarks } from './turn-bookmarks.js';
import { compactMentions, mentionQuery } from './mention-menu.js';
const source = 'sessivra-bookmark';
async function readCandidates(saved, load) {
    const groups = new Map();
    for (const { sessionId, turn } of saved) {
        const turns = groups.get(sessionId);
        if (turns)
            turns.push(turn);
        else
            groups.set(sessionId, [turn]);
    }
    const pending = [...groups];
    const rows = new Map();
    const read = async () => {
        for (let group = pending.shift(); group; group = pending.shift()) {
            const [id, turns] = group;
            for (let start = 0; start < turns.length; start += 100) {
                const session = await load(id, turns.slice(start, start + 100)).catch(() => undefined);
                if (!session)
                    continue;
                for (const item of session.items) {
                    if (!item.prompt && !item.response)
                        continue;
                    const name = `${session.title} · 第 ${item.turn} 轮`;
                    rows.set(JSON.stringify([id, item.turn]), {
                        name, section: '收藏', description: item.prompt || item.response,
                        value: JSON.stringify({ origin: item.anchor, turn: item.turn, name }),
                        searchText: `${name} ${item.prompt} ${item.response}`.normalize('NFKC').toLocaleLowerCase(),
                    });
                }
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(4, pending.length) }, read));
    return saved.flatMap(({ sessionId, turn }) => rows.get(JSON.stringify([sessionId, turn])) ?? []);
}
export function createBookmarkMentionSource(load, resolve) {
    let cached;
    const prepare = () => {
        const saved = listTurnBookmarks(window);
        const key = JSON.stringify(saved);
        if (cached?.key !== key || cached.expires <= Date.now()) {
            cached = { key, expires: Date.now() + 60000, rows: readCandidates(saved, load) };
        }
        return cached.rows;
    };
    return {
        name: source, trigger: '@', order: -10, showGroupTitle: false,
        warm: prepare,
        async candidates(_session, { query, quoted, signal }) {
            const { category, text } = mentionQuery(query);
            if (quoted || (category && category !== 'bookmarks'))
                return [];
            const rows = await prepare();
            if (signal.aborted)
                return [];
            const terms = text.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/u).filter(term => term && term !== '收藏');
            return compactMentions(rows.filter(row => terms.every(term => row.searchText.includes(term))), 'bookmarks', query);
        },
        onPick({ candidate }) {
            if (candidate.value.startsWith('@'))
                return { text: candidate.value, continue: true };
            const { name } = JSON.parse(candidate.value);
            return { insert: {
                    source, ref: candidate.value, label: `收藏 · ${name}`,
                    appearance: 'session', clipboardText: `@收藏 · ${name}`,
                } };
        },
        codec: {
            clipboardText(ref) { return `@收藏 · ${JSON.parse(ref).name}`; },
            async serialize(ref, signal) {
                signal.throwIfAborted();
                const { origin, turn } = JSON.parse(ref);
                const quote = await resolve(origin, turn);
                signal.throwIfAborted();
                return quote;
            },
        },
    };
}
