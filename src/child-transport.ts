import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-subagent';
import type {} from '@deepseek-ai/dsh-session-query';
import type {} from '@deepseek-ai/dsh-workspace';
import { queueHostSubagentPrompt, steerHostSubagentPrompt } from '@deepseek-ai/dsh-subagent/internal';
import type { ChildRecipient, ChildTransport, Root } from './core.js';
import { workspace } from './core.js';
import type { TreeSessionProjections } from './collaboration.js';

/** rc.5's own Team mailbox uses these exported host adapters. They retain
 * plugin attribution and queue/steer semantics under native child ownership. */
export function childTransport(ctx: Context): ChildTransport {
  const liveParent = (parent: Root) => ctx.agents.get(parent.id as Agent['id']) === parent &&
    ctx.agents.roots().includes(parent as Agent) && parent.session.header.origin !== 'subagent';
  const inspect: ChildTransport['inspect'] = async (parent, childId, signal) => {
    if (!liveParent(parent)) throw new Error('CHILD_PARENT_NOT_LIVE');
    const query = ctx.get('sessionQuery');
    if (!ctx.get('subagents') || !query) return undefined;
    const archived = ctx.get('workspaceRegistry')?.archivedSessionIds ?? [];
    if (archived.includes(parent.id as Agent['id']) || archived.includes(childId as Agent['id'])) return undefined;
    const observation = await query.observeSession(childId as Agent['id'], { signal });
    try {
      const { header } = observation;
      const values = observation.projections?.values as TreeSessionProjections | undefined;
      if (header.id !== childId || header.origin !== 'subagent' || header.parentSession !== parent.id || values?.subagent?.mode !== 'continuable') return undefined;
      const parentObservation = await query.observeSession(parent.id as Agent['id'], { signal });
      try {
        const team = (parentObservation.projections?.values as TreeSessionProjections | undefined)?.agentTeam;
        if (team?.failure) return undefined;
        const member = team?.members.find(member => member.id === childId);
        if (member && (member.role !== 'teammate' || member.phase !== 'active')) return undefined;
        if (!liveParent(parent)) throw new Error('CHILD_PARENT_NOT_LIVE');
        signal?.throwIfAborted();
        return { id: childId, cwd: header.cwd, origin: header.origin, delegationDepth: header.delegationDepth,
          parentSession: header.parentSession, child: { parentId: parent.id, childId, kind: member ? 'teammate' : 'standalone' } };
      } finally { parentObservation[Symbol.dispose](); }
    } finally { observation[Symbol.dispose](); }
  };
  return {
    inspect,
    async send(parent, recipient, input, deliveryMode, signal, beforeDispatch) {
      const current: ChildRecipient | undefined = await inspect(parent, recipient.id, signal);
      if (!current || current.child.kind !== recipient.child.kind || workspace(current.cwd) !== workspace(recipient.cwd)) throw new Error('CHILD_ADDRESS_CHANGED');
      const deliver = deliveryMode === 'queue' ? queueHostSubagentPrompt : steerHostSubagentPrompt;
      const runtime = ctx.get('subagents');
      if (!runtime) throw new Error('CHILD_TRANSPORT_UNAVAILABLE');
      beforeDispatch?.();
      return deliver(runtime, parent as Agent, recipient.id as Agent['id'], [...input.content], input.source, signal);
    },
    async reply(child, parentId, input, signal) {
      if (ctx.agents.get(child.id as Agent['id']) !== child || child.session.header.origin !== 'subagent' || child.session.header.parentSession !== parentId) throw new Error('CHILD_SENDER_NOT_LIVE');
      // Native sendMessage verifies the exact resident child activation and its
      // live parent; a forged/stale header alone is never enough to reply.
      const runtime = ctx.get('subagents');
      if (!runtime) throw new Error('CHILD_TRANSPORT_UNAVAILABLE');
      return runtime.sendMessage(child as Agent, parentId as Agent['id'], [...input.content], { signal });
    },
  };
}
