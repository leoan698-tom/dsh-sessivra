import React from 'react';
import type { SentBookmark } from './bookmark-user-text.js';
import type { LegacyBookmarkQuote, MessageOrigin } from './message-history.js';
export declare function SentBookmarkChip({ quote, locateLegacy, jump }: {
    quote: SentBookmark;
    locateLegacy(quote: LegacyBookmarkQuote): Promise<MessageOrigin | null>;
    jump(origin: MessageOrigin): void;
}): React.JSX.Element;
