import React from 'react';
import type { Menu as HostMenu } from '@deepseek-ai/dsh-client-ui-primitives';
import type { BookmarkedSession, MessageOrigin } from './message-history.js';
export declare function BookmarkLibrary({ load, jump, Menu }: {
    load(sessionId: string, turns: number[]): Promise<BookmarkedSession>;
    jump(origin: MessageOrigin): void;
    Menu: typeof HostMenu;
}): React.JSX.Element;
