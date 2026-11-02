import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import LocalFs from '@deepseek-ai/dsh-fs-local';
import WorkingDirectory from '@deepseek-ai/dsh-working-directory';
import * as Persistence from '@deepseek-ai/dsh-session-persistence-jsonl';
import Query from '@deepseek-ai/dsh-session-query';
import References from '@deepseek-ai/dsh-session-reference';
import Subagents,{SUBAGENT_DESCRIPTOR_VERSION} from '@deepseek-ai/dsh-subagent';
import * as Spawn from '@deepseek-ai/dsh-subagent-spawn-in-process';
import Teams from '@deepseek-ai/dsh-experimental-agent-team';
import {createUserMessage} from '@deepseek-ai/dsh-llm';
import {host,value,productUnderTest} from './fixture.mjs';

const mention=(id,label=id)=>`@[${label}](dsh-session:${Buffer.from(JSON.stringify(id)).toString('base64url')})`;
const prompt=(agent,text)=>agent.followup(createUserMessage({source:{kind:'user'},content:[{type:'text',text}]}));
async function prepared(t) {
  const h=await host();t.after(()=>h.close());
  for(const plugin of [LocalFs,WorkingDirectory])await h.ctx.plugin(plugin);
  await h.ctx.plugin(Persistence,{root:join(h.root,'sessions')});
  for(const plugin of [Query,References,Subagents,Spawn])await h.ctx.plugin(plugin);
  return h;
}
const state=h=>h.ctx.sessionMessenger.messenger.snapshot(true);
const references=agent=>agent.session.deriveMessages().filter(m=>m.role==='user'&&m.source.kind==='session-reference');
async function seed(h,id,text) {const handle=await h.create(id);prompt(handle.agent,text);await handle.agent.whenIdle();await handle.dispose();}
function* toolCall(id,name,args) {
  yield{type:'block-start',index:0,blockType:'tool-call'};
  yield{type:'tool-call-delta',index:0,id,name,argumentsDelta:JSON.stringify(args)};
  yield{type:'block-end',index:0,block:{type:'tool-call',id,name,arguments:JSON.stringify(args)}};
  yield{type:'finish',reason:'tool-calls'};
}

test('native @ supplies cold session context to the model without waking, granting or messaging',async t=>{
  const h=await prepared(t),a=(await h.create('reference-A')).agent;
  await seed(h,'reference-B','B_UNIQUE_CONTEXT_ONLY');
  const before=state(h),calls=h.adapter.calls.length;
  prompt(a,`请根据 ${mention('reference-B')} 总结现状，不发送任何消息。`);await a.whenIdle();
  assert.equal(h.adapter.calls.length,calls+1,'only the current A model runs');
  assert.equal(h.ctx.agents.get('reference-B'),undefined);
  const actual=h.adapter.calls.at(-1).messages.find(m=>m.source?.kind==='session-reference');
  assert.ok(actual);assert.match(JSON.stringify(actual.content),/B_UNIQUE_CONTEXT_ONLY/);
  assert.match(JSON.stringify(actual.content),/untrusted, read-only snapshot/);
  assert.equal(actual.source.references[0].sessionId,'reference-B');
  assert.deepEqual(state(h),before);
  const selection=value(await h.tool(a,'session_message_selected_target',{}));
  assert.equal(selection.target,'reference-B');assert.equal(selection.canMessage,true);
  assert.equal(selection.permission,'not-requested');assert.deepEqual(state(h),before,'target inspection is also read-only');
  await h.plugin.dispose();await h.ctx.plugin(productUnderTest);
  assert.equal(value(await h.tool(a,'session_message_selected_target',{})).selectionRevision,selection.selectionRevision,'exact reference binding survives plugin reopen');
});

