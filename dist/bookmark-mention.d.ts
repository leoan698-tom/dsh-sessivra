import type { BookmarkedSession, MessageOrigin } from './message-history.js';
import { type MentionQuery, type MentionRow } from './mention-menu.js';
type Load = (sessionId: string, turns: number[]) => Promise<BookmarkedSession>;
type Candidate = {
    name: string;
    description: string;
    section: string;
    value: string;
    searchText: string;
};
export declare function createBookmarkMentionSource(load: Load, resolve: (origin: MessageOrigin, turn: number) => Promise<string>): {
    name: string;
    trigger: string;
    order: number;
    showGroupTitle: boolean;
    warm: () => Promise<Candidate[]>;
    candidates(_session: unknown, { query, quoted, signal }: MentionQuery): Promise<MentionRow[]>;
    onPick({ candidate }: {
        candidate: MentionRow;
    }): {
        text: string;
        continue: boolean;
        insert?: undefined;
    } | {
        insert: {
            source: string;
            ref: string;
            label: string;
            appearance: string;
            clipboardText: string;
        };
        text?: undefined;
        continue?: undefined;
    };
    codec: {
        clipboardText(ref: string): string;
        serialize(ref: string, signal: AbortSignal): Promise<string>;
    };
};
export {};
