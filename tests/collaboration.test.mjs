import test from 'node:test';
import assert from 'node:assert/strict';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { defineTool } from '@deepseek-ai/dsh-tools';
import LocalFs from '@deepseek-ai/dsh-fs-local';
import WorkingDirectory from '@deepseek-ai/dsh-working-directory';
import * as Persistence from '@deepseek-ai/dsh-session-persistence-jsonl';
import Query from '@deepseek-ai/dsh-session-query';
import { join } from 'node:path';
import { host, value } from './fixture.mjs';
import * as Plugin from '../dist/index.js';
import { Messenger, emptyState } from '../dist/core.js';
import { sessionForest } from '../dist/session-tree.js';

test('switching recipients retains earlier user intent; AI chooses queue/insert per message without another user action', async () => {
  let state = emptyState();
  const calls = [];
  const roots = ['A', 'B', 'C'].map(id => ({ id, status: 'running', session: { header: { cwd: '/test' } }, followup: () => calls.push([id, 'queue']), steer: () => calls.push([id, 'insert']) }));
  const messenger = new Messenger({ roots: () => roots, get: id => roots.find(root => root.id === id) }, { read: () => state, write: async next => { state = structuredClone(next); } });
  const [a] = roots;
  const selected = await messenger.selectRecipient(a, 'B', 'B');
  assert.equal(messenger.selectedFor('A').permission, 'granted');
  await messenger.send(a, { text: 'wait', selectionRevision: selected.revision });
  assert.deepEqual(calls, [['B', 'queue']]);
  await messenger.send(a, { id: 'adjust', text: 'now', selectionRevision: selected.revision, deliveryMode: 'insert' });
  await assert.rejects(messenger.send(a, { id: 'adjust', text: 'now', selectionRevision: selected.revision, deliveryMode: 'queue' }), /ID_CONFLICT/);
  await assert.rejects(messenger.send(a, { text: 'bad mode', selectionRevision: selected.revision, deliveryMode: 'invalid' }), /INVALID_DELIVERY_MODE/);
  const legacy = await messenger.setDeliveryMode('A', selected.revision, 'insert');
  await messenger.send(a, { text: 'default remains queue despite old UI preference', selectionRevision: legacy.revision });
  assert.deepEqual(calls[2], ['B', 'queue']);
  assert.deepEqual(calls[1], ['B', 'insert']);
  await messenger.selectRecipient(a, 'C', 'C');
  await messenger.selectRecipient(a, 'B', 'B');
  assert.equal(messenger.selectedFor('A').permission, 'granted');
  assert.equal(Object.keys(state.pairGrants).length, 2);
});

for (const deliveryMode of ['queue', 'insert']) test(`AI-chosen ${deliveryMode} reaches the real busy AgentLoop without cancellation`, { timeout: 10000 }, async t => {
  const h = await host(); t.after(() => h.close());
  const a = await h.create('queue-A'), b = await h.create('queue-B');
  const entered = Promise.withResolvers(), release = Promise.withResolvers();
  let toolSignal;
  t.after(() => release.resolve());
  h.ctx.tools.register(defineTool({ name: 'test_gate', description: 'Free test gate', parameters: {}, output: { schema: {type:'string'}, render: () => [] }, execute: async (_args, exec) => { toolSignal = exec.signal; entered.resolve(); await release.promise; return 'finished'; } }));
  h.adapter.script = async function* () {
    if (h.adapter.calls.length === 1) {
      yield { type: 'block-start', index: 0, blockType: 'tool-call' };
      yield { type: 'tool-call-delta', index: 0, id: 'gate', name: 'test_gate', argumentsDelta: '{}' };
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: 'gate', name: 'test_gate', arguments: '{}' } };
      yield { type: 'finish', reason: 'tool-calls' };
    } else yield { type: 'finish', reason: 'stop' };
  };
  b.agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'current task' }] }));
  await entered.promise;
  await h.rpc('selectRecipient', { sourceId: a.agent.id, targetId: b.agent.id, label: 'B' });
  const selected = value(await h.tool(a.agent, 'session_message_selected_target', {}));
  const receipt = value(await h.tool(a.agent, 'session_message_send', { text: 'next task', deliveryMode, selectionRevision: selected.selectionRevision }));
  assert.equal(receipt.deliveryMode, deliveryMode);
  assert.equal(selected.targetStatus, 'running');
  assert.equal(selected.deliveryMode, undefined);
  assert.equal(b.agent.inbox.nextTurn.length, deliveryMode === 'queue' ? 1 : 0);
  assert.equal(b.agent.inbox.nextStep.length, deliveryMode === 'insert' ? 1 : 0);
  assert.equal(toolSignal.aborted, false);
  release.resolve(); await b.agent.whenIdle();
  assert.equal(b.agent.session.snapshotEvents().filter(event => event.type === 'turn/start').length, deliveryMode === 'queue' ? 2 : 1);
  assert.equal((await h.rpc('view')).state.messages[receipt.id].status, 'claimed');
});

