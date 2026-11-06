import React from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import { TaskPanel, taskPanelTitle, type TaskPanelApi } from './task-panel.js';
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client';
import { remoteContribution } from './contract.js';
import { createLegacyRecipientSource } from './recipient-source.js';
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client';
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client';
import { Button, MarkdownText, Menu, Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import { createSessionTreeStore, type TreeApi } from './session-tree.js';
import { NativeSessionTreeHost } from './session-tree-host.js';
import type { SessionActions } from './session-actions.js';
import { createSessionDialogStore, SessionDialogOutlet } from './session-dialog.js';
import { createWorkspaceArchiveSource, NativeTeamSearch, ParentUnavailableComposer, selectParentUnavailable, type WorkspaceViewSlots } from './session-navigation.js';
import { createSessionViews, SessionViews, SessionViewContent } from './session-views.js';
import { mirrorNativePaneHeader } from './native-pane-header.js';
import { createHeaderViews, wireHeaderViews } from './header-views.js';
import { createSessionReferenceDrop, SessionReferenceDropInput } from './session-reference-drop.js';

interface Api {
  selectRecipient(sourceId: string, targetId: string, label: string): Promise<RemoteResult<unknown>>;
}
const reportLabels = { code: { copyLabel: '复制代码', copiedLabel: '已复制' }, footnotes: '脚注' };
const renderReport = (text: string) => <MarkdownText text={text} labels={reportLabels}/>;

declare module '@deepseek-ai/dsh-typert-protocol' { interface TypertRemoteNamespaceMap { sessionMessenger: Api; sessivraTaskPanel: TaskPanelApi; sessionCollaboration: TreeApi } }
export const inject = ['slots', 'remote'];
export async function apply(ctx: Context) {
  await ctx.remote.$mount(remoteContribution);
  await ctx.inject(['remote.sessionMessenger'], remoteCtx => {
    remoteCtx.inject(['uiWorkspace', 'sessions', 'conversation', 'remote.sessionCollaboration'], treeCtx => {
      // Extend native session rows; never occupy sidebar.workspaces, whose owner
      // also supplies the native header, search, view options and directory flow.
      const treeSlots = treeCtx.slots as unknown as WorkspaceViewSlots & { inject(name: string, register: () => unknown): void; register(entry: object, component: React.ComponentType<never>): () => void };
      const store = createSessionTreeStore(treeCtx.remote.sessionCollaboration);
      const dialogs = createSessionDialogStore();
      const sessions = treeCtx.sessions as unknown as ISessions;
      const views = createSessionViews(sessions);
      const referenceDrop = createSessionReferenceDrop();
      const headerViews = createHeaderViews();
      let requestedTask: string | undefined;
      let showTask: ((id:string) => void) | undefined;
      treeCtx.inject(['remote.sessivraTaskPanel','layout'], panelCtx => {
        const panelId = 'sessivra-tasks' as MainPanelId;
        const listeners = new Set<()=>void>();
        showTask = id => { requestedTask=id; panelCtx.layout.selectPanel(panelId); for (const notify of listeners) notify(); };
        panelCtx.effect(() => () => { showTask=undefined; });
        const panelSlots = panelCtx.slots as unknown as typeof treeSlots;
        panelSlots.inject('sidebar.panellist', () => panelSlots.register({
          name:'sidebar.panellist', id:panelId, order:20, label:()=>taskPanelTitle,
        }, ({size}:{size:number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m3 6 2 2 4-5M12 6h9M3 14l2 2 4-5M12 14h9M12 20h9"/></svg>));
        panelSlots.inject('main', () => panelSlots.register({ name:'main', key:panelId }, function Mounted(props: {useSessions:<T>(get:(s:{byId:Record<string,{id:string; retainedBy:{mainView?:number}}>})=>T)=>T}) {
          const current = props.useSessions(s=>Object.values(s.byId).find(row=>row.retainedBy.mainView)?.id);
          const task = React.useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},()=>requestedTask);
          return <TaskPanel key={task} initialSession={current} initialTask={task} api={panelCtx.remote.sessivraTaskPanel} renderMarkdown={renderReport} open={id=>{
            const node=store.getSnapshot().nodes.get(id);
            if(node?.subagent && !node.openable) throw new Error('会话当前不可打开');
            panelCtx.uiWorkspace.openSession((node?.subagent ? {parentSessionId:node.parentId,childSessionId:id,mode:node.subagentMode} : id) as Parameters<typeof treeCtx.uiWorkspace.openSession>[0]);
          }}/>;
        }));
      });
      treeSlots.inject('conversation.session.header.actions', () => wireHeaderViews(treeCtx.slots, headerViews));
      treeSlots.inject('conversation.input.overlay', () => treeSlots.register({
        name: 'conversation.input.overlay', id: 'sessivra-reference-drop',
        inject: (sessionId: Parameters<ISessions['binding']>[0]) => {
          const binding = sessions.binding(sessionId);
          if (!binding) throw new Error('会话输入框尚未就绪');
          return { referenceDrop, sessionInput: treeCtx.conversation.input.for(binding.ctx) };
        },
      }, SessionReferenceDropInput));
      treeCtx.effect(() => () => views.dispose(), 'sessivra: session views');
      treeSlots.inject('shell.overlay', () => treeSlots.register({
        name: 'shell.overlay', id: 'sessivra-session-views',
        children: { 'sessivra.conversation.pane': { kind: 'single', scope: 'session' }, 'sessivra.conversation.header': { kind: 'single', scope: 'session' } },
        inject: () => ({ views, store, referenceDrop, headerViews, Menu, selectSession: (target: Parameters<typeof treeCtx.uiWorkspace.openSession>[0]) => treeCtx.uiWorkspace.openSession(target), startSession: () => treeCtx.uiWorkspace.startSession() }),
      }, SessionViews));
      treeSlots.inject('sessivra.conversation.pane', () => treeSlots.register({ name: 'sessivra.conversation.pane' }, SessionViewContent));
      treeSlots.inject('sessivra.conversation.header', () => mirrorNativePaneHeader(treeCtx.slots));
      const openSession = (session: import('./collaboration.js').TreeSession) => {
        if (session.subagent && !session.openable) return;
        treeCtx.uiWorkspace.openSession((session.subagent
          ? { parentSessionId: session.parentId, childSessionId: session.id, mode: session.subagentMode }
          : session.id) as Parameters<typeof treeCtx.uiWorkspace.openSession>[0]);
      };
      treeCtx.effect(() => () => store.dispose(), 'session-messenger: native tree');
      treeCtx.effect(() => () => dialogs.dispose(), 'session-messenger: session dialogs');
      treeSlots.inject('shell.overlay', () => treeSlots.register({
        name: 'shell.overlay', id: 'sessivra-session-dialogs', inject: () => ({ dialogs }),
      }, SessionDialogOutlet));
      treeSlots.inject('shell.overlay', () => treeSlots.register({
        name: 'shell.overlay', id: 'sessivra-team-search', inject: () => ({ store, openSession, hooks: { archiveFilter: createWorkspaceArchiveSource(treeSlots) } }),
      }, NativeTeamSearch));
      treeSlots.inject('conversation.composer', () => treeSlots.register({
        // Chain seats use ascending priority; the native read-only entry is -10.
        name: 'conversation.composer', id: 'sessivra-parent-unavailable', priority: -20,
        select: selectParentUnavailable, inject: () => ({ store, openSession, Button }),
      }, ParentUnavailableComposer));
      treeSlots.inject('sidebar.workspaces.session.row.action', () => treeSlots.register({
        name: 'sidebar.workspaces.session.row.action', id: 'messenger-session-children', order: 300,
        inject: () => ({
          store, openTask:(id:string)=>showTask?.(id),
          controls: { Menu, Modal, Button },
          dialogs,
          sessionActions: {
            rename: async (id, title) => {
              const result = await sessions.using(id as Parameters<ISessions['using']>[0], { source: 'workspaceOperation' }, reference => reference.binding.session.rename(title));
              if (!result.ok) throw new Error(result.error.message);
            },
            pin: (id, pinned) => pinned ? treeCtx.uiWorkspace.pinSession(id as Parameters<typeof treeCtx.uiWorkspace.pinSession>[0]) : treeCtx.uiWorkspace.unpinSession(id as Parameters<typeof treeCtx.uiWorkspace.unpinSession>[0]),
            archive: id => treeCtx.uiWorkspace.archiveSession(id as Parameters<typeof treeCtx.uiWorkspace.archiveSession>[0]),
          } satisfies SessionActions,
          openSession,
        }),
      }, NativeSessionTreeHost));
    });
    remoteCtx.inject(['inputTriggers'], triggerCtx => {
      const inputTriggers = (triggerCtx as unknown as { inputTriggers: { registerSource(source: ReturnType<typeof createLegacyRecipientSource>): () => void } }).inputTriggers;
      // The native reference source provides the only visible session entries,
      // preserving file references, history snapshots, search and multiple chips.
      // This empty source exists solely to migrate pre-upgrade draft chips.
      triggerCtx.effect(() => inputTriggers.registerSource(createLegacyRecipientSource()), 'session-messenger: legacy draft codec');
    });
  });
}
