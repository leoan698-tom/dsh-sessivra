import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import React, {act} from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as reactDom from 'react-dom';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {createSessionTreeStore,NativeSessionChildren,treePresentation} from '../dist/session-tree.js';
import {NativeSessionTreeHost} from '../dist/session-tree-host.js';
import {SessionActionsMenu} from '../dist/session-actions.js';
import {createSessionDialogStore,SessionDialogOutlet} from '../dist/session-dialog.js';
import {createWorkspaceArchiveSource,NativeTeamSearch,searchTeamMembers,selectParentUnavailable,ParentUnavailableComposer} from '../dist/session-navigation.js';

test('native workspace stays registered; row navigation uses original ordinary and child addresses',async()=>{
  let bundle;
  vm.runInNewContext(await readFile(new URL('../dist/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:value=>{bundle=value;}}},console,TextEncoder,TextDecoder,setInterval,clearInterval});
  const client=bundle.factory(name=>name==='react'?React:name==='react/jsx-runtime'?jsxRuntime:name==='react-dom'?reactDom:name==='@deepseek-ai/dsh-client-ui-primitives'?{}:undefined);
  const active=new Set(),opened=[],selected=[],disposals=[],operations=[];
  const ctx={
    remote:{$mount:async()=>{},sessionMessenger:{selectRecipient:async(...args)=>{selected.push(args);return{ok:true};}},sessionCollaboration:{candidates:async()=>({ok:true,value:[]})}},
    uiWorkspace:{openSession:id=>opened.push(id),pinSession:async id=>operations.push(['pin',id]),unpinSession:async id=>operations.push(['unpin',id]),archiveSession:async(...args)=>operations.push(['archive',...args])},
    sessions:{using:async(id,options,fn)=>{operations.push(['using',id,options]);return fn({binding:{session:{rename:async title=>{operations.push(['rename',title]);return{ok:true};}}}});}},
    slots:{inject:(_name,register)=>register(),register:(entry,component)=>{const row={entry,component};active.add(row);return()=>active.delete(row);}},
    inputTriggers:{registerSource:()=>()=>{}},effect:fn=>disposals.push(fn()),
  };
  ctx.inject=async(_deps,fn)=>fn(ctx);
  await client.apply(ctx);
  assert.equal([...active].some(row=>row.entry.name==='sidebar.workspaces'),false);
  assert.equal([...active].some(row=>row.entry.name==='sidebar.panellist.actions'),false);
  const tree=[...active].find(row=>row.entry.name==='sidebar.workspaces.session.row.action');
  assert.ok(tree);
  const dialogSlot=[...active].find(row=>row.entry.id==='sessivra-session-dialogs');assert.equal(dialogSlot.entry.name,'shell.overlay');
  assert.equal(dialogSlot.entry.inject().dialogs,tree.entry.inject().dialogs);
  const props=tree.entry.inject();
  const composer=[...active].find(row=>row.entry.name==='conversation.composer');
  assert.ok(composer.entry.priority < -10,'parent navigation must route before the native rc.5 read-only composer');
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
  await props.sessionActions.rename('ordinary:B','Renamed');
  await props.sessionActions.pin('ordinary:B',true);await props.sessionActions.pin('ordinary:B',false);
  await props.sessionActions.archive('ordinary:B');
  assert.deepEqual(JSON.parse(JSON.stringify(operations)),[['using','ordinary:B',{source:'workspaceOperation'}],['rename','Renamed'],['pin','ordinary:B'],['unpin','ordinary:B'],['archive','ordinary:B']],'archive never opts in to stopping live work');
  disposals.forEach(dispose=>dispose?.());
});

test('native header handlers, hierarchy, collapse, sorting, workspace removal and cleanup coexist',async()=>{
  const dom=new JSDOM('<div id="app"></div>');
  const previous={window:globalThis.window,document:globalThis.document,MutationObserver:globalThis.MutationObserver,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,MutationObserver:dom.window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true});
  let rows=[{id:'lead',label:'Lead',subagent:false,running:false},{id:'ordinary',parentId:'lead',label:'Ordinary child',subagent:false,running:false},
    {id:'child',parentId:'lead',label:'Worker',subagent:true,subagentKind:'teammate',subagentMode:'continuable',openable:true,running:false},
    {id:'nested',parentId:'child',label:'Review',subagent:true,subagentKind:'teammate',subagentMode:'one-shot',openable:true,running:false,note:'只读'}];
  const store=createSessionTreeStore({tree:async()=>({ok:true,value:rows})});
  const opened=[],actions=[];
  const root=createRoot(document.getElementById('app'));
  function NativeFixture({ids=['lead','ordinary','other']}){
    return React.createElement('section',{'data-slot':'sidebar.workspaces'},
      React.createElement('header',null,'工作区',...['搜索','筛选','添加工作区'].map(label=>React.createElement('button',{key:label,onClick:()=>actions.push(label)},label))),
      React.createElement('div',{id:'list'},...ids.map(id=>React.createElement('div',{key:id,'data-row-key':`session:${id}`,onClick:()=>opened.push(`native:${id}`),onPointerDown:()=>actions.push('row pointer'),onDoubleClick:()=>actions.push('row rename'),onDragStart:()=>actions.push('row drag'),onKeyDown:()=>actions.push('row keydown'),onKeyUp:()=>actions.push('row keyup')},
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
    assert.equal(lead.dataset.dshsmParent,'true');
    assert.equal(document.querySelector('[data-row-key="session:other"]').dataset.dshsmParent,undefined);
    const rootToggle=lead.querySelector('.dshsm-native-toggle'),nestedToggle=children.querySelector('.dshsm-tree-toggle');
    for(const toggle of [rootToggle,nestedToggle]){
      for(const type of ['pointerdown','dblclick','dragstart'])await act(async()=>toggle.dispatchEvent(new dom.window.MouseEvent(type,{bubbles:true,cancelable:true})));
      const press=new dom.window.MouseEvent('mousedown',{button:0,bubbles:true,cancelable:true});
      await act(async()=>toggle.dispatchEvent(press));
      assert.equal(press.defaultPrevented,true,'pressing disclosure cannot initiate dragging its native ancestor');
      assert.equal(document.activeElement,toggle,'preventing native drag still gives the disclosure keyboard focus');
      for(const key of ['Enter',' '])for(const type of ['keydown','keyup'])await act(async()=>toggle.dispatchEvent(new dom.window.KeyboardEvent(type,{key,bubbles:true})));
    }
    assert.deepEqual(actions,['搜索','筛选','添加工作区'],'toggle gestures never reach native open/rename/drag/keyboard handlers');
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
    await click(lead.querySelector('span'));
    assert.deepEqual(opened,['nested','native:lead'],'native title still opens the parent');
    await render(['other','ordinary','lead']);
    assert.equal(lead.nextElementSibling,children,'children follow a native sort operation');
    assert.equal(document.querySelector('header'),header);assert.equal(header.outerHTML,headerHTML);
    await render(['ordinary','other']);
    assert.equal(document.querySelector('[data-row-key="session:ordinary"]').dataset.dshsmNested,undefined,'visible child is restored if its parent workspace is not rendered');
    assert.equal(children.isConnected,false);
    await render(['lead','ordinary']);
    assert.match(document.querySelector('[data-row-key="session:lead"]').nextElementSibling.textContent,/Review/);
    await act(async()=>root.unmount());
    assert.equal(lead.dataset.dshsmParent,undefined,'unmount removes the reserved disclosure gutter');
    assert.equal(document.querySelectorAll('.dshsm-native-children,.dshsm-native-toggle,[data-dshsm-nested],[data-dshsm-parent]').length,0);
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
    resolveRead({ok:true,value:[{id:'lead',label:'Lead',subagent:false},{id:'new',parentId:'lead',label:'New worker',subagent:true,subagentKind:'teammate'}]});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(store.getSnapshot().nodes.get('lead').children[0].id,'new');
    unsubscribe();second();assert.equal(cleared,1);
    store.dispose();tick();assert.equal(reads,2);
  }finally{store.dispose();globalThis.setInterval=originalSetInterval;globalThis.clearInterval=originalClearInterval;}
});

test('sidebar retains ordinary sessions and rooted teammates while pruning all other subagent branches',async()=>{
  const ordinary=(id,parentId)=>({id,parentId,label:id,subagent:false,running:false});
  const child=(id,parentId,subagentKind,extra={})=>({id,parentId,label:id,subagent:true,subagentKind,subagentMode:'continuable',openable:true,running:false,...extra});
  const rows=[ordinary('lead'),ordinary('ordinary','lead'),ordinary('ordinary-grandchild','ordinary'),ordinary('independent'),
    child('member','lead','teammate'),child('member-child','member','teammate'),
    child('pending','lead','teammate',{openable:false,note:'创建中'}),child('failed','lead','teammate',{openable:false,note:'创建失败'}),
    child('readonly-member','lead','teammate',{subagentMode:'one-shot',note:'只读'}),
    child('outside','lead','standalone'),child('outside-under-member','member','standalone'),
    child('uncertain','lead','unknown'),child('legacy','lead',undefined),
    child('member-under-hidden','outside','teammate'),child('orphan-member','missing','teammate'),
    child('cycle-a','cycle-b','teammate'),child('cycle-b','cycle-a','teammate'),
    ordinary('ordinary-with-missing-parent','missing')];
  for(let i=0;i<40;i++)rows.push(child(`temporary-${i}`,i?`temporary-${i-1}`:'outside','standalone',{subagentMode:'one-shot',note:'只读'}));
  const original=JSON.stringify(rows);
  let candidateCalls=0;
  const store=createSessionTreeStore({tree:async()=>({ok:true,value:rows}),candidates:async()=>{candidateCalls++;return{ok:true,value:[]};}});
  const unsubscribe=store.subscribe(()=>{});
  try{
    await new Promise(resolve=>setImmediate(resolve));
    const {nodes,parents,hiddenSessions}=store.getSnapshot();
    assert.deepEqual([...nodes.keys()],['lead','ordinary','ordinary-grandchild','member','member-child','pending','failed','readonly-member','independent','ordinary-with-missing-parent']);
    assert.equal(parents.get('ordinary-grandchild'),'ordinary');assert.equal(parents.get('member-child'),'member');
    for(const row of rows)assert.equal(hiddenSessions.has(row.id),row.subagent&&!nodes.has(row.id),row.id);
    assert.equal(nodes.get('pending').openable,false);assert.equal(nodes.get('failed').note,'创建失败');
    assert.equal(JSON.stringify(rows),original,'visibility never changes discovery records or parent identities');
    assert.equal(candidateCalls,0,'sidebar filtering does not query or rewrite messaging candidates');
  }finally{unsubscribe();store.dispose();}
});

test('hidden branches stay absent after refresh or parent removal; native rows, arrows and markers recover',async()=>{
  const dom=new JSDOM('<div id="app"></div>');
  const previous={window:globalThis.window,document:globalThis.document,MutationObserver:globalThis.MutationObserver,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
  let tick;
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,MutationObserver:dom.window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true,setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>{}});
  let rows=[{id:'lead',label:'Lead',subagent:false},{id:'ordinary',parentId:'lead',label:'Ordinary',subagent:false},
    {id:'member',parentId:'lead',label:'Member',subagent:true,subagentKind:'teammate',openable:true},
    {id:'outside',parentId:'lead',label:'Hidden task',subagent:true,subagentKind:'standalone',openable:true},
    {id:'hidden-only',label:'Only temporary children',subagent:false},
    {id:'once',parentId:'hidden-only',label:'One shot',subagent:true,subagentKind:'standalone',subagentMode:'one-shot',openable:true},
    {id:'uncertain',parentId:'hidden-only',label:'Unknown',subagent:true,subagentKind:'unknown',openable:false}];
  let failed=false;
  const store=createSessionTreeStore({tree:async()=>failed?{ok:false}:{ok:true,value:rows}});
  const opened=[];
  const root=createRoot(document.getElementById('app'));
  const render=async(ids)=>act(async()=>{root.render(React.createElement('div',null,...ids.map(id=>React.createElement('div',{key:id,'data-row-key':`session:${id}`,onClick:()=>opened.push(id)},
    React.createElement('span',null,id),React.createElement(NativeSessionChildren,{sessionId:id,store,openSession:node=>opened.push(node.id)})))));await new Promise(resolve=>setImmediate(resolve));});
  const refresh=async()=>act(async()=>{tick();await new Promise(resolve=>setImmediate(resolve));});
  const native=id=>document.querySelector(`[data-row-key="session:${id}"]`);
  try{
    const ids=rows.map(row=>row.id);await render(ids);
    const retained=[...document.querySelectorAll('[data-row-key]')];
    for(const id of ['outside','once','uncertain']){
      assert.equal(dom.window.getComputedStyle(native(id)).display,'none');assert.equal(native(id).nextElementSibling.hidden,true);
    }
    assert.equal(native('hidden-only').querySelector('.dshsm-native-toggle'),null,'no arrow for hidden-only branches');
    assert.equal(native('hidden-only').dataset.dshsmParent,undefined,'no reserved gutter for hidden-only branches');
    assert.equal(document.querySelector('[aria-label="打开会话：Hidden task"]'),null);
    await act(async()=>document.querySelector('[aria-label="打开会话：Member"]').click());assert.deepEqual(opened,['member']);
    failed=true;await refresh();assert.equal(native('outside').dataset.dshsmHidden,'true','a failed refresh does not reveal filtered rows');failed=false;
    rows=rows.map(row=>row.id==='outside'?{...row,subagentKind:'teammate'}:row);await refresh();
    assert.equal(native('outside').dataset.dshsmHidden,undefined);assert.equal(native('outside').dataset.dshsmNested,'true');
    assert.ok(document.querySelector('[aria-label="打开会话：Hidden task"]'),'confirmed team membership becomes visible on refresh');
    rows=rows.map(row=>['member','outside'].includes(row.id)?{...row,subagentKind:'standalone'}:row);await refresh();
    assert.equal(document.querySelector('[aria-label="打开会话：Member"]'),null);assert.equal(native('member').dataset.dshsmHidden,'true');
    await render(ids.filter(id=>id!=='lead'));
    assert.equal(native('ordinary').dataset.dshsmNested,undefined,'ordinary child remains navigable when its parent is not mounted');
    assert.equal(dom.window.getComputedStyle(native('outside')).display,'none','filtered subagent never becomes a top-level native row');
    await act(async()=>root.unmount());
    for(const row of retained)for(const key of ['dshsmNested','dshsmHidden','dshsmParent'])assert.equal(row.dataset[key],undefined);
    assert.equal(document.querySelectorAll('.dshsm-native-children,.dshsm-native-toggle').length,0);
  }finally{store.dispose();dom.window.close();Object.assign(globalThis,previous);}
});

const settle=()=>new Promise(resolve=>setImmediate(resolve));
const ordinary=(id,parentId)=>({id,parentId,label:id,subagent:false,running:false});
function installDom(){
  const dom=new JSDOM('<div id="app"></div>');
  const previous={window:globalThis.window,document:globalThis.document,MutationObserver:globalThis.MutationObserver,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,MutationObserver:dom.window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true});
  return {dom,root:createRoot(document.getElementById('app')),restore:()=>{dom.window.close();Object.assign(globalThis,previous);}};
}

test('host selection is exclusive across roots, follows search/remount, reveals ancestors and clears on a panel',async()=>{
  const env=installDom(),rows=[ordinary('a'),ordinary('a1','a'),ordinary('a2','a1'),ordinary('b'),ordinary('b1','b')];
  const store=createSessionTreeStore({tree:async()=>({ok:true,value:rows})});
  let selected='a1',panel=null;const opened=[];
  const render=async(ids=['a','b'])=>act(async()=>{env.root.render(React.createElement('div',null,...ids.map(id=>React.createElement('div',{key:id,'data-row-key':`session:${id}`},React.createElement(NativeSessionTreeHost,{
    sessionId:id,store,openSession:session=>opened.push(session.id),controls:{Menu:()=>null,Modal:()=>null,Button:'button'},dialogs:createSessionDialogStore(),sessionActions:{},
    useSessions:selector=>selector({byId:Object.fromEntries(rows.map(s=>[s.id,{id:s.id,retainedBy:s.id===selected?{mainView:1}:{}}]))}),
    usePanelInfo:selector=>selector({activePanelId:panel}),useSessionStatus:selector=>selector(new Map()),useWorkspaces:selector=>selector({pinnedSessionIds:[]}),
  })))));await settle();});
  const highlighted=()=>[...document.querySelectorAll('[data-selected=true]')].map(e=>e.dataset.sessionId);
  try{
    await render();assert.deepEqual(highlighted(),['a1']);
    await act(async()=>document.querySelector('[aria-label="打开会话：b1"]').click());
    assert.deepEqual(opened,['b1']);assert.deepEqual(highlighted(),['a1'],'a click is not a confirmed host selection');
    selected='b1';await render();assert.deepEqual(highlighted(),['b1']);
    await act(async()=>{store.toggle('a');store.toggle('a1');});
    await render([]);selected='a2';await render();assert.deepEqual(highlighted(),['a2']);
    assert.equal(store.isExpanded('a'),true);assert.equal(store.isExpanded('a1'),true);
    assert.equal(document.querySelector('[aria-current=page]').textContent,'a2');
    await act(async()=>store.toggle('a'));
    assert.equal(document.querySelector('[data-row-key="session:a"] [aria-label="包含当前会话"]').getAttribute('role'),'img');
    await act(async()=>store.refresh());assert.equal(store.isExpanded('a'),false,'current marker never forces a folded branch open');
    panel='settings';await render();assert.deepEqual(highlighted(),[]);
    assert.equal(document.querySelector('[aria-label="包含当前会话"]'),null);
  }finally{await act(async()=>env.root.unmount());store.dispose();env.restore();}
});

test('explicit teammate names persist locally and search includes names and parent paths without hidden agents',async()=>{
  const saved=new Map(),storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
  const member={...ordinary('acct','lead'),label:'acct',subagent:true,subagentKind:'teammate',teammateName:'acct',description:'你是政府端 UI 实测审计员',subagentMode:'continuable',openable:true};
  const rows=[{...ordinary('lead'),label:'政府端验收'},member,{...member,id:'temp',label:'临时账号检查',subagentKind:'standalone'}, {...member,id:'hidden-child',parentId:'temp'}];
  const create=()=>createSessionTreeStore({tree:async()=>({ok:true,value:rows})},storage);
  let store=create(),unsubscribe=store.subscribe(()=>{});await settle();
  try{
    store.setAlias('acct','账号检查');
    assert.equal(treePresentation(member,undefined,store.getSnapshot().aliases.get('acct')).label,'账号检查');
    assert.match(treePresentation(member,undefined,store.getSnapshot().aliases.get('acct')).title,/队员：acct/);
    for(const query of ['acct','账号','政府端验收','政府端 acct'])assert.deepEqual(searchTeamMembers(store,query).map(match=>match.node.id),['acct']);
    assert.equal(searchTeamMembers(store,'临时').length,0);assert.equal(searchTeamMembers(store,'你是政府端').length,0);
    assert.throws(()=>store.setAlias('lead','非法名称'));assert.throws(()=>store.setAlias('acct','x'.repeat(61)));
    unsubscribe();store.dispose();store=create();unsubscribe=store.subscribe(()=>{});await settle();
    assert.equal(store.getSnapshot().aliases.get('acct'),'账号检查');store.setAlias('acct','');assert.equal(store.getSnapshot().aliases.has('acct'),false);
    assert.equal(rows[1].label,'acct','Team identity is never renamed by a local alias');
  }finally{unsubscribe();store.dispose();}
});

test('native search keeps its header and native results, finds a teammate and reveals the exact folded workspace branch',async()=>{
  const env=installDom(),opened=[];
  const rows=[ordinary('lead'),{...ordinary('acct','lead'),subagent:true,subagentKind:'teammate',teammateName:'acct',subagentMode:'continuable',openable:true}];
  const store=createSessionTreeStore({tree:async()=>({ok:true,value:rows})});
  const workspaces=[{workspaceId:'work',path:'D:/project',sessionIds:['lead']}];
  function Fixture(){
    const [query,setQuery]=React.useState('acct'),[expanded,setExpanded]=React.useState(false),[selected,setSelected]=React.useState();
    return React.createElement(React.Fragment,null,
      React.createElement('div',{'data-native-workspace':true},
        React.createElement('header',null,React.createElement('div',null,React.createElement('div',null,
          React.createElement('input',{placeholder:'搜索会话名称',value:query,onChange:e=>setQuery(e.target.value)}),
          React.createElement('button',{'aria-label':'清除搜索',onClick:()=>setQuery('')},'清除')))),
        query?React.createElement('div',null,React.createElement('div',{role:'tree','aria-label':'搜索结果'},React.createElement('span',{'data-native-result':true},'原生会话结果')),React.createElement('div',null,'无匹配会话')):
          React.createElement('div',null,React.createElement('div',{'data-row-key':'workspace:work','aria-expanded':expanded,onClick:()=>setExpanded(true)},'工作区'),expanded&&React.createElement('div',{'data-row-key':'session:lead'},React.createElement(NativeSessionChildren,{sessionId:'lead',store,currentId:selected,openSession:()=>{}})))),
      React.createElement(NativeTeamSearch,{store,useWorkspaces:selector=>selector({items:workspaces,archivedSessionIds:[]}),useArchiveFilter:selector=>selector('default'),openSession:node=>{opened.push(node.id);setSelected(node.id);}}));
  }
  try{
    await act(async()=>{env.root.render(React.createElement(Fixture));await settle();});
    assert.equal(document.querySelectorAll('input').length,1);assert.equal(document.querySelector('[data-native-result]').textContent,'原生会话结果');
    assert.equal(document.querySelector('[data-dshsm-search-empty]').textContent,'无匹配会话');
    assert.equal(document.querySelector('.dshsm-search-result span').textContent,'acct');
    await act(async()=>{document.querySelector('.dshsm-search-result').click();await settle();});
    assert.deepEqual(opened,['acct']);assert.equal(document.querySelector('input').value,'');
    assert.equal(document.querySelector('[data-row-key="workspace:work"]').getAttribute('aria-expanded'),'true');
    assert.equal(document.querySelector('[aria-current=page]').textContent,'acct队员');
    assert.equal(document.querySelector('[data-dshsm-search]'),null);
  }finally{await act(async()=>env.root.unmount());store.dispose();env.restore();}
});

test('parent guidance requires an explicit host availability fact and opens the original parent address',async()=>{
  const owner=(mode,available,running=false)=>({session:{running,subagent:{address:{mode,parentSessionId:'parent'},parentAvailable:available}}});
  assert.deepEqual(selectParentUnavailable(owner('continuable',false)),{parentId:'parent'});
  for(const candidate of [owner('continuable',true),owner('continuable',undefined),owner('continuable',false,true),owner('one-shot',false),owner('unknown',false),{}])assert.equal(selectParentUnavailable(candidate),null);
  const member={...ordinary('acct','parent'),subagent:true,subagentKind:'teammate',subagentMode:'continuable',openable:true};
  assert.equal(treePresentation({...member,parentAvailable:false}).state,'需先打开父会话');
  assert.equal(treePresentation(member).state,'');
  assert.equal(treePresentation({...member,parentAvailable:false,running:true}).state,'运行中');
  const env=installDom(),opened=[],parent={...member,id:'parent',parentId:'lead'};
  const store=createSessionTreeStore({tree:async()=>({ok:true,value:[ordinary('lead'),parent,member]})});
  try{
    await act(async()=>{env.root.render(React.createElement(ParentUnavailableComposer,{store,matched:{parentId:'parent'},openSession:node=>opened.push(node),Button:({variant,size,...props})=>React.createElement('button',{'data-variant':variant,'data-size':size,...props})}));await settle();});
    await act(async()=>document.querySelector('button').click());assert.equal(opened[0].parentId,'lead');assert.equal(opened[0].id,'parent');assert.equal(opened[0].subagent,true);
  }finally{await act(async()=>env.root.unmount());store.dispose();env.restore();}
});

test('archive filter observes the elected native view through load, changes and replacement without writing it',()=>{
  let entries=[];const ledgerListeners=new Set();
  const slots={entriesOfSlot:()=>entries,subscribe:(name,listener)=>{assert.equal(name,'sidebar.workspaces');ledgerListeners.add(listener);return()=>ledgerListeners.delete(listener);}};
  const view=filter=>{
    let snapshot={archivedFilter:filter};const listeners=new Set();let creates=0;
    const instance={getSnapshot:()=>snapshot,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},actions:{setArchivedFilter:()=>assert.fail('review bridge must never write Host view state')}};
    return {entry:{locale:'workspace',children:{'sidebar.workspaces.session.row.action':{}},store:{create:()=>{creates++;return instance;}}},listeners,creates:()=>creates,set:filter=>{snapshot={archivedFilter:filter};listeners.forEach(fn=>fn());}};
  };
  const publish=next=>{entries=next;ledgerListeners.forEach(fn=>fn());};
  const source=createWorkspaceArchiveSource(slots),changes=[];
  const unsubscribe=source.subscribe(()=>changes.push(source.getSnapshot()));
  assert.equal(source.getSnapshot(),undefined,'unknown native view never guesses default');
  const first=view(undefined);publish([first.entry]);assert.equal(source.getSnapshot(),'default');
  first.set('only');assert.equal(source.getSnapshot(),'only');first.set('show');assert.equal(source.getSnapshot(),'show');
  assert.equal(first.creates(),1,'shared instance resolved once per registration');
  const second=view('only');publish([second.entry]);assert.equal(first.listeners.size,0);assert.equal(source.getSnapshot(),'only');
  first.set('default');assert.equal(source.getSnapshot(),'only');
  publish([{locale:'other'}]);assert.equal(second.listeners.size,0);assert.equal(source.getSnapshot(),undefined);
  publish([]);unsubscribe();assert.equal(ledgerListeners.size,0);
  assert.deepEqual(changes.slice(0,4),['default','only','show','only']);
});

test('teammate search respects live archive filters and removes newly archived branches before tree polling',async()=>{
  const env=installDom(),member={...ordinary('acct','lead'),subagent:true,subagentKind:'teammate',teammateName:'acct',subagentMode:'continuable',openable:true};
  const store=createSessionTreeStore({tree:async()=>({ok:true,value:[ordinary('lead'),member]})});
  let filter='default',archived=[];
  function Fixture(){return React.createElement(React.Fragment,null,
    React.createElement('div',null,React.createElement('header',null,React.createElement('div',null,React.createElement('div',null,React.createElement('input',{placeholder:'搜索会话名称',defaultValue:'acct'})))),
      React.createElement('div',null,React.createElement('div',{role:'tree','aria-label':'搜索结果'},React.createElement('span',{'data-native-result':true},'原生结果')),React.createElement('div',{'data-native-empty':true},'无匹配会话'))),
    React.createElement(NativeTeamSearch,{store,useArchiveFilter:selector=>selector(filter),useWorkspaces:selector=>selector({items:[],archivedSessionIds:archived}),openSession:()=>assert.fail('filtering must not navigate')}));}
  const render=()=>act(async()=>{env.root.render(React.createElement(Fixture));await settle();});
  try{
    await render();assert.equal(document.querySelectorAll('.dshsm-search-result').length,1);
    filter='only';await render();assert.equal(document.querySelector('[data-dshsm-search]'),null);assert.equal(document.querySelector('[data-native-empty]').hasAttribute('data-dshsm-search-empty'),false);
    filter='show';await render();assert.equal(document.querySelectorAll('.dshsm-search-result').length,1);
    archived=['acct'];await render();assert.equal(document.querySelectorAll('.dshsm-search-result').length,0);
    archived=['lead'];await render();assert.equal(document.querySelectorAll('.dshsm-search-result').length,0);
    archived=[];await render();assert.equal(document.querySelectorAll('.dshsm-search-result').length,1);
    filter=undefined;await render();assert.equal(document.querySelector('[data-dshsm-search]'),null);
    assert.equal(document.querySelector('[data-native-result]').textContent,'原生结果');
  }finally{await act(async()=>env.root.unmount());store.dispose();env.restore();}
});

test('teammate identity remains visible alongside every live or read-only state',async()=>{
  const env=installDom(),member={...ordinary('acct','lead'),subagent:true,subagentKind:'teammate',teammateName:'acct',subagentMode:'continuable',openable:true};
  let current=member;const store=createSessionTreeStore({tree:async()=>({ok:true,value:[ordinary('lead'),current,ordinary('ordinary','lead')]})});
  try{
    for(const [status,patch,label] of [
      [{}, {}, ''],[{running:true},{},'运行中'],[{pendingInteraction:{kind:'approval'}},{},'等待批准'],
      [{pendingInteraction:{kind:'plan-review'}},{},'等待方案确认'],[{pendingInteraction:{kind:'question'}},{},'等待回答'],
      [{},{parentAvailable:false},'需开父会话'],[{},{subagentMode:'one-shot',note:'只读'},'只读'],
      [{},{openable:false,note:'创建中'},'创建中'],[{},{openable:false,note:'创建失败'},'创建失败'],
    ]){
      current={...member,...patch};
      await act(async()=>{env.root.render(React.createElement('div',{'data-row-key':'session:lead'},React.createElement(NativeSessionChildren,{sessionId:'lead',store,statuses:new Map([['acct',status]]),openSession:()=>{}})));await settle();await store.refresh();});
      const row=document.querySelector('[data-session-id=acct]');assert.equal(row.querySelector('.dshsm-tree-member').textContent,'队员');assert.equal(row.querySelector('.dshsm-tree-status')?.textContent??'',label);
      assert.equal(document.querySelector('[data-session-id=ordinary] .dshsm-tree-member'),null);
    }
  }finally{await act(async()=>env.root.unmount());store.dispose();env.restore();}
});

test('portaled session menus and dialogs do not re-enter the parent hover card while activation still dismisses it',async()=>{
  const env=installDom(),dialogs=createSessionDialogStore();let enters=0,dismissals=0;
  const store=createSessionTreeStore({tree:async()=>({ok:true,value:[ordinary('lead'),ordinary('child','lead')]})});
  const controls={
    Menu:({open,anchor,onSelect})=>React.createElement(React.Fragment,null,anchor,open&&reactDom.createPortal(React.createElement('button',{role:'menuitem',onClick:()=>onSelect('rename')},'重命名'),document.body)),
    Modal:({open,children,footer})=>open&&reactDom.createPortal(React.createElement('div',{role:'dialog'},children,footer),document.body),
    Button:({variant,...props})=>React.createElement('button',{'data-variant':variant,...props}),
  };
  const pointerOver=element=>element.dispatchEvent(new env.dom.window.MouseEvent('pointerover',{bubbles:true}));
  const pointerOut=(element,relatedTarget)=>element.dispatchEvent(new env.dom.window.MouseEvent('pointerout',{bubbles:true,relatedTarget}));
  try{
    await act(async()=>{env.root.render(React.createElement(React.Fragment,null,React.createElement(SessionDialogOutlet,{dialogs}),React.createElement('div',{'data-row-key':'session:lead','data-host-hover-anchor':true,onPointerEnter:()=>enters++,onClickCapture:()=>dismissals++},
      React.createElement(NativeSessionChildren,{sessionId:'lead',store,openSession:()=>{},renderActions:session=>React.createElement(SessionActionsMenu,{session,pinned:false,controls,dialogs,actions:{},onChanged:()=>{}})}))));await settle();});
    await act(async()=>pointerOver(document.querySelector('[data-host-hover-anchor]')));assert.equal(enters,1);
    const child=document.querySelector('[aria-label="打开会话：child"]');
    await act(async()=>pointerOver(child));assert.equal(enters,1,'the adjacent child tree is not part of the native parent hover surface');
    await act(async()=>document.querySelector('.dshsm-session-menu').click());assert.equal(dismissals,1);
    await act(async()=>pointerOver(document.querySelector('[role=menuitem]')));assert.equal(enters,1,'menu portal must not restart the parent dwell timer');
    await act(async()=>document.querySelector('[role=menuitem]').click());assert.equal(dismissals,2);
    await act(async()=>pointerOver(document.querySelector('[role=dialog] input')));assert.equal(enters,1,'dialog portal must not reopen the parent card');
    await act(async()=>pointerOut(child,document.querySelector('[role=dialog] input')));assert.equal(enters,1,'moving from the child tree into its dialog must not synthesize parent entry');
    await act(async()=>document.querySelector('[role=dialog] input').click());assert.equal(dismissals,2,'dialog interactions must not enter the native parent row event path');
    await act(async()=>[...document.querySelectorAll('[role=dialog] button')].find(button=>button.textContent==='取消').click());assert.equal(document.querySelector('[role=dialog]'),null);
    await act(async()=>pointerOver(document.querySelector('[data-host-hover-anchor]')));assert.equal(enters,2,'native parent hover still works after closing');
  }finally{await act(async()=>env.root.unmount());store.dispose();env.restore();}
});

test('fold preferences survive store recreation; deeper branches default closed and broken storage is harmless',async()=>{
  const rows=[ordinary('a'),ordinary('b','a'),ordinary('c','b'),ordinary('d','c')];
  let saved=null;const storage={getItem:()=>saved,setItem:(_key,value)=>{saved=value;}};
  const create=()=>createSessionTreeStore({tree:async()=>({ok:true,value:rows})},storage);
  let store=create(),unsubscribe=store.subscribe(()=>{});await settle();
  assert.equal(store.isExpanded('a'),true);assert.equal(store.isExpanded('b'),true);assert.equal(store.isExpanded('c'),false);
  store.toggle('a');unsubscribe();store.dispose();
  store=create();unsubscribe=store.subscribe(()=>{});await settle();assert.equal(store.isExpanded('a'),false);
  store.reveal('d');assert.equal(store.isExpanded('a'),true);assert.equal(store.isExpanded('c'),true);
  store.toggle('a');await store.refresh();store.reveal('d');assert.equal(store.isExpanded('a'),false,'polling must not override a deliberate fold');
  unsubscribe();store.dispose();saved='not valid JSON';store=create();store.dispose();
  store=createSessionTreeStore({tree:async()=>({ok:true,value:rows})},{getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('full');}});
  unsubscribe=store.subscribe(()=>{});await settle();store.toggle('a');assert.equal(store.isExpanded('a'),false);unsubscribe();store.dispose();
});

test('initial loading and failures stay visible once, retry recovers, and failed refresh keeps folded content',async()=>{
  const env=installDom();let finish;
  const store=createSessionTreeStore({tree:()=>new Promise(resolve=>{finish=resolve;})});
  try{
    await act(async()=>env.root.render(React.createElement('div',null,...['a','b'].map(id=>React.createElement('div',{key:id,'data-row-key':`session:${id}`},React.createElement(NativeSessionChildren,{sessionId:id,store,openSession:()=>{}}))))));
    assert.equal(document.querySelectorAll('[role=status]').length,1);assert.equal(document.querySelector('[role=status]').parentElement.hidden,false);
    await act(async()=>{finish({ok:false,error:{message:'synthetic'}});await settle();});
    assert.equal(document.querySelectorAll('[role=alert]').length,1);assert.equal(document.querySelector('[role=alert]').parentElement.hidden,false);
    await act(async()=>document.querySelector('[role=alert] button').click());assert.equal(document.querySelector('[role=alert] button').disabled,true);
    await act(async()=>{finish({ok:true,value:[ordinary('a'),ordinary('child','a'),ordinary('b')]});await settle();});
    assert.equal(document.querySelector('[role=alert]'),null);assert.ok(document.querySelector('[aria-label="打开会话：child"]'));
    await act(async()=>{store.toggle('a');void store.refresh();});
    await act(async()=>{finish({ok:false});await settle();});
    assert.match(document.querySelector('[role=alert]').textContent,/上次结果/);assert.equal(document.querySelector('[role=alert]').parentElement.hidden,false);
    assert.equal(store.getSnapshot().nodes.get('a').children.length,1);assert.equal(store.isExpanded('a'),false);
    await act(async()=>document.querySelector('[role=alert] button').click());
    await act(async()=>{finish({ok:true,value:[ordinary('a'),ordinary('b')]});await settle();});
    assert.equal(document.querySelector('[role=alert]'),null);assert.equal(document.querySelector('[data-row-key="session:a"]').nextElementSibling.hidden,true,'successful empty result has no loading/error spacer');
  }finally{await act(async()=>env.root.unmount());store.dispose();env.restore();}
});

test('team responsibilities and attention states use host facts without inventing completion',()=>{
  const node={id:'acct',label:'acct',teammateName:'acct',subagent:true,subagentKind:'teammate',description:'检查账号与登录',running:true};
  const display=treePresentation(node,{running:true,pendingInteraction:{kind:'approval'}});
  assert.equal(display.label,'检查账号与登录');assert.equal(display.state,'等待批准');assert.match(display.title,/队员：acct/);
  assert.equal(treePresentation(node,{running:false,pendingInteraction:{kind:'question'}}).state,'等待回答');
  assert.equal(treePresentation(node,{running:false,pendingInteraction:{kind:'plan-review'}}).state,'等待方案确认');
  assert.equal(treePresentation(node,{running:false}).state,'');
  assert.equal(treePresentation({...node,note:'创建失败'},{running:false}).state,'创建失败');
  assert.equal(treePresentation({...node,description:''}).label,'acct');
  assert.equal(treePresentation({...node,description:'你是政府端 UI 实测审计员，负责'}).label,'acct');
  assert.equal(treePresentation({...node,description:'You are performing an exhaustive review'}).label,'acct');
});

test('ordinary child management handles rename, pin, failure and archive confirmation; team and running guards apply',async()=>{
  const env=installDom(),calls=[],dialogs=createSessionDialogStore();let fail=false,changes=0;
  const controls={
    Menu:({open,anchor,items,onSelect})=>React.createElement('span',null,anchor,open&&items.map(item=>React.createElement('button',{key:item.id,role:'menuitem',disabled:item.disabled,onClick:()=>onSelect(item.id)},item.label))),
    Modal:({open,children,footer})=>open?React.createElement('div',{role:'dialog'},children,footer):null,
    Button:({variant,...props})=>React.createElement('button',{'data-variant':variant,...props}),
  };
  const actions={rename:async(id,title)=>{calls.push(['rename',id,title]);if(fail)throw Error('offline');},pin:async(...args)=>calls.push(['pin',...args]),archive:async id=>calls.push(['archive',id])};
  const render=async(session=ordinary('child'),pinned=false)=>act(async()=>env.root.render(React.createElement(React.Fragment,null,React.createElement(SessionDialogOutlet,{dialogs}),React.createElement(SessionActionsMenu,{session,pinned,actions,controls,dialogs,onChanged:()=>changes++}))));
  const click=async(text)=>act(async()=>[...document.querySelectorAll('button')].find(e=>e.textContent===text).click());
  const submit=async()=>act(async()=>document.querySelector('form').dispatchEvent(new env.dom.window.Event('submit',{bubbles:true,cancelable:true})));
  try{
    await render();await click('···');await click('重命名');fail=true;await submit();
    assert.ok(document.querySelector('[role=alert]'));assert.ok(document.querySelector('input'));assert.equal(changes,0);
    fail=false;await submit();assert.equal(document.querySelector('[role=dialog]'),null);assert.equal(changes,1);assert.deepEqual(calls.slice(0,2),[['rename','child','child'],['rename','child','child']]);
    await click('···');await click('置顶');assert.deepEqual(calls.at(-1),['pin','child',true]);
    await render(ordinary('child'),true);await click('···');await click('取消置顶');assert.deepEqual(calls.at(-1),['pin','child',false]);
    await click('···');await click('归档');assert.notEqual(calls.at(-1)[0],'archive');await submit();assert.deepEqual(calls.at(-1),['archive','child']);
    await render({...ordinary('child'),running:true});await click('···');assert.equal([...document.querySelectorAll('[role=menuitem]')].find(e=>e.textContent==='归档').disabled,true);
    await render({...ordinary('member'),subagent:true});assert.equal(document.querySelector('button'),null);
  }finally{await act(async()=>env.root.unmount());env.restore();}
});
