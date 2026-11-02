import test from 'node:test';
import assert from 'node:assert/strict';
import { Messenger,emptyState,defaults,workspace,operatorAddress } from '../dist/core.js';
import {stateSchema,domainSpec} from '../dist/schemas.js';
import {createHash} from 'node:crypto';
function fixture(limits={}) {
  let state=emptyState(),now=10000;
  const received=[];
  const a={id:'alpha',status:'idle',session:{header:{cwd:'/synthetic/shared'}},followup:m=>received.push(m),steer:m=>received.push(m)};
  const b={...a,id:'beta'};
  const roots=[a,b];
  const store={read:()=>state,write:async s=>{state=structuredClone(s);}};
  const m=new Messenger({roots:()=>roots,get:id=>roots.find(r=>r.id===id)},store,{...defaults,...limits},()=>now);
  return {m,a,b,roots,received,store,advance:n=>now+=n,policy:mode=>m.setPolicy('beta',{mode,senders:['alpha'],crossWorkspace:false,alias:'Synthetic B'})};
}
test('default refuse; hold no wake; accept release; duplicate ID once',async()=>{
  const f=fixture();assert.equal((await f.m.send(f.a,{id:'refused',target:'beta',text:'synthetic'})).status,'failed');assert.equal(f.received.length,0);
  await f.policy('hold');assert.equal((await f.m.send(f.a,{id:'one',target:'beta',text:'synthetic'})).status,'queued');assert.equal(f.received.length,0);
  await f.policy('accept');assert.equal((await f.m.release('one')).status,'delivered');assert.equal(f.received.length,1);
  await f.m.send(f.a,{id:'one',target:'beta',text:'synthetic'});assert.equal(f.received.length,1);
  await assert.rejects(f.m.send(f.a,{id:'one',target:'beta',text:'changed'}),/ID_CONFLICT/);
});
test('sender identity, closed target and cross-workspace authorization',async()=>{
  const f=fixture();await f.policy('accept');await assert.rejects(f.m.send({...f.a},{target:'beta',text:'synthetic'}),/CALLER_NOT_ACTIVE_ROOT/);
  f.b.session={header:{cwd:'/synthetic/other'}};await f.policy('accept');assert.equal((await f.m.send(f.a,{id:'cross',target:'beta',text:'synthetic'})).reason,'CROSS_WORKSPACE_DENIED');
  f.roots.pop();await assert.rejects(f.m.send(f.a,{target:'beta',text:'synthetic'}),/TARGET_CLOSED/);
});
test('TTL, queue, rate and length budgets',async()=>{
  const f=fixture({maxQueue:1,ratePerMinute:2,maxLength:10});await f.policy('hold');await f.m.send(f.a,{id:'ttl',target:'beta',text:'synthetic',ttl:1});
  await assert.rejects(f.m.send(f.a,{target:'beta',text:'synthetic'}),/QUEUE_LIMIT/);f.advance(2);await f.policy('accept');assert.equal((await f.m.release('ttl')).status,'expired');
  await assert.rejects(f.m.send(f.a,{target:'beta',text:'way too much synthetic text'}),/INVALID_MESSAGE/);
  await f.m.send(f.a,{id:'second',target:'beta',text:'synthetic'});await assert.rejects(f.m.send(f.a,{target:'beta',text:'synthetic'}),/RATE_LIMIT/);
});
test('reply causality, one reply and hop bound',async()=>{
  const f=fixture({maxHops:1});await f.policy('accept');await f.m.setPolicy('alpha',{mode:'accept',senders:['beta'],crossWorkspace:false,alias:''});
  await f.m.send(f.a,{id:'start',target:'beta',text:'synthetic'});await f.m.claimed(f.b,f.received[0].id);
  await assert.rejects(f.m.send(f.b,{target:'alpha',text:'synthetic'}),/REPLY_REQUIRED/);
  await f.m.send(f.b,{id:'reply',target:'alpha',text:'synthetic',replyTo:'start'});
  await assert.rejects(f.m.send(f.b,{target:'alpha',text:'synthetic',replyTo:'start'}),/ALREADY_REPLIED/);
  await assert.rejects(f.m.send(f.a,{target:'beta',text:'synthetic',replyTo:'reply'}),/HOP_LIMIT/);
});
test('durable dispatch ambiguity is quarantined, never retried',async()=>{
  const f=fixture();await f.policy('hold');await f.m.send(f.a,{id:'restart',target:'beta',text:'synthetic'});
  const s=structuredClone(f.store.read());s.messages.restart.status='dispatching';await f.store.write(s);await f.m.recover();assert.equal((await f.m.release('restart')).status,'uncertain');assert.equal(f.received.length,0);
});
test('workspace normalization and no unknown-workspace implicit allowance',()=>{
  assert.equal(workspace('C:\\SYNTHETIC\\workspace'),workspace('c:/synthetic/workspace'));assert.equal(workspace(),null);
});
test('wake budget holds new work; closed-during-durability cannot dispatch; prototype IDs denied',async()=>{
  const f=fixture({wakesPerMinute:1});await f.policy('accept');await f.m.send(f.a,{id:'wake1',target:'beta',text:'synthetic'});
  assert.equal((await f.m.send(f.a,{id:'wake2',target:'beta',text:'synthetic'})).reason,'WAKE_BUDGET');assert.equal(f.received.length,1);
  await assert.rejects(f.m.send(f.a,{id:'__proto__',target:'beta',text:'synthetic'}),/INVALID_MESSAGE/);
  const g=fixture();await g.policy('accept');const write=g.store.write;g.store.write=async s=>{await write(s);if(s.messages.race?.status==='dispatching')g.roots.pop();};
  assert.equal((await g.m.send(g.a,{id:'race',target:'beta',text:'synthetic'})).status,'failed');assert.equal(g.received.length,0);
});
test('cross-workspace requires both sender and receiver grants, default fail closed',async()=>{
  const f=fixture();f.b.session={header:{cwd:'/synthetic/other'}};
  await f.m.setPolicy('beta',{mode:'accept',senders:['alpha'],crossWorkspace:true,alias:''});
  assert.equal((await f.m.send(f.a,{id:'receiver-only',target:'beta',text:'synthetic'})).reason,'CROSS_WORKSPACE_DENIED');assert.equal(f.received.length,0);
  await f.m.setPolicy('alpha',{mode:'refuse',senders:[],crossWorkspace:true,alias:''});
  await f.m.setPolicy('beta',{mode:'accept',senders:['alpha'],crossWorkspace:false,alias:''});
  assert.equal((await f.m.send(f.a,{id:'sender-only',target:'beta',text:'synthetic'})).reason,'CROSS_WORKSPACE_DENIED');
  await f.m.setPolicy('beta',{mode:'accept',senders:['alpha'],crossWorkspace:true,alias:''});assert.equal((await f.m.send(f.a,{id:'both',target:'beta',text:'synthetic'})).status,'delivered');
});
test('release preserves every non-queued historical receipt after sessions close',async()=>{
  const f=fixture();await f.policy('accept');await f.m.send(f.a,{id:'history',target:'beta',text:'synthetic'});
  f.roots.pop();
  for(const status of ['delivered','claimed','processed','failed','expired','uncertain']){
    const state=structuredClone(f.store.read());state.messages.history.status=status;state.messages.history.reason='PRESERVE_ORIGINAL';await f.store.write(state);
    const before=structuredClone(f.store.read());assert.equal((await f.m.release('history')).status,status);assert.deepEqual(f.store.read(),before);
  }
});
test('model discovery hides default-refuse, unauthorized and cross-workspace-denied roots',async()=>{
  const f=fixture();assert.deepEqual(f.m.directory(f.a),[]);assert.equal(f.m.directory().length,2);
  await f.policy('hold');assert.equal(f.m.directory(f.a)[0].id,'beta');
  await f.m.setPolicy('beta',{mode:'accept',senders:[],crossWorkspace:false,alias:'private alias'});assert.deepEqual(f.m.directory(f.a),[]);
  f.b.session={header:{cwd:'/synthetic/other'}};await f.m.setPolicy('beta',{mode:'accept',senders:['alpha'],crossWorkspace:true,alias:'private alias'});assert.deepEqual(f.m.directory(f.a),[]);
});
test('operator has a distinct sender, held dispatch, durable reply and idempotency',async()=>{
  const f=fixture();const actor=operatorAddress(f.a.id);
  await f.m.setPolicy('beta',{mode:'hold',senders:[],operatorSources:['alpha'],crossWorkspace:false,alias:''});
  assert.equal((await f.m.sendOperator('alpha',{id:'op-one',target:'beta',text:'Synthetic operator request'})).status,'queued');
  assert.equal(f.store.read().messages['op-one'].sender,actor);
  assert.equal(f.store.read().messages['op-one'].sourceRoot,'alpha');
  assert.equal(f.received.length,0);
  await f.m.setPolicy('beta',{mode:'accept',senders:[],operatorSources:['alpha'],crossWorkspace:false,alias:''});
  assert.equal((await f.m.release('op-one')).status,'delivered');assert.equal(f.received.length,1);
  assert.match(f.received[0].content[0].text,/untrusted operator text/);
  assert.equal((await f.m.sendOperator('alpha',{id:'op-one',target:'beta',text:'Synthetic operator request'})).status,'delivered');assert.equal(f.received.length,1);
  await assert.rejects(f.m.sendOperator('alpha',{id:'op-one',target:'beta',text:'Changed'}),/ID_CONFLICT/);
  await f.m.claimed(f.b,f.received[0].id);
  await assert.rejects(f.m.send(f.b,{target:actor,text:'Unrelated'}),/REPLY_REQUIRED/);
  await f.m.sendOperator('alpha',{id:'op-two',target:'beta',text:'Another synthetic request'});
  await assert.rejects(f.m.send(f.b,{target:actor,text:'Wrong parent',replyTo:'op-two'}),/REPLY_REQUIRED/);
  const reply=await f.m.send(f.b,{id:'op-reply',target:actor,text:'Synthetic answer',replyTo:'op-one'});
  assert.equal(reply.status,'received');assert.equal(f.received.length,2);
  assert.equal(f.store.read().messages['op-reply'].replyTo,'op-one');
  await assert.rejects(f.m.send(f.b,{target:actor,text:'Again',replyTo:'op-one'}),/ALREADY_REPLIED/);
});
test('same-ID replay checks the typed origin and the real model sender',async()=>{
  const f=fixture(),actor=operatorAddress(f.a.id),collision={...f.a,id:actor};f.roots.push(collision);
  await f.m.setPolicy('beta',{mode:'hold',senders:[],operatorSources:['alpha'],crossWorkspace:false,alias:''});
  const operatorArgs={id:'known-op',target:'beta',text:'Synthetic operator request'};
  assert.equal((await f.m.sendOperator('alpha',operatorArgs)).status,'queued');
  const before=structuredClone(f.store.read());
  await assert.rejects(f.m.send(collision,operatorArgs),/ID_CONFLICT/);
  assert.deepEqual(f.store.read(),before);assert.equal(f.received.length,0);
  await f.m.setPolicy('beta',{mode:'accept',senders:[],operatorSources:['alpha'],crossWorkspace:false,alias:''});
  assert.equal((await f.m.release('known-op')).status,'delivered');
  await f.m.claimed(f.b,f.received[0].id);
  const replyArgs={id:'known-reply',target:actor,text:'Synthetic answer',replyTo:'known-op'};
  assert.equal((await f.m.send(f.b,replyArgs)).status,'received');
  assert.equal((await f.m.send(f.b,replyArgs)).status,'received');
  await assert.rejects(f.m.send(f.a,replyArgs),/ID_CONFLICT/);
  await assert.rejects(f.m.send(collision,replyArgs),/ID_CONFLICT/);
  await f.m.setPolicy('beta',{mode:'accept',senders:[actor],operatorSources:[],crossWorkspace:false,alias:''});
  const agentArgs={id:'known-agent',target:'beta',text:'Synthetic model request'};
  assert.equal((await f.m.send(collision,agentArgs)).status,'delivered');
  assert.equal((await f.m.send(collision,agentArgs)).status,'delivered');
  await assert.rejects(f.m.send(f.a,agentArgs),/ID_CONFLICT/);
  assert.equal(f.received.length,2);
});
test('operator cannot impersonate a model sender or bypass workspace permission',async()=>{
  const f=fixture();
  await f.m.setPolicy('beta',{mode:'accept',senders:['alpha'],crossWorkspace:false,alias:''});
  assert.equal((await f.m.sendOperator('alpha',{id:'op-denied',target:'beta',text:'Synthetic'})).reason,'OPERATOR_NOT_ALLOWED');
  f.b.session={header:{cwd:'/synthetic/other'}};
  await f.m.setPolicy('beta',{mode:'accept',senders:[],operatorSources:['alpha'],crossWorkspace:true,alias:''});
  assert.equal((await f.m.sendOperator('alpha',{id:'op-cross',target:'beta',text:'Synthetic'})).reason,'CROSS_WORKSPACE_DENIED');
  await f.m.setPolicy('alpha',{mode:'refuse',senders:[],crossWorkspace:true,alias:''});
  assert.equal((await f.m.sendOperator('alpha',{id:'op-both',target:'beta',text:'Synthetic'})).status,'delivered');
  assert.equal(f.received.length,1);
  f.roots.shift();await assert.rejects(f.m.sendOperator('alpha',{target:'beta',text:'Synthetic'}),/CALLER_NOT_ACTIVE_ROOT|SOURCE_CLOSED/);
});
test('v1 records without origin fields remain readable under the same domain version',()=>{
  const legacy={policies:{},budgets:{},messages:{old:{id:'old',sender:'alpha',target:'beta',text:'Synthetic old text',created:1,expires:2,status:'delivered',hops:0,hostId:'host-old'}}};
  assert.equal(domainSpec.version,1);
  assert.equal(stateSchema.parse(legacy).messages.old.origin,undefined);
});
test('legacy policy, budget and idempotency record keep their original model semantics',async()=>{
  const f=fixture({ratePerMinute:1}),hash=id=>createHash('sha256').update(id).digest('hex');
  const legacy={policies:{[hash('beta')]:{mode:'accept',senders:['alpha'],crossWorkspace:false,workspace:'/synthetic/shared',alias:'Legacy'}},budgets:{[`s_${hash('alpha')}`]:{start:10000,sent:1,wakes:0}},messages:{old:{id:'old',sender:'alpha',target:'beta',text:'Synthetic old',created:10000,expires:20000,status:'delivered',hops:0,hostId:'host-old'}}};
  await f.store.write(stateSchema.parse(legacy));
  assert.equal(f.m.inspectPolicy('beta').alias,'Legacy');
  assert.deepEqual(f.m.inspectPolicy('beta').operatorSources,[]);
  assert.equal((await f.m.send(f.a,{id:'old',target:'beta',text:'Synthetic old'})).status,'delivered');
  assert.equal(f.received.length,0);
  await assert.rejects(f.m.send(f.a,{id:'fresh',target:'beta',text:'Synthetic'}),/RATE_LIMIT/);
  assert.equal(f.store.read().budgets[`s_${hash('alpha')}`].sent,1);
});
test('operator rate is global across source roots and separate from legacy model budget',async()=>{
  const f=fixture({ratePerMinute:2});
  const c={...f.a,id:'gamma'};f.roots.push(c);
  await f.m.setPolicy('beta',{mode:'accept',senders:['alpha'],operatorSources:['alpha','gamma'],crossWorkspace:false,alias:''});
  assert.equal((await f.m.sendOperator('alpha',{id:'global-a',target:'beta',text:'Synthetic'})).status,'delivered');
  assert.equal((await f.m.sendOperator('gamma',{id:'global-g',target:'beta',text:'Synthetic'})).status,'delivered');
  await assert.rejects(f.m.sendOperator('alpha',{id:'global-third',target:'beta',text:'Synthetic'}),/RATE_LIMIT/);
  assert.equal((await f.m.send(f.a,{id:'model-separate',target:'beta',text:'Synthetic'})).status,'delivered');
  assert.equal(f.store.read().budgets.s_operator_global.sent,2);
});
test('operator reply may finish an already delivered request after target refuse, while cross-workspace revocation denies',async()=>{
  const f=fixture();await f.m.setPolicy('beta',{mode:'accept',senders:[],operatorSources:['alpha'],crossWorkspace:false,alias:''});
  await f.m.sendOperator('alpha',{id:'accepted-before-refuse',target:'beta',text:'Synthetic'});
  await f.m.setPolicy('beta',{mode:'refuse',senders:[],operatorSources:[],crossWorkspace:false,alias:''});
  assert.equal((await f.m.send(f.b,{id:'reply-after-refuse',target:operatorAddress('alpha'),text:'Synthetic reply',replyTo:'accepted-before-refuse'})).status,'received');
  f.b.session={header:{cwd:'/synthetic/other'}};
  await f.m.setPolicy('beta',{mode:'accept',senders:[],operatorSources:['alpha'],crossWorkspace:true,alias:''});
  await f.m.setPolicy('alpha',{mode:'refuse',senders:[],crossWorkspace:true,alias:''});
  await f.m.sendOperator('alpha',{id:'cross-parent',target:'beta',text:'Synthetic cross'});
  await f.m.setPolicy('alpha',{mode:'refuse',senders:[],crossWorkspace:false,alias:''});
  await assert.rejects(f.m.send(f.b,{id:'cross-reply-denied',target:operatorAddress('alpha'),text:'Synthetic reply',replyTo:'cross-parent'}),/CROSS_WORKSPACE_DENIED/);
});
test('arbitrary active root IDs stay exact and prototype-shaped IDs never become state keys',async()=>{
  const f=fixture();
  for(const [index,id] of ['a:b','中文 会话',' with spaces ','__proto__','constructor','prototype'].entries()) {
    const root={...f.b,id};f.roots.push(root);
    await f.m.setPolicy(id,{mode:'accept',senders:[],operatorSources:['alpha'],crossWorkspace:false,alias:`Synthetic ${index}`});
    assert.equal((await f.m.sendOperator('alpha',{id:`arbitrary-${index}`,target:id,text:'Synthetic'})).status,'delivered');
    assert.equal(f.m.inspectPolicy(id).alias,`Synthetic ${index}`);
  }
  assert.equal(Object.hasOwn(f.store.read().policies,'__proto__'),false);
  assert.equal(Object.hasOwn(f.store.read().messages,'__proto__'),false);
  await f.m.setPolicy('beta',{mode:'accept',senders:[],operatorSources:['__proto__'],crossWorkspace:false,alias:''});
  assert.equal((await f.m.sendOperator('__proto__',{id:'prototype-source',target:'beta',text:'Synthetic'})).status,'delivered');
  const controlId={...f.a,id:'line\nbreak'};f.roots.push(controlId);
  await f.m.setPolicy('beta',{mode:'accept',senders:[controlId.id],operatorSources:[],crossWorkspace:false,alias:''});
  assert.equal((await f.m.send(controlId,{id:'escaped-id',target:'beta',text:'Synthetic'})).status,'delivered');
  assert.match(f.received.at(-1).content[0].text,/sender="line\\nbreak"/);
  await assert.rejects(f.m.sendOperator('alpha',{id:'__proto__',target:'a:b',text:'Synthetic'}),/INVALID_MESSAGE/);
});
test('recent rejected-candidate operator records reserve the new global rate window',async()=>{
  const f=fixture({ratePerMinute:1});
  await f.m.setPolicy('beta',{mode:'accept',senders:[],operatorSources:['alpha'],crossWorkspace:false,alias:''});
  const state=structuredClone(f.store.read());
  state.messages.previous={id:'previous',sender:operatorAddress('alpha'),target:'beta',text:'Synthetic prior',created:10000,expires:20000,status:'delivered',hops:0,hostId:'host-previous',origin:'operator',sourceRoot:'alpha',sourceWorkspace:'/synthetic/shared'};
  await f.store.write(state);
  await assert.rejects(f.m.sendOperator('alpha',{id:'next',target:'beta',text:'Synthetic'}),/RATE_LIMIT/);
});
test('old operator-shaped sender string is not migrated into operator permission on held release',async()=>{
  const f=fixture(),actor=operatorAddress('alpha');
  await f.m.setPolicy('beta',{mode:'hold',senders:[actor],crossWorkspace:false,alias:''});
  const state=structuredClone(f.store.read());
  state.messages.oldHeld={id:'oldHeld',sender:actor,target:'beta',text:'Synthetic old held',created:10000,expires:20000,status:'queued',hops:0,hostId:'host-old-held',origin:'operator',sourceRoot:'alpha',sourceWorkspace:'/synthetic/shared'};
  await f.store.write(state);
  assert.equal((await f.m.release('oldHeld')).reason,'OPERATOR_NOT_ALLOWED');
  assert.equal(f.received.length,0);
  await f.m.setPolicy('beta',{mode:'accept',senders:[actor],operatorSources:['alpha'],crossWorkspace:false,alias:''});
  assert.equal((await f.m.release('oldHeld')).status,'failed');
  assert.equal(f.received.length,0);
});
