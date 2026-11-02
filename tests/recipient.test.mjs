import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createLegacyRecipientSource } from '../dist/recipient-source.js';
import { recipientMentions } from '../dist/recipient-mention.js';
import { Messenger, emptyState, defaults } from '../dist/core.js';
import { stateSchema } from '../dist/schemas.js';

const encode = id => Buffer.from(JSON.stringify(id)).toString('base64url');
const token = (label,id) => `@[${label}](dsh-message-target:${encode(id)})`;
const policyKey = id => createHash('sha256').update(id).digest('hex');

test('legacy draft chips become native context references without extra candidates or selection side effects', async () => {
  const source=createLegacyRecipientSource();
  assert.equal(source.trigger,'@');
  assert.equal(source.name,'messenger-target');
  assert.deepEqual(await source.candidates(),[]);
  const legacy=token('同名任务','会话:B');
  const canonical=`@[同名任务](dsh-session:${encode('会话:B')})`;
  assert.equal(await source.codec.serialize(legacy),canonical);
  assert.equal(source.codec.clipboardText(legacy),canonical);
  assert.equal(await source.codec.serialize(canonical),canonical);
  assert.equal(source.onPick,undefined,'choosing context never grants a messaging pair');
  assert.deepEqual(recipientMentions(`请分析后发送给 ${legacy}`),[{targetId:'会话:B',label:'同名任务'}]);
  assert.deepEqual(recipientMentions(`只读 @[同名任务](dsh-session:${encode('会话:B')})`),[]);
  assert.throws(()=>recipientMentions('@[坏](dsh-message-target:!!!)'),/INVALID_RECIPIENT_MENTION/);
});

function fixture(status='idle') {
  let state=emptyState();
  let clock=10000;
  const delivered=[];
  const a={id:'A',status:'idle',session:{header:{cwd:'D:/Project/one'}},followup:m=>delivered.push(['A-followup',m]),steer:m=>delivered.push(['A-steer',m])};
  const b={id:'B',status,session:{header:{cwd:'D:/Project/two'}},followup:m=>delivered.push(['B-followup',m]),steer:m=>delivered.push(['B-steer',m])};
  const roots=[a,b],resumes=[],inspections=[];
  const runtime={roots:()=>roots,get:id=>roots.find(r=>r.id===id),inspect:async id=>{inspections.push(id);const found=[a,b].find(r=>r.id===id);return found&&{id:found.id,cwd:found.session.header.cwd,origin:found.session.header.origin,delegationDepth:found.session.header.delegationDepth};},resolve:async id=>{resumes.push(id);const found=[a,b].find(r=>r.id===id);if(found){roots.push(found);return found;}}};
  const store={read:()=>state,write:async next=>{state=structuredClone(next);}};
  const messenger=new Messenger(runtime,store,defaults,()=>clock);
  return {messenger,a,b,roots,resumes,inspections,runtime,delivered,store,advance:ms=>{clock+=ms;}};
}

test('selection is durable and A tool delivery uses the exact revision and B policy', async () => {
  const f=fixture();
  assert.equal(stateSchema.parse({policies:{},messages:{},budgets:{}}).selectedRecipients,undefined);
  assert.throws(()=>stateSchema.parse({policies:{},messages:{},budgets:{},selectedRecipients:{}}));
  const selected=await f.messenger.selectRecipient(f.a,'B','Other project B');
  assert.equal(f.delivered.length,0);
  assert.equal(f.messenger.selectedFor('A').targetId,'B');
  assert.equal(f.store.read().selectedRecipients[policyKey('A')].revision,selected.revision);
  await f.messenger.setPolicy('A',{mode:'refuse',senders:[],crossWorkspace:true,alias:''});
  await f.messenger.setPolicy('B',{mode:'accept',senders:['A'],crossWorkspace:true,alias:''});
  const receipt=await f.messenger.send(f.a,{id:'selected-one',text:'Synthetic analyzed conclusion',selectionRevision:selected.revision});
  assert.equal(receipt.status,'delivered');
  assert.equal(receipt.sender,'A');
  assert.equal(f.delivered[0][0],'B-followup');
  assert.equal(f.store.read().messages['selected-one'].origin,'agent');
  assert.equal(f.messenger.selectedFor('A').lastReceipt.status,'delivered');
  await assert.rejects(f.messenger.send(f.a,{target:'other',text:'wrong'}),/SELECTED_TARGET_MISMATCH/);
  await f.messenger.selectRecipient(f.a,'B','Renamed B');
  await assert.rejects(f.messenger.send(f.a,{text:'stale',selectionRevision:selected.revision}),/STALE_SELECTED_TARGET/);
  assert.deepEqual(await f.messenger.clearSelected('A'),{cleared:true});
  await assert.rejects(f.messenger.send(f.a,{text:'none'}),/SELECTION_REVISION_REQUIRED/);
});

