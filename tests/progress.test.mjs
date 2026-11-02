import test from 'node:test';
import assert from 'node:assert/strict';
import LocalFs from '@deepseek-ai/dsh-fs-local';
import WorkingDirectory from '@deepseek-ai/dsh-working-directory';
import * as Persistence from '@deepseek-ai/dsh-session-persistence-jsonl';
import Query from '@deepseek-ai/dsh-session-query';
import {join} from 'node:path';
import {createUserMessage} from '@deepseek-ai/dsh-llm';
import {progressEvent,ProgressReader} from '../dist/progress.js';
import {host,value,productUnderTest} from './fixture.mjs';

async function prepared(t){const h=await host();t.after(()=>h.close());for(const p of [LocalFs,WorkingDirectory])await h.ctx.plugin(p);await h.ctx.plugin(Persistence,{root:join(h.root,'sessions')});await h.ctx.plugin(Query);return h;}

test('bounded progress is exact-ID, read-only, incremental and does not claim business completion',async t=>{
  const h=await prepared(t),a=await h.create('progress-A');
  const created=value(await h.tool(a.agent,'session_create_child',{requestId:'progress-B',label:'Duplicate',prompt:'Task B'}));
  const other=value(await h.tool(a.agent,'session_create_child',{requestId:'progress-C',label:'Duplicate',prompt:'Task C'}));
  const b=h.ctx.agents.get(created.id);await b.whenIdle();await h.ctx.agents.get(other.id).whenIdle();
  const before=h.ctx.sessionMessenger.messenger.snapshot(true),calls=h.adapter.calls.length;
  const report=value(await h.tool(a.agent,'session_progress',{target:b.id,limit:24}));
  assert.equal(report.target,b.id);assert.equal(report.runtime.status,'idle');assert.equal(report.businessCompletion,'unknown');assert.equal(report.waitingForUser.state,'unknown');
  assert.ok(report.events.length<=24);assert.ok(report.events.every(event=>!Object.hasOwn(event,'arguments')));assert.ok(Buffer.byteLength(JSON.stringify(report))<=16384);
  assert.equal(h.adapter.calls.length,calls);assert.deepEqual(h.ctx.sessionMessenger.messenger.snapshot(true),before);
  const unchanged=value(await h.tool(a.agent,'session_progress',{target:b.id,after:report.nextCursor}));
  assert.deepEqual(unchanged.events,[]);assert.equal(unchanged.coverage.hasMore,false);
  b.followup(createUserMessage({source:{kind:'user'},content:[{type:'text',text:'A later human task'}]}));await b.whenIdle();
  const delta=value(await h.tool(a.agent,'session_progress',{target:b.id,after:report.nextCursor,limit:24}));
  assert.ok(delta.events.length>0);assert.ok(delta.events.every(event=>event.seq>report.coverage.toSeq));
  const wrong=await h.tool(a.agent,'session_progress',{target:other.id,after:report.nextCursor});assert.equal(wrong.isError,true);assert.match(wrong.error.message,/CURSOR_SCOPE/);
  await h.plugin.dispose();await h.ctx.plugin(productUnderTest);
  const restored=value(await h.tool(a.agent,'session_progress',{target:b.id,after:delta.nextCursor}));assert.deepEqual(restored.events,[]);
});

test('denied progress never reads a body, creates a grant, activates or calls a model',async t=>{
  const h=await prepared(t),a=await h.create('denied-A'),b=await h.create('denied-B');
  let bodies=0;const original=h.ctx.sessionQuery.observeSession.bind(h.ctx.sessionQuery);h.ctx.sessionQuery.observeSession=async(...args)=>{bodies++;return original(...args);};
  const before=h.ctx.sessionMessenger.messenger.snapshot(true);
  const denied=await h.tool(a.agent,'session_progress',{target:b.agent.id});assert.equal(denied.isError,true);assert.match(denied.error.message,/PROGRESS_DENIED/);
  assert.equal(bodies,0);assert.equal(h.adapter.calls.length,0);assert.deepEqual(h.ctx.sessionMessenger.messenger.snapshot(true),before);
  await h.rpc('selectRecipient',{sourceId:a.agent.id,targetId:b.agent.id,label:'B'});
  const selected=await h.rpc('selectedFor',{sourceId:a.agent.id});await h.rpc('revokeSelected',{sourceId:a.agent.id,revision:selected.revision});
  const revoked=await h.tool(a.agent,'session_progress',{target:b.agent.id});assert.equal(revoked.isError,true);assert.equal(bodies,0);
});

