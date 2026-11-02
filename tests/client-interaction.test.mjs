import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';

test('native tree menu restores the same sidebar after workspace management without a separate panel',async()=>{
  let bundle;
  vm.runInNewContext(await readFile(new URL('../dist/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:value=>{bundle=value;}}},console,TextEncoder,TextDecoder});
  const client=bundle.factory(name=>name==='react'?React:name==='react/jsx-runtime'?jsxRuntime:name==='@deepseek-ai/dsh-client-ui-primitives'?{MenuItemButton:()=>null}:undefined);
  const active=new Set(),opened=[],selected=[];
  const ctx={
    remote:{$mount:async()=>{},sessionMessenger:{selectRecipient:async(...args)=>{selected.push(args);return{ok:true};}},sessionCollaboration:{candidates:async()=>({ok:true,value:[]})}},
    uiWorkspace:{openSession:id=>opened.push(id),startSession:()=>{}},
    slots:{inject:(_name,register)=>register(),register:(entry,component)=>{const row={entry,component};active.add(row);return()=>active.delete(row);}},
    inputTriggers:{registerSource:()=>()=>{}},effect:fn=>fn(),
  };
  ctx.inject=async(_deps,fn)=>fn(ctx);
  await client.apply(ctx);
  const tree=()=>[...active].find(row=>row.entry.name==='sidebar.workspaces');
  assert.ok(tree());
  const props=tree().entry.inject();
  props.openSession({id:'ordinary:B'});
  assert.deepEqual(opened,['ordinary:B']);
  props.openSession({id:'teammate:B',parentId:'lead:A',subagent:true,subagentKind:'teammate',teammateName:'reviewer',subagentMode:'continuable',openable:true});
  assert.equal(opened.length,2);
  assert.equal(opened[1].parentSessionId,'lead:A');
  assert.equal(opened[1].childSessionId,'teammate:B');
  assert.equal(opened[1].mode,'continuable','Team navigation uses the Host child address, never ordinary Session routing');
  props.openSession({id:'outside:C',parentId:'lead:A',subagent:true,subagentKind:'standalone',subagentMode:'continuable',openable:true});
  assert.equal(opened[2].parentSessionId,'lead:A');
  assert.equal(opened[2].childSessionId,'outside:C');
  assert.equal(opened[2].mode,'continuable','outside-Team navigation also uses the original Host child address');
  props.openSession({id:'nested:D',parentId:'outside:C',subagent:true,subagentKind:'standalone',subagentMode:'one-shot',openable:true});
  assert.equal(opened[3].parentSessionId,'outside:C');
  assert.equal(opened[3].childSessionId,'nested:D');
  assert.equal(opened[3].mode,'one-shot','one-shot descendants use their direct parent and read-only address');
  props.openSession({id:'pending:E',parentId:'lead:A',subagent:true,subagentKind:'teammate',subagentMode:'unknown',openable:false});
  assert.equal(opened.length,4,'a pending or unavailable row never opens an invented Session');
  props.standardList();
  assert.equal(tree(),undefined);
  const menu=[...active].find(row=>row.entry.id==='messenger-session-tree');
  let dismissed=0;
  menu.component({...menu.entry.inject(),onDismiss:()=>dismissed++}).props.onSelect();
  assert.ok(tree());
  assert.equal(dismissed,1);
  menu.component({...menu.entry.inject(),onDismiss:()=>dismissed++}).props.onSelect();
  assert.equal([...active].filter(row=>row.entry.name==='sidebar.workspaces').length,1);
  assert.equal([...active].some(row=>row.entry.name==='plugins.bundle.config'),false);
  assert.deepEqual(selected,[],'navigation never sends or mutates communication intent');
});

test('an already mounted tree automatically renders newly discovered nested children on its next refresh',async()=>{
  let bundle,component,props,tick,cleanup,cleared=false,hookIndex=0,effect;
  const stateValues=[];
  const hooks={...React,useState:initial=>{
    const index=hookIndex++;if(!(index in stateValues))stateValues[index]=typeof initial==='function'?initial():initial;
    return[stateValues[index],value=>{stateValues[index]=typeof value==='function'?value(stateValues[index]):value;}];
  },useEffect:fn=>{effect??=fn;}};
  vm.runInNewContext(await readFile(new URL('../dist/client.js',import.meta.url),'utf8'),{
    window:{__ModuleLoader__:{load:value=>{bundle=value;}}},console,TextEncoder,TextDecoder,
    setInterval:(fn,ms)=>{assert.equal(ms,2000);tick=fn;return 1;},clearInterval:()=>{cleared=true;},
  });
  const client=bundle.factory(name=>name==='react'?hooks:name==='react/jsx-runtime'?jsxRuntime:name==='@deepseek-ai/dsh-client-ui-primitives'?{MenuItemButton:()=>null}:undefined);
  let rows=[{id:'lead',label:'Refresh lead',subagent:false,workspace:'/test',running:false}],reads=0;
  const ctx={remote:{$mount:async()=>{},sessionMessenger:{},sessionCollaboration:{tree:async()=>{reads++;return{ok:true,value:structuredClone(rows)};}}},
    uiWorkspace:{},slots:{inject:(_name,fn)=>fn(),register:(entry,view)=>{if(entry.name==='sidebar.workspaces'){component=view;props=entry.inject();}return()=>{};}},
    inputTriggers:{registerSource:()=>()=>{}},effect:fn=>fn()};ctx.inject=async(_deps,fn)=>fn(ctx);
  await client.apply(ctx);
  const render=()=>{hookIndex=0;return renderToStaticMarkup(component(props));};
  render();cleanup=effect();await new Promise(resolve=>setImmediate(resolve));
  assert.match(render(),/Refresh lead/);assert.equal(reads,1);
  rows.push({id:'child',parentId:'lead',label:'New worker',workspace:'/test',running:false,subagent:true,subagentKind:'standalone',subagentMode:'continuable',openable:true,canMessage:true},
    {id:'nested',parentId:'child',label:'New nested review',workspace:'/test',running:false,subagent:true,subagentKind:'standalone',subagentMode:'one-shot',openable:true,canMessage:false,note:'只读'});
  tick();await new Promise(resolve=>setImmediate(resolve));
  const updated=render();assert.match(updated,/New worker/);assert.match(updated,/New nested review/);assert.match(updated,/只读/);assert.equal(reads,2);
  cleanup();assert.equal(cleared,true);
});
