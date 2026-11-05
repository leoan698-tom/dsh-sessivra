// Isolated browser verification; does not attach to the user's desktop/profile.
// Set PLAYWRIGHT_MODULE to an installed playwright or playwright-core entry.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const out = new URL('../artifacts/session-views/', import.meta.url);
await mkdir(out, { recursive: true });
const built = await build({ stdin: { contents: `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {createHeaderViews} from './src/header-views.tsx';
import {SessionViews,createSessionViews} from './src/session-views.tsx';
import {createSessionTreeStore} from './src/session-tree.tsx';
const sessions=[{id:'main',label:'主会话',subagent:false},{id:'design',label:'交互设计',subagent:false},{id:'build',label:'功能开发',subagent:false},{id:'review',label:'代码检查',subagent:false},{id:'qa',label:'验收测试',subagent:false}];
const store=createSessionTreeStore({tree:async()=>({ok:true,value:sessions})});
window.retained=[];window.released=[];
const views=createSessionViews({retain(target){window.retained.push(target);return{sessionId:target,ready:Promise.resolve(),release:()=>window.released.push(target)}}});
const Scope=React.createContext('');
window.viewSelections=[];const headerViews=createHeaderViews();
function Header(){const id=React.useContext(Scope);const [view,setView]=React.useState('对话');React.useEffect(()=>headerViews.register(id,{views:[{id:'chat',label:'对话'},{id:'trajectory',label:'轨迹'}],current:view==='对话'?'chat':'trajectory',selectView:key=>{const name=key==='chat'?'对话':'轨迹';setView(name);window.viewSelections.push([id,name])}}),[id,view]);return <header data-fixture-header={id}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',height:32}}><nav aria-label="会话层级" style={{display:'flex',alignItems:'center'}}>原生会话标题栏 {id}</nav><div data-conversation-header-corner/></div><div><div data-conversation-tabs>{['对话','轨迹'].map(name=><button key={name} role="tab" aria-selected={view===name} onClick={()=>{setView(name);window.viewSelections.push([id,name])}}>{name}</button>)}</div></div></header>}
function Menu({anchor,open,items,onSelect}){return <>{anchor}{open&&createPortal(<div role="menu" style={{position:'fixed',top:60,left:300,zIndex:100,background:'white',padding:8}}>{items.map(item=><button key={item.id} role="menuitem" onClick={()=>onSelect(item.id)}>{item.label}</button>)}</div>,document.body)}</>}

function Content(){const id=React.useContext(Scope);return <div data-conversation-content><div data-conversation-scroll><p>这是 {id} 会话的独立内容区域。</p><p>用于验证布局、拖放与草稿隔离。</p></div><div data-native-controls>{['统计','完成状态','模型选择','发送'].map(name=><button key={name} className="native-control">{name}</button>)}</div><textarea aria-label={'草稿 '+id} placeholder="输入消息…"/></div>}
createRoot(document.getElementById('overlay')).render(<SessionViews views={views} store={store} Menu={Menu} headerViews={headerViews} selectSession={()=>{}} startSession={()=>{}} useSessions={select=>select({byId:{main:{id:'main',retainedBy:{mainView:1}}}})} usePanelInfo={select=>select({activePanelId:null})} SessionProvider={({session,children})=><Scope.Provider value={session.sessionId}>{children}</Scope.Provider>} renderSlot={name=>name==='sessivra.conversation.header'?<Header/>:<Content/>}/>);
`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, format: 'iife', write: false });
const html = `<!doctype html><html lang="zh"><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;font:14px system-ui;background:#faf9f6;color:#262624;--dsw-alias-label-primary:#262624;--dsw-alias-label-secondary:#55554e;--dsw-alias-bg-layer-1:#fff;--dsw-alias-border-l2:#d5d4ce;--dsw-focus-ring-color:#b06345;display:flex;height:100vh}aside{width:200px;flex:none;padding:20px;background:#f0efea}aside div{padding:12px 0;cursor:grab}main{flex:1;min-width:0;display:flex;flex-direction:column;height:100vh}main>header,[data-slot="conversation.header"]>header{padding:16px;border-bottom:1px solid #d5d4ce} [data-conversation-content]{display:flex;flex:1;min-height:0;flex-direction:column;padding:16px;overflow:hidden} [data-conversation-scroll]{flex:1;overflow:auto}textarea{width:100%;min-height:70px;resize:none;border:1px solid #d5d4ce;border-radius:12px;padding:12px;font:inherit}button,select{font:inherit}.native-control{font:13px system-ui;padding:0;border:0;border-radius:0;background:transparent}
</style><aside><h3>工作区</h3>${['main','design','build','review','qa'].map(id=>`<div draggable="true" data-row-key="session:${id}">${id}</div>`).join('')}</aside><main data-phase="active"><div data-slot="conversation.header" style="display:contents"><header><div style="display:flex;align-items:center;justify-content:space-between;height:32px"><nav aria-label="会话层级">主会话 · 原生标题栏</nav><div data-conversation-header-corner></div></div><div><div data-conversation-tabs><button role="tab" aria-selected="true">对话</button><button role="tab">轨迹</button></div></div></header></div><div data-conversation-content><div data-conversation-scroll>主会话历史记录</div><div data-native-controls><button class="native-control">统计</button><button class="native-control">完成状态</button><button class="native-control">模型选择</button><button class="native-control">发送</button></div><textarea aria-label="主草稿">保留的主会话草稿</textarea></div></main><div id="overlay"></div><script>${built.outputFiles[0].text}</script></html>`;
await writeFile(new URL('fixture.html', out), html);
const server = createServer((_req, res) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(html); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const moduleName = process.env.PLAYWRIGHT_MODULE;
if (!moduleName) throw new Error('Set PLAYWRIGHT_MODULE to the installed playwright entry');
const { chromium } = await import(moduleName.includes(':') ? pathToFileURL(moduleName).href : moduleName);
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
const report = [];
const native = page.locator('main>[data-conversation-content]');
const pane = id => id === '$main' ? native : page.locator(`[data-sessivra-pane="${id}"]`);
const box = async id => { const rect=await pane(id).boundingBox();assert.ok(rect);return rect; };
const edgePoint = (rect, edge) => ({x:edge==='left'?4:edge==='right'?rect.width-4:rect.width/2,y:edge==='top'?4:edge==='bottom'?rect.height-4:rect.height/2});
async function dock(source, target, edge, existing=false) {
  const before = await box(target);
  const from = source === '$main' ? page.locator('[data-row-key="session:main"]') : existing ? page.locator(`[data-view-source="${source}"]`) : page.locator(`[data-row-key="session:${source}"]`);
  await from.dragTo(pane(target), {targetPosition:edgePoint(before,edge)});
  await page.waitForFunction(()=>document.querySelector('.sessivra-drop-preview')===null);
}
async function resizeDivider(locator, ratio) {
  const r=await locator.boundingBox(),axis=await locator.getAttribute('data-axis');
  const canvas=await page.locator('[data-sessivra-canvas]').boundingBox();
  await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();
  await page.mouse.move(axis==='x'?canvas.x+canvas.width*ratio:r.x+r.width/2,axis==='y'?canvas.y+canvas.height*ratio:r.y+r.height/2,{steps:12});
  await page.mouse.up();
}
try {
  const url=`http://127.0.0.1:${server.address().port}`;
  for(const edge of ['left','right','top','bottom']){
    await page.goto(url);await page.locator('[data-sessivra-canvas]').waitFor();await page.waitForFunction(()=>{const m=document.querySelector('main'),c=document.querySelector('[data-sessivra-canvas]');return m.querySelector('[data-sessivra-compact]')&&Math.abs(parseFloat(m.style.getPropertyValue('--sessivra-main-height'))-c.getBoundingClientRect().height)<1});
    const previewBefore=await box('$main');
    const point=edgePoint(previewBefore,edge);
    await page.evaluate(({x,y})=>{
      const source=document.querySelector('[data-row-key="session:design"]');
      const transfer=new DataTransfer();source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));
      document.querySelector('main').dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer,clientX:x,clientY:y}));
    },{x:previewBefore.x+point.x,y:previewBefore.y+point.y});
    const preview=page.locator('.sessivra-drop-preview');await preview.waitFor();
    assert.equal(await preview.textContent(),'','preview has no text');
    const style=await preview.evaluate(element=>{const s=getComputedStyle(element);return {color:s.borderTopColor,width:s.borderTopWidth,background:s.backgroundColor};});
    assert.deepEqual(style,{color:'rgb(59, 130, 246)',width:'3px',background:'rgba(0, 0, 0, 0)'});
    const pb=await preview.boundingBox();
    assert.ok(Math.abs(pb.width-(edge==='left'||edge==='right'?previewBefore.width/2:previewBefore.width))<1);
    assert.ok(Math.abs(pb.height-(edge==='top'||edge==='bottom'?previewBefore.height/2:previewBefore.height))<1);
    assert.ok(Math.abs(pb.x-(edge==='right'?previewBefore.x+previewBefore.width/2:previewBefore.x))<1);
    assert.ok(Math.abs(pb.y-(edge==='bottom'?previewBefore.y+previewBefore.height/2:previewBefore.y))<1);
    if(edge==='bottom')await page.screenshot({path:new URL('blue-preview-bottom.png',out).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
    await page.keyboard.press('Escape');await preview.waitFor({state:'detached'});
    await dock('design','$main',edge);
    await page.getByLabel('草稿 design').waitFor();
    const parity=await page.locator('[data-native-controls]').evaluateAll(groups=>groups.map(group=>[...group.children].map(button=>{const s=getComputedStyle(button);return ['fontSize','fontWeight','padding','borderTopWidth','borderRadius','backgroundColor'].map(key=>s[key]);})));
    assert.deepEqual(parity[1],parity[0],'native controls must keep exactly the same styles in an auxiliary pane');
    assert.equal(await page.locator('.sessivra-views-toolbar,select,input[type=range]').count(),0,'no control bar');
    assert.equal(await page.getByLabel('关闭视图：交互设计').innerText(),'');
    await page.waitForFunction(()=>document.querySelectorAll('[data-sessivra-compact]').length===2);
    assert.deepEqual(await page.locator('[data-sessivra-compact]').evaluateAll(headers=>headers.map(header=>Math.round(header.getBoundingClientRect().height))),[40,40]);
    assert.equal(await page.locator('[data-conversation-tabs]:visible').count(),0,'tab rows are inside menus');
    await page.getByLabel('视图菜单：交互设计').click();await page.getByRole('menuitem',{name:'轨迹'}).click();
    assert.deepEqual(await page.evaluate(()=>window.viewSelections.at(-1)),['design','轨迹']);
    await page.getByLabel('视图菜单：交互设计').click();await page.getByRole('menuitem',{name:'对话'}).click();
    const m=await box('$main'),a=await box('design');
    const mh=await page.locator('[data-sessivra-main-header]').boundingBox();
    assert.ok(Math.abs(mh.x-m.x)<1 && Math.abs(mh.width-m.width)<1,'main header follows its own pane width');
    assert.ok(Math.abs(mh.y+mh.height-m.y)<1,'main header is directly above its own content');
    const ah=await page.locator('[data-sessivra-pane="design"] .sessivra-pane-header').boundingBox();
    assert.ok(Math.abs(ah.y-a.y-1)<1,'additional header belongs to its pane');
    if(edge==='left'||edge==='right')assert.ok(Math.abs(mh.y-a.y)<1,'side-by-side headers align at the pane top');
    assert.equal(await page.locator('[data-row-key="session:design"]').getAttribute('data-sessivra-visible'),'true');
    assert.ok(edge==='left'?a.x<m.x:edge==='right'?a.x>m.x:edge==='top'?a.y<m.y:a.y>m.y,JSON.stringify({edge,m,a}));
    assert.equal(await page.getByLabel('主草稿').inputValue(),'保留的主会话草稿');
    report.push({check:`drop ${edge} splits the target pane`,pass:true});
  }
  // Nested mixed axes: add below an existing pane, and above main, without
  // repartitioning the other branch; then resize each axis independently.
  await page.goto(url);await page.locator('[data-sessivra-canvas]').waitFor();await page.waitForFunction(()=>{const m=document.querySelector('main'),c=document.querySelector('[data-sessivra-canvas]');return m.querySelector('[data-sessivra-compact]')&&Math.abs(parseFloat(m.style.getPropertyValue('--sessivra-main-height'))-c.getBoundingClientRect().height)<1});
  await dock('design','$main','right');await page.getByLabel('草稿 design').fill('设计草稿');
  const designBefore=await box('design');
  await dock('build','design','bottom');await page.getByLabel('草稿 build').fill('开发草稿');
  assert.equal((await box('design')).x,designBefore.x);
  await dock('review','$main','top');await page.getByLabel('草稿 review').waitFor();
  const separators=page.getByRole('separator');assert.equal(await separators.count(),3);
  const outer=page.locator('[data-split-id="split-1"]');
  await resizeDivider(outer,.62);
  const ratio=Number(await outer.getAttribute('aria-valuenow'));assert.ok(ratio>=60&&ratio<=64,String(ratio));
  const inner=page.locator('[data-split-id="split-2"]');
  await resizeDivider(inner,.35);
  assert.ok(Number(await inner.getAttribute('aria-valuenow'))<40);
  const rectangles={};for(const id of ['$main','design','build','review'])rectangles[id]=await box(id);
  assert.ok(rectangles.design.height<rectangles.build.height);
  assert.ok(rectangles.$main.width>rectangles.design.width);
  assert.equal(await page.getByLabel('草稿 design').inputValue(),'设计草稿');
  assert.equal(await page.getByLabel('草稿 build').inputValue(),'开发草稿');
  assert.equal(await page.getByLabel('主草稿').inputValue(),'保留的主会话草稿');
  report.push({check:'nested mixed axes and real pointer resizing produce nonuniform rectangles',pass:true,rectangles});
  await page.screenshot({path:new URL('free-split.png',out).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  await page.getByLabel('草稿 design').evaluate(element=>element.dataset.identity='original');
  await dock('design','build','left',true);
  assert.equal(await page.getByLabel('草稿 design').getAttribute('data-identity'),'original');
  assert.equal(await page.getByLabel('草稿 design').inputValue(),'设计草稿');
  assert.deepEqual(await page.evaluate(()=>window.retained),['design','build','review']);
  report.push({check:'moving a pane preserves its actual DOM, draft and reference',pass:true});
  await dock('$main','review','right',true);
  assert.equal(await page.getByLabel('主草稿').inputValue(),'保留的主会话草稿');
  assert.ok((await box('$main')).x>(await box('review')).x);
  report.push({check:'native main pane can be redocked without remount',pass:true});
  const selected=page.locator('[data-split-id="split-4"]');
  await selected.focus();const old=Number(await selected.getAttribute('aria-valuenow'));
  await page.keyboard.press('ArrowRight');assert.equal(Number(await selected.getAttribute('aria-valuenow')),old+2);
  await selected.focus();await page.keyboard.press('End');assert.equal(Number(await selected.getAttribute('aria-valuenow')),90);
  await page.keyboard.press('Home');assert.equal(Number(await selected.getAttribute('aria-valuenow')),10);
  // Restore useful reading size using the same non-drag adjustment path.
  await selected.focus();await page.keyboard.press('ArrowRight');
  report.push({check:'keyboard separator adjustment and ratio bounds work',pass:true});
  // More than four panes: removal of the old fixed four-view constraint.
  await dock('qa','review','bottom');await page.getByLabel('草稿 qa').waitFor();
  assert.equal(await page.locator('.sessivra-pane').count(),4);
  report.push({check:'fifth view can be split without preset layout limits',pass:true});
  const beforeClose=await separators.count();await page.getByLabel('关闭视图：验收测试').click();
  await page.waitForFunction(count=>document.querySelectorAll('[role="separator"]').length===count,beforeClose-1);
  assert.equal(await separators.count(),beforeClose-1);
  assert.equal(await page.getByLabel('草稿 design').inputValue(),'设计草稿');
  await page.setViewportSize({width:650,height:900});
  await page.waitForFunction(()=>parseFloat(document.querySelector('[data-sessivra-canvas]').getBoundingClientRect().width)<500);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await separators.count(),3,'narrow viewport preserves the split structure');
  await page.screenshot({path:new URL('free-split-narrow.png',out).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  report.push({check:'closing collapses only that branch; resizing viewport retains structure without overflow',pass:true});
  for(const label of ['关闭视图：交互设计','关闭视图：功能开发','关闭视图：代码检查']) await page.getByLabel(label).click();
  await page.waitForFunction(()=>document.querySelectorAll('[role="separator"]').length===0);
  assert.equal(await separators.count(),0);
  assert.deepEqual(await page.evaluate(()=>window.released.sort()),['build','design','qa','review']);
  assert.deepEqual(errors,[]);report.push({check:'close all releases references; no browser errors',pass:true});
  await writeFile(new URL('browser-results.json',out),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
