import React from 'react';
import type { ISessions, SessionTarget } from '@deepseek-ai/dsh-api-session-controller/client';
import type { MessageLocation, ResolvedMessage } from './message-history.js';
interface JumpState {
    loading?: boolean;
    error?: string;
    row?: HTMLElement;
    message?: ResolvedMessage;
}
export declare function createMessageNavigator(sessions: ISessions, open: (target: SessionTarget) => void, resolve: (location: MessageLocation, expectedId: string) => Promise<ResolvedMessage>): {
    subscribe(notify: () => void): () => void;
    snapshot: () => JumpState;
    dismiss(): void;
    jump(location: MessageLocation, expectedId?: string, bookmark?: boolean): Promise<void>;
};
export declare function MessageJumpNotice({ navigator, organize }: {
    navigator: ReturnType<typeof createMessageNavigator>;
    organize?(message: ResolvedMessage): void;
}): React.JSX.Element | null;
export {};