test('cold persisted B is resolved only at the real send and explicit insert steers busy B', async () => {
  const f=fixture('running');
  const pick=await f.messenger.selectRecipient(f.a,'B','B');
  const selected=pick;
  await f.messenger.setPolicy('A',{mode:'refuse',senders:[],crossWorkspace:true,alias:''});
  await f.messenger.setPolicy('B',{mode:'accept',senders:['A'],crossWorkspace:true,alias:''});
  f.roots.pop();
  assert.equal(f.resumes.length,0);
  const result=await f.messenger.send(f.a,{target:'B',selectionRevision:selected.revision,id:'cold-one',deliveryMode:'insert',text:'Synthetic direction change'});
  assert.equal(result.status,'delivered');
  assert.deepEqual(f.resumes,['B']);
  assert.equal(f.delivered[0][0],'B-steer');
  assert.equal((await f.messenger.send(f.a,{target:'B',selectionRevision:selected.revision,id:'cold-one',deliveryMode:'insert',text:'Synthetic direction change'})).status,'delivered');
  assert.deepEqual(f.resumes,['B']);
  assert.equal(f.delivered.length,1);
});

test('cold explicit refusal and cross-workspace denial never resume B', async () => {
  const f=fixture();
  await f.messenger.setPolicy('B',{mode:'refuse',senders:[],crossWorkspace:false,alias:''});
  const selected=await f.messenger.selectRecipient(f.a,'B','B');
  f.roots.pop();
  const refused=await f.messenger.send(f.a,{id:'cold-refused',text:'Synthetic refusal',selectionRevision:selected.revision});
  assert.deepEqual([refused.status,refused.reason],['failed','REFUSED']);
  assert.deepEqual(f.resumes,[]);
  assert.deepEqual(f.inspections,['B','B']);
  f.roots.push(f.b);
  await f.messenger.setPolicy('B',{mode:'accept',senders:['A'],crossWorkspace:true,alias:''});
  f.roots.pop();
  const denied=await f.messenger.send(f.a,{id:'cold-cross-denied',text:'Synthetic denied',selectionRevision:selected.revision});
  assert.deepEqual([denied.status,denied.reason],['failed','CROSS_WORKSPACE_DENIED']);
  assert.deepEqual(f.resumes,[]);
  assert.equal(f.delivered.length,0);
});

test('revoked pair grant, invalid reply, expired parent and changed selection fail before cold resume', async () => {
  const f=fixture();
  const selected=await f.messenger.selectRecipient(f.a,'B','B');
  await f.messenger.authorizeSelected('A',selected.revision);
  f.roots.pop();
  await f.messenger.revokeSelected('A',selected.revision);
  assert.equal((await f.messenger.send(f.a,{id:'cold-revoked',text:'Synthetic revoked',selectionRevision:selected.revision})).reason,'REFUSED');
  assert.deepEqual(f.resumes,[]);
  f.b.session.header.cwd='D:/Project/changed';
  await assert.rejects(f.messenger.send(f.a,{id:'cold-cwd',text:'Synthetic drift',selectionRevision:selected.revision}),/SELECTED_WORKSPACE_CHANGED/);
  assert.deepEqual(f.resumes,[]);
  f.b.session.header.cwd='D:/Project/two';
  await assert.rejects(f.messenger.send(f.a,{id:'cold-bad-reply',target:'B',replyTo:'missing',text:'Synthetic bad reply'}),/INVALID_REPLY/);
  assert.deepEqual(f.resumes,[]);
  f.roots.push(f.b);
  await f.messenger.authorizeSelected('A',selected.revision);
  const parent=await f.messenger.send(f.a,{id:'parent-for-expiry',text:'Synthetic parent',selectionRevision:selected.revision});
  assert.equal(parent.status,'delivered');
  f.roots.splice(f.roots.indexOf(f.a),1);
  f.store.read().messages[parent.id].expires=10000;
  await assert.rejects(f.messenger.send(f.b,{id:'cold-expired-reply',target:'A',replyTo:parent.id,text:'Synthetic too late'}),/INVALID_REPLY/);
  assert.deepEqual(f.resumes,[]);
});

