import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import LocalFs from '@deepseek-ai/dsh-fs-local';
import WorkingDirectory from '@deepseek-ai/dsh-working-directory';
import * as Persistence from '@deepseek-ai/dsh-session-persistence-jsonl';
import Query from '@deepseek-ai/dsh-session-query';
import Subagents from '@deepseek-ai/dsh-subagent';
import * as Spawn from '@deepseek-ai/dsh-subagent-spawn-in-process';
import {defineTool} from '@deepseek-ai/dsh-tools';
import {host,productUnderTest} from './fixture.mjs';
import {sessionForest} from '../dist/session-tree.js';
import {SessionHistoryController} from '../node_modules/@deepseek-ai/dsh-api-session-controller/lib/types/history.js';

const tree=h=>h.ctx.typertGateway.invoke({namespace:'sessionCollaboration',method:'tree',args:{},peer:h.peer});
const candidates=(h,sourceId)=>h.ctx.typertGateway.invoke({namespace:'sessionCollaboration',method:'candidates',args:{sourceId,query:''},peer:h.peer});
const identity=(mode='continuable',label='Task')=>({agentTeam:null,subagentCatalog:[],subagent:{mode,label}});

test('new direct, nested and one-shot children appear on the next read without changing the parent',async t=>{
  const h=await host();t.after(()=>h.close());
  const items=[{sessionId:'lead',blank:false,cwd:h.root,running:false,projections:{values:{title:'Lead',agentTeam:null,subagentCatalog:[]}}}];
  h.ctx.provide('sessionController',{list:async()=>({items})});
  assert.deepEqual((await tree(h)).map(x=>x.id),['lead']);
  const child=(id,parent,mode)=>({sessionId:id,parentSessionId:parent,origin:'subagent',cwd:h.root,running:false,projections:{values:identity(mode,id)}});
  items.push(child('worker','lead','continuable'),child('grandchild','worker','continuable'),child('once','grandchild','one-shot'));
  const rows=await tree(h),forest=sessionForest(rows);
  assert.equal(forest[0].children[0].id,'worker');
  assert.equal(forest[0].children[0].children[0].id,'grandchild');
  assert.equal(forest[0].children[0].children[0].children[0].id,'once');
  assert.equal(rows.find(x=>x.id==='once').openable,true);
  assert.equal(rows.find(x=>x.id==='once').canMessage,false);
  assert.deepEqual((await candidates(h,'lead')).map(x=>x.sessionId),['worker']);
  assert.deepEqual(await candidates(h,'worker'),[],'tree depth never expands Messenger authority');
  await h.plugin.dispose();await h.ctx.plugin(productUnderTest);
  assert.deepEqual(await tree(h),rows);
  assert.equal(h.adapter.calls.length,0);
});

test('catalog-only and provisioning nodes remain visible, then become the original created Session',async t=>{
  const h=await host();t.after(()=>h.close());
  const member={id:'later',name:'new-worker',role:'teammate',phase:'provisioning'};
  const values={agentTeam:{members:[member]},subagentCatalog:[{id:'external-id',mode:'external',label:'Remote task'},{id:'catalog-only',mode:'continuable',label:'Preparing history'}]};
  const items=[{sessionId:'blank-lead',blank:true,cwd:h.root,running:false,projections:{values}}];
  h.ctx.provide('sessionController',{list:async()=>({items})});
  const initial=await tree(h);
  assert.ok(initial.some(x=>x.id==='blank-lead'),'a blank parent with children is retained');
  assert.equal(initial.find(x=>x.id==='later').note,'创建中');
  assert.equal(initial.find(x=>x.id==='catalog-only').openable,false);
  const external=initial.find(x=>x.subagentMode==='external');
  assert.equal(external.label,'Remote task');assert.equal(external.openable,false);
  assert.deepEqual(await candidates(h,'blank-lead'),[]);
  member.phase='failed';assert.equal((await tree(h)).find(x=>x.id==='later').note,'创建失败');
  member.phase='active';items.push({sessionId:'later',parentSessionId:'blank-lead',origin:'subagent',cwd:h.root,running:true,projections:{values:identity()}});
  const ready=await tree(h);
  assert.equal(ready.filter(x=>x.id==='later').length,1);
  assert.equal(ready.find(x=>x.id==='later').openable,true);
  assert.deepEqual((await candidates(h,'blank-lead')).map(x=>x.sessionId),['later']);
  assert.equal(h.adapter.calls.length,0);
});

test('one unavailable child or Team projection never hides siblings and recovers on a later refresh',async t=>{
  const h=await host();t.after(()=>h.close());let broken=true;const disposed=[];
  const items=[{sessionId:'lead',cwd:h.root,running:false},...['broken','sibling'].map(id=>({sessionId:id,parentSessionId:'lead',origin:'subagent',cwd:h.root,running:false}))];
  h.ctx.provide('sessionController',{list:async()=>({items})});
  h.ctx.provide('sessionQuery',{observeSession:async id=>{
    if(id==='broken'&&broken)throw Error('Transient unreadable descriptor');
    const values=id==='lead'?{agentTeam:broken?{members:[],failure:'unavailable'}:null,subagentCatalog:[]}:identity();
    return{projections:{values},[Symbol.dispose]:()=>disposed.push(id)};
  }});
  const first=await tree(h);
  assert.deepEqual(first.map(x=>x.id),['lead','broken','sibling']);
  assert.equal(first.find(x=>x.id==='broken').openable,false);
  assert.equal(first.find(x=>x.id==='sibling').openable,true);
  assert.deepEqual(await candidates(h,'lead'),[],'uncertain Team membership does not grant messaging');
  broken=false;const next=await tree(h);
  assert.equal(next.find(x=>x.id==='broken').openable,true);
  assert.deepEqual(new Set((await candidates(h,'lead')).map(x=>x.sessionId)),new Set(['broken','sibling']));
  assert.ok(disposed.includes('broken'));assert.equal(h.adapter.calls.length,0);
});

