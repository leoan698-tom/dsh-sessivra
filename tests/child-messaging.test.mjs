import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import LocalFs from '@deepseek-ai/dsh-fs-local';
import WorkingDirectory from '@deepseek-ai/dsh-working-directory';
import * as Persistence from '@deepseek-ai/dsh-session-persistence-jsonl';
import Query from '@deepseek-ai/dsh-session-query';
import Subagents from '@deepseek-ai/dsh-subagent';
import * as Spawn from '@deepseek-ai/dsh-subagent-spawn-in-process';
import Teams from '@deepseek-ai/dsh-experimental-agent-team';
import {defineTool} from '@deepseek-ai/dsh-tools';
import {Messenger,emptyState} from '../dist/core.js';
import {host,value,productUnderTest} from './fixture.mjs';

async function nativeHost(t) {
  const h=await host();t.after(()=>h.close());
  for(const plugin of [LocalFs,WorkingDirectory])await h.ctx.plugin(plugin);
  await h.ctx.plugin(Persistence,{root:join(h.root,'sessions')});
  await h.ctx.plugin(Query);
  await h.ctx.plugin(Subagents);
  await h.ctx.plugin(Spawn);
  return h;
}
async function coldChild(h,parent,id,label) {
  const activation=await h.ctx.subagents.startActivation({provider:'spawn',childId:id,label,request:{parent,prompt:[{type:'text',text:'Synthetic setup only.'}]},signal:new AbortController().signal,delivery:'caller'});
  await activation.result;
  assert.equal(h.ctx.agents.get(id),undefined);
  return id;
}
function* toolCall(id,name,args) {
  yield {type:'block-start',index:0,blockType:'tool-call'};
  yield {type:'tool-call-delta',index:0,id,name,argumentsDelta:JSON.stringify(args)};
  yield {type:'block-end',index:0,block:{type:'tool-call',id,name,arguments:JSON.stringify(args)}};
  yield {type:'finish',reason:'tool-calls'};
}

for(const kind of ['standalone','teammate'])test(`real native cold ${kind} receives a parent task and returns an exact linked reply`, {timeout:15000}, async t=>{
  const h=await nativeHost(t);
  if(kind==='teammate')await h.ctx.plugin(Teams);
  const parent=(await h.create('native-parent')).agent;
  let childId;
  if(kind==='teammate'){
    const spawned=await h.ctx.agentTeams.spawnTeammate(parent,{name:'native-reviewer',description:'Isolated member',prompt:[{type:'text',text:'Setup'}],context:'fresh',provider:'spawn',signal:new AbortController().signal});
    childId=spawned.member.id;await h.ctx.subagents.waitForChildren(parent);await parent.whenIdle();
  }else childId=await coldChild(h,parent,'native-outside','独立验证');
  const teamBefore=parent.session.snapshotEvents().filter(e=>e.type==='team/member'||e.type==='team/task');
  const initialCalls=h.adapter.calls.length;
  const candidates=await h.ctx.typertGateway.invoke({namespace:'sessionCollaboration',method:'candidates',args:{sourceId:parent.id,query:kind==='teammate'?'native-reviewer':'独立验证'},peer:h.peer});
  assert.equal(candidates[0].sessionId,childId);
  assert.equal(candidates[0].kind,kind);
  await h.rpc('selectRecipient',{sourceId:parent.id,targetId:childId,label:'独立验证 · 子智能体'});
  assert.equal(h.adapter.calls.length,initialCalls,'candidate and selection must not call a model');
  assert.equal(h.ctx.agents.get(childId),undefined,'selection must not resume the child');
  const selected=value(await h.tool(parent,'session_message_selected_target',{}));
  let replied=false;
  h.adapter.script=async function*(options){
    const incoming=options.messages.findLast(m=>m.role==='user'&&m.source?.kind==='plugin:dsh-session-messenger'&&m.source?.messageId==='native-task');
    if(incoming&&!replied){
      replied=true;
      assert.ok(options.tools.some(tool=>tool.name==='session_message_reply'));
      yield*toolCall('child-linked-reply','session_message_reply',{replyTo:'native-task',id:'native-result',text:'NATIVE_CHILD_RESULT'});
    }else yield {type:'finish',reason:'stop'};
  };
  const receipt=value(await h.tool(parent,'session_message_send',{id:'native-task',text:'Run the isolated task and report.',selectionRevision:selected.selectionRevision}));
  assert.equal(receipt.status,'delivered');
  await h.ctx.subagents.waitForChildren(parent);
  await parent.whenIdle();
  const messages=(await h.rpc('view')).state.messages;
  assert.equal(messages['native-task'].status,'claimed');
  assert.equal(messages['native-result']?.replyTo,'native-task');
  assert.equal(messages['native-result']?.target,parent.id);
  assert.equal(messages['native-result']?.status,'claimed');
  const actual=parent.session.snapshotEvents().filter(e=>JSON.stringify(e).includes('NATIVE_CHILD_RESULT'));
  assert.ok(actual.length>0,'linked result really reached parent history');
  assert.equal(Object.values(messages).filter(m=>m.replyTo==='native-task').length,1);
  assert.deepEqual(parent.session.snapshotEvents().filter(e=>e.type==='team/member'||e.type==='team/task'),teamBefore);
  await h.plugin.dispose();await h.ctx.plugin(productUnderTest);
  const reopened=value(await h.tool(parent,'session_message_selected_target',{}));
  assert.equal(reopened.child.kind,kind);assert.equal(reopened.lastReply.id,'native-result');
  assert.equal(value(await h.tool(parent,'session_message_status',{id:'native-result'})).status,'claimed');
});

