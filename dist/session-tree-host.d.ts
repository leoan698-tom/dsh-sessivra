import React from 'react';
import { type NativeTreeProps, type TreeStatus } from './session-tree.js';
import { type SessionActions, type SessionControls } from './session-actions.js';
import type { SessionDialogStore } from './session-dialog.js';
type SelectorHook<S> = <T>(selector: (snapshot: S) => T) => T;
interface HostProps extends NativeTreeProps {
    useSessions: SelectorHook<{
        byId: Record<string, {
            id: string;
            retainedBy: {
                mainView?: number;
            };
        }>;
    }>;
    usePanelInfo: SelectorHook<{
        activePanelId: string | null;
    }>;
    useSessionStatus: SelectorHook<ReadonlyMap<string, TreeStatus>>;
    useWorkspaces: SelectorHook<{
        pinnedSessionIds: readonly string[];
    }>;
    sessionActions: SessionActions;
    controls: SessionControls;
    dialogs: SessionDialogStore;
}
export declare function NativeSessionTreeHost(props: HostProps): React.JSX.Element;
export {};