test('archive, conflicting parent facts and cycles cannot attach a child to an unrelated root',async t=>{
  const h=await host();t.after(()=>h.close());
  const items=[{sessionId:'lead',cwd:h.root,running:false,projections:{values:{agentTeam:null,subagentCatalog:[{id:'foreign',mode:'continuable',label:'Wrong parent'},{id:'archived',mode:'continuable'}]}}},
    {sessionId:'foreign',parentSessionId:'absent',origin:'subagent',cwd:h.root,running:false,projections:{values:identity()}},
    {sessionId:'archived',parentSessionId:'lead',origin:'subagent',cwd:h.root,running:false,projections:{values:identity()}}];
  h.ctx.provide('sessionController',{list:async()=>({items})});h.ctx.provide('workspaceRegistry',{archivedSessionIds:['archived']});
  assert.deepEqual((await tree(h)).map(x=>x.id),['lead']);
  const c=(id,parentId)=>({id,parentId,subagent:true,subagentKind:'standalone',subagentMode:'continuable',label:id,workspace:h.root,running:false,openable:true,canMessage:true});
  assert.deepEqual(sessionForest([c('a','b'),c('b','a')]),[]);
  assert.deepEqual(sessionForest([c('orphan','missing')]),[]);
});

test('real newly spawned native grandchildren are discovered live and after all children become cold', {timeout:15000},async t=>{
  const h=await host();t.after(()=>h.close());
  for(const plugin of [LocalFs,WorkingDirectory])await h.ctx.plugin(plugin);
  await h.ctx.plugin(Persistence,{root:join(h.root,'sessions')});await h.ctx.plugin(Query);await h.ctx.plugin(Subagents);await h.ctx.plugin(Spawn);
  const parent=(await h.create('native-tree-lead')).agent;
  assert.deepEqual((await tree(h)).map(x=>x.id),[parent.id]);
  const entered=Promise.withResolvers(),release=Promise.withResolvers();let first=true;t.after(()=>release.resolve());
  h.ctx.tools.register(defineTool({name:'tree_gate',description:'Free test gate',parameters:{},output:{schema:{type:'string'},render:()=>[]},execute:async()=>{entered.resolve();await release.promise;return 'done';}}));
  h.adapter.script=async function*(){
    if(first){first=false;yield{type:'block-start',index:0,blockType:'tool-call'};yield{type:'tool-call-delta',index:0,id:'gate',name:'tree_gate',argumentsDelta:'{}'};yield{type:'block-end',index:0,block:{type:'tool-call',id:'gate',name:'tree_gate',arguments:'{}'}};yield{type:'finish',reason:'tool-calls'};}
    else yield{type:'finish',reason:'stop'};
  };
  const start=(owner,id)=>h.ctx.subagents.startActivation({provider:'spawn',childId:id,label:id,request:{parent:owner,prompt:[{type:'text',text:'Free tree discovery'}]},signal:new AbortController().signal,delivery:'caller'});
  const direct=await start(parent,'native-tree-worker');await entered.promise;
  const child=h.ctx.agents.get('native-tree-worker');
  const nested=await start(child,'native-tree-grandchild');await nested.result;
  const calls=h.adapter.calls.length;
  const live=await tree(h);
  assert.equal(live.find(x=>x.id==='native-tree-grandchild').parentId,child.id);
  assert.equal(sessionForest(live)[0].children[0].children[0].id,'native-tree-grandchild');
  assert.equal(h.adapter.calls.length,calls,'discovery causes no model request');
  release.resolve();await direct.result;await h.ctx.subagents.waitForChildren(parent);
  assert.equal(h.ctx.agents.get(child.id),undefined);
  const cold=await tree(h);assert.equal(cold.find(x=>x.id==='native-tree-grandchild').openable,true);
  const observation=await h.ctx.sessionQuery.observeSession('native-tree-grandchild');
  const throughSeq=observation.cursor;observation[Symbol.dispose]();
  const history=new SessionHistoryController(h.ctx,()=>{throw Error('READ_MUST_NOT_PROMOTE');});
  const page=await history.page({address:{kind:'subagent',parentSessionId:child.id,childSessionId:'native-tree-grandchild',mode:'continuable'},throughSeq},new AbortController().signal);
  assert.ok(JSON.stringify(page.records).includes('Free tree discovery'),'native child navigation reads the exact grandchild history');
  assert.equal(h.ctx.agents.get('native-tree-grandchild'),undefined);
  await h.plugin.dispose();await h.ctx.plugin(productUnderTest);
  assert.deepEqual(await tree(h),cold);
});
