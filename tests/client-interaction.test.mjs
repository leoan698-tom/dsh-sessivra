import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import React, {act} from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as reactDom from 'react-dom';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {createSessionTreeStore,NativeSessionChildren} from '../dist/session-tree.js';

test('native workspace stays registered; row navigation uses original ordinary and child addresses',async()=>{
  let bundle;
  vm.runInNewContext(await readFile(new URL('../dist/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:value=>{bundle=value;}}},console,TextEncoder,TextDecoder,setInterval,clearInterval});
  const client=bundle.factory(name=>name==='react'?React:name==='react/jsx-runtime'?jsxRuntime:name==='react-dom'?reactDom:undefined);
  const active=new Set(),opened=[],selected=[],disposals=[];
  const ctx={
    remote:{$mount:async()=>{},sessionMessenger:{selectRecipient:async(...args)=>{selected.push(args);return{ok:true};}},sessionCollaboration:{candidates:async()=>({ok:true,value:[]})}},
    uiWorkspace:{openSession:id=>opened.push(id)},
    slots:{inject:(_name,register)=>register(),register:(entry,component)=>{const row={entry,component};active.add(row);return()=>active.delete(row);}},
    inputTriggers:{registerSource:()=>()=>{}},effect:fn=>disposals.push(fn()),
  };
  ctx.inject=async(_deps,fn)=>fn(ctx);
  await client.apply(ctx);
  assert.equal([...active].some(row=>row.entry.name==='sidebar.workspaces'),false);
  assert.equal([...active].some(row=>row.entry.name==='sidebar.panellist.actions'),false);
  const tree=[...active].find(row=>row.entry.name==='sidebar.workspaces.session.row.action');
  assert.ok(tree);
  const props=tree.entry.inject();
  props.openSession({id:'ordinary:B'});
  props.openSession({id:'teammate:B',parentId:'lead:A',subagent:true,subagentKind:'teammate',subagentMode:'continuable',openable:true});
  props.openSession({id:'outside:C',parentId:'lead:A',subagent:true,subagentKind:'standalone',subagentMode:'continuable',openable:true});
  props.openSession({id:'nested:D',parentId:'outside:C',subagent:true,subagentKind:'standalone',subagentMode:'one-shot',openable:true});
  props.openSession({id:'pending:E',parentId:'lead:A',subagent:true,subagentKind:'teammate',subagentMode:'unknown',openable:false});
  assert.deepEqual(JSON.parse(JSON.stringify(opened)),['ordinary:B',
    {parentSessionId:'lead:A',childSessionId:'teammate:B',mode:'continuable'},
    {parentSessionId:'lead:A',childSessionId:'outside:C',mode:'continuable'},
    {parentSessionId:'outside:C',childSessionId:'nested:D',mode:'one-shot'}]);
  assert.deepEqual(selected,[],'navigation never sends or mutates communication intent');
  disposals.forEach(dispose=>dispose?.());
});

test('native header handlers, hierarchy, collapse, sorting, workspace removal and cleanup coexist',async()=>{
  const dom=new JSDOM('<div id="app"></div>');
  const previous={window:globalThis.window,document:globalThis.document,MutationObserver:globalThis.MutationObserver,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,MutationObserver:dom.window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true});
  let rows=[{id:'lead',label:'Lead',subagent:false,running:false},{id:'ordinary',parentId:'lead',label:'Ordinary child',subagent:false,running:false},
    {id:'child',parentId:'lead',label:'Worker',subagent:true,subagentKind:'teammate',subagentMode:'continuable',openable:true,running:false},
    {id:'nested',parentId:'child',label:'Review',subagent:true,subagentKind:'standalone',subagentMode:'one-shot',openable:true,running:false,note:'只读'}];
  const store=createSessionTreeStore({tree:async()=>({ok:true,value:rows})});
  const opened=[],actions=[];
  const root=createRoot(document.getElementById('app'));
  function NativeFixture({ids=['lead','ordinary','other']}){
    return React.createElement('section',{'data-slot':'sidebar.workspaces'},
      React.createElement('header',null,'工作区',...['搜索','筛选','添加工作区'].map(label=>React.createElement('button',{key:label,onClick:()=>actions.push(label)},label))),
      React.createElement('div',{id:'list'},...ids.map(id=>React.createElement('div',{key:id,'data-row-key':`session:${id}`,onClick:()=>opened.push(`native:${id}`)},
        React.createElement('span',null,id),React.createElement('span',null,'1天'),React.createElement('span',null,
          React.createElement(NativeSessionChildren,{sessionId:id,store,openSession:node=>opened.push(node.id)}))))));
  }
  const render=async(ids)=>act(async()=>{root.render(React.createElement(NativeFixture,{ids}));await new Promise(resolve=>setImmediate(resolve));});
  const click=async(element)=>act(async()=>element.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
  try{
    await render();
    const header=document.querySelector('header'),headerHTML=header.outerHTML;
    for(const button of header.querySelectorAll('button'))await click(button);
    assert.deepEqual(actions,['搜索','筛选','添加工作区']);
    const lead=document.querySelector('[data-row-key="session:lead"]');
    const children=lead.nextElementSibling;
    assert.ok(children.classList.contains('dshsm-native-children'));
    assert.match(children.textContent,/Worker/);assert.match(children.textContent,/Review/);assert.match(children.textContent,/只读/);
    assert.equal(document.querySelector('[data-row-key="session:ordinary"]').dataset.dshsmNested,'true','linked ordinary child is shown once under its parent');
    assert.equal(document.querySelector('[data-row-key="session:other"]').nextElementSibling.hidden,true,'no empty spacer for childless rows');
    await click(lead.querySelector('.dshsm-native-toggle'));
    assert.equal(children.querySelector('[role=list]'),null);
    assert.deepEqual(opened,[],'expansion does not open the parent');
    await click(lead.querySelector('.dshsm-native-toggle'));
    await click(children.querySelector('.dshsm-tree-toggle'));
    assert.equal(children.querySelector('[aria-label="打开会话：Review"]'),null);
    assert.deepEqual(opened,[],'nested expansion does not open the native parent');
    await click(children.querySelector('.dshsm-tree-toggle'));
    await click(children.querySelector('[aria-label="打开会话：Review"]'));
    assert.deepEqual(opened,['nested']);
    await render(['other','ordinary','lead']);
    assert.equal(lead.nextElementSibling,children,'children follow a native sort operation');
    assert.equal(document.querySelector('header'),header);assert.equal(header.outerHTML,headerHTML);
    await render(['ordinary','other']);
    assert.equal(document.querySelector('[data-row-key="session:ordinary"]').dataset.dshsmNested,undefined,'visible child is restored if its parent workspace is not rendered');
    assert.equal(children.isConnected,false);
    await render(['lead','ordinary']);
    assert.match(document.querySelector('[data-row-key="session:lead"]').nextElementSibling.textContent,/Review/);
    await act(async()=>root.unmount());
    assert.equal(document.querySelectorAll('.dshsm-native-children,.dshsm-native-toggle,[data-dshsm-nested]').length,0);
  }finally{store.dispose();dom.window.close();Object.assign(globalThis,previous);}
});

test('one shared refresh discovers new children, prevents overlapping reads and stops after disposal',async()=>{
  const originalSetInterval=globalThis.setInterval,originalClearInterval=globalThis.clearInterval;
  let tick,cleared=0,reads=0,resolveRead;
  globalThis.setInterval=(fn,ms)=>{assert.equal(ms,2000);tick=fn;return 123;};
  globalThis.clearInterval=()=>cleared++;
  const store=createSessionTreeStore({tree:()=>{reads++;return new Promise(resolve=>{resolveRead=resolve;});}});
  try{
    const unsubscribe=store.subscribe(()=>{}),second=store.subscribe(()=>{});
    tick();tick();assert.equal(reads,1);
    resolveRead({ok:true,value:[{id:'lead',label:'Lead',subagent:false}]});await new Promise(resolve=>setImmediate(resolve));
    tick();assert.equal(reads,2);
    resolveRead({ok:true,value:[{id:'lead',label:'Lead',subagent:false},{id:'new',parentId:'lead',label:'New worker',subagent:true,subagentKind:'standalone'}]});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(store.getSnapshot().nodes.get('lead').children[0].id,'new');
    unsubscribe();second();assert.equal(cleared,1);
    store.dispose();tick();assert.equal(reads,2);
  }finally{store.dispose();globalThis.setInterval=originalSetInterval;globalThis.clearInterval=originalClearInterval;}
});
