import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { value, productUnderTest } from './fixture.mjs';
import { taskHost, scenario, version, until, get, child } from './support/tasks-host.mjs';
import { treePresentation } from '../dist/session-tree.js';
import Subagents from '@deepseek-ai/dsh-subagent';
import * as Spawn from '@deepseek-ai/dsh-subagent-spawn-in-process';
import { Tasks } from '../dist/tasks.js';
import { emptyTaskState } from '../dist/task-schema.js';

const ask = task => ['session_task_question', { ...version(task), topic: 'database-engine', context: 'application-v1', question: `Question from ${task.title}: which database?`, options: ['PostgreSQL', 'SQLite'] }];
const submit = (task, evidence = ['fixture artifact']) => ['session_task_report', { ...version(task), phase: 'result', summary: 'Finished with evidence', done: task.acceptance, remaining: [], artifacts: evidence, evidence }];
const input = (agent, text) => agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text }] }));

test('automatic ordinary A -> build B -> review C -> acceptance; real files and exact session tree', { timeout: 15000 }, async t => {
  const h = await taskHost(t), artifact = join(h.root, 'build.json'), reviewArtifact = join(h.root, 'review.json');
  let buildOwner, reviewOwner, verifiedBuild = false, verifiedReview = false;
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  h.ctx.tools.register(defineTool({ name: 'fixture_build', description: 'Write isolated arithmetic artifact', parameters: {}, output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: JSON.stringify(v) }] }, execute: async (_a, exec) => { assert.equal(buildOwner, undefined, 'construction happens once'); buildOwner = exec.agent.id; await writeFile(artifact, JSON.stringify({ left: 17, right: 25, sum: 42 })); return { artifact }; } }));
  h.ctx.tools.register(defineTool({ name: 'fixture_review', description: 'Read artifact and create a separate verification report', parameters: {}, output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: JSON.stringify(v) }] }, execute: async (_a, exec) => { reviewOwner = exec.agent.id; const bytes = await readFile(artifact), data = JSON.parse(bytes); assert.equal(data.sum, data.left + data.right); const report = { valid: true, sha256: digest(bytes), reviewer: reviewOwner }; await writeFile(reviewArtifact, JSON.stringify(report)); return report; } }));
  h.ctx.tools.register(defineTool({ name: 'fixture_verify_build', description: 'Coordinator verifies actual construction', parameters: {}, output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: JSON.stringify(v) }] }, execute: async () => { const data = JSON.parse(await readFile(artifact)); assert.equal(data.sum, 42); verifiedBuild = true; return { accepted: true }; } }));
  h.ctx.tools.register(defineTool({ name: 'fixture_verify_review', description: 'Coordinator verifies actual reviewer report', parameters: {}, output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: JSON.stringify(v) }] }, execute: async () => { const report = JSON.parse(await readFile(reviewArtifact)); assert.equal(report.sha256, digest(await readFile(artifact))); assert.notEqual(report.reviewer, buildOwner); verifiedReview = true; return report; } }));
  scenario(h, {
    initial: () => ['session_task_create_child', { requestId: 'build', label: 'Construction', prompt: 'WF_BUILD: write arithmetic artifact', acceptance: ['17+25=42 file exists'] }],
    worker: task => task.goal.includes('WF_BUILD') ? !buildOwner ? ['fixture_build'] : submit(task, [artifact]) : !reviewOwner ? ['fixture_review'] : submit(task, [reviewArtifact]),
    coordinator: state => {
      const build = state.tasks.find(task => task.title === 'Construction'), review = state.tasks.find(task => task.title === 'Review');
      if (build?.status === 'review') return !verifiedBuild ? ['fixture_verify_build'] : ['session_task_review', { ...version(build), accepted: true, explanation: 'Read actual arithmetic file and checked 17+25=42.', evidence: [artifact] }];
      if (build?.status === 'completed' && !review) return ['session_task_create_child', { requestId: 'review', label: 'Review', prompt: 'WF_REVIEW: independently review the construction file', acceptance: ['hash and arithmetic verified without changing original'], scope: build.scopeId }];
      if (review?.status === 'review') return !verifiedReview ? ['fixture_verify_review'] : ['session_task_review', { ...version(review), accepted: true, explanation: 'Read independent review and matched artifact hash.', evidence: [reviewArtifact] }];
    },
  });
  const a = (await h.create('managed-A')).agent; input(a, 'WF_PARENT: build and independently verify the arithmetic artifact using child conversations.');
  await until(async () => { const list = value(await h.tool(a, 'session_task_list', {})); return list.items.length === 2 && list.items.every(task => task.status === 'completed'); }, 'A/B/C must complete automatically');
  await Promise.all(h.ctx.agents.list().map(agent => agent.whenIdle()));
  const tasks = value(await h.tool(a, 'session_task_list', {}));
  assert.ok(verifiedBuild && verifiedReview); assert.notEqual(buildOwner, reviewOwner);
  const tree = await h.ctx.typertGateway.invoke({ namespace: 'sessionCollaboration', method: 'tree', args: {}, peer: h.peer });
  for (const id of [buildOwner, reviewOwner]) { assert.equal(tree.find(row => row.id === id).parentId, a.id); assert.equal(h.ctx.agents.get(id).session.header.origin, undefined); }
  assert.equal(Object.keys(h.ctx.sessionMessenger.messenger.snapshot(true).messages).length, 0, 'managed lifecycle does not consume legacy one-reply chains');
  if (process.env.DSHSM_EVIDENCE_DIR) { await mkdir(process.env.DSHSM_EVIDENCE_DIR, { recursive: true }); await writeFile(join(process.env.DSHSM_EVIDENCE_DIR, 'managed-workflow.json'), JSON.stringify({ status: 'PASS', layer: 'official rc.5 Host and deterministic model adapter', tasks, ids: { A: a.id, B: buildOwner, C: reviewOwner }, artifactHash: digest(await readFile(artifact)), calls: h.adapter.calls.length, realModel: false, desktopNative: false }, null, 2)); }
});

