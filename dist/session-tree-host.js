import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useSyncExternalStore } from 'react';
import { NativeSessionChildren } from './session-tree.js';
import { SessionActionsMenu } from './session-actions.js';
export function NativeSessionTreeHost(props) {
    const selected = props.useSessions(list => Object.values(list.byId).find(session => (session.retainedBy.mainView ?? 0) > 0)?.id);
    const panelActive = props.usePanelInfo(info => info.activePanelId !== null);
    const statuses = props.useSessionStatus(state => state);
    const pinnedIds = new Set(props.useWorkspaces(state => state.pinnedSessionIds));
    const snapshot = useSyncExternalStore(props.store.subscribe, props.store.getSnapshot, props.store.getSnapshot);
    return _jsx(NativeSessionChildren, { ...props, currentId: panelActive ? undefined : selected, statuses: statuses, pinnedIds: pinnedIds, renderActions: session => _jsxs(_Fragment, { children: [session.task && props.openTask && _jsx("button", { type: "button", className: "dshsm-session-actions", title: "\u67E5\u770B\u4EFB\u52A1", onClick: e => { e.stopPropagation(); props.openTask?.(session.task.id); }, children: "\u4EFB\u52A1" }), _jsx(SessionActionsMenu, { session: { ...session, running: statuses.get(session.id)?.running ?? session.running }, pinned: pinnedIds.has(session.id), actions: props.sessionActions, controls: props.controls, dialogs: props.dialogs, alias: snapshot.aliases.get(session.id), setAlias: name => props.store.setAlias(session.id, name), onChanged: () => void props.store.refresh() })] }) });
}
