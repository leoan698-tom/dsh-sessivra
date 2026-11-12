import test from 'node:test';
import assert from 'node:assert/strict';
import {host,value} from './fixture.mjs';
import {defineTool} from '@deepseek-ai/dsh-tools';
import {createUserMessage} from '@deepseek-ai/dsh-llm';
import * as Plugin from '../dist/index.js';
import {operatorAddress} from '../dist/core.js';
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Buffer} from 'node:buffer';
import {cliMarker} from '../dist/cli-mention.js';
import {LocalCli} from '../dist/local-cli.js';

test('CLI chat streams history, relays decisions and requires approval for automatic selection', async t => {
  const h = await host(undefined, {
    ...Plugin,
    apply: ctx => Plugin.apply(ctx, { externalCli: {
      codex: { executable: process.execPath, timeoutSeconds: 15 },
      grok: { executable: process.execPath, timeoutSeconds: 15, dispatchApproval: 'direct' },
    } }),
  });
  t.after(() => h.close());
  const approvalRequests = [];
  let allowAuto = false;
  h.ctx.provide('approval');
  h.ctx.set('approval', { request: async request => {
    approvalRequests.push(request);
    if (request.toolName.startsWith('自动选择')) return allowAuto ? 'allowed-once' : 'rejected';
    return request.toolName.startsWith('Codex') ? 'allowed-once' : 'rejected';
  } });
  h.ctx.provide('userQuestions');
  h.ctx.set('userQuestions', { ask: async request => ({
    answers: request.questions.map(question => ({id: question.id, selected: ['方案 B']})),
  }) });
  const fixture = `
const readline = require('node:readline');
const send = value => process.stdout.write(JSON.stringify(value) + '\\n');
const methods = readline.createInterface({input: process.stdin});
const grok = process.argv[1].endsWith('agent');
const threadId = 'fixture-thread';
const notify = (method, params) => send({method, params});
const ask = (id, method, params) => send({id, method, params});
let turnRequest;
methods.on('line', line => {
  const message = JSON.parse(line);
  const {method, id, params, result} = message;
  const respond = result => send({id, result});
  if (method === 'initialize') respond(grok ? {authMethods:[{id:'cached_token'}]} : {});
  if (method === 'thread/start' || method === 'thread/resume') respond({thread:{id:threadId}});
  if (method === 'authenticate' || method === 'session/load') respond({});
  if (method === 'session/new') respond({sessionId:threadId});
  if (method === 'turn/start') {
    respond({});
    ask('approve-codex', 'item/commandExecution/requestApproval', {threadId, command:'fixture-safe-command'});
  }
  if (id === 'approve-codex') {
    if (result.decision !== 'accept') process.exit(1);
    ask('decide-codex', 'item/tool/requestUserInput', {threadId, questions:[
      {id:'pick', question:'采用哪个方案？', options:[{label:'方案 A'}, {label:'方案 B'}]},
    ]});
  }
  if (id === 'decide-codex') {
    if (result.answers.pick.answers[0] !== '方案 B') process.exit(1);
    notify('item/agentMessage/delta', {threadId, itemId:'a', delta:'CODEX_DECISION_OK'});
    notify('turn/completed', {threadId, turn:{status:'completed'}});
  }
  if (method === 'session/prompt') {
    turnRequest = id;
    ask('approve-grok', 'session/request_permission', {sessionId:threadId, toolCall:{title:'fixture Grok tool'}, options:[
      {kind:'allow_once', optionId:'allow'}, {kind:'reject_once', optionId:'deny'},
    ]});
  }
  if (id === 'approve-grok') {
    if (result.outcome.optionId !== 'deny') process.exit(1);
    notify('session/update', {sessionId:threadId, update:{sessionUpdate:'tool_call_update', title:'Fetch releases',
      content:[{type:'content',content:{type:'text',text:'{"tarball_url":"https://api.github.com/repos/example/releases/1"}'}}]}});
    notify('session/update', {sessionId:threadId, update:{sessionUpdate:'agent_message_chunk', content:{type:'text', text:'GROK_DENY_OK'}}});
    send({id:turnRequest, result:{stopReason:'end_turn'}});
  }
});
`;
  for (const name of ['app-server','agent']) await writeFile(join(h.root,name),fixture);
  const turn = async (agent, text) => {
    agent.followup(createUserMessage({source:{kind:'user'},content:[{type:'text',text}]}));
    await agent.whenIdle();
    return agent.session.deriveMessages().filter(message=>message.role==='assistant').at(-1)
      .content.filter(part=>part.type==='text').map(part=>part.text).join('');
  };
  const {agent} = await h.create('cli-interactive');
  assert.match(await turn(agent,cliMarker('codex')+' Test the decision.'), /已允许一次[\s\S]*已回答：方案 B[\s\S]*CODEX_DECISION_OK/);
  assert.match(await turn(agent,'Continue.'), /CODEX_DECISION_OK/);
  const grok = await turn(agent,cliMarker('grok')+' Test rejection.');
  assert.match(grok, /未授权[\s\S]*GROK_DENY_OK/);
  assert.match(grok, /~{3,}json\n\{"tarball_url":"https:\/\/api.github.com\/repos\/example\/releases\/1"\}\n~{3,}\n[\s\S]*GROK_DENY_OK/);
  assert.equal(await turn(agent,cliMarker('deepseek')+' Return.'), 'Synthetic acknowledgement.');
  assert.equal(approvalRequests.length,3);
  assert.match(approvalRequests[0].reason,/fixture-safe-command/);
  h.adapter.script = async function* (options) {
    const response = options.system?.startsWith('You route a user task')
      ? '{"provider":"grok","reason":"适合横向比较"}' : 'Synthetic acknowledgement.';
    yield {type:'block-start',index:0,blockType:'text'};
    yield {type:'text-delta',index:0,text:response};
    yield {type:'block-end',index:0,block:{type:'text',text:response}};
    yield {type:'finish',reason:'stop'};
  };
  const task = '比较两种实现路线。';
  assert.match(await turn(agent,cliMarker('auto')+' '+task), /建议使用.*Grok Build[\s\S]*本轮任务未发送/);
  assert.equal(approvalRequests.length,4);
  assert.match(approvalRequests[3].reason,/适合横向比较[\s\S]*比较两种实现路线/);
  assert.equal(await turn(agent,'Remain in DSH.'), 'Synthetic acknowledgement.');
  allowAuto = true;
  assert.match(await turn(agent,cliMarker('auto')+' '+task), /已同意切换到.*Grok Build[\s\S]*GROK_DENY_OK/);
  assert.match(await turn(agent,'Continue with Grok.'), /GROK_DENY_OK/);
  assert.equal(approvalRequests.length,7);
});