test('two child questions share one decision and one coordinator notification; answer resumes both without manual copying', async t => {
  const h = await taskHost(t), a = (await h.create('decisions-A')).agent;
  scenario(h, { worker: (task, state) => state.questions.some(q => q.status === 'resolved') ? submit(task) : ask(task) });
  const b = await child(h, a, 'B', { scope: 'shared' }), c = await child(h, a, 'C', { scope: 'shared' });
  await until(async () => (await get(h, a, b.taskId)).status === 'waiting-decision' && (await get(h, a, c.taskId)).status === 'waiting-decision', 'both children waiting');
  const bt = await get(h, a, b.taskId), ct = await get(h, a, c.taskId), question = bt.questions[0];
  assert.equal(question.id, ct.questions[0].id); assert.equal(question.taskIds.length, 2);
  assert.equal([...bt.deliveries, ...ct.deliveries].filter(e => e.kind === 'question').length, 1);
  const first = value(await h.tool(a, 'session_task_escalate', { questionId: question.id, version: 1 }));
  const again = value(await h.tool(a, 'session_task_escalate', { questionId: question.id, version: 1 }));
  assert.equal(first.present, true); assert.equal(again.present, false);
  const fake = await h.tool(a, 'session_task_decide', { questionId: question.id, version: 1, answer: 'PostgreSQL', authority: 'user', userMessageId: 'peer-claimed-user' }); assert.equal(fake.isError, true);
  const noUser = await h.tool(a, 'session_task_decide', { questionId: question.id, version: 1, answer: 'PostgreSQL', authority: 'coordinator' }); assert.equal(noUser.isError, true);
  input(a, 'Use PostgreSQL for this application.'); await a.whenIdle();
  const userId = a.session.deriveMessages().findLast(m => m.role === 'user' && m.source.kind === 'user').id;
  value(await h.tool(a, 'session_task_decide', { questionId: question.id, version: 1, answer: 'PostgreSQL', authority: 'user', userMessageId: userId, userQuote: 'Use PostgreSQL for this application.' }));
  await until(async () => (await get(h, a, b.taskId)).status === 'review' && (await get(h, a, c.taskId)).status === 'review', 'answer unblocks same tasks');
  const before = (await get(h, a, b.taskId)).deliveries.length;
  assert.equal(value(await h.tool(a, 'session_task_decide', { questionId: question.id, version: 1, answer: 'PostgreSQL', authority: 'user', userMessageId: userId, userQuote: 'Use PostgreSQL for this application.' })).reused, true);
  assert.equal((await h.tool(a, 'session_task_decide', { questionId: question.id, version: 1, answer: 'SQLite', authority: 'coordinator' })).isError, true);
  assert.equal((await get(h, a, b.taskId)).deliveries.length, before);
  assert.equal((await get(h, a, b.taskId)).appliedDecisionRevision, 1);
});