test('child is an ordinary conversation, never a subagent; relation survives plugin reopen', { timeout: 10000 }, async t => {
  const h = await host(); t.after(() => h.close());
  for (const plugin of [LocalFs, WorkingDirectory]) await h.ctx.plugin(plugin);
  await h.ctx.plugin(Persistence, { root: join(h.root, 'sessions') });
  await h.ctx.plugin(Query);
  const a = await h.create('conversation-parent-A');
  const created = value(await h.tool(a.agent, 'session_create_child', { label: 'Ordinary child conversation', prompt: 'Free synthetic task' }));
  assert.equal(created.kind, 'conversation');
  assert.equal(created.parentId, a.agent.id);
  const child = h.ctx.agents.get(created.id);
  assert.ok(child);
  assert.equal(child.session.header.origin, undefined);
  assert.ok(h.ctx.agents.roots().includes(child));
  assert.equal(child.session.header.isSeeded, false);
  assert.equal(h.ctx.get('subagents'), undefined, 'creation requires no subagent service');
  await child.whenIdle();
  const unrelated = await h.create('unrelated-conversation');
  await h.ctx.agents.create({ sessionId: 'hidden-worker', parentAgent: a.agent, agentOptions: { provider:'synthetic-free',model:'fixture' }, meta: { cwd:h.root,parentSession:a.agent.id,origin:'subagent',delegationDepth:1 } });
  const treeRead = () => h.ctx.typertGateway.invoke({ namespace:'sessionCollaboration',method:'tree',args:{},peer:h.peer });
  const tree = await treeRead();
  assert.equal(tree.find(row => row.id === child.id).parentId, a.agent.id);
  assert.equal(tree.find(row => row.id === child.id).label, 'Ordinary child conversation');
  assert.equal(tree.find(row => row.id === 'hidden-worker').openable, false,'an unavailable descriptor stays visible without a fabricated navigation path');
  assert.equal(tree.find(row => row.id === unrelated.agent.id).parentId, undefined);
  const candidates = await h.ctx.typertGateway.invoke({ namespace:'sessionCollaboration',method:'candidates',args:{sourceId:a.agent.id,query:''},peer:h.peer });
  assert.ok(candidates.some(row => row.sessionId === child.id && row.displayTitle === 'Ordinary child conversation'));
  assert.ok(candidates.some(row => row.sessionId === unrelated.agent.id));
  assert.equal(candidates.some(row => row.sessionId === a.agent.id || row.sessionId === 'hidden-worker'),false);
  const reply = value(await h.tool(child,'session_message_reply',{replyTo:created.messageId,text:'Child conversation result'}));
  await a.agent.whenIdle();
  assert.equal(reply.target,a.agent.id);
  await h.plugin.dispose(); await h.ctx.plugin(Plugin);
  const restored = await treeRead();
  assert.equal(restored.find(row => row.id === child.id).parentId,a.agent.id);
  assert.equal(restored.find(row => row.id === 'hidden-worker').canMessage,false);
  assert.equal(value(await h.tool(a.agent,'session_message_selected_target',{})).target,child.id);
});