test('local CLI status and login are restricted to the task panel owner', async t => {
  const h = await host();
  t.after(() => h.close());
  const invoke = (method, args, peer = h.peer) => h.ctx.typertGateway.invoke({
    namespace: 'sessivraTaskPanel', method, args, peer,
  });
  const outsider = { ...h.peer, principal: { kind: 'test-outsider' } };
  await assert.rejects(invoke('cliStatus', {}, outsider));
  await assert.rejects(invoke('refreshCliStatus', {}, outsider));
  await assert.rejects(invoke('cliLogin', { provider: 'claude' }, outsider));
  await assert.rejects(invoke('cliLogin', { provider: 'cmd.exe' }));
  const rows = await invoke('cliStatus', {});
  assert.deepEqual(rows.map(row => row.provider), ['claude', 'codex', 'grok']);
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(),
      ['auth', 'dispatchConfigured', 'installed', 'launchFailed', 'loginRunning', 'provider', 'version']);
    assert.ok(['signed-in', 'signed-out', 'unknown'].includes(row.auth));
  }
});

test('local CLI reuses stored status and distinguishes a failed probe from logout', async () => {
  let saved;
  const cli = new LocalCli({}, [], async rows => { saved = structuredClone(rows); });
  cli.detect = async provider => ({
    provider, installed: true, auth: 'signed-in', version: '1.0.0', dispatchConfigured: true,
  });
  assert.equal((await cli.status()).length, 3);
  await cli.close();
  const reopened = new LocalCli({}, saved);
  reopened.detect = async () => assert.fail('Opening with cached rows must not start a probe');
  assert.equal((await reopened.status()).find(row => row.provider === 'grok').auth, 'signed-in');
  let grokAuth = 'unknown';
  reopened.detect = async provider => ({
    ...saved.find(row => row.provider === provider),
    auth: provider === 'grok' ? grokAuth : 'signed-in',
  });
  const unverified = (await reopened.status(true)).find(row => row.provider === 'grok');
  assert.equal(unverified.auth, 'signed-in');
  assert.equal(unverified.authUnverified, true);
  grokAuth = 'signed-out';
  const signedOut = (await reopened.status(true)).find(row => row.provider === 'grok');
  assert.equal(signedOut.auth, 'signed-out');
  assert.equal(signedOut.authUnverified, undefined);
  await reopened.close();
});