test('updates during a running tool preserve it; new work waits through question and review until acceptance', async t => {
  const h = await taskHost(t), a = (await h.create('queue-A')).agent, entered = Promise.withResolvers(), release = Promise.withResolvers();
  t.after(() => release.resolve()); let signal, enteredOnce = false;
  h.ctx.tools.register(defineTool({ name: 'fixture_gate', description: 'Controlled tool boundary', parameters: {}, output: { schema: { type: 'json' }, render: () => [] }, execute: async (_a, exec) => { signal = exec.signal; entered.resolve(); await release.promise; return { finished: true }; } }));
  scenario(h, { worker: task => { if (task.title === 'First' && !enteredOnce) { enteredOnce = true; return ['fixture_gate']; } return submit(task); } });
  const b = await child(h, a, 'First'); await entered.promise;
  const initial = await get(h, a, b.taskId);
  const updated = value(await h.tool(a, 'session_task_update', { taskId: b.taskId, revision: initial.revision, goal: 'Updated timeout is five minutes; preserve original work', acceptance: ['artifact verified', 'five minutes'], explanation: 'user changed timeout' }));
  assert.equal(updated.revision, 2); assert.equal(updated.appliedRevision, 1); assert.equal(signal.aborted, false);
  assert.deepEqual(updated.checkpoint, initial.checkpoint, 'requirements changes preserve actual execution progress');
  await h.rpc('selectRecipient', { sourceId: a.id, targetId: b.id, label: 'B' });
  const selected = value(await h.tool(a, 'session_message_selected_target', {}));
  const queued = value(await h.tool(a, 'session_task_assign', { requestId: 'second', target: b.id, selectionRevision: selected.selectionRevision, title: 'Second', goal: 'Next task', acceptance: ['artifact verified'] }));
  assert.equal(queued.status, 'queued'); assert.equal(h.ctx.agents.get(b.id).inbox.nextTurn.length, 0, 'next TASK is not just next TURN');
  const stale = await h.tool(h.ctx.agents.get(b.id), 'session_task_report', { taskId: b.taskId, revision: 1, decisionRevision: 0, phase: 'result', summary: 'old version', remaining: [], evidence: ['old'] }); assert.equal(stale.isError, true);
  const directSend = await h.tool(a, 'session_message_send', { target: b.id, selectionRevision: selected.selectionRevision, text: 'overwrite active task', deliveryMode: 'insert' }); assert.equal(directSend.isError, true);
  release.resolve(); await until(async () => (await get(h, a, b.taskId)).status === 'review', 'updated first task returns result');
  const first = await get(h, a, b.taskId); assert.equal(first.appliedRevision, 2); assert.equal((await get(h, a, queued.id)).status, 'queued');
  value(await h.tool(a, 'session_task_review', { ...version(first), accepted: true, explanation: 'checked version 2', evidence: ['fixture verification'] }));
  await until(async () => (await get(h, a, queued.id)).status === 'review', 'acceptance releases next task');
});

test('task decisions are scoped; identical topics in unrelated scopes do not share answers', async t => {
  const h = await taskHost(t), a = (await h.create('scope-A')).agent;
  scenario(h, { worker: ask });
  const b = await child(h, a, 'B', { scope: 'project-one' }), c = await child(h, a, 'C', { scope: 'project-two' });
  await until(async () => (await get(h, a, b.taskId)).questions.length && (await get(h, a, c.taskId)).questions.length, 'questions recorded');
  assert.notEqual((await get(h, a, b.taskId)).questions[0].id, (await get(h, a, c.taskId)).questions[0].id);
  const outsider = (await h.create('outsider')).agent;
  assert.equal((await h.tool(outsider, 'session_task_get', { taskId: b.taskId })).isError, true);
  assert.equal((await h.tool(h.ctx.agents.get(b.id), 'session_task_decide', { questionId: (await get(h, a, b.taskId)).questions[0].id, version: 1, authority: 'coordinator', answer: 'SQLite' })).isError, true);
});