test('tree reconstructs real parent edges and contains corrupt cycles without recursion', () => {
  const row = (id, parentId) => ({ id, parentId, label: id, workspace: '/test', running: false, subagent: false });
  const forest = sessionForest([row('A'), row('B', 'A'), row('C', 'B')]);
  assert.equal(forest[0].children[0].children[0].id, 'C');
  assert.equal(sessionForest([row('A','B'), row('B','A')]).length, 2);
  assert.equal(sessionForest([row('A'), {...row('worker','A'),subagent:true}]).length,1);
  assert.equal(sessionForest([row('A'), {...row('worker','A'),subagent:true}])[0].children.length,0);
  const teammate={...row('member','A'),subagent:true,subagentKind:'teammate',teammateName:'reviewer'};
  assert.equal(sessionForest([row('A'),teammate])[0].children[0].id,'member');
  assert.equal(sessionForest([teammate]).length,0,'a Team member never becomes a standalone root');
  const outside={...row('outside','A'),subagent:true,subagentKind:'standalone'};
  assert.equal(sessionForest([row('A'),teammate,outside])[0].children.length,2);
  assert.equal(sessionForest([outside]).length,0,'an outside-Team subagent never becomes a standalone root');
});

test('tree distinguishes Team and outside-Team children and offers them only to their own parent', async t => {
  const h=await host();t.after(()=>h.close());
  const member=(id,phase='active')=>({id,name:id,role:'teammate',phase});
  const child=(sessionId,parentSessionId='lead',mode='continuable')=>({sessionId,parentSessionId,cwd:h.root,running:false,origin:'subagent',projections:{values:{subagent:{mode,label:`Role of ${sessionId}`}}}});
  const items=[
    {sessionId:'lead',cwd:h.root,running:false,projections:{values:{title:'商管主会话',agentTeam:{members:[member('db-engineer'),member('reviewer'),member('foreign'),member('failed','failed'),member('starting','provisioning'),member('one-shot'),member('archived'),member('missing'),member('ordinary-child')],tasks:[]}}}},
    {sessionId:'ordinary-child',cwd:h.root,running:false},
    child('db-engineer'),{...child('reviewer'),running:true},child('unregistered-worker'),
    child('foreign','another-lead'),child('failed'),child('starting'),child('one-shot','lead','one-shot'),child('archived'),
  ];
  h.ctx.provide('sessionController',{list:async()=>({items}),resolveAgent:()=>{throw Error('TREE_MUST_NOT_ACTIVATE');}});
  h.ctx.provide('workspaceRegistry',{archivedSessionIds:['archived']});
  const tree=await h.ctx.typertGateway.invoke({namespace:'sessionCollaboration',method:'tree',args:{},peer:h.peer});
  assert.deepEqual(tree.map(x=>x.id),['lead','ordinary-child','db-engineer','reviewer','failed','starting','one-shot','missing','unregistered-worker']);
  const team=tree.filter(x=>x.subagentKind==='teammate');
  assert.ok(team.every(x=>x.parentId==='lead'));
  assert.equal(team[0].label,'db-engineer');
  assert.equal(team[0].description,'Role of db-engineer');
  assert.equal(team[1].running,true);
  assert.equal(tree.find(x=>x.id==='failed').note,'创建失败');
  assert.equal(tree.find(x=>x.id==='starting').note,'创建中');
  assert.equal(tree.find(x=>x.id==='missing').openable,false);
  assert.equal(tree.find(x=>x.id==='one-shot').subagentMode,'one-shot');
  assert.equal(tree.find(x=>x.id==='one-shot').canMessage,false);
  const outside=tree.find(x=>x.id==='unregistered-worker');
  assert.equal(outside.subagentKind,'standalone');
  assert.equal(outside.parentId,'lead');
  assert.equal(outside.label,'Role of unregistered-worker');
  assert.equal(outside.teammateName,undefined);
  const candidates=await h.ctx.typertGateway.invoke({namespace:'sessionCollaboration',method:'candidates',args:{sourceId:'lead',query:''},peer:h.peer});
  assert.deepEqual(new Set(candidates.map(x=>x.sessionId)),new Set(['ordinary-child','db-engineer','reviewer','unregistered-worker']));
  assert.match(candidates.find(x=>x.sessionId==='db-engineer').displayTitle,/队员/);
  assert.match(candidates.find(x=>x.sessionId==='unregistered-worker').displayTitle,/子智能体/);
  const foreignCandidates=await h.ctx.typertGateway.invoke({namespace:'sessionCollaboration',method:'candidates',args:{sourceId:'ordinary-child',query:''},peer:h.peer});
  assert.deepEqual(foreignCandidates.map(x=>x.sessionId),['lead']);
  const childCandidates=await h.ctx.typertGateway.invoke({namespace:'sessionCollaboration',method:'candidates',args:{sourceId:'db-engineer',query:''},peer:h.peer});
  assert.deepEqual(childCandidates,[]);
  assert.equal(h.adapter.calls.length,0);
  assert.equal(h.ctx.agents.list().length,0);
  assert.deepEqual((await h.rpc('view')).state.messages,{});
});

