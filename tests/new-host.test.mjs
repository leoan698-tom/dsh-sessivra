import test from 'node:test';
import assert from 'node:assert/strict';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import Skills from '@deepseek-ai/dsh-skill';
import * as ToolSkill from '@deepseek-ai/dsh-tool-skill';
import WorkingDirectory from '@deepseek-ai/dsh-working-directory';
import LocalFs from '@deepseek-ai/dsh-fs-local';
import { host } from './fixture.mjs';
import { createAdapter, createWaitTool } from './support/adapter.mjs';

const prompt = (agent, text) => agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text }] }));
const mention = id => `@[B](dsh-message-target:${Buffer.from(JSON.stringify(id)).toString('base64url')})`;
async function installFixture(h, targets, observations) {
  const io = { loadTargets: async () => targets, record: async (kind, action, detail) => observations.push({ kind, action, detail }) };
  const adapter = createAdapter(io);
  const stream = adapter.stream.bind(adapter);
  adapter.stream = async function* (options) {
    const messages = options.messages;
    const direct = messages.findLastIndex(m => m.role === 'user' && m.source.kind === 'user');
    observations.push({ trailing: messages.slice(direct + 1).filter(m => m.role === 'user').map(m => ({ kind: m.source.kind, form: m.source.form, update: m.source.update })) });
    yield* stream(options);
  };
  h.ctx.llm.registerAdapter(['at27-free'], adapter);
  return id => h.ctx.agents.create({ sessionId: id, agentOptions: { provider: 'at27-free', model: 'fixture' }, meta: { cwd: h.root } });
}

test('new Host real skill producer: initial, unchanged and updated catalogs preserve direct input', { timeout: 15000 }, async t => {
  const h = await host(); t.after(() => h.close());
  for (const p of [LocalFs, WorkingDirectory, Skills]) await h.ctx.plugin(p);
  await h.ctx.plugin(ToolSkill);
  h.ctx.skills.register({ name: 'synthetic-one', description: 'Synthetic test skill.', source: 'runtime', content: 'Synthetic only.' });
  const observations = [], create = await installFixture(h, {}, observations);
  const a = await create('session-new-host-catalog-A');
  prompt(a.agent, 'AT27_ANALYZE_SELECT'); await a.agent.whenIdle();
  assert.ok(observations.some(row => row.trailing?.some(m => m.kind === 'skill-catalog' && m.form === 'catalog')));
  assert.ok(observations.some(row => row.detail === 'AT27_ANALYSIS_READY'));
  observations.length = 0;
  prompt(a.agent, 'AT27_ANALYZE_SELECT'); await a.agent.whenIdle();
  assert.ok(observations.some(row => row.trailing && row.trailing.every(m => m.kind !== 'skill-catalog')));
  assert.ok(observations.some(row => row.detail === 'AT27_ANALYSIS_READY'));
  h.ctx.skills.register({ name: 'synthetic-two', description: 'Another synthetic skill.', source: 'runtime', content: 'Synthetic only.' });
  observations.length = 0;
  prompt(a.agent, 'AT27_ANALYZE_SELECT'); await a.agent.whenIdle();
  assert.ok(observations.some(row => row.trailing?.some(m => m.kind === 'skill-catalog' && m.update === true)));
  assert.ok(observations.some(row => row.detail === 'AT27_ANALYSIS_READY'));
});

test('new fixture drives actual A selected/send, B reply, same-B busy steer and later dispatch', { timeout: 15000 }, async t => {
  const h = await host(); t.after(() => h.close());
  const observations = [], targets = {}, create = await installFixture(h, targets, observations);
  const a = await create('session-new-host-flow-A'), b = await create('session-new-host-flow-B');
  targets.source = a.agent.id; targets.idle = b.agent.id;
  prompt(a.agent, `AT27_ANALYZE_SELECT ${mention(b.agent.id)}`); await a.agent.whenIdle();
  assert.equal(Object.keys((await h.rpc('view')).state.messages).length, 0);
  const selected = await h.rpc('selectedFor', { sourceId: a.agent.id });
  await h.rpc('authorizeSelected', { sourceId: a.agent.id, revision: selected.revision });
  prompt(a.agent, 'AT27_SEND_IDLE'); await a.agent.whenIdle(); await b.agent.whenIdle(); await a.agent.whenIdle();
  const first = (await h.rpc('view')).state.messages;
  assert.equal(first['at27-idle-01'].sender, a.agent.id);
  assert.equal(first['at27-idle-01'].origin, 'agent');
  assert.equal(first['at27-reply-idle-01'].replyTo, 'at27-idle-01');
  assert.equal(first['at27-reply-idle-01'].target, a.agent.id);
  let ready, release, aborted = false;
  const readyPromise = new Promise(resolve => { ready = resolve; });
  const releasePromise = new Promise(resolve => { release = resolve; });
  h.ctx.tools.register(createWaitTool(async (agent, signal) => {
    assert.equal(agent, b.agent);
    signal.addEventListener('abort', () => { aborted = true; }, { once: true });
    ready(); await releasePromise; return { released: true, case: 'N4' };
  }));
  t.after(() => release());
  prompt(b.agent, 'AT27_BUSY_BEGIN'); await readyPromise;
  assert.equal(b.agent.status, 'running');
  prompt(a.agent, 'AT27_SEND_BUSY'); await a.agent.whenIdle();
  assert.equal(b.agent.status, 'running'); assert.equal(aborted, false);
  release(); await b.agent.whenIdle();
  assert.ok(observations.some(row => row.detail === 'AT27_DIRECTION_APPLIED'));
  assert.equal(aborted, false);
  prompt(a.agent, 'AT27_SEND_LATER'); await a.agent.whenIdle(); await b.agent.whenIdle();
  const messages = (await h.rpc('view')).state.messages;
  assert.equal(Object.keys(messages).length, 4);
  assert.equal(messages['at27-later-01'].target, b.agent.id);
  assert.ok(observations.some(row => row.detail === 'AT27_WORK_RECEIVED_at27-later-01'));
});

test('new Gateway rejects disposed and non-owner test carriers without an access policy', async t => {
  const h = await host(); t.after(() => h.close());
  const invoke = peer => h.ctx.typertGateway.invoke({ namespace: 'sessionMessenger', method: 'view', args: {}, peer });
  await assert.rejects(invoke({ ...h.peer, principal: { kind: 'synthetic-untrusted' } }), /access denied/);
  const lifetime = new AbortController(); lifetime.abort();
  await assert.rejects(invoke({ ...h.peer, signal: lifetime.signal }), /disposed/);
  assert.equal(Object.keys((await h.rpc('view')).state.messages).length, 0);
});
