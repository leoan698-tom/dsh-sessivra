import test from 'node:test';
import assert from 'node:assert/strict';
import LocalFs from '@deepseek-ai/dsh-fs-local';
import WorkingDirectory from '@deepseek-ai/dsh-working-directory';
import * as Persistence from '@deepseek-ai/dsh-session-persistence-jsonl';
import Query from '@deepseek-ai/dsh-session-query';
import {join,resolve,dirname} from 'node:path';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createUserMessage} from '@deepseek-ai/dsh-llm';
import {defineTool} from '@deepseek-ai/dsh-tools';
import {host,value,productUnderTest} from './fixture.mjs';

async function prepared(t){
  const h=await host();t.after(()=>h.close());
  for(const plugin of [LocalFs,WorkingDirectory])await h.ctx.plugin(plugin);
  await h.ctx.plugin(Persistence,{root:join(h.root,'sessions')});await h.ctx.plugin(Query);
  return h;
}

test('a repeated child creation request retains its exact conversation and first message',async t=>{
  const h=await prepared(t),a=await h.create('creation-A');
  const args={requestId:'build-case',label:'Same name',prompt:'Free build task'};
  const first=value(await h.tool(a.agent,'session_create_child',args));
  await h.ctx.agents.get(first.id).whenIdle();
  const again=value(await h.tool(a.agent,'session_create_child',args));
  assert.equal(again.id,first.id);assert.equal(again.messageId,first.messageId);
  assert.equal(h.ctx.agents.roots().length,2);
  const conflict=await h.tool(a.agent,'session_create_child',{...args,prompt:'Different task'});
  assert.equal(conflict.isError,true);
});

test('A forwards B associated result to independent review C without replying to a reply',async t=>{
  const h=await prepared(t),a=await h.create('workflow-A');
  const b=value(await h.tool(a.agent,'session_create_child',{label:'Same name',prompt:'Build'}));
  const c=value(await h.tool(a.agent,'session_create_child',{label:'Same name',prompt:'Wait for review input'}));
  const B=h.ctx.agents.get(b.id),C=h.ctx.agents.get(c.id);
  await Promise.all([B.whenIdle(),C.whenIdle()]);
  const built=value(await h.tool(B,'session_message_reply',{replyTo:b.messageId,text:'Build result v1: 2 + 2 = 4'}));
  await a.agent.whenIdle();
  await h.rpc('selectRecipient',{sourceId:a.agent.id,targetId:C.id,label:'Same name'});
  const selected=value(await h.tool(a.agent,'session_message_selected_target',{}));
  const review=value(await h.tool(a.agent,'session_message_send',{target:C.id,selectionRevision:selected.selectionRevision,text:'Read-only review of B result v1: 2 + 2 = 4',deliveryMode:'queue'}));
  await C.whenIdle();
  const verdict=value(await h.tool(C,'session_message_reply',{replyTo:review.id,text:'Reviewed: arithmetic is correct; no files changed'}));
  await a.agent.whenIdle();
  assert.equal(built.target,a.agent.id);assert.equal(verdict.target,a.agent.id);
  assert.equal(review.target,C.id);assert.notEqual(B.id,C.id);
});

test('create success then initial task setup failure is recoverable with no duplicate conversation',async t=>{
  const h=await prepared(t),a=await h.create('partial-A');
  let shouldFail=true,createdCount=0;
  h.ctx.provide('sessionController',{
    create:async({sessionId,cwd})=>{createdCount++;await h.ctx.agents.create({sessionId,agentOptions:{provider:'synthetic-free',model:'fixture'},meta:{cwd}});return{sessionId};},
    rename:async()=>{if(shouldFail)throw new Error('FIXTURE_RENAME_FAILURE');},
    inspect:async id=>{const child=h.ctx.agents.get(id);return child?{meta:child.session.header}:null;},
  });
  const args={requestId:'partial-build',label:'Build',prompt:'Free build'};
  const partial=value(await h.tool(a.agent,'session_create_child',args));
  assert.equal(partial.created,true);assert.equal(partial.status,'not-confirmed');assert.match(partial.error,/FIXTURE_RENAME_FAILURE/);assert.equal(createdCount,1);assert.equal(h.adapter.calls.length,0);
  shouldFail=false;
  const retry=value(await h.tool(a.agent,'session_create_child',args));
  assert.equal(retry.id,partial.id);assert.equal(createdCount,1);assert.equal(retry.reused,true);assert.equal(retry.status,'delivered');await h.ctx.agents.get(retry.id).whenIdle();
});

