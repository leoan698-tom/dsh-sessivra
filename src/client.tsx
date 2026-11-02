import React from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import { remoteContribution } from './contract.js';
import { createLegacyRecipientSource } from './recipient-source.js';
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client';
import { createSessionTreeStore, NativeSessionChildren, type TreeApi } from './session-tree.js';

interface Api {
  selectRecipient(sourceId: string, targetId: string, label: string): Promise<RemoteResult<unknown>>;
}

declare module '@deepseek-ai/dsh-typert-protocol' { interface TypertRemoteNamespaceMap { sessionMessenger: Api; sessionCollaboration: TreeApi } }
export const inject = ['slots', 'remote'];
export async function apply(ctx: Context) {
  await ctx.remote.$mount(remoteContribution);
  await ctx.inject(['remote.sessionMessenger'], remoteCtx => {
    remoteCtx.inject(['uiWorkspace', 'remote.sessionCollaboration'], treeCtx => {
      // Extend native session rows; never occupy sidebar.workspaces, whose owner
      // also supplies the native header, search, view options and directory flow.
      const treeSlots = treeCtx.slots as unknown as { inject(name: string, register: () => unknown): void; register(entry: object, component: React.ComponentType<never>): () => void };
      const store = createSessionTreeStore(treeCtx.remote.sessionCollaboration);
      treeCtx.effect(() => () => store.dispose(), 'session-messenger: native tree');
      treeSlots.inject('sidebar.workspaces.session.row.action', () => treeSlots.register({
        name: 'sidebar.workspaces.session.row.action', id: 'messenger-session-children', order: 300,
        inject: () => ({
          store,
          openSession: (session: import('./collaboration.js').TreeSession) => {
            if (session.subagent && !session.openable) return;
            treeCtx.uiWorkspace.openSession((session.subagent
              ? { parentSessionId: session.parentId, childSessionId: session.id, mode: session.subagentMode }
              : session.id) as Parameters<typeof treeCtx.uiWorkspace.openSession>[0]);
          },
        }),
      }, NativeSessionChildren));
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