test('progress and reads do not wake the coordinator; idle is unfinished, not success', async t => {
  const h = await taskHost(t), a = (await h.create('idle-A')).agent;
  const b = await child(h, a, 'unfinished');
  await until(async () => (await get(h, a, b.taskId)).status === 'blocked', 'idle task becomes explicit unfinished blocker');
  await Promise.all(h.ctx.agents.list().map(agent => agent.whenIdle()));
  const before = h.adapter.calls.length, task = await get(h, a, b.taskId);
  assert.equal(task.reason, 'TURN_ENDED_WITHOUT_TASK_RESULT'); assert.equal(task.completionMeaning, 'not-accepted');
  await get(h, a, b.taskId); value(await h.tool(a, 'session_task_list', {})); assert.equal(h.adapter.calls.length, before);
  assert.equal((await h.tool(a, 'session_task_review', { ...version(task), accepted: true, explanation: 'idle', evidence: ['idle'] })).isError, true);
});

test('explicit cancellation waits for the tool boundary and retains checkpoint', async t => {
  const h = await taskHost(t), a = (await h.create('cancel-A')).agent, entered = Promise.withResolvers(), release = Promise.withResolvers(); let signal, attempts = 0;
  t.after(() => release.resolve());
  h.ctx.tools.register(defineTool({ name: 'fixture_cancel_gate', description: 'Work in flight', parameters: {}, output: { schema: { type: 'json' }, render: () => [] }, execute: async (_a, exec) => { signal = exec.signal; attempts++; entered.resolve(); await release.promise; return 'completed current effect'; } }));
  scenario(h, { worker: () => ['fixture_cancel_gate'] });
  const b = await child(h, a, 'B'); await entered.promise; const task = await get(h, a, b.taskId);
  const cancelling = value(await h.tool(a, 'session_task_control', { taskId: task.id, revision: task.revision, action: 'cancel', reason: 'user cancelled' }));
  assert.equal(cancelling.status, 'cancelling'); assert.equal(signal.aborted, false);
  release.resolve(); await until(async () => (await get(h, a, b.taskId)).status === 'cancelled', 'cancel applied at boundary');
  assert.equal(attempts, 1); assert.deepEqual((await get(h, a, b.taskId)).checkpoint.remaining, ['artifact verified']);
});

test('revocation blocks managed access and retry cannot restore permission', async t => {
  const h = await taskHost(t), a = (await h.create('revoke-A')).agent;
  scenario(h, { worker: ask }); const b = await child(h, a, 'B'); await h.ctx.agents.get(b.id).whenIdle();
  const selected = value(await h.tool(a, 'session_message_selected_target', {}));
  await h.rpc('revokeSelected', { sourceId: a.id, revision: selected.selectionRevision });
  assert.equal((await h.tool(a, 'session_task_get', { taskId: b.taskId })).isError, true);
  const retry = await h.tool(a, 'session_task_create_child', { requestId: 'B', label: 'B', prompt: 'B', acceptance: ['artifact verified'] }); assert.equal(retry.isError, true);
  assert.equal(value(await h.tool(a, 'session_message_selected_target', {})).permission, 'needsConsent');
});

test('same creation request is idempotent, conflicting payload is rejected without replacement', async t => {
  const h = await taskHost(t), a = (await h.create('idempotent-A')).agent;
  scenario(h, { worker: ask }); const b = await child(h, a, 'B'); const again = await child(h, a, 'B');
  assert.equal(b.id, again.id); assert.equal(b.taskId, again.taskId); assert.equal(h.ctx.agents.roots().length, 2);
  const conflict = await h.tool(a, 'session_task_create_child', { requestId: 'B', label: 'B', prompt: 'Changed work', acceptance: ['artifact verified'] }); assert.equal(conflict.isError, true);
  assert.equal(h.ctx.agents.roots().length, 2);
});

test('direct user input in child preserves task and advances revision; stale coordinator update fails', async t => {
  const h = await taskHost(t), a = (await h.create('direct-A')).agent;
  scenario(h, { worker: ask }); const b = await child(h, a, 'B');
  await until(async () => (await get(h, a, b.taskId)).status === 'waiting-decision', 'waiting'); const old = await get(h, a, b.taskId);
  const B = h.ctx.agents.get(b.id); input(B, 'Use a different timeout for this task.'); await B.whenIdle();
  const changed = await get(h, a, b.taskId); assert.equal(changed.status, 'paused'); assert.ok(changed.pendingUserMessage); assert.equal(changed.revision, old.revision + 1);
  assert.equal((await h.tool(a, 'session_task_update', { taskId: old.id, revision: old.revision, goal: 'stale overwrite', acceptance: old.acceptance, explanation: 'old view' })).isError, true);
  const reconciled = value(await h.tool(B, 'session_task_update', { taskId: changed.id, revision: changed.revision, goal: 'Use new timeout, retain database question', acceptance: changed.acceptance, explanation: 'direct user change' }));
  assert.equal(reconciled.revision, changed.revision + 1); assert.equal(reconciled.pendingUserMessage, undefined); assert.equal(reconciled.status, 'waiting-decision');
});