test('external CLI dispatch is opt-in and requires host approval for the exact prompt', async t => {
  const name = 'sessivra_external_cli';
  const ordinary = await host();
  t.after(() => ordinary.close());
  assert.equal(ordinary.ctx.tools.get(name), undefined);

  const configured = await host(undefined, {
    ...Plugin,
    apply: ctx => Plugin.apply(ctx, { externalCli: { codex: { executable: process.execPath } } }),
  });
  t.after(() => configured.close());
  const { agent } = await configured.create('cli-task-owner');
  const request = { provider: 'codex', prompt: 'Read the project and report the test entry point.' };
  assert.match(JSON.stringify(await configured.tool(agent, name, request)), /EXTERNAL_CLI_APPROVAL_UNAVAILABLE/);
  const approvals = [];
  configured.ctx.provide('approval');
  configured.ctx.set('approval', { request: async input => { approvals.push(input); return 'denied'; } });

  assert.match(JSON.stringify(await configured.tool(agent, name, { ...request, cwd: 'forged' })), /Unrecognized key/);
  assert.match(JSON.stringify(await configured.tool(agent, name, { ...request, sessionId: '--last' })), /Invalid UUID/);
  assert.match(JSON.stringify(await configured.tool(agent, name, { ...request, provider: 'grok' })), /EXTERNAL_CLI_NOT_CONFIGURED/);
  assert.equal(approvals.length, 0);
  assert.match(JSON.stringify(await configured.tool(agent, name, request)), /EXTERNAL_CLI_APPROVAL_DENIED/);
  assert.equal(approvals.length, 1);
  assert.ok(approvals[0].reason.includes(agent.session.header.cwd));
  assert.ok(approvals[0].reason.endsWith(request.prompt));
});

test('only an explicitly configured external CLI can dispatch without a repeated approval', async t => {
  const h = await host(undefined, {
    ...Plugin,
    apply: ctx => Plugin.apply(ctx, { externalCli: {
      codex: { executable: process.execPath, dispatchApproval: 'direct' },
      claude: { executable: process.execPath },
    } }),
  });
  t.after(() => h.close());
  const { agent } = await h.create('cli-direct-owner');
  const tool = 'sessivra_external_cli';
  const prompt = 'Reply with a brief test marker.';
  // Node exits on the CLI arguments, proving dispatch reached the process without an approval service.
  const result = value(await h.tool(agent, tool, { provider: 'codex', prompt }));
  assert.equal(result.status, 'failed');
  assert.ok(result.exitCode > 0);
  assert.match(JSON.stringify(await h.tool(agent, tool, { provider: 'claude', prompt })), /EXTERNAL_CLI_APPROVAL_UNAVAILABLE/);
});

