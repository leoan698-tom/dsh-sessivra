import { createHash } from 'node:crypto';
import { recipientMentions } from './recipient-mention.js';
/** Exact ids from Host-prepared context metadata, never from snapshot prose. */
export function latestSessionReferences(agent) {
    const messages = agent.session.deriveMessages();
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (message.role !== 'user')
            continue;
        // A later legacy destination supersedes earlier native context references.
        if (message.source.kind === 'user' && message.content.some(block => block.type === 'text' && recipientMentions(block.text).length))
            return undefined;
        if (message.source.kind !== 'session-reference')
            continue;
        return { id: message.id, references: message.source.references.map(ref => ({ target: ref.sessionId, label: ref.label.slice(0, 160) || ref.sessionId })) };
    }
    return undefined;
}
/** A reference is background context until an explicit message tool is invoked. */
export class ReferenceTargets {
    ctx;
    collaboration;
    messenger;
    constructor(ctx, collaboration, messenger) {
        this.ctx = ctx;
        this.collaboration = collaboration;
        this.messenger = messenger;
    }
    async resolve(agent, target) {
        const cited = latestSessionReferences(agent);
        if (!cited)
            return undefined;
        if (target && !cited.references.some(ref => ref.target === target))
            throw new Error('TARGET_NOT_REFERENCED');
        const tree = await this.collaboration.tree();
        const root = this.ctx.agents.roots().includes(agent) && agent.session.header.origin !== 'subagent';
        const candidates = cited.references.map(ref => {
            const row = tree.find(session => session.id === ref.target);
            const canMessage = root && Boolean(row && (!row.subagent || row.parentId === agent.id && row.canMessage));
            return { ...ref, canReference: true, canMessage,
                ...(!canMessage ? { reason: !root ? 'CHILD_CANNOT_INITIATE_MESSAGE' : !row ? 'ARCHIVED_OR_UNAVAILABLE' : row.subagent && row.subagentMode === 'one-shot' ? 'ONE_SHOT_READ_ONLY' : 'NOT_OWNED_CONTINUABLE_CHILD' } : {}) };
        });
        if (!target && candidates.length !== 1)
            return { source: 'session-reference', requiresTarget: true, candidates };
        const chosen = candidates.find(ref => ref.target === (target ?? candidates[0]?.target));
        if (!chosen)
            throw new Error('TARGET_NOT_REFERENCED');
        const revision = `reference:${createHash('sha256').update(JSON.stringify([agent.id, cited.id, chosen.target])).digest('hex')}`;
        const previous = this.messenger.selectedFor(agent.id);
        const sameSelection = previous?.revision === revision;
        return { source: 'session-reference', requiresTarget: false, ...chosen,
            selectionRevision: revision, permission: sameSelection ? previous.permission : 'not-requested',
            targetStatus: this.ctx.agents.get(chosen.target)?.status ?? 'cold',
            ...(sameSelection ? { lastReceipt: previous.lastReceipt, lastReply: previous.lastReply, ...(previous.child ? { child: previous.child } : {}) } : {}) };
    }
    async send(agent, args, signal) {
        // Core owns exact idempotency, including uncertain deliveries and conflicts.
        if (args.id && this.messenger.snapshot(false).messages[args.id])
            return this.messenger.send(agent, args, signal);
        const resolved = await this.resolve(agent, args.target);
        if (!resolved) {
            if (args.selectionRevision?.startsWith('reference:'))
                throw new Error('STALE_REFERENCE_SELECTION');
            return this.messenger.send(agent, args, signal);
        }
        if (resolved.requiresTarget)
            throw new Error('REFERENCE_TARGET_REQUIRED');
        if (!resolved.canMessage)
            throw new Error(`REFERENCE_ONLY_TARGET:${resolved.reason}`);
        if (args.selectionRevision !== resolved.selectionRevision)
            throw new Error('REFERENCE_SELECTION_REVISION_REQUIRED');
        signal.throwIfAborted();
        const selected = await this.messenger.selectRecipient(agent, resolved.target, resolved.label, resolved.selectionRevision);
        return this.messenger.send(agent, { ...args, target: selected.targetId, selectionRevision: selected.revision }, signal);
    }
    /** Explicit task admission uses the same exact reference and consent boundary as send. */
    async prepareTask(agent, target, selectionRevision, signal) {
        const resolved = await this.resolve(agent, target);
        if (resolved) {
            if (resolved.requiresTarget)
                throw new Error('REFERENCE_TARGET_REQUIRED');
            if (!resolved.canMessage)
                throw new Error(`REFERENCE_ONLY_TARGET:${resolved.reason}`);
            if (selectionRevision !== resolved.selectionRevision)
                throw new Error('REFERENCE_SELECTION_REVISION_REQUIRED');
            signal.throwIfAborted();
            return this.messenger.selectRecipient(agent, resolved.target, resolved.label, resolved.selectionRevision);
        }
        const selected = this.messenger.selectedFor(agent.id);
        if (!selected || (target && selected.targetId !== target) || selected.revision !== selectionRevision)
            throw new Error('TASK_TARGET_SELECTION_REQUIRED');
        return selected;
    }
}