test('plugin and full Host reopen preserve questions, decisions, checkpoints and identity without boot inference', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dshsm-task-reopen-')); let h;
  t.after(async () => { await h?.close(); assert.equal(dirname(resolve(root)), resolve(tmpdir())); assert.match(root.split(/[\\/]/).at(-1), /^dshsm-task-reopen-/); await rm(root, { recursive: true, force: true }); });
  h = await taskHost(null, root); const a = (await h.create('reopen-A')).agent;
  scenario(h, { worker: ask }); const b = await child(h, a, 'B');
  await until(async () => (await get(h, a, b.taskId)).status === 'waiting-decision', 'question saved');
  const original = await get(h, a, b.taskId); value(await h.tool(a, 'session_task_escalate', { questionId: original.questions[0].id, version: 1 }));
  await Promise.all(h.ctx.agents.list().map(agent => agent.whenIdle()));
  await h.plugin.dispose(); await h.ctx.plugin(productUnderTest);
  assert.equal((await get(h, a, b.taskId)).status, 'waiting-decision');
  await h.close(); h = await taskHost(null, root);
  const resumed = (await h.ctx.agents.resume({ resumeSessionId: 'reopen-A', agentOptions: { provider: 'synthetic-free', model: 'fixture' } })).agent;
  const restored = await get(h, resumed, b.taskId); assert.equal(restored.assignee.id, b.id); assert.equal(restored.status, 'waiting-decision'); assert.deepEqual(restored.checkpoint, original.checkpoint); assert.equal(restored.questions[0].status, 'awaiting-user'); assert.equal(h.adapter.calls.length, 0);
  assert.equal(value(await h.tool(resumed, 'session_task_escalate', { questionId: restored.questions[0].id, version: 1 })).present, false);
});

test('tree distinguishes task waiting, revision adoption and native permissions', () => {
  const row = { id: 'B', label: 'B', workspace: '/w', running: true, subagent: false, task: { id: 'T', title: 'Build', status: 'waiting-decision', label: '待裁决', revision: 2, appliedRevision: 1, pendingUpdate: true, queued: 1, updatedAt: 1 } };
  const display = treePresentation(row); assert.equal(display.state, '待裁决 · 待同步'); assert.equal(display.waiting, true); assert.match(display.title, /已采用 v1 \/ 当前 v2/);
  assert.equal(treePresentation(row, { pendingInteraction: { kind: 'approval' } }).state, '等待批准');
});

test('equivalent questions with different topic keys can be merged once, including future retries', async t => {
  const h = await taskHost(t), a = (await h.create('merge-A')).agent;
  scenario(h, { worker: task => { const [name, args] = ask(task); return [name, { ...args, topic: task.title === 'B' ? 'database-engine' : 'db-selection' }]; } });
  const b = await child(h, a, 'B', { scope: 'shared' }), c = await child(h, a, 'C', { scope: 'shared' });
  await until(async () => (await get(h, a, b.taskId)).questions.length && (await get(h, a, c.taskId)).questions.length, 'both question keys');
  const qb = (await get(h, a, b.taskId)).questions[0], qc = (await get(h, a, c.taskId)).questions[0]; assert.notEqual(qb.id, qc.id);
  value(await h.tool(a, 'session_task_escalate', { questionId: qb.id, version: qb.version }));
  const merged = value(await h.tool(a, 'session_task_merge_questions', { questionId: qc.id, into: qb.id, version: qc.version, targetVersion: qb.version, reason: 'same database choice and applicability' }));
  assert.equal(merged.question.taskIds.length, 2); assert.equal(value(await h.tool(a, 'session_task_escalate', { questionId: qb.id, version: merged.question.version })).present, false);
  const current = await get(h, a, c.taskId);
  const repeated = value(await h.tool(h.ctx.agents.get(c.id), 'session_task_question', { ...version(current), topic: 'db-selection', context: 'application-v1', question: 'same issue again', options: ['PostgreSQL', 'SQLite'] }));
  assert.equal(repeated.question.id, qb.id);
});