for(const deliveryMode of ['queue','insert'])test(`native busy child ${deliveryMode} preserves the running tool and consumes the task`,{timeout:15000},async t=>{
  const h=await nativeHost(t),parent=(await h.create('busy-parent')).agent;
  const entered=Promise.withResolvers(),release=Promise.withResolvers();
  t.after(()=>release.resolve());
  let toolSignal,first=true;
  h.ctx.tools.register(defineTool({name:'child_gate',description:'Isolated gate',parameters:{},output:{schema:{type:'string'},render:()=>[]},execute:async(_args,exec)=>{toolSignal=exec.signal;entered.resolve();await release.promise;return 'done';}}));
  h.adapter.script=async function*(){if(first){first=false;yield*toolCall('gate','child_gate',{});}else yield{type:'finish',reason:'stop'};};
  const activation=await h.ctx.subagents.startActivation({provider:'spawn',childId:'busy-child',label:'Busy child',request:{parent,prompt:[{type:'text',text:'Initial gate'}]},signal:new AbortController().signal,delivery:'caller'});
  await entered.promise;
  const child=h.ctx.agents.get('busy-child');
  await h.rpc('selectRecipient',{sourceId:parent.id,targetId:child.id,label:'Busy child'});
  const selected=value(await h.tool(parent,'session_message_selected_target',{}));
  const receipt=value(await h.tool(parent,'session_message_send',{id:'busy-task',text:'Next task',selectionRevision:selected.selectionRevision,deliveryMode}));
  assert.equal(receipt.status,'delivered');
  assert.equal(child.inbox.nextTurn.length,deliveryMode==='queue'?1:0);
  assert.equal(child.inbox.nextStep.length,deliveryMode==='insert'?1:0);
  assert.equal(toolSignal.aborted,false);
  release.resolve();await activation.result;await h.ctx.subagents.waitForChildren(parent);
  assert.equal(child.session.snapshotEvents().filter(e=>e.type==='turn/start').length,deliveryMode==='queue'?2:1);
  assert.equal((await h.rpc('view')).state.messages['busy-task'].status,'claimed');
});

test('foreign and archived native children cannot be selected or resumed',{timeout:15000},async t=>{
  const h=await nativeHost(t),parent=(await h.create('owner')).agent,foreign=(await h.create('foreign')).agent;
  const id=await coldChild(h,parent,'owned-child','Owned child');
  const calls=h.adapter.calls.length;
  await assert.rejects(h.rpc('selectRecipient',{sourceId:foreign.id,targetId:id,label:'Forged'}),/RECIPIENT_NOT_OWNED_CHILD/);
  const denied=await h.tool(foreign,'session_message_send',{target:id,id:'forged-task',text:'Forbidden'});
  assert.equal(denied.isError,true);assert.match(JSON.stringify(denied),/RECIPIENT_NOT_OWNED_CHILD/);
  h.ctx.provide('workspaceRegistry',{archivedSessionIds:[id]});
  await assert.rejects(h.rpc('selectRecipient',{sourceId:parent.id,targetId:id,label:'Archived'}),/RECIPIENT_NOT_OWNED_CHILD/);
  assert.equal(h.adapter.calls.length,calls);assert.equal(h.ctx.agents.get(id),undefined);
  assert.deepEqual((await h.rpc('view')).state.messages,{});
});

