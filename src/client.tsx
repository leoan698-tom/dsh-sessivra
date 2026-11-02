import React from 'react';
import { MenuItemButton } from '@deepseek-ai/dsh-client-ui-primitives';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import { remoteContribution } from './contract.js';
import { createLegacyRecipientSource } from './recipient-source.js';
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client';
import { SessionTree, type TreeApi } from './session-tree.js';

interface Api {
  selectRecipient(sourceId: string, targetId: string, label: string): Promise<RemoteResult<unknown>>;
}

declare module '@deepseek-ai/dsh-typert-protocol' { interface TypertRemoteNamespaceMap { sessionMessenger: Api; sessionCollaboration: TreeApi } }
export const inject = ['slots', 'remote'];
export async function apply(ctx: Context) {
  await ctx.remote.$mount(remoteContribution);
  await ctx.inject(['remote.sessionMessenger'], remoteCtx => {
    remoteCtx.inject(['uiWorkspace', 'remote.sessionCollaboration'], treeCtx => {
      // A documented single-slot priority shadows the standard list; disposing
      // only this entry restores workspace management without unloading messaging.
      const treeSlots = treeCtx.slots as unknown as { inject(name: string, register: () => unknown): void; register(entry: object, component: React.ComponentType<never>): () => void };
      let disposeTree: (() => void) | undefined;
      const showTree = () => {
        if (disposeTree) return;
        disposeTree = treeSlots.register({ name: 'sidebar.workspaces', priority: -20, inject: () => ({
          api: treeCtx.remote.sessionCollaboration,
          startSession: () => treeCtx.uiWorkspace.startSession(),
          standardList: () => { disposeTree?.(); disposeTree = undefined; },
          openSession: (session: import('./collaboration.js').TreeSession) => {
            if (session.subagent && !session.openable) return;
            treeCtx.uiWorkspace.openSession((session.subagent
              ? { parentSessionId: session.parentId, childSessionId: session.id, mode: session.subagentMode }
              : session.id) as Parameters<typeof treeCtx.uiWorkspace.openSession>[0]);
          },
        }) }, SessionTree);
      };
      treeSlots.inject('sidebar.workspaces', () => { showTree(); return () => { disposeTree?.(); disposeTree = undefined; }; });
      treeSlots.inject('sidebar.panellist.actions', () => treeSlots.register({ name: 'sidebar.panellist.actions', id: 'messenger-session-tree', order: 20, inject: () => ({ showTree }) }, TreeToggle));
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

function TreeToggle({ showTree, onDismiss }: { showTree: () => void; onDismiss?: () => void }) {
  return <MenuItemButton icon={<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><path d="M3 2v10h3M3 6h3M6 4h7v4H6zM6 10h7v4H6z" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" /></svg>} onSelect={() => { showTree(); onDismiss?.(); }}>会话树</MenuItemButton>;
}