test('outside-Team children recover without a Team roster and retain their exact parent and descriptor', async t => {
  const h=await host();t.after(()=>h.close());
  const items=[{sessionId:'lead',cwd:h.root,running:false},
    {sessionId:'outside',parentSessionId:'lead',origin:'subagent',cwd:h.root,running:false},
    {sessionId:'orphan',parentSessionId:'missing',origin:'subagent',cwd:h.root,running:false}];
  const observed=[],disposed=[];
  h.ctx.provide('sessionController',{list:async()=>({items}),resolveAgent:()=>{throw Error('TREE_MUST_NOT_ACTIVATE');}});
  h.ctx.provide('sessionQuery',{observeSession:async id=>{
    observed.push(id);
    return {projections:{values:id==='lead'?{agentTeam:null}:{title:'Generic prompt title',subagent:{mode:'continuable',label:'交付文档收尾'}}},[Symbol.dispose]:()=>disposed.push(id)};
  }});
  const read=()=>h.ctx.typertGateway.invoke({namespace:'sessionCollaboration',method:'tree',args:{},peer:h.peer});
  const before=await read();
  assert.deepEqual(before.map(x=>x.id),['lead','outside']);
  assert.equal(before[1].subagentKind,'standalone');
  assert.equal(before[1].parentId,'lead');
  assert.equal(before[1].label,'交付文档收尾');
  assert.deepEqual(observed,['lead','outside']);
  assert.deepEqual(disposed,observed);
  await h.plugin.dispose();await h.ctx.plugin(Plugin);
  assert.deepEqual(await read(),before);
  assert.equal(h.adapter.calls.length,0);
  assert.equal(h.ctx.agents.list().length,0);
});

test('missing cold Team hints use disposable read-only observations and retain ordinary navigation after reopen', async t => {
  const h=await host();t.after(()=>h.close());
  const items=[{sessionId:'lead',cwd:h.root,running:false},{sessionId:'worker',parentSessionId:'lead',origin:'subagent',cwd:h.root,running:false}];
  const observations=[],disposed=[];
  h.ctx.provide('sessionController',{list:async()=>({items}),resolveAgent:()=>{throw Error('TREE_MUST_NOT_ACTIVATE');}});
  h.ctx.provide('sessionQuery',{observeSession:async id=>{
    observations.push(id);
    const values=id==='lead'?{agentTeam:{members:[{id:'worker',name:'db-engineer',role:'teammate',phase:'active'}]}}:{subagent:{mode:'continuable',label:'Database task'}};
    return {projections:{values},[Symbol.dispose]:()=>disposed.push(id)};
  }});
  const read=()=>h.ctx.typertGateway.invoke({namespace:'sessionCollaboration',method:'tree',args:{},peer:h.peer});
  const before=await read();
  assert.equal(before[1].parentId,'lead');
  assert.equal(before[1].teammateName,'db-engineer');
  assert.deepEqual(observations,['lead','worker']);
  assert.deepEqual(disposed,observations);
  await h.plugin.dispose();await h.ctx.plugin(Plugin);
  assert.deepEqual(await read(),before);
  assert.equal(h.adapter.calls.length,0);
  assert.equal(h.ctx.agents.list().length,0);
  assert.deepEqual((await h.rpc('view')).state.messages,{});
});