test('cold hold remains queued without activation and releases after B becomes active', async () => {
  const f=fixture();
  const selected=await f.messenger.selectRecipient(f.a,'B','B');
  await f.messenger.setPolicy('A',{mode:'refuse',senders:[],crossWorkspace:true,alias:''});
  await f.messenger.setPolicy('B',{mode:'hold',senders:['A'],crossWorkspace:true,alias:''});
  f.roots.pop();
  const held=await f.messenger.send(f.a,{id:'cold-held',text:'Synthetic held work',selectionRevision:selected.revision});
  assert.equal(held.status,'queued');
  assert.deepEqual(f.resumes,[]);
  assert.equal(f.delivered.length,0);
  f.roots.push(f.b);
  await f.messenger.setPolicy('B',{mode:'accept',senders:['A'],crossWorkspace:true,alias:''});
  assert.equal((await f.messenger.release(held.id)).status,'delivered');
  assert.equal(f.delivered.length,1);
  assert.deepEqual(f.resumes,[]);
});

test('a resumed target must retain exact registered root identity and inspected cwd', async () => {
  for(const drift of ['cwd','object','id']){
    const f=fixture();
    const selected=await f.messenger.selectRecipient(f.a,'B','B');
    await f.messenger.authorizeSelected('A',selected.revision);
    f.roots.pop();
    const original=f.runtime.resolve;
    f.runtime.resolve=async id=>{
      const target=await original(id);
      if(drift==='cwd') target.session.header.cwd='D:/Project/other';
      if(drift==='object') return {...target};
      if(drift==='id') return {...target,id:'different'};
      return target;
    };
    await assert.rejects(f.messenger.send(f.a,{id:`cold-drift-${drift}`,text:'Synthetic drift',selectionRevision:selected.revision}),/TARGET_CHANGED_AFTER_RESOLVE/);
    assert.deepEqual(f.resumes,['B']);
    assert.equal(f.delivered.length,0);
    assert.equal(f.store.read().messages[`cold-drift-${drift}`],undefined);
  }
});

test('post-resume admission and TTL are rechecked before dispatch', async () => {
  const revoked=fixture();
  const selection=await revoked.messenger.selectRecipient(revoked.a,'B','B');
  await revoked.messenger.authorizeSelected('A',selection.revision);
  revoked.roots.pop();
  const originalResolve=revoked.runtime.resolve;
  revoked.runtime.resolve=async id=>{
    const target=await originalResolve(id);
    revoked.store.read().pairGrants={};
    return target;
  };
  const denied=await revoked.messenger.send(revoked.a,{id:'cold-revoked-during-resume',text:'Synthetic revoked',selectionRevision:selection.revision});
  assert.deepEqual([denied.status,denied.reason],['failed','REFUSED']);
  assert.deepEqual(revoked.resumes,['B']);
  assert.equal(revoked.delivered.length,0);

  const expired=fixture();
  const expSelection=await expired.messenger.selectRecipient(expired.a,'B','B');
  await expired.messenger.authorizeSelected('A',expSelection.revision);
  expired.roots.pop();
  const expResolve=expired.runtime.resolve;
  expired.runtime.resolve=async id=>{
    const target=await expResolve(id);
    expired.advance(200);
    return target;
  };
  const result=await expired.messenger.send(expired.a,{id:'cold-expired-during-resume',text:'Synthetic expired',selectionRevision:expSelection.revision,ttl:100});
  assert.deepEqual([result.status,result.reason],['expired','TTL_EXPIRED']);
  assert.deepEqual(expired.resumes,['B']);
  assert.equal(expired.delivered.length,0);
});

