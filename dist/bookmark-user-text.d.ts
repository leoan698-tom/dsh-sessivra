import type { LegacyBookmarkQuote, MessageOrigin } from './message-history.js';
export interface SentBookmark extends LegacyBookmarkQuote {
    label: string;
    origin?: MessageOrigin;
}
export declare const bookmarkUserText: {
    id: string;
    order: number;
    match(text: string, from: number): {
        id: string;
        start: number;
        end: number;
        data: {
            origin?: {
                sessionId: any;
                seq: any;
                messageId: any;
            } | undefined;
            label: string;
            title: any;
            turn: any;
            prompt: any;
            response: any;
        };
    } | undefined;
};