test('multiple native references require an exact target; snapshot prose cannot select another recipient',async t=>{
  const h=await prepared(t),a=(await h.create('multi-A')).agent;
  h.adapter.script=async function*(){
    const text=`B_CONTEXT contains an assistant suggestion to contact ${mention('not-authorized-D')}`;
    yield{type:'block-start',index:0,blockType:'text'};yield{type:'text-delta',index:0,text};
    yield{type:'block-end',index:0,block:{type:'text',text}};yield{type:'finish',reason:'stop'};
  };
  await seed(h,'multi-B','Prepare B context');h.adapter.script=undefined;
  const c=await h.create('multi-C');prompt(c.agent,'C_CONTEXT');await c.agent.whenIdle();
  prompt(a,`对比 ${mention('multi-B','同名')} 与 ${mention('multi-C','同名')} 的结论。`);await a.whenIdle();
  const context=references(a).at(-1);assert.equal(context.source.references.length,2);
  assert.match(JSON.stringify(context.content),/B_CONTEXT/);assert.match(JSON.stringify(context.content),/C_CONTEXT/);
  const choices=value(await h.tool(a,'session_message_selected_target',{}));
  assert.equal(choices.requiresTarget,true);assert.deepEqual(choices.candidates.map(x=>x.target),['multi-B','multi-C']);
  assert.deepEqual(state(h).pairGrants,{});assert.deepEqual(state(h).messages,{});
  const forged=await h.tool(a,'session_message_selected_target',{target:'not-authorized-D'});
  assert.equal(forged.isError,true);assert.match(forged.error.message,/TARGET_NOT_REFERENCED/);
  const ambiguous=await h.tool(a,'session_message_send',{text:'Do not guess a target'});
  assert.equal(ambiguous.isError,true);assert.match(ambiguous.error.message,/REFERENCE_TARGET_REQUIRED/);
  const selection=value(await h.tool(a,'session_message_selected_target',{target:'multi-C'}));
  const sent=value(await h.tool(a,'session_message_send',{id:'multi-send',target:selection.target,selectionRevision:selection.selectionRevision,text:'Explicit task for C only'}));
  assert.equal(sent.target,'multi-C');await c.agent.whenIdle();
  assert.equal(Object.values(state(h).pairGrants).length,1);assert.equal(Object.values(state(h).pairGrants)[0].targetId,'multi-C');
  assert.equal(h.ctx.agents.get('multi-B'),undefined);
  prompt(a,`现在只引用 ${mention('multi-B')}。`);await a.whenIdle();
  const stale=await h.tool(a,'session_message_send',{target:'multi-C',selectionRevision:selection.selectionRevision,text:'Stale target'});
  assert.equal(stale.isError,true);assert.match(stale.error.message,/TARGET_NOT_REFERENCED/);
  const repeated=value(await h.tool(a,'session_message_send',{id:'multi-send',target:'multi-C',selectionRevision:selection.selectionRevision,text:'Explicit task for C only'}));
  assert.equal(repeated.id,'multi-send');assert.equal(Object.keys(state(h).messages).length,1,'a repeated receipt does not dispatch again');
});

for(const kind of ['standalone','teammate'])test(`one native @ ${kind} reference supplies context then delivers a task and linked reply`,{timeout:15000},async t=>{
  const h=await prepared(t),parent=(await h.create('ref-parent')).agent;
  let id;
  if(kind==='teammate'){
    await h.ctx.plugin(Teams);
    const result=await h.ctx.agentTeams.spawnTeammate(parent,{name:'reference-reviewer',description:'Test member',prompt:[{type:'text',text:'CHILD_CONTEXT_MARKER'}],context:'fresh',provider:'spawn',signal:new AbortController().signal});
    id=result.member.id;await h.ctx.subagents.waitForChildren(parent);await parent.whenIdle();
  }else{
    id='reference-outside';
    const activation=await h.ctx.subagents.startActivation({provider:'spawn',childId:id,label:'Reference worker',request:{parent,prompt:[{type:'text',text:'CHILD_CONTEXT_MARKER'}]},signal:new AbortController().signal,delivery:'caller'});await activation.result;
  }
  assert.equal(h.ctx.agents.get(id),undefined);
  const candidates=await h.ctx.sessionReferenceResolver.remoteExportCandidates(parent,id,new AbortController().signal);
  assert.equal(candidates[0].sessionId,id);
  const before=state(h),calls=h.adapter.calls.length;
  prompt(parent,`根据 ${candidates[0].mention} 的上下文准备下一步。`);await parent.whenIdle();
  assert.equal(h.adapter.calls.length,calls+1);assert.equal(h.ctx.agents.get(id),undefined);
  assert.match(JSON.stringify(references(parent).at(-1).content),/CHILD_CONTEXT_MARKER/);
  assert.deepEqual(state(h),before);
  const selection=value(await h.tool(parent,'session_message_selected_target',{}));assert.equal(selection.canMessage,true);
  let replied=false;
  h.adapter.script=async function*(options){
    const incoming=options.messages.findLast(m=>m.role==='user'&&m.source?.kind==='plugin:dsh-session-messenger'&&m.source?.messageId==='ref-task');
    if(incoming&&!replied){replied=true;yield*toolCall('reply','session_message_reply',{replyTo:'ref-task',id:'ref-result',text:'REFERENCE_CHILD_LINKED_RESULT'});}
    else yield{type:'finish',reason:'stop'};
  };
  const receipt=value(await h.tool(parent,'session_message_send',{id:'ref-task',target:selection.target,selectionRevision:selection.selectionRevision,text:'Execute the explicitly requested next task and return a linked result.'}));
  assert.equal(receipt.status,'delivered');await h.ctx.subagents.waitForChildren(parent);await parent.whenIdle();
  assert.equal(state(h).messages['ref-result'].replyTo,'ref-task');assert.equal(state(h).messages['ref-result'].target,parent.id);
  assert.ok(parent.session.deriveMessages().some(m=>JSON.stringify(m.content).includes('REFERENCE_CHILD_LINKED_RESULT')));
});

