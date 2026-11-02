import test from 'node:test';
import assert from 'node:assert/strict';
import {host,value} from './fixture.mjs';

test('real Host teaches parent replyTo separately from optional new id and diagnoses parent-id reuse',async t=>{
  const h=await host();t.after(()=>h.close());const a=await h.create('guidance-A'),b=await h.create('guidance-B');
  await h.rpc('policy',{id:b.agent.id,input:{mode:'accept',senders:[a.agent.id],crossWorkspace:false,alias:'B'}});
  value(await h.tool(a.agent,'session_message_send',{id:'guidance-parent',target:b.agent.id,text:'Synthetic tag task; return one explicit reply.'}));await b.agent.whenIdle();
  const call=h.adapter.calls[0],tool=call.tools.find(t=>t.name==='session_message_reply');
  assert.match(tool.parameters.properties.replyTo.description,/received parent message ID/);
  assert.match(tool.parameters.properties.id.description,/new reply.*[Oo]mit/);
  const incoming=call.messages.find(m=>m.source?.kind==='plugin:dsh-session-messenger').content[0].text;
  assert.match(incoming,/replyTo=guidance-parent/);assert.match(incoming,/omit.*id/i);
  const bad=await h.tool(b.agent,'session_message_reply',{id:'guidance-parent',replyTo:'guidance-parent',text:'Synthetic result'});
  assert.equal(bad.isError,true);assert.match(JSON.stringify(bad),/ID_CONFLICT.*omit id/);
  const reply=value(await h.tool(b.agent,'session_message_reply',{replyTo:'guidance-parent',text:'Synthetic result'}));await a.agent.whenIdle();
  assert.notEqual(reply.id,'guidance-parent');const state=(await h.rpc('view')).state;
  assert.equal(state.messages[reply.id].replyTo,'guidance-parent');assert.equal(state.messages[reply.id].target,a.agent.id);
  assert.equal(Object.values(state.messages).filter(x=>x.replyTo==='guidance-parent').length,1);
});
