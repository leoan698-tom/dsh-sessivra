import React from 'react';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { SessivraPanel } from './task-panel-service.js';
type RemoteApi = {
    [K in 'participants' | 'detail' | 'list' | 'command' | 'operation' | 'preview']: (...args: Parameters<SessivraPanel[K]>) => Promise<RemoteResult<Awaited<ReturnType<SessivraPanel[K]>>>>;
};
export type TaskPanelApi = RemoteApi;
export type TaskHistoryApi = {
    [K in 'locateMessage' | 'bookmarkedTurns' | 'bookmarkReference' | 'locateLegacyBookmark']: (...args: Parameters<SessivraPanel[K]>) => Promise<RemoteResult<Awaited<ReturnType<SessivraPanel[K]>>>>;
};
export declare const taskPanelTitle = "\u4EFB\u52A1\u4E2D\u5FC3";
export declare function TaskPanel({ api, open, renderMarkdown, initialSession, initialTask, }: {
    api: RemoteApi;
    open: (id: string) => void;
    renderMarkdown: (text: string) => React.ReactNode;
    initialSession?: string;
    initialTask?: string;
}): React.JSX.Element;
export {};
