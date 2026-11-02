import type { Context } from '@deepseek-ai/cordis';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { Messenger, DeliveryMode } from './core.js';
import { policyInput } from './schemas.js';

/** Only authenticated Host operator UI; no corresponding model tool. */
export class MessengerSettings extends TypertRemoteService {
  constructor(ctx: Context, readonly messenger: Messenger) { super(ctx, 'sessionMessenger'); }
  @Remote async view() { await this.messenger.sweep(); return { directory: this.messenger.directory().map(r => ({ ...r, policy: this.messenger.inspectPolicy(r.id) })), state: this.messenger.snapshot(false), limits: this.messenger.limits }; }
  @Remote selectedFor(sourceId: string) { return this.messenger.selectedFor(sourceId); }
  @Remote selectRecipient(sourceId: string, targetId: string, label: string) { return this.messenger.selectRecipientById(sourceId, targetId, label); }
  @Remote authorizeSelected(sourceId: string, revision: string) { return this.messenger.authorizeSelected(sourceId, revision); }
  @Remote revokeSelected(sourceId: string, revision: string) { return this.messenger.revokeSelected(sourceId, revision); }
  @Remote clearSelected(sourceId: string) { return this.messenger.clearSelected(sourceId); }
  @Remote setDeliveryMode(sourceId: string, revision: string, mode: DeliveryMode) { return this.messenger.setDeliveryMode(sourceId, revision, mode); }
  @Remote sendOperator(sourceId: string, input: { target: string; text: string; id?: string; ttl?: number }) { return this.messenger.sendOperator(sourceId, input); }
  @Remote async conversation(sourceId: string, targetId: string) {
    await this.messenger.sweep();
    const messages = this.messenger.snapshot(true).messages;
    return Object.values(messages).filter(m => (m.origin === 'operator' && m.sourceRoot === sourceId && m.target === targetId) || (m.status === 'received' && m.sourceRoot === sourceId && m.sender === targetId && m.replyTo && messages[m.replyTo]?.origin === 'operator' && messages[m.replyTo]?.sourceRoot === sourceId && messages[m.replyTo]?.target === targetId)).sort((a,b) => a.created - b.created);
  }
  @Remote policy(id: string, input: unknown) { return this.messenger.setPolicy(id, policyInput.parse(input)); }
  @Remote release(id: string) { return this.messenger.release(id); }
  @Remote backup(includeText: boolean) { if (typeof includeText !== 'boolean') throw new Error('INVALID_REQUEST'); return this.messenger.snapshot(includeText); }
  @Remote clear(confirmation: string) { if (confirmation !== 'DELETE MESSENGER DATA') throw new Error('CONFIRMATION_REQUIRED'); return this.messenger.clear(); }
}