test('event projection excludes raw headers, tool arguments, output, metadata and reasoning',()=>{
  const base={seq:1,time:2};
  const samples=[{...base,type:'tool/call',data:{name:'command',callId:'call',arguments:'RAW_SECRET'}},{...base,type:'tool/result',data:{message:{isError:true,toolCallId:'call',content:[{type:'text',text:'RAW_SECRET'}]},meta:{key:'RAW_SECRET'},error:{code:'E_TEST',reason:'RAW_SECRET'}}},{...base,type:'request/header',data:{header:{config:{provider:'fixture',model:'free',reasoningEffort:'high',apiKey:'RAW_SECRET'},tools:['RAW_SECRET']}}},{...base,type:'assistant/attempt',data:{reasoning:'RAW_SECRET'}}];
  for(const sample of samples)assert.equal(JSON.stringify(progressEvent(sample)).includes('RAW_SECRET'),false);
});

test('cold observation and cursor survive close/reopen without resuming a target',async t=>{
  const h=await prepared(t),a=await h.create('cold-progress-A'),b=await h.create('cold-progress-B');
  await h.rpc('selectRecipient',{sourceId:a.agent.id,targetId:b.agent.id,label:'B'});
  b.agent.followup(createUserMessage({source:{kind:'user'},content:[{type:'text',text:'Free cold progress'}]}));await b.agent.whenIdle();
  const first=value(await h.tool(a.agent,'session_progress',{target:b.agent.id,limit:24}));
  await b.dispose();const calls=h.adapter.calls.length;
  const roots=h.ctx.agents.roots().map(agent=>agent.id);
  const cold=value(await h.tool(a.agent,'session_progress',{target:b.agent.id,after:first.nextCursor}));
  assert.equal(cold.runtime.status,'cold');assert.equal(cold.source.availability,'prepared');assert.deepEqual(cold.events,[]);assert.equal(h.adapter.calls.length,calls);assert.deepEqual(h.ctx.agents.roots().map(agent=>agent.id),roots);
});

test('explicit failed turn is observable without treating idle as success',async t=>{
  const h=await prepared(t),a=await h.create('failure-A'),b=await h.create('failure-B');
  await h.rpc('selectRecipient',{sourceId:a.agent.id,targetId:b.agent.id,label:'B'});
  h.adapter.script=async function*(){throw new Error('FREE_MODEL_FIXTURE_FAILURE');};
  b.agent.followup(createUserMessage({source:{kind:'user'},content:[{type:'text',text:'Free failure case'}]}));await b.agent.whenIdle();
  const report=value(await h.tool(a.agent,'session_progress',{target:b.agent.id,limit:24}));
  assert.equal(report.runtime.status,'idle');assert.equal(report.businessCompletion,'unknown');assert.ok(report.events.some(event=>event.type==='turn/end'&&event.outcome==='error'));assert.equal(JSON.stringify(report).includes('FREE_MODEL_FIXTURE_FAILURE'),false,'raw errors are omitted');
});

test('old cursor gaps are explicit, envelopes are bounded, and cancellation is honored',async t=>{
  const h=await prepared(t),a=await h.create('gap-A'),b=await h.create('gap-B');await h.rpc('selectRecipient',{sourceId:a.agent.id,targetId:b.agent.id,label:'B'});
  await assert.rejects(new ProgressReader(h.ctx,h.ctx.sessionMessenger.messenger).read(a.agent,{target:b.agent.id,limit:24},AbortSignal.abort()),/abort/i);
  const first=value(await h.tool(a.agent,'session_progress',{target:b.agent.id,limit:24}));
  for(let i=0;i<140;i++) b.agent.session.append('model/selection',{provider:'synthetic-free',model:'fixture',reasoningEffort:'high'});
  const delta=value(await h.tool(a.agent,'session_progress',{target:b.agent.id,after:first.nextCursor,limit:24}));
  assert.ok(delta.coverage.skippedSinceCursor>0);assert.equal(delta.coverage.hasMore,true);assert.ok(delta.events.length<=24);assert.ok(Buffer.byteLength(JSON.stringify(delta))<=16384);assert.equal(h.adapter.calls.length,0);
  const changed=JSON.parse(Buffer.from(delta.nextCursor,'base64url'));changed.seq=999999;
  const invalid=await h.tool(a.agent,'session_progress',{target:b.agent.id,after:Buffer.from(JSON.stringify(changed)).toString('base64url')});assert.equal(invalid.isError,true);assert.match(invalid.error.message,/CURSOR_LOG_CHANGED/);
});

test('revocation during an asynchronous progress read prevents the result from escaping',async t=>{
  const h=await prepared(t),a=await h.create('race-A'),b=await h.create('race-B');await h.rpc('selectRecipient',{sourceId:a.agent.id,targetId:b.agent.id,label:'B'});
  const selected=await h.rpc('selectedFor',{sourceId:a.agent.id});
  const original=h.ctx.sessionQuery.observeSession.bind(h.ctx.sessionQuery);h.ctx.sessionQuery.observeSession=async(...args)=>{const observation=await original(...args);await h.rpc('revokeSelected',{sourceId:a.agent.id,revision:selected.revision});return observation;};
  const result=await h.tool(a.agent,'session_progress',{target:b.agent.id});assert.equal(result.isError,true);assert.match(result.error.message,/PROGRESS_DENIED/);assert.equal(h.adapter.calls.length,0);
});