test('A composer recipient persists before an explicit A model tool call',async t=>{
  const h=await host();t.after(()=>h.close());
  const a=await h.create('synthetic-A'),b=await h.create('synthetic-B');
  const encoded=Buffer.from(JSON.stringify(b.agent.id)).toString('base64url');
  a.agent.followup(createUserMessage({source:{kind:'user'},content:[{type:'text',text:`Analyze this issue, then send the conclusion to @[B](dsh-message-target:${encoded})`}]}));
  await a.agent.whenIdle();
  const selected=value(await h.tool(a.agent,'session_message_selected_target',{}));
  assert.equal(selected.target,b.agent.id);
  assert.equal((await h.rpc('selectedFor',{sourceId:a.agent.id})).lastReceipt,null);
  assert.equal((await h.rpc('view')).state.messages && Object.keys((await h.rpc('view')).state.messages).length,0);
  const recipientMedium=JSON.parse(await readFile(join(h.root,'dsh_session_messenger_recipients.json'),'utf8'));
  assert.equal(Object.keys(recipientMedium.global.selectedRecipients).length,1);
  assert.equal((await h.rpc('selectedFor',{sourceId:a.agent.id})).permission,'granted');
  await h.rpc('authorizeSelected',{sourceId:a.agent.id,revision:selected.selectionRevision});
  assert.equal((await h.rpc('selectedFor',{sourceId:a.agent.id})).permission,'granted');
  assert.equal(Object.keys(JSON.parse(await readFile(join(h.root,'dsh_session_messenger_recipients.json'),'utf8')).global.pairGrants).length,1);
  await h.plugin.dispose();
  await h.ctx.plugin(Plugin);
  assert.equal((await h.rpc('selectedFor',{sourceId:a.agent.id})).revision,selected.selectionRevision);
  assert.equal((await h.rpc('selectedFor',{sourceId:a.agent.id})).permission,'granted');
  const receipt=value(await h.tool(a.agent,'session_message_send',{id:'a-to-b-one',target:selected.target,selectionRevision:selected.selectionRevision,text:'Synthetic analyzed conclusion'}));
  assert.equal(receipt.status,'delivered');
  await b.agent.whenIdle();
  const state=(await h.rpc('view')).state;
  assert.equal(state.messages['a-to-b-one'].origin,'agent');
  assert.equal(state.messages['a-to-b-one'].sender,a.agent.id);
  const mainMedium=JSON.parse(await readFile(join(h.root,'dsh_session_messenger.json'),'utf8'));
  assert.equal(Object.hasOwn(mainMedium.global,'selectedRecipients'),false);
  assert.equal((await h.rpc('selectedFor',{sourceId:a.agent.id})).lastReceipt.status,'claimed');
  await h.rpc('revokeSelected',{sourceId:a.agent.id,revision:selected.selectionRevision});
  assert.equal((await h.rpc('selectedFor',{sourceId:a.agent.id})).permission,'needsConsent');
});
test('actual isolated Host registers plugin, strict settings RPC and two independent roots',async t=>{
  const h=await host();t.after(()=>h.close());const a=await h.create('synthetic-alpha'),b=await h.create('synthetic-beta');
  assert.equal(h.ctx.agents.roots().length,2);
  assert.equal((await h.rpc('view')).directory.length,2);
  await h.rpc('policy',{id:b.agent.id,input:{mode:'accept',senders:[a.agent.id],crossWorkspace:false,alias:'B'}});
  const result=value(await h.tool(a.agent,'session_message_send',{id:'host-one',target:b.agent.id,text:'Synthetic hello'}));
  assert.equal(result.status,'delivered');await b.agent.whenIdle();
  assert.equal(h.adapter.calls.length,1);
  const forwarded=h.adapter.calls[0].messages.find(m=>m.source?.kind==='plugin:dsh-session-messenger');
  assert.equal(forwarded.source.kind,'plugin:dsh-session-messenger');assert.equal(Object.hasOwn(forwarded.source,'plugin'),false);assert.match(forwarded.content[0].text,/sender="synthetic-alpha"/);
  const duplicate=value(await h.tool(a.agent,'session_message_send',{id:'host-one',target:b.agent.id,text:'Synthetic hello'}));assert.ok(['delivered','claimed'].includes(duplicate.status));assert.equal(h.adapter.calls.length,1);
  const fake=value(await h.tool(a.agent,'session_message_send',{target:b.agent.id,text:'Synthetic spoof',sender:'forged'}));assert.equal(fake.sender,a.agent.id);await b.agent.whenIdle();
  const ack=value(await h.tool(b.agent,'session_message_ack',{id:'host-one'}));assert.equal(ack.status,'processed');
  await b.dispose();assert.equal((await h.rpc('release',{id:'host-one'})).status,'processed');
});
test('operator RPC sends with its own identity and model reply stays in plugin conversation',async t=>{
  const h=await host();t.after(()=>h.close());const a=await h.create('synthetic-operator-source'),b=await h.create('synthetic-operator-target');
  const actor=operatorAddress(a.agent.id);
  const directory=(await h.rpc('view')).directory;
  assert.equal(directory.length,2);assert.ok(directory.every(r=>typeof r.workspace==='string'));
  await h.rpc('policy',{id:b.agent.id,input:{mode:'accept',senders:[],operatorSources:[a.agent.id],crossWorkspace:false,alias:'Target'}});
  const sent=await h.rpc('sendOperator',{sourceId:a.agent.id,input:{target:b.agent.id,text:'Synthetic operator request',id:'operator-host-one'}});
  assert.equal(sent.sender,actor);assert.equal(sent.status,'delivered');
  await b.agent.whenIdle();assert.equal(h.adapter.calls.length,1);
  const input=h.adapter.calls[0].messages.find(m=>m.source?.kind==='plugin:dsh-session-messenger');
  assert.equal(input.source.actor,'operator');assert.equal(input.source.sender,actor);
  assert.match(input.content[0].text,/untrusted operator text/);assert.match(input.content[0].text,/sender="operator:/);
  const reply=value(await h.tool(b.agent,'session_message_reply',{replyTo:'operator-host-one',text:'Synthetic reply',id:'operator-host-reply'}));
  assert.equal(reply.status,'received');assert.equal(h.adapter.calls.length,1);
  const conversation=await h.rpc('conversation',{sourceId:a.agent.id,targetId:b.agent.id});
  assert.equal(conversation.length,2);assert.equal(conversation[1].text,'Synthetic reply');assert.equal(conversation[1].replyTo,'operator-host-one');
  assert.equal((await h.rpc('view')).state.messages['operator-host-reply'].text,'[omitted]');
});
test('operator permission cannot be used by a colliding real root ID on discovery, send, reply or status',async t=>{
  const h=await host();t.after(()=>h.close());
  const a=await h.create('synthetic-a'),b=await h.create('synthetic-b'),collision=await h.create('operator:synthetic-a');
  const actor=operatorAddress(a.agent.id);
  await h.rpc('policy',{id:b.agent.id,input:{mode:'hold',senders:[],operatorSources:[a.agent.id],crossWorkspace:false,alias:''}});
  assert.deepEqual(value(await h.tool(collision.agent,'session_message_directory',{})),[]);
  const operator=await h.rpc('sendOperator',{sourceId:a.agent.id,input:{target:b.agent.id,text:'Synthetic operator',id:'typed-operator'}});
  assert.equal(operator.status,'queued');
  assert.equal((await h.tool(collision.agent,'session_message_send',{target:b.agent.id,text:'Synthetic operator',id:'typed-operator'})).isError,true);
  assert.equal(h.adapter.calls.length,0);
  assert.equal(value(await h.tool(collision.agent,'session_message_send',{target:b.agent.id,text:'Synthetic spoof',id:'typed-spoof'})).reason,'SENDER_NOT_ALLOWED');
  assert.equal((await h.tool(collision.agent,'session_message_status',{id:'typed-operator'})).isError,true);
  await h.rpc('policy',{id:b.agent.id,input:{mode:'accept',senders:[],operatorSources:[a.agent.id],crossWorkspace:false,alias:''}});
  assert.equal((await h.rpc('release',{id:'typed-operator'})).status,'delivered');await b.agent.whenIdle();
  const reply=value(await h.tool(b.agent,'session_message_reply',{replyTo:'typed-operator',text:'Synthetic answer',id:'typed-reply'}));
  assert.equal(reply.status,'received');assert.equal(h.adapter.calls.length,1);
  assert.equal(value(await h.tool(b.agent,'session_message_reply',{replyTo:'typed-operator',text:'Synthetic answer',id:'typed-reply'})).status,'received');
  assert.equal((await h.tool(collision.agent,'session_message_send',{target:actor,text:'Synthetic answer',replyTo:'typed-operator',id:'typed-reply'})).isError,true);
  assert.equal((await h.tool(a.agent,'session_message_send',{target:actor,text:'Synthetic answer',replyTo:'typed-operator',id:'typed-reply'})).isError,true);
  assert.equal(h.adapter.calls.length,1);
  assert.equal((await h.tool(collision.agent,'session_message_status',{id:'typed-reply'})).isError,true);
  assert.equal((await h.rpc('conversation',{sourceId:a.agent.id,targetId:b.agent.id})).length,2);
  await h.rpc('policy',{id:b.agent.id,input:{mode:'accept',senders:[collision.agent.id],operatorSources:[],crossWorkspace:false,alias:''}});
  assert.equal(value(await h.tool(collision.agent,'session_message_directory',{}))[0].id,b.agent.id);
  assert.equal(value(await h.tool(collision.agent,'session_message_send',{target:b.agent.id,text:'Legitimate model root',id:'typed-agent'})).status,'delivered');
  assert.ok(['delivered','claimed'].includes(value(await h.tool(collision.agent,'session_message_send',{target:b.agent.id,text:'Legitimate model root',id:'typed-agent'})).status));
  assert.equal((await h.rpc('sendOperator',{sourceId:a.agent.id,input:{target:b.agent.id,text:'No operator permission',id:'typed-operator-denied'}})).reason,'OPERATOR_NOT_ALLOWED');
});
test('official Host stable IDs with colon, Chinese, spaces and prototype keys remain selectable',async t=>{
  const h=await host();t.after(()=>h.close());
  const a=await h.create('synthetic:来源'),b=await h.create('中文 目标'),prototype=await h.create('__proto__');
  const directory=(await h.rpc('view')).directory;
  for(const id of [a.agent.id,b.agent.id,prototype.agent.id]) assert.ok(directory.some(entry=>entry.id===id));
  await h.rpc('policy',{id:b.agent.id,input:{mode:'accept',senders:[],operatorSources:[a.agent.id],crossWorkspace:false,alias:''}});
  assert.equal((await h.rpc('sendOperator',{sourceId:a.agent.id,input:{target:b.agent.id,text:'Synthetic Unicode',id:'unicode-one'}})).status,'delivered');
  await b.agent.whenIdle();
  assert.equal((await h.rpc('conversation',{sourceId:a.agent.id,targetId:b.agent.id}))[0].id,'unicode-one');
  await h.rpc('policy',{id:prototype.agent.id,input:{mode:'accept',senders:[],operatorSources:[a.agent.id],crossWorkspace:false,alias:'Prototype key'}});
  assert.equal((await h.rpc('sendOperator',{sourceId:a.agent.id,input:{target:prototype.agent.id,text:'Synthetic prototype',id:'prototype-one'}})).status,'delivered');
  await prototype.agent.whenIdle();
  assert.equal((await h.rpc('view')).directory.find(entry=>entry.id==='__proto__').alias,'Prototype key');
});
test('busy root finishes its tool before consuming steer; no tool abort or extra turn',async t=>{
  const h=await host();t.after(()=>h.close());const a=await h.create('synthetic-busy-a'),b=await h.create('synthetic-busy-b');
  await h.rpc('policy',{id:b.agent.id,input:{mode:'accept',senders:[a.agent.id],crossWorkspace:false,alias:''}});
  const entered=Promise.withResolvers(),release=Promise.withResolvers();let toolSignal;
  h.ctx.tools.register(defineTool({name:'synthetic_wait',description:'Synthetic gated test tool',parameters:{},output:{schema:{type:'string'},render:(_a,v)=>[{type:'text',text:v}]},execute:async(_args,exec)=>{toolSignal=exec.signal;entered.resolve();await release.promise;return 'Synthetic tool finished';}}));
  h.adapter.script=async function*(options){
    if(h.adapter.calls.length===1){yield{type:'block-start',index:0,blockType:'tool-call'};yield{type:'tool-call-delta',index:0,id:'synthetic-call',name:'synthetic_wait',argumentsDelta:'{}'};yield{type:'block-end',index:0,block:{type:'tool-call',id:'synthetic-call',name:'synthetic_wait',arguments:'{}'}};yield{type:'finish',reason:'tool-calls'};}
    else {assert.ok(options.messages.some(m=>m.source?.plugin==='dsh-session-messenger'));yield{type:'finish',reason:'stop'};}
  };
  b.agent.followup(createUserMessage({source:{kind:'user'},content:[{type:'text',text:'Synthetic begin tool'}]}));
  await entered.promise;
  const sent=value(await h.tool(a.agent,'session_message_send',{id:'busy-message',target:b.agent.id,text:'Synthetic steering'}));assert.equal(sent.status,'delivered');
  assert.equal(toolSignal.aborted,false);assert.equal(h.adapter.calls.length,1);assert.equal(b.agent.inbox.nextStep.length,1);
  release.resolve();await b.agent.whenIdle();assert.equal(toolSignal.aborted,false);assert.equal(h.adapter.calls.length,2);
  assert.equal(b.agent.session.snapshotEvents().filter(e=>e.type==='turn/start').length,1);
});
test('real disk domain closes/reopens with held queue; TTL and explicit release do not auto wake',async t=>{
  const h=await host();t.after(()=>h.close());const a=await h.create('synthetic-recovery-a'),b=await h.create('synthetic-recovery-b');
  await h.rpc('policy',{id:b.agent.id,input:{mode:'hold',senders:[a.agent.id],crossWorkspace:false,alias:''}});
  value(await h.tool(a.agent,'session_message_send',{id:'recover-held',target:b.agent.id,text:'Synthetic saved queue'}));
  const disk=JSON.parse(await readFile(join(h.root,'dsh_session_messenger.json'),'utf8'));assert.ok(JSON.stringify(disk).includes('recover-held'));
  await h.plugin.dispose();await h.ctx.plugin(Plugin);assert.equal((await h.rpc('view')).state.messages['recover-held'].status,'queued');assert.equal(h.adapter.calls.length,0);
  await h.rpc('policy',{id:b.agent.id,input:{mode:'accept',senders:[a.agent.id],crossWorkspace:false,alias:''}});await h.rpc('release',{id:'recover-held'});await b.agent.whenIdle();assert.equal(h.adapter.calls.length,1);
});
test('real cross-workspace default denial, explicit grant, reply limits, unauthorized status',async t=>{
  const h=await host();t.after(()=>h.close());const a=await h.create('synthetic-cross-a'),b=await h.create('synthetic-cross-b',join(h.root,'other')),c=await h.create('synthetic-unrelated');
  await h.rpc('policy',{id:b.agent.id,input:{mode:'accept',senders:[a.agent.id],crossWorkspace:false,alias:''}});
  assert.equal(value(await h.tool(a.agent,'session_message_send',{id:'cross-denied',target:b.agent.id,text:'Synthetic'})).reason,'CROSS_WORKSPACE_DENIED');assert.equal(h.adapter.calls.length,0);
  await h.rpc('policy',{id:b.agent.id,input:{mode:'accept',senders:[a.agent.id],crossWorkspace:true,alias:''}});
  await h.rpc('policy',{id:a.agent.id,input:{mode:'accept',senders:[b.agent.id],crossWorkspace:true,alias:''}});
  value(await h.tool(a.agent,'session_message_send',{id:'cross-allowed',target:b.agent.id,text:'Synthetic'}));await b.agent.whenIdle();
  assert.equal((await h.tool(c.agent,'session_message_status',{id:'cross-allowed'})).isError,true);
  assert.equal((await h.tool(b.agent,'session_message_send',{target:a.agent.id,text:'Synthetic new loop'})).isError,true);
  value(await h.tool(b.agent,'session_message_reply',{id:'r1',replyTo:'cross-allowed',text:'Synthetic reply'}));await a.agent.whenIdle();
  value(await h.tool(a.agent,'session_message_reply',{id:'r2',replyTo:'r1',text:'Synthetic reply'}));await b.agent.whenIdle();
  assert.equal((await h.tool(b.agent,'session_message_reply',{replyTo:'r2',text:'Synthetic loop beyond bound'})).isError,true);
});
test('actual hold/refuse do not invoke model; cross workspace and closed target fail',async t=>{
  const h=await host();t.after(()=>h.close());const a=await h.create('synthetic-a'),b=await h.create('synthetic-b');
  assert.equal(value(await h.tool(a.agent,'session_message_send',{id:'refuse',target:b.agent.id,text:'Synthetic'})).status,'failed');
  await h.rpc('policy',{id:b.agent.id,input:{mode:'hold',senders:[a.agent.id],crossWorkspace:false,alias:''}});
  assert.equal(value(await h.tool(a.agent,'session_message_send',{id:'held',target:b.agent.id,text:'Synthetic'})).status,'queued');assert.equal(h.adapter.calls.length,0);
  await b.dispose();assert.equal((await h.rpc('release',{id:'held'})).status,'failed');assert.equal(h.adapter.calls.length,0);
});
test('real held TTL expiry and strict RPC rejects permission-shaped extra fields',async t=>{
  const h=await host();t.after(()=>h.close());const a=await h.create('synthetic-ttl-a'),b=await h.create('synthetic-ttl-b');
  await assert.rejects(h.rpc('policy',{id:b.agent.id,input:{mode:'accept',senders:[a.agent.id],crossWorkspace:false,alias:'',permissions:'full'}}));
  await h.rpc('policy',{id:b.agent.id,input:{mode:'hold',senders:[a.agent.id],crossWorkspace:false,alias:''}});
  value(await h.tool(a.agent,'session_message_send',{id:'real-ttl',target:b.agent.id,text:'Synthetic expiry',ttl:1}));
  await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal((await h.rpc('view')).state.messages['real-ttl'].status,'expired');assert.equal(h.adapter.calls.length,0);
  assert.equal((await h.rpc('release',{id:'real-ttl'})).status,'expired');assert.equal(h.adapter.calls.length,0);
});
test('real model directory is opt-in and cross-workspace delivery needs bilateral consent',async t=>{
  const h=await host();t.after(()=>h.close());const a=await h.create('synthetic-discovery-a'),b=await h.create('synthetic-discovery-b',join(h.root,'other'));
  assert.deepEqual(value(await h.tool(a.agent,'session_message_directory',{})),[]);assert.equal((await h.rpc('view')).directory.length,2);
  await h.rpc('policy',{id:b.agent.id,input:{mode:'accept',senders:[a.agent.id],crossWorkspace:true,alias:'private until authorized'}});
  assert.deepEqual(value(await h.tool(a.agent,'session_message_directory',{})),[]);
  assert.equal(value(await h.tool(a.agent,'session_message_send',{id:'one-sided',target:b.agent.id,text:'Synthetic'})).reason,'CROSS_WORKSPACE_DENIED');assert.equal(h.adapter.calls.length,0);
  await h.rpc('policy',{id:a.agent.id,input:{mode:'refuse',senders:[],crossWorkspace:true,alias:''}});
  const directory=value(await h.tool(a.agent,'session_message_directory',{}));assert.deepEqual(directory.map(r=>r.id),[b.agent.id]);
  assert.deepEqual(value(await h.tool(b.agent,'session_message_directory',{})),[]);
  assert.equal(value(await h.tool(a.agent,'session_message_send',{id:'bilateral',target:b.agent.id,text:'Synthetic'})).status,'delivered');await b.agent.whenIdle();assert.equal(h.adapter.calls.length,1);
});
