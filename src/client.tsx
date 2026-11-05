import React from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import { remoteContribution } from './contract.js';
import { createLegacyRecipientSource } from './recipient-source.js';
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client';
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client';
import { Button, Menu, Modal } from '@deepseek-ai/dsh-client-ui-primitives';
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

declare module '@deepseek-ai/dsh-typert-protocol' { interface TypertRemoteNamespaceMap { sessionMessenger: Api; sessionCollaboration: TreeApi } }
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
          store,
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
