export declare const turnBookmarksChanged = "sessivra:turn-bookmarks-changed";
export declare function listTurnBookmarks(win: Window): {
    sessionId: string;
    turn: number;
}[];
/** Decorate the native rc.1 turn rail and completed-turn actions in each conversation occurrence. */
export declare function mountTurnBookmarks(host: HTMLElement, fish: {
    path: string;
    width: number;
    height: number;
}): (() => void) | undefined;
