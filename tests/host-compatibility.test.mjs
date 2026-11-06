import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import semver from 'semver';
test('manifest accepts both validated hosts and rejects unvalidated releases', async()=>{
 const p=JSON.parse(await readFile(new URL('../package.json',import.meta.url)));
 for(const v of ['0.2.1-rc.5','0.2.2-rc.1']) {
  assert.ok(semver.satisfies(v,p.engines.dsh));
  for(const [name,range] of Object.entries(p.peerDependencies))if(name.startsWith('@deepseek-ai/dsh-'))assert.ok(semver.satisfies(v,range),name);
 }
 for(const v of ['0.2.1-rc.4','0.2.2-rc.2','0.2.2','0.3.0'])assert.equal(semver.satisfies(v,p.engines.dsh),false);
});

import {taskHost} from './support/tasks-host.mjs';
import {value} from './fixture.mjs';
test('ordinary child creation works with a controller that has no legacy inspect method', async t=>{
 const h=await taskHost(t);
 h.ctx.provide('sessionController',{
  create:async ({sessionId,cwd})=>{await h.create(sessionId,cwd);return {sessionId};},
  rename:async()=>{},
  resolveAgent:async id=>({agent:h.ctx.agents.get(id)}),
 });
 const parent=(await h.create('compat-parent')).agent;
 const child=value(await h.tool(parent,'session_create_child',{requestId:'no-inspect',label:'compat child',prompt:'verify child identity'}));
 assert.equal(child.kind,'conversation');
 assert.notEqual(child.status,'not-confirmed',JSON.stringify(child));
 assert.equal(child.parentId,parent.id);
 await h.ctx.agents.get(child.id).whenIdle();
 const retry=value(await h.tool(parent,'session_create_child',{requestId:'no-inspect',label:'compat child',prompt:'verify child identity'}));
 assert.equal(retry.id,child.id);
});
