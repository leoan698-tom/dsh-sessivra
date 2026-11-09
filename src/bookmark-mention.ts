import type { BookmarkedSession, MessageOrigin } from './message-history.js';
import { listTurnBookmarks } from './turn-bookmarks.js';
import { compactMentions, mentionQuery, type MentionQuery, type MentionRow } from './mention-menu.js';

const source = 'sessivra-bookmark';
type Saved = ReturnType<typeof listTurnBookmarks>;
type Load = (sessionId: string, turns: number[]) => Promise<BookmarkedSession>;
type Candidate = { name: string; description: string; section: string; value: string; searchText: string };

async function readCandidates(saved: Saved, load: Load) {
  const groups = new Map<string, number[]>();
  for (const { sessionId, turn } of saved) {
    const turns = groups.get(sessionId);
    if (turns) turns.push(turn);
    else groups.set(sessionId, [turn]);
  }
  const pending = [...groups];
  const rows = new Map<string, Candidate>();
  const read = async () => {
    for (let group = pending.shift(); group; group = pending.shift()) {
      const [id, turns] = group;
      for (let start = 0; start < turns.length; start += 100) {
        const session = await load(id, turns.slice(start, start + 100)).catch(() => undefined);
        if (!session) continue;
        for (const item of session.items) {
          if (!item.prompt && !item.response) continue;
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

export function createBookmarkMentionSource(load: Load, resolve: (origin: MessageOrigin, turn: number) => Promise<string>) {
  let cached: { key: string; expires: number; rows: Promise<Candidate[]> } | undefined;
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
    async candidates(_session: unknown, { query, quoted, signal }: MentionQuery) {
      const { category, text } = mentionQuery(query);
      if (quoted || (category && category !== 'bookmarks')) return [];
      const rows = await prepare();
      if (signal.aborted) return [];
      const terms = text.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/u).filter(term => term && term !== '收藏');
      return compactMentions(rows.filter(row => terms.every(term => row.searchText.includes(term))), 'bookmarks', query);
    },
    onPick({ candidate }: { candidate: MentionRow }) {
      if (candidate.value.startsWith('@')) return { text: candidate.value, continue: true };
      const { name } = JSON.parse(candidate.value);
      return { insert: {
        source, ref: candidate.value, label: `收藏 · ${name}`,
        appearance: 'session', clipboardText: `@收藏 · ${name}`,
      } };
    },
    codec: {
      clipboardText(ref: string) { return `@收藏 · ${JSON.parse(ref).name}`; },
      async serialize(ref: string, signal: AbortSignal) {
        signal.throwIfAborted();
        const { origin, turn } = JSON.parse(ref) as { origin: MessageOrigin; turn: number };
        const quote = await resolve(origin, turn);
        signal.throwIfAborted();
        return quote;
      },
    },
  };
}
