import React from 'react';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { SessivraPanel } from './task-panel-service.js';
import type { MessageOrigin, ResolvedMessage } from './message-history.js';
type RemoteApi = {
    [K in 'participants' | 'detail' | 'list' | 'command' | 'operation' | 'preview' | 'cliStatus' | 'refreshCliStatus' | 'cliLogin' | 'cliChatProviders']: (...args: Parameters<SessivraPanel[K]>) => Promise<RemoteResult<Awaited<ReturnType<SessivraPanel[K]>>>>;
};
export type TaskPanelApi = RemoteApi;
export type TaskHistoryApi = {
    [K in 'searchHistory' | 'locateMessage' | 'bookmarkedTurns' | 'bookmarkReference' | 'locateLegacyBookmark']: (...args: Parameters<SessivraPanel[K]>) => Promise<RemoteResult<Awaited<ReturnType<SessivraPanel[K]>>>>;
};
export declare const taskPanelTitle = "\u4EFB\u52A1\u4E2D\u5FC3";
export declare function TaskPanel({ api, open, renderMarkdown, initialSession, initialTask, source: initialSource, openOrigin, }: {
    api: RemoteApi;
    open: (id: string) => void;
    renderMarkdown: (text: string) => React.ReactNode;
    initialSession?: string;
    initialTask?: string;
    source?: ResolvedMessage;
    openOrigin?: (origin: MessageOrigin) => void;
}): React.JSX.Element;
export {};
