import React, { useSyncExternalStore } from 'react';
import { NativeSessionChildren, type NativeTreeProps, type TreeStatus } from './session-tree.js';
import { SessionActionsMenu, type SessionActions, type SessionControls } from './session-actions.js';
import type { SessionDialogStore } from './session-dialog.js';

type SelectorHook<S> = <T>(selector: (snapshot: S) => T) => T;
// rc.5's root slot hooks; selectors read only and never retain listed sessions.
interface HostProps extends NativeTreeProps {
  useSessions: SelectorHook<{ byId: Record<string, { id: string; retainedBy: { mainView?: number } }> }>;
  usePanelInfo: SelectorHook<{ activePanelId: string | null }>;
  useSessionStatus: SelectorHook<ReadonlyMap<string, TreeStatus>>;
  useWorkspaces: SelectorHook<{ pinnedSessionIds: readonly string[] }>;
  sessionActions: SessionActions;
  controls: SessionControls;
  dialogs: SessionDialogStore;
}
export function NativeSessionTreeHost(props: HostProps) {
  const selected = props.useSessions(list => Object.values(list.byId).find(session => (session.retainedBy.mainView ?? 0) > 0)?.id);
  const panelActive = props.usePanelInfo(info => info.activePanelId !== null);
  const statuses = props.useSessionStatus(state => state);
  const pinnedIds = new Set(props.useWorkspaces(state => state.pinnedSessionIds));
  const snapshot = useSyncExternalStore(props.store.subscribe, props.store.getSnapshot, props.store.getSnapshot);
  return <NativeSessionChildren {...props} currentId={panelActive ? undefined : selected} statuses={statuses} pinnedIds={pinnedIds}
    renderActions={session => <SessionActionsMenu session={{ ...session, running: statuses.get(session.id)?.running ?? session.running }} pinned={pinnedIds.has(session.id)} actions={props.sessionActions} controls={props.controls} dialogs={props.dialogs} alias={snapshot.aliases.get(session.id)} setAlias={name => props.store.setAlias(session.id, name)} onChanged={() => void props.store.refresh()} />} />;
}
