import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {Context,Service} from '@deepseek-ai/cordis';
import * as cordis from '@deepseek-ai/cordis';
import * as reactDomClient from 'react-dom/client';
import * as reactDom from 'react-dom';
import * as slotContracts from '@deepseek-ai/dsh-client-ui-slots';
import {remoteContribution} from '../dist/contract.js';
test('actual DSH remote lifecycle retains old draft serialization without adding a visible @ group',async()=>{
  let bundle;
  vm.runInNewContext(await readFile(new URL('../dist/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:value=>{bundle=value;}}},console,globalThis,crypto:webcrypto,TextEncoder,TextDecoder});
  assert.equal(bundle.id,'@leoan698-tom/dsh-agent-hub');
  const client=bundle.factory(name=>{if(name==='react')return React;if(name==='react/jsx-runtime')return jsxRuntime;if(name==='react-dom')return reactDom;throw new Error(`Unexpected runtime external ${name}`);});
  let rendererBundle;
  vm.runInNewContext(await readFile(new URL(import.meta.resolve('@deepseek-ai/dsh-client-ui-renderer/client')),'utf8'), {window:{__ModuleLoader__:{load:value=>{rendererBundle=value;}}},console,globalThis});
  const renderer=rendererBundle.factory(name=>{if(name==='react')return React;if(name==='react/jsx-runtime')return jsxRuntime;if(name==='@deepseek-ai/dsh-client-ui-primitives')return {MenuItemButton:({onSelect,icon,children})=>React.createElement('button',{role:'menuitem',onClick:onSelect},icon,children)};if(name==='react-dom')return reactDom;if(name==='react-dom/client')return reactDomClient;if(name==='@deepseek-ai/dsh-client-ui-slots')return slotContracts;if(name==='@deepseek-ai/cordis')return cordis;throw new Error(`Unexpected renderer external ${name}`);});
  const ctx=new Context();const slots=new renderer.SlotRegistry(ctx);let mounted;
  slots.register({name:'root',children:{'plugins.bundle.config':{kind:'keyed',scope:'root'},'conversation.composer.dock':{kind:'list',scope:'session'}}},()=>null);
  // The official Gateway mounts a separate Cordis service for each remote namespace.
  // Reading remote.sessionMessenger therefore needs a nested service injection.
  let namespaceFiber;
  class Remote extends Service {
    constructor(context){super(context,'remote');this.ownerCtx=context;}
    async $mount(value){
      mounted=value;
      namespaceFiber=this.ownerCtx.plugin({name:'remote.sessionMessenger',apply:context=>{new MessengerNamespace(context);new CollaborationNamespace(context);}});
      await namespaceFiber;
      return ()=>namespaceFiber.dispose();
    }
  }
  class MessengerNamespace extends Service {
    constructor(context){super(context,'remote.sessionMessenger');}
    view(){return {ok:true,value:'synthetic namespace'};}
  }
  let recipientSource;
  class InputTriggers extends Service {
    constructor(context){super(context,'inputTriggers');}
    registerSource(source){recipientSource=source;return()=>{recipientSource=undefined;};}
  }
  class CollaborationNamespace extends Service {
    constructor(context){super(context,'remote.sessionCollaboration');}
    candidates(){return Promise.resolve({ok:true,value:[]});}
  }
  new Remote(ctx);
  new InputTriggers(ctx);
  await ctx.plugin(client);
  assert.deepEqual(Array.from(mounted.descriptors,d=>d.method),remoteContribution.descriptors.map(d=>d.method));
  assert.equal(slots.entries('plugins.bundle.config').length,0);
  assert.equal(ctx.get('remote.sessionReferenceResolver'),undefined);
  assert.equal(recipientSource?.name,'messenger-target');
  assert.equal((await recipientSource.candidates()).length,0);
  assert.equal(slots.entries('conversation.composer.dock').length,0);
  await namespaceFiber.dispose();assert.equal(slots.entries('plugins.bundle.config').length,0);assert.equal(recipientSource,undefined);
  namespaceFiber=ctx.plugin({name:'remote.sessionMessenger',apply:context=>{new MessengerNamespace(context);new CollaborationNamespace(context);}});
  await namespaceFiber;assert.equal(slots.entries('plugins.bundle.config').length,0);assert.equal(recipientSource?.name,'messenger-target');
  await ctx.fiber.dispose();assert.equal(slots.entries('plugins.bundle.config').length,0);
});

test('browser bundle leaves native file and session references as the only visible @ source',async()=>{
  let bundle;
  vm.runInNewContext(await readFile(new URL('../dist/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:value=>{bundle=value;}}},console,globalThis,crypto:webcrypto,TextEncoder,TextDecoder});
  const client=bundle.factory(name=>{if(name==='react')return React;if(name==='react/jsx-runtime')return jsxRuntime;if(name==='react-dom')return reactDom;throw new Error(`Unexpected runtime external ${name}`);});
  const entries=[];let source;
  const nativeRows=[{name:'Project B',value:'native-session'},{name:'README.md',value:'native-file'}];
  const native={name:'reference',trigger:'@',candidates:async()=>nativeRows};
  const sources=[native];
  const ctx={
    remote:{
      $mount:async()=>{},
      sessionMessenger:{},
      sessionCollaboration:{candidates:async()=>{throw Error('Native reference source owns discovery');}},
    },
    slots:{inject:(_key,register)=>register(),register:(entry,component)=>{entries.push({entry,component});return()=>{};}},
    inputTriggers:{registerSource(value){source=value;sources.push(value);return()=>{source=undefined;};}},
    effect:factory=>factory(),
  };
  ctx.inject=async(_deps,callback)=>callback(ctx);
  await client.apply(ctx);
  assert.equal(entries.some(x=>x.entry.name==='plugins.bundle.config'),false);
  assert.equal(entries.some(x=>x.entry.name==='conversation.composer.dock'),false);
  assert.equal(entries.some(x=>x.entry.name==='sidebar.workspaces'),false,'native workspace header and controls keep their owner');
  assert.ok(entries.find(x=>x.entry.id==='messenger-session-children'));
  assert.equal(source.trigger,'@');
  const rows=(await Promise.all(sources.map(s=>s.candidates()))).flat();
  assert.deepEqual(rows,nativeRows,'session entries occur once and native file references remain intact');
  assert.equal(sources[0],native,'the Host source is not patched or replaced');
  assert.match(await source.codec.serialize('@[B](dsh-message-target:IkIi)'),/dsh-session:/);
});