function ledgerFixture(){
  let state=emptyState(),now=1000,dispatches=0;
  const parent={id:'P',status:'idle',session:{header:{cwd:'/test'}}};
  const child={id:'C',status:'idle',session:{header:{cwd:'/test',origin:'subagent',parentSession:'P',delegationDepth:1}}};
  let allowed=true,sendError;
  const recipient=()=>allowed?{id:child.id,...child.session.header,child:{parentId:'P',childId:'C',kind:'teammate'}}:undefined;
  const messenger=new Messenger({roots:()=>[parent],get:id=>[parent,child].find(a=>a.id===id),inspect:async id=>id==='C'?{id,...child.session.header}:undefined,
    children:{inspect:async()=>recipient(),send:async()=>{dispatches++;if(sendError)throw sendError;return 'native-input';},reply:async()=>{dispatches++;return 'native-reply';}}},
    {read:()=>state,write:async next=>{state=structuredClone(next);}},undefined,()=>now);
  return{messenger,parent,child,state:()=>state,dispatches:()=>dispatches,deny:()=>{allowed=false;},advance:()=>{now+=400000;},breakSend:()=>{sendError=Error('lost after submit');}};
}

test('child reply validates linkage, preserves exact-once replay and allows the parent next task',async()=>{
  const h=ledgerFixture(),m=h.messenger;
  await m.selectRecipient(h.parent,'C','Member');
  await m.send(h.parent,{target:'C',id:'task',text:'Do work'});
  await assert.rejects(m.send(h.child,{target:'P',text:'unsolicited'}),/CHILD_REPLY_ONLY/);
  await assert.rejects(m.send(h.child,{target:'other',replyTo:'task',text:'wrong'}),/INVALID_REPLY/);
  const result=await m.send(h.child,{replyTo:'task',id:'result',text:'Done'});
  assert.deepEqual(await m.send(h.child,{replyTo:'task',id:'result',text:'Done'}),result);
  await assert.rejects(m.send(h.child,{replyTo:'task',text:'Again'}),/ALREADY_REPLIED/);
  await m.claimed(h.parent,'native-reply');
  assert.equal((await m.send(h.parent,{target:'C',id:'task2',text:'Next work'})).status,'delivered');
  assert.equal(h.dispatches(),3);
});

test('changed ownership, revoked permission and expired requests cannot dispatch child work or replies',async()=>{
  const h=ledgerFixture(),m=h.messenger,selected=await m.selectRecipient(h.parent,'C','Member');
  await m.send(h.parent,{target:'C',id:'task',text:'Do work'});
  await m.revokeSelected('P',selected.revision);
  assert.equal((await m.send(h.child,{replyTo:'task',id:'result',text:'Done'})).status,'failed');
  assert.equal(h.dispatches(),1);
  h.advance();await assert.rejects(m.send(h.child,{replyTo:'task',text:'Late'}),/INVALID_REPLY/);
  h.deny();await assert.rejects(m.send(h.parent,{target:'C',text:'Changed child'}),/RECIPIENT_NOT_OWNED_CHILD/);
  assert.equal(h.dispatches(),1);
});

test('ambiguous child submission stays uncertain through retry and recovery',async()=>{
  const h=ledgerFixture(),m=h.messenger;await m.selectRecipient(h.parent,'C','Member');h.breakSend();
  const args={target:'C',id:'ambiguous',text:'Task'};
  assert.equal((await m.send(h.parent,args)).status,'uncertain');
  assert.equal((await m.send(h.parent,args)).status,'uncertain');
  await m.recover();assert.equal((await m.release('ambiguous')).status,'uncertain');
  assert.equal(h.dispatches(),1);
});