// Regression: a child's requested effort must apply before its first request,
// without changing the parent's selection or any profile-wide defaults.
test('ordinary child starts its first model request at the requested High effort', { timeout: 10000 }, async t => {
  const h = await host(); t.after(() => h.close());
  for (const plugin of [LocalFs, WorkingDirectory]) await h.ctx.plugin(plugin);
  await h.ctx.plugin(Persistence, { root: join(h.root, 'sessions') });
  await h.ctx.plugin(Query);
  h.adapter.resolveModel = async (provider, model) => ({provider,id:model,name:model,contextWindow:100000,reasoning:{efforts:[{id:'low',name:'Low'},{id:'high',name:'High'}]}});
  const parent = await h.ctx.agents.create({ sessionId: 'high-parent', agentOptions: { provider: 'synthetic-free', model: 'fixture', reasoningEffort: 'low' }, meta: { cwd: h.root } });
  const result = value(await h.tool(parent.agent, 'session_create_child', { label: 'High child', prompt: 'Free check', reasoningEffort: 'high' }));
  const child = h.ctx.agents.get(result.id);
  await child.whenIdle();
  assert.equal(child.options.reasoningEffort, 'high');
  assert.equal(parent.agent.options.reasoningEffort, 'low');
  const firstRequest = child.session.snapshotEvents().find(event => event.type === 'request/header');
  assert.equal(firstRequest?.data.header.config.reasoningEffort, 'high');
});

test('desktop controller default Low is overridden for child first request without saving global defaults', { timeout: 10000 }, async t => {
  const h = await host(); t.after(() => h.close());
  for (const plugin of [LocalFs, WorkingDirectory]) await h.ctx.plugin(plugin);
  await h.ctx.plugin(Persistence, { root: join(h.root, 'sessions') });
  await h.ctx.plugin(Query);
  h.adapter.resolveModel = async (provider, model) => ({provider,id:model,name:model,contextWindow:100000,reasoning:{efforts:[{id:'low',name:'Low'},{id:'high',name:'High'}]}});
  // Exact SDK helper used by the shipped desktop controller. The wrapper only
  // omits unrelated file upload / UI services from this free composition.
  const { ApiSessionAgentController } = await import('../node_modules/@deepseek-ai/dsh-api-session-controller/lib/types/agent.js');
  const { installModelSelectionProjection } = await import('../node_modules/@deepseek-ai/dsh-api-session-controller/lib/types/model-selection-projection.js');
  installModelSelectionProjection(h.ctx);
  let globalWrites = 0;
  const defaultSelection = {provider:'synthetic-free',model:'fixture',reasoningEffort:'low'};
  h.ctx.provide('agentDefaultModel', {currentSelection:()=>defaultSelection,saveSelection:async()=>{globalWrites++;}});
  const desktop = new ApiSessionAgentController(h.ctx);
  h.ctx.provide('sessionController', {
    create:async request=>{const result=await desktop.createSession(request);desktop.installSelection(result.agent);return {sessionId:result.agent.id};},
    rename:async()=>{},
    inspect:async id=>{const agent=h.ctx.agents.get(id);return agent?{meta:{id,...agent.session.header}}:null;},
  });
  const parent=await h.create('desktop-high-parent');
  const created=[];
  for(let i=0;i<8;i++) {
    const result=value(await h.tool(parent.agent,'session_create_child',{label:`Desktop High child ${i+1}`,prompt:'Free check',reasoningEffort:'High'}));
    const child=h.ctx.agents.get(result.id);
    await child.whenIdle();
    assert.equal(result.reasoningEffort,'high');
    assert.equal(child.session.requestHeader()?.config.reasoningEffort,'high');
    assert.equal(child.session.header.origin,undefined);
    created.push(child);
  }
  assert.equal(new Set(created.map(child=>child.id)).size,8);
  const child=created.at(-1);
  assert.equal(defaultSelection.reasoningEffort,'low');
  assert.equal(globalWrites,0);
  // A later explicit selection remains effective; the bootstrap override is not permanent.
  desktop.selectForNextRequest(child,{provider:'synthetic-free',model:'fixture',reasoningEffort:'low'});
  child.followup(createUserMessage({source:{kind:'user'},content:[{type:'text',text:'Free next task'}]}));
  await child.whenIdle();
  assert.equal(child.session.requestHeader()?.config.reasoningEffort,'low');
});