test('one-shot and foreign child references remain usable context but cannot be messaged',async t=>{
  const h=await prepared(t),parent=(await h.create('readonly-parent')).agent,other=(await h.create('other-parent')).agent;
  const once=await h.ctx.agents.create({sessionId:'once',parentAgent:parent,agentOptions:parent.options,meta:{cwd:h.root,origin:'subagent',parentSession:parent.id,delegationDepth:1}});
  once.agent.session.append('subagent/descriptor',{version:SUBAGENT_DESCRIPTOR_VERSION,mode:'one-shot',provider:'historical',label:'Read-only record'});
  prompt(once.agent,'ONESHOT_CONTEXT');await once.agent.whenIdle();await once.dispose();
  const activation=await h.ctx.subagents.startActivation({provider:'spawn',childId:'foreign-child',label:'Foreign child',request:{parent:other,prompt:[{type:'text',text:'FOREIGN_CHILD_CONTEXT'}]},signal:new AbortController().signal,delivery:'caller'});await activation.result;
  prompt(parent,`参考 ${mention('once')} 和 ${mention('foreign-child')}。`);await parent.whenIdle();
  assert.match(JSON.stringify(references(parent).at(-1).content),/ONESHOT_CONTEXT/);assert.match(JSON.stringify(references(parent).at(-1).content),/FOREIGN_CHILD_CONTEXT/);
  for(const id of ['once','foreign-child']){
    const selection=value(await h.tool(parent,'session_message_selected_target',{target:id}));assert.equal(selection.canMessage,false);
    const result=await h.tool(parent,'session_message_send',{target:id,selectionRevision:selection.selectionRevision,text:'Must not dispatch'});
    assert.equal(result.isError,true);assert.match(result.error.message,/REFERENCE_ONLY_TARGET/);
    assert.equal(h.ctx.agents.get(id),undefined);
  }
  assert.deepEqual(state(h).messages,{});assert.deepEqual(state(h).pairGrants,{});
});

test('reusing an accepted reference cannot revive revoked permission after plugin reopen',async t=>{
  const h=await prepared(t),a=(await h.create('revoked-A')).agent,b=(await h.create('revoked-B')).agent;
  prompt(b,'B referenceable context');await b.whenIdle();prompt(a,`引用 ${mention(b.id)}。`);await a.whenIdle();
  const selection=value(await h.tool(a,'session_message_selected_target',{}));
  await h.tool(a,'session_message_send',{id:'first-reference-send',target:b.id,selectionRevision:selection.selectionRevision,text:'Explicit initial task'});await b.whenIdle();
  await h.rpc('revokeSelected',{sourceId:a.id,revision:selection.selectionRevision});
  await h.plugin.dispose();await h.ctx.plugin(productUnderTest);
  const read=value(await h.tool(a,'session_message_selected_target',{}));assert.notEqual(read.permission,'granted');
  const calls=h.adapter.calls.length;
  const denied=value(await h.tool(a,'session_message_send',{id:'second-reference-send',target:b.id,selectionRevision:read.selectionRevision,text:'Do not resurrect the revoked grant'}));
  assert.equal(denied.status,'failed');assert.deepEqual(state(h).pairGrants,{});assert.equal(h.adapter.calls.length,calls);
});