test('an uncertain task dispatch survives reload without retry or replacement', async t => {
  const h = await taskHost(t), a = (await h.create('uncertain-A')).agent, b = (await h.create('uncertain-B')).agent; let sends = 0;
  b.followup = () => { sends++; throw new Error('unobservable transport failure'); };
  await h.rpc('selectRecipient', { sourceId: a.id, targetId: b.id, label: 'B' });
  const selected = value(await h.tool(a, 'session_message_selected_target', {}));
  const args = { requestId: 'uncertain', target: b.id, selectionRevision: selected.selectionRevision, title: 'B task', goal: 'build once', acceptance: ['artifact'] };
  const assigned = value(await h.tool(a, 'session_task_assign', args));
  assert.equal(assigned.status, 'blocked'); assert.equal(assigned.deliveries[0].status, 'uncertain'); assert.equal(sends, 1);
  await h.plugin.dispose(); await h.ctx.plugin(productUnderTest);
  const retry = value(await h.tool(a, 'session_task_assign', args)); assert.equal(retry.id, assigned.id); assert.equal(sends, 1);
  const resume = await h.tool(a, 'session_task_control', { taskId: assigned.id, revision: 1, action: 'resume', reason: 'continue' }); assert.equal(resume.isError, true); assert.equal(sends, 1);
});

test('outbox write failure after delivery reconciles actual evidence, never a duplicate dispatch', async () => {
  let state = emptyTaskState(), failDeliveredWrite = true, deliveries = 0; const observed = new Set();
  const a = { id: 'A', session: { header: { cwd: '/workspace' }, deriveMessages: () => [] } };
  const transport = { caller() {}, bind: async () => ({ coordinator: { id: 'A', cwd: '/workspace', child: false }, assignee: { id: 'B', cwd: '/workspace', child: false }, grantAt: 1 }), validate: async () => {}, permitted: () => true, live: () => undefined,
    deliver: async (_task, event) => { deliveries++; observed.add(event.id); }, observed: event => observed.has(event.id) ? 'delivered' : undefined };
  const store = { read: () => state, write: async next => { if (failDeliveredWrite && Object.values(next.events).some(e => e.status === 'delivered')) { failDeliveredWrite = false; throw Error('simulated final persistence failure'); } state = structuredClone(next); } };
  const first = new Tasks(store, transport);
  await assert.rejects(first.assign(a, { requestId: 'one', target: 'B', title: 'Build', goal: 'build once', acceptance: ['evidence'] })); await first.close();
  assert.equal(Object.values(state.events)[0].status, 'dispatching');
  const recovered = new Tasks(store, transport); await recovered.recover();
  assert.equal(Object.values(state.events)[0].status, 'delivered'); assert.equal(deliveries, 1); await recovered.close();
});

test('declared overlapping resource paths serialize different child sessions until acceptance', async t => {
  const h = await taskHost(t), a = (await h.create('resources-A')).agent;
  scenario(h, { worker: task => submit(task) });
  const b = await child(h, a, 'B', { resources: ['src'] });
  await until(async () => (await get(h, a, b.taskId)).status === 'review', 'first result');
  const c = await child(h, a, 'C', { resources: ['src/component.ts'] }); assert.equal((await get(h, a, c.taskId)).status, 'queued');
  const first = await get(h, a, b.taskId); value(await h.tool(a, 'session_task_review', { ...version(first), accepted: true, explanation: 'verified', evidence: ['artifact inspected'] }));
  await until(async () => (await get(h, a, c.taskId)).status === 'review', 'resource released');
});

test('owned continuable native child uses managed lifecycle without changing native ownership', { timeout: 15000 }, async t => {
  const h = await taskHost(t); await h.ctx.plugin(Subagents); await h.ctx.plugin(Spawn);
  const a = (await h.create('native-task-A')).agent;
  const activation = await h.ctx.subagents.startActivation({ provider: 'spawn', childId: 'native-task-child', label: 'Native member', request: { parent: a, prompt: [{ type: 'text', text: 'initial setup' }] }, signal: new AbortController().signal, delivery: 'caller' }); await activation.result;
  scenario(h, { worker: task => submit(task) });
  await h.rpc('selectRecipient', { sourceId: a.id, targetId: 'native-task-child', label: 'Native member' }); const selected = value(await h.tool(a, 'session_message_selected_target', {}));
  const assigned = value(await h.tool(a, 'session_task_assign', { requestId: 'native-task', target: 'native-task-child', selectionRevision: selected.selectionRevision, title: 'Native work', goal: 'work inside original child', acceptance: ['artifact checked'] }));
  await until(async () => (await get(h, a, assigned.id)).status === 'review', 'native child submits result');
  const current = await get(h, a, assigned.id); assert.equal(current.assignee.child, true); assert.equal(current.assignee.id, 'native-task-child');
  const observed = await h.ctx.sessionQuery.observeSession('native-task-child');
  try { assert.equal(observed.header.origin, 'subagent'); assert.equal(observed.header.parentSession, a.id); } finally { observed[Symbol.dispose](); }
  value(await h.tool(a, 'session_task_review', { ...version(current), accepted: true, explanation: 'checked native result', evidence: ['fixture evidence'] }));
});

