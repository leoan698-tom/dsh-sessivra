import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { join } from 'node:path';
import LocalFs from '@deepseek-ai/dsh-fs-local';
import WorkingDirectory from '@deepseek-ai/dsh-working-directory';
import * as Persistence from '@deepseek-ai/dsh-session-persistence-jsonl';
import Query from '@deepseek-ai/dsh-session-query';
import { host, value } from '../fixture.mjs';

export async function taskHost(t, root) {
  const h = await host(root); if (t) t.after(() => h.close());
  for (const plugin of [LocalFs, WorkingDirectory]) await h.ctx.plugin(plugin);
  await h.ctx.plugin(Persistence, { root: join(h.root, 'sessions') }); await h.ctx.plugin(Query);
  return h;
}
export function snapshot(options) {
  const message = options.messages.findLast(message => message.source?.kind === 'runtime-context' && message.source.sections?.some(section => section.name === 'sessivra-current-tasks'));
  if (!message) return { tasks: [], questions: [] };
  const section = message.source.sections.find(section => section.name === 'sessivra-current-tasks');
  assert.ok(message.content.some(block => block.type === 'text' && block.text.includes(section.text)), 'snapshot must actually be model-visible');
  return JSON.parse(section.text.slice(section.text.indexOf('\n') + 1));
}
export const version = task => ({ taskId: task.id, revision: task.revision, decisionRevision: task.decisionRevision });
export async function* call(name, args = {}) {
  const encoded = JSON.stringify(args);
  yield { type: 'block-start', index: 0, blockType: 'tool-call' };
  yield { type: 'tool-call-delta', index: 0, id: `call-${name}`, name, argumentsDelta: encoded };
  yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: `call-${name}`, name, arguments: encoded } };
  yield { type: 'finish', reason: 'tool-calls' };
}
export function scenario(h, { worker, coordinator, initial, maxCalls = 100 }) {
  h.adapter.script = async function* (options) {
    assert.ok(h.adapter.calls.length <= maxCalls, 'scenario must converge without an unbounded model loop');
    const state = snapshot(options);
    const task = state.tasks.find(task => task.role === 'assignee' && !['queued', 'completed', 'cancelled', 'failed'].includes(task.status));
    let action;
    if (task) {
      if (['dispatched', 'running'].includes(task.status) && (task.appliedRevision !== task.revision || task.appliedDecisionRevision !== task.decisionRevision)) {
        action = ['session_task_report', { ...version(task), phase: 'running', summary: 'Adopt current task and decisions; preserve completed work.' }];
      } else if (task.status === 'running' || task.status === 'blocked') action = await worker?.(task, state, options);
    } else if (state.tasks.some(task => task.role === 'coordinator')) action = await coordinator?.(state, options);
    else action = await initial?.(options);
    if (action) yield* call(...action); else yield { type: 'finish', reason: 'stop' };
  };
}
export async function until(predicate, message, timeout = 8000) {
  const started = Date.now();
  while (!await predicate()) { assert.ok(Date.now() - started < timeout, message); await delay(5); }
}
export async function get(h, agent, taskId) { return value(await h.tool(agent, 'session_task_get', { taskId })); }
export async function child(h, parent, requestId, extra = {}) {
  const created = value(await h.tool(parent, 'session_task_create_child', { requestId, label: requestId, prompt: requestId, acceptance: ['artifact verified'], ...extra }));
  assert.ok(created.taskId, JSON.stringify(created)); return created;
}
