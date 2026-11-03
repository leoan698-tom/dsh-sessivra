import React from 'react';
import type { Button, Menu, Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import type { TreeSession } from './collaboration.js';
import { type SessionDialogStore } from './session-dialog.js';
export interface SessionActions {
    rename(id: string, title: string): Promise<void>;
    pin(id: string, pinned: boolean): Promise<void>;
    archive(id: string): Promise<void>;
}
export interface SessionControls {
    Menu: typeof Menu;
    Modal: typeof Modal;
    Button: typeof Button;
}
export declare function SessionActionsMenu({ session, pinned, actions, controls, dialogs, onChanged, alias, setAlias }: {
    session: TreeSession;
    pinned: boolean;
    actions: SessionActions;
    controls: SessionControls;
    onChanged(): void;
    dialogs: SessionDialogStore;
    alias?: string;
    setAlias?(name: string): void;
}): React.JSX.Element | null;
