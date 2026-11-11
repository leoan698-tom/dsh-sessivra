import React from 'react';
import type { ISessions, SessionTarget } from '@deepseek-ai/dsh-api-session-controller/client';
import type { Button as HostButton } from '@deepseek-ai/dsh-client-ui-primitives';
import type { MessageLocation, ResolvedMessage } from './message-history.js';
interface JumpState {
    loading?: boolean;
    error?: string;
    row?: HTMLElement;
}
export declare function createMessageNavigator(sessions: ISessions, open: (target: SessionTarget) => void, resolve: (location: MessageLocation, expectedId: string) => Promise<ResolvedMessage>): {
    subscribe(notify: () => void): () => void;
    snapshot: () => JumpState;
    dismiss(): void;
    jump(location: MessageLocation, expectedId?: string, bookmark?: boolean): Promise<void>;
};
export declare function MessageJumpNotice({ navigator, Button }: {
    navigator: ReturnType<typeof createMessageNavigator>;
    Button: typeof HostButton;
}): React.JSX.Element | null;
export {};