test('uncertain initial dispatch retains one child and never automatically repeats the delivery',async t=>{
  const h=await prepared(t),a=await h.create('uncertain-A');let attempts=0;
  h.ctx.provide('sessionController',{
    create:async({sessionId,cwd})=>{const child=await h.ctx.agents.create({sessionId,agentOptions:{provider:'synthetic-free',model:'fixture'},meta:{cwd}});child.agent.followup=()=>{attempts++;throw new Error('FIXTURE_AMBIGUOUS_DISPATCH');};return{sessionId};},
    rename:async()=>{},inspect:async id=>({meta:h.ctx.agents.get(id).session.header}),
  });
  const args={requestId:'uncertain-build',label:'Build',prompt:'Free build'};
  const first=value(await h.tool(a.agent,'session_create_child',args));assert.equal(first.status,'uncertain');
  await h.plugin.dispose();await h.ctx.plugin(productUnderTest);
  const retry=value(await h.tool(a.agent,'session_create_child',args));assert.equal(retry.id,first.id);assert.equal(retry.status,'uncertain');assert.equal(attempts,1);assert.equal(h.ctx.agents.roots().length,2);
});

test('complete ordinary A / construction B / readonly review C workflow and full Host reopen', {timeout:15000}, async t=>{
  const root=await mkdtemp(join(tmpdir(),'dshsm-workflow-'));
  let h;
  const boot=async()=>{const x=await host(root);for(const p of [LocalFs,WorkingDirectory])await x.ctx.plugin(p);await x.ctx.plugin(Persistence,{root:join(root,'sessions')});await x.ctx.plugin(Query);return x;};
  const entered=Promise.withResolvers(),release=Promise.withResolvers();
  t.after(async()=>{release.resolve();if(h)await h.close();assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.match(root.split(/[\\/]/).at(-1),/^dshsm-workflow-/);await rm(root,{recursive:true,force:true});});
  h=await boot();
  const artifact=join(root,'construction-result.json');let toolSignal,buildAgent,reviewAgent,buildStarted=false,reviewStarted=false;
  h.ctx.tools.register(defineTool({name:'free_build_fixture',description:'Write one isolated free arithmetic artifact',parameters:{},output:{schema:{type:'json'},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},execute:async(_args,exec)=>{buildAgent=exec.agent.id;toolSignal=exec.signal;entered.resolve();await release.promise;const result={version:1,left:2,right:2,sum:4};await writeFile(artifact,JSON.stringify(result));return result;}}));
  h.ctx.tools.register(defineTool({name:'free_review_fixture',description:'Read and check the isolated build artifact without edits',parameters:{},output:{schema:{type:'json'},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},execute:async(_args,exec)=>{reviewAgent=exec.agent.id;const bytes=await readFile(artifact),result=JSON.parse(bytes);assert.equal(result.sum,result.left+result.right);return{verdict:'consistent',sha256:createHash('sha256').update(bytes).digest('hex')};}}));
  const call=async function*(name){yield{type:'block-start',index:0,blockType:'tool-call'};yield{type:'tool-call-delta',index:0,id:name,name,argumentsDelta:'{}'};yield{type:'block-end',index:0,block:{type:'tool-call',id:name,name,arguments:'{}'}};yield{type:'finish',reason:'tool-calls'};};
  h.adapter.script=async function*(options){const texts=options.messages.flatMap(message=>(message.content??[]).filter(block=>block.type==='text').map(block=>block.text)).join('\n');if(!buildStarted&&texts.includes('WF_BUILD')){buildStarted=true;yield*call('free_build_fixture');}else if(!reviewStarted&&texts.includes('WF_REVIEW_RESULT')){reviewStarted=true;yield*call('free_review_fixture');}else yield{type:'finish',reason:'stop'};};
  const a=await h.create('full-workflow-A');
  const b=value(await h.tool(a.agent,'session_create_child',{requestId:'full-B',label:'Construction / review',prompt:'WF_BUILD: construct the isolated arithmetic result'}));
  await entered.promise;
  const c=value(await h.tool(a.agent,'session_create_child',{requestId:'full-C',label:'Construction / review',prompt:'Wait for an explicit review request'}));
  const B=h.ctx.agents.get(b.id),C=h.ctx.agents.get(c.id);await C.whenIdle();
  const readTree=()=>h.ctx.typertGateway.invoke({namespace:'sessionCollaboration',method:'tree',args:{},peer:h.peer});
  const tree=await readTree();assert.equal(tree.find(row=>row.id===B.id).parentId,a.agent.id);assert.equal(tree.find(row=>row.id===C.id).parentId,a.agent.id);
  C.followup(createUserMessage({source:{kind:'user'},content:[{type:'text',text:'Independent human message to ordinary C'}]}));await C.whenIdle();
  const calls=h.adapter.calls.length;
  const pb=value(await h.tool(a.agent,'session_progress',{target:B.id,limit:24})),pc=value(await h.tool(a.agent,'session_progress',{target:C.id,limit:24}));
  assert.equal(pb.runtime.status,'running');assert.equal(pc.runtime.status,'idle');assert.equal(h.adapter.calls.length,calls);
  await h.rpc('selectRecipient',{sourceId:a.agent.id,targetId:B.id,label:'Construction / review'});
  let selected=value(await h.tool(a.agent,'session_message_selected_target',{}));
  const queued=value(await h.tool(a.agent,'session_message_send',{id:'full-queue',target:B.id,selectionRevision:selected.selectionRevision,text:'Follow-up after current work',deliveryMode:'queue'}));
  const inserted=value(await h.tool(a.agent,'session_message_send',{id:'full-insert',target:B.id,selectionRevision:selected.selectionRevision,text:'Immediate adjustment: keep result version 1',deliveryMode:'insert'}));
  assert.equal(B.inbox.nextTurn.length,1);assert.equal(B.inbox.nextStep.length,1);assert.equal(toolSignal.aborted,false);
  const waiting=value(await h.tool(a.agent,'session_progress',{target:B.id,limit:24}));
  assert.equal(waiting.messages.find(message=>message.id===queued.id).status,'delivered');assert.equal(waiting.businessCompletion,'unknown');
  release.resolve();await B.whenIdle();assert.equal(buildAgent,B.id);
  const bytes=await readFile(artifact),hash=createHash('sha256').update(bytes).digest('hex');
  const built=value(await h.tool(B,'session_message_reply',{replyTo:queued.id,text:`Construction result v1: 2+2=4; sha256=${hash}`}));await a.agent.whenIdle();
  const bp=value(await h.tool(a.agent,'session_progress',{target:B.id,after:pb.nextCursor,limit:24}));
  assert.ok(bp.messages.some(message=>message.id===built.id&&message.replyTo===queued.id));
  await h.rpc('selectRecipient',{sourceId:a.agent.id,targetId:C.id,label:'Construction / review'});selected=value(await h.tool(a.agent,'session_message_selected_target',{}));
  const forward=value(await h.tool(a.agent,'session_message_send',{id:'full-review',target:C.id,selectionRevision:selected.selectionRevision,text:`WF_REVIEW_RESULT: read only result v1, 2+2=4, expected sha256=${hash}`,deliveryMode:'queue'}));await C.whenIdle();assert.equal(reviewAgent,C.id);assert.equal(createHash('sha256').update(await readFile(artifact)).digest('hex'),hash);
  const verdict=value(await h.tool(C,'session_message_reply',{replyTo:forward.id,text:'Read-only review: result consistent; file hash unchanged'}));await a.agent.whenIdle();
  const final=value(await h.tool(a.agent,'session_progress',{target:C.id,limit:24}));assert.ok(final.messages.some(message=>message.id===verdict.id&&message.replyTo===forward.id));
  const ids={A:a.agent.id,B:B.id,C:C.id},cursor=final.nextCursor;
  await h.close();h=await boot();
  const resumed=await h.ctx.agents.resume({resumeSessionId:ids.A,agentOptions:{provider:'synthetic-free',model:'fixture'}});
  const restored=await readTree();assert.equal(restored.find(row=>row.id===ids.B).parentId,ids.A);assert.equal(restored.find(row=>row.id===ids.C).parentId,ids.A);
  const after=value(await h.tool(resumed.agent,'session_progress',{target:ids.C,after:cursor,limit:24}));assert.equal(after.runtime.status,'cold');assert.deepEqual(after.events,[]);assert.ok(after.messages.some(message=>message.id===verdict.id&&message.replyTo===forward.id));assert.equal(h.adapter.calls.length,0);
  if(process.env.DSHSM_EVIDENCE_DIR){await mkdir(process.env.DSHSM_EVIDENCE_DIR,{recursive:true});await writeFile(join(process.env.DSHSM_EVIDENCE_DIR,'ordinary-workflow-free.json'),JSON.stringify({status:'PASS',layer:'isolated official SDK Host with deterministic free model adapter',ids,checks:['ordinary children with exact-ID parent edges','independent human message','A bounded progress of B and C','busy next-turn queue','busy next-step insert without abort','B associated reply','A forwards result to C','C actual readonly artifact review and associated reply','full Host close/reopen relationships and cold progress cursor'],artifactSha256:hash,messages:{queued:queued.id,inserted:inserted.id,built:built.id,forward:forward.id,verdict:verdict.id},desktopNativeVerified:false,realModelCalls:0},null,2)+'\n');}
});
