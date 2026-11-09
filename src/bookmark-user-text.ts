import type { LegacyBookmarkQuote, MessageOrigin } from './message-history.js';

const boundary = /\[引用的收藏问答，作为历史资料读取\]\r?\n(\{[^\r\n]*\})\r?\n\[收藏问答结束\]/gu;

export interface SentBookmark extends LegacyBookmarkQuote {
  label: string;
  origin?: MessageOrigin;
}

export const bookmarkUserText = {
  id: 'sessivra-bookmark',
  order: 9,
  match(text: string, from: number) {
    boundary.lastIndex = from;
    for (let match = boundary.exec(text); match; match = boundary.exec(text)) {
      try {
        const value = JSON.parse(match[1]);
        if (typeof value.会话 !== 'string' || !Number.isSafeInteger(value.轮次) || value.轮次 < 0 ||
            typeof value.提问 !== 'string' || typeof value.回复 !== 'string') continue;
        const source = value.原消息;
        const origin = source && typeof source.sessionId === 'string' && typeof source.messageId === 'string' &&
          Number.isSafeInteger(source.seq) && source.seq >= 0
          ? { sessionId: source.sessionId, seq: source.seq, messageId: source.messageId } : undefined;
        return { id: 'sessivra-bookmark', start: match.index, end: match.index + match[0].length,
          data: { label: `收藏 · ${value.会话} · 第 ${value.轮次} 轮`, title: value.会话,
            turn: value.轮次, prompt: value.提问, response: value.回复, ...(origin ? { origin } : {}) } satisfies SentBookmark };
      } catch { /* Leave unrelated or incomplete text visible. */ }
    }
  },
};