test('required questions block startup deterministically and reuse one decision across children', async t => {
  const h = await taskHost(t), a = (await h.create('prerequisite-A')).agent;
  scenario(h, { worker: task => submit(task) });
  const requiredQuestions = [{ topic: 'format', context: 'artifact-v1', question: 'Choose format before any construction', options: ['JSON', 'text'] }];
  const b = await child(h, a, 'B', { scope: 'prerequisites', requiredQuestions }), c = await child(h, a, 'C', { scope: 'prerequisites', requiredQuestions });
  const first = await get(h, a, b.taskId), second = await get(h, a, c.taskId);
  assert.equal(first.status, 'queued'); assert.equal(first.reason, 'WAITING_FOR_REQUIRED_DECISION'); assert.equal(second.status, 'queued');
  assert.equal(first.questions[0].id, second.questions[0].id); assert.equal(first.deliveries.some(e => e.kind === 'start'), false);
  assert.equal(h.ctx.agents.get(b.id).session.snapshotEvents().some(e => e.type === 'assistant/message'), false);
  const updated = value(await h.tool(a, 'session_task_update', { taskId: b.taskId, revision: first.revision, goal: 'Build version 2 after the shared answer', acceptance: ['version=2', '17+25=42'], explanation: 'Change the unstarted artifact version' }));
  assert.equal(updated.id, first.id); assert.equal(updated.appliedRevision, 0);
  assert.deepEqual(updated.checkpoint.remaining, ['version=2', '17+25=42']);
  assert.equal(updated.questions[0].id, first.questions[0].id);
  const later = value(await h.tool(a, 'session_task_assign', { requestId: 'B-later', target: b.id, scope: first.scopeId, title: 'Later B', goal: 'Read the accepted artifact', acceptance: ['summary checked'] }));
  const tree = await h.ctx.typertGateway.invoke({ namespace: 'sessionCollaboration', method: 'tree', args: {}, peer: h.peer });
  assert.equal(tree.find(row => row.id === b.id).task.queued, 1, 'only subsequent tasks count');
  assert.equal(tree.find(row => row.id === c.id).task.queued, 0, 'the waiting task is not its own successor');
  assert.equal((await get(h, a, later.id)).status, 'queued');
  value(await h.tool(a, 'session_task_decide', { questionId: first.questions[0].id, version: 1, authority: 'coordinator', answer: 'JSON' }));
  await until(async () => (await get(h, a, b.taskId)).status === 'review' && (await get(h, a, c.taskId)).status === 'review', 'decided prerequisites start both');
  assert.equal((await get(h, a, b.taskId)).appliedRevision, 2);
  assert.equal((await get(h, a, later.id)).status, 'queued', 'idle while awaiting acceptance must not release the successor');
});

test('reopen repairs an old unstarted checklist without replacing identities, decisions or real progress', async () => {
  let state = emptyTaskState();
  const makeTask = (id, appliedRevision) => ({ id, coordinator: { id: 'A' }, assignee: { id }, status: 'queued', revision: 2, appliedRevision,
    acceptance: ['version=2'], checkpoint: { summary: '尚未开始', done: [], remaining: ['version=1'], artifacts: [], at: 1 },
    questionIds: ['shared-question'], history: [], updatedAt: 1 });
  state.tasks.B = makeTask('B', 0); state.tasks.C = makeTask('C', 1);
  const progressBefore = structuredClone(state.tasks.C.checkpoint);
  const tasks = new Tasks({ read: () => state, write: async next => { state = next; } }, { permitted: () => true, live: () => undefined }, () => 20);
  await tasks.recover();
  assert.equal(state.tasks.B.id, 'B'); assert.equal(state.tasks.B.revision, 2); assert.equal(state.tasks.B.appliedRevision, 0);
  assert.deepEqual(state.tasks.B.questionIds, ['shared-question']);
  assert.deepEqual(state.tasks.B.checkpoint.remaining, ['version=2']);
  assert.deepEqual(state.tasks.C.checkpoint, progressBefore);
  assert.equal(Object.keys(state.events).length, 0, 'repair does not send work or wake a model');
  const repaired = structuredClone(state); await tasks.recover(); assert.deepEqual(state, repaired, 'repair is idempotent'); await tasks.close();
});