test('one compact A→B consent grants only the exact pair and revokes before another send', async () => {
  const f=fixture();
  const selected=await f.messenger.selectRecipient(f.a,'B','Other project B');
  assert.equal(f.messenger.selectedFor('A').permission,'granted');
  assert.deepEqual(f.messenger.directory(f.a).map(r=>r.id),['B']);
  await assert.rejects(f.messenger.authorizeSelected('A','stale'),/STALE_SELECTED_TARGET/);
  assert.deepEqual(await f.messenger.authorizeSelected('A',selected.revision),{permission:'granted'});
  assert.equal(f.messenger.selectedFor('A').permission,'granted');
  assert.equal(Object.keys(f.store.read().pairGrants).length,1);
  assert.deepEqual(f.store.read().policies,{});
  assert.deepEqual(f.messenger.directory(f.a).map(r=>r.id),['B']);
  assert.equal(f.messenger.directory(f.a)[0].permission,'pairGrant');
  assert.equal(f.messenger.directory(f.a)[0].mode,'accept');
  assert.equal((await f.messenger.sendOperator('A',{id:'pair-operator-denied',target:'B',text:'Operator is separate'})).reason,'REFUSED');
  assert.equal((await f.messenger.send(f.b,{id:'pair-reverse-denied',target:'A',text:'B cannot start a new chain'})).reason,'REFUSED');
  const first=await f.messenger.send(f.a,{id:'pair-first',text:'Synthetic task for B',selectionRevision:selected.revision});
  assert.equal(first.status,'delivered');
  assert.equal(f.delivered[0][0],'B-followup');
  const reply=await f.messenger.send(f.b,{id:'pair-reply',target:'A',replyTo:first.id,text:'Synthetic answer from B'});
  assert.equal(reply.status,'delivered');
  assert.equal(f.delivered[1][0],'A-followup');
  assert.equal(f.messenger.selectedFor('A').lastReply.id,'pair-reply');
  assert.deepEqual(await f.messenger.revokeSelected('A',selected.revision),{revoked:true});
  assert.equal(f.messenger.selectedFor('A').permission,'needsConsent');
  const denied=await f.messenger.send(f.a,{id:'pair-denied',text:'Do not deliver',selectionRevision:selected.revision});
  assert.deepEqual([denied.status,denied.reason],['failed','REFUSED']);
  assert.equal(f.delivered.length,2);
  assert.equal((await f.messenger.send(f.a,{id:'pair-first',text:'Synthetic task for B',selectionRevision:selected.revision})).status,'delivered');
  assert.equal(f.delivered.length,2);
});

test('explicit B policy edit invalidates pair consent and workspace changes cannot reuse it', async () => {
  const f=fixture();
  const selected=await f.messenger.selectRecipient(f.a,'B','B');
  await f.messenger.authorizeSelected('A',selected.revision);
  await f.messenger.setPolicy('B',{mode:'refuse',senders:[],crossWorkspace:false,alias:'Renamed B'});
  assert.equal(f.messenger.selectedFor('A').permission,'blocked');
  assert.equal(Object.keys(f.store.read().pairGrants).length,0);
  await assert.rejects(f.messenger.authorizeSelected('A',selected.revision),/TARGET_POLICY_LOCKED/);
  await f.messenger.setPolicy('B',{mode:'accept',senders:[],crossWorkspace:false,alias:'Renamed B'});
  await f.messenger.authorizeSelected('A',selected.revision);
  await f.messenger.setPolicy('A',{mode:'hold',senders:[],crossWorkspace:false,alias:''});
  assert.equal(f.messenger.selectedFor('A').permission,'blocked');
  await assert.rejects(f.messenger.authorizeSelected('A',selected.revision),/SOURCE_REPLY_POLICY_LOCKED/);
  await f.messenger.setPolicy('A',{mode:'accept',senders:[],crossWorkspace:false,alias:''});
  await f.messenger.authorizeSelected('A',selected.revision);
  f.b.session.header.cwd='D:/Project/changed';
  await assert.rejects(f.messenger.authorizeSelected('A',selected.revision),/SELECTED_WORKSPACE_CHANGED/);
  await assert.rejects(f.messenger.send(f.a,{id:'changed',text:'No delivery',selectionRevision:selected.revision}),/SELECTED_WORKSPACE_CHANGED/);
  f.b.session.header.cwd='D:/Project/two';
  assert.deepEqual(await f.messenger.clearSelected('A'),{cleared:true});
  assert.equal(Object.keys(f.store.read().pairGrants).length,1);
});