test('the first model request after a user answer exposes that exact current message id', async t => {
  const h = await taskHost(t), a = (await h.create('current-answer-A')).agent;
  input(a, 'Keep the format undecided for now.'); await a.whenIdle();
  const b = await child(h, a, 'B', { requiredQuestions: [{ topic: 'format', context: 'current-answer', question: 'Choose a format', options: ['JSON', 'text'] }] });
  await a.whenIdle();
  const current = await get(h, a, b.taskId);
  value(await h.tool(a, 'session_task_escalate', { questionId: current.questions[0].id, version: 1 }));
  const answer = createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Choose JSON for the shared format.' }] });
  const observed = [];
  scenario(h, { coordinator: state => { observed.push(state.currentUserMessageId); } });
  a.followup(answer); await a.whenIdle();
  assert.deepEqual(observed, [answer.id], 'the model must not receive the prior human message id when recording a new decision');
});

test('a direct user answer in a child resolves the shared question and synchronizes the coordinator', async t => {
  const h = await taskHost(t), a = (await h.create('child-answer-A')).agent;
  scenario(h, { worker: (task, state) => state.questions.some(q => q.status === 'resolved') ? submit(task) : ask(task) });
  const b = await child(h, a, 'B', { scope: 'shared' }), c = await child(h, a, 'C', { scope: 'shared' });
  await until(async () => (await get(h, a, b.taskId)).status === 'waiting-decision' && (await get(h, a, c.taskId)).status === 'waiting-decision', 'shared question ready');
  const B = h.ctx.agents.get(b.id); input(B, 'Use PostgreSQL for the shared application.'); await B.whenIdle();
  const current = await get(h, a, b.taskId);
  value(await h.tool(B, 'session_task_decide', { questionId: current.questions[0].id, version: 1, authority: 'user', answer: 'PostgreSQL', userMessageId: current.pendingUserMessage, userQuote: 'Use PostgreSQL for the shared application.' }));
  await until(async () => (await get(h, a, b.taskId)).status === 'review' && (await get(h, a, c.taskId)).status === 'review', 'same decision unblocks both');
  const synced = await get(h, a, b.taskId); assert.equal(synced.questions[0].decision.actor, B.id); assert.equal(synced.pendingUserMessage, undefined);
});

test('task snapshots stay bounded under maximum legal field sizes including JSON escape expansion', async () => {
  const state = emptyTaskState(), noisy = 'a' + '\u0001'.repeat(499), list = Array(32).fill(noisy);
  for (let n = 0; n < 12; n++) state.tasks[`task-${n}`] = {
    id: `task-${n}`, scopeId: 'scope-shared', title: noisy, coordinator: { id: 'A' }, assignee: { id: `B-${n}` },
    status: 'running', goal: noisy.repeat(16), acceptance: list, revision: 3, appliedRevision: 2, decisionRevision: 2, appliedDecisionRevision: 1,
    checkpoint: { summary: noisy.repeat(16), done: list, remaining: list, artifacts: list }, reason: noisy,
    result: { summary: noisy.repeat(16), evidence: list }, updatedAt: 1,
  };
  for (let n = 0; n < 16; n++) state.questions[`q-${n}`] = { id: `q-${n}`, scopeId: 'scope-shared', topic: noisy, context: noisy, question: noisy.repeat(16), status: 'resolved', version: 1, decision: { answer: noisy.repeat(16), authority: 'user' } };
  const tasks = new Tasks({ read: () => state }, { permitted: () => true });
  const text = tasks.snapshot({ id: 'A', session: { deriveMessages: () => [] } });
  assert.ok(text.length <= 24000, `snapshot exceeded context bound: ${text.length}`);
  const snapshot = JSON.parse(text.slice(text.indexOf('\n') + 1));
  assert.equal(snapshot.truncated, true); assert.equal(snapshot.totalTasks, 12);
  assert.equal(snapshot.tasks[0].revision, 3); assert.equal(snapshot.tasks[0].appliedRevision, 2);
  assert.match(text, /session_task_get/); await tasks.close();
});
