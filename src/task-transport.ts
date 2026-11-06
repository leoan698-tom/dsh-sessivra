import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { UserMessage } from '@deepseek-ai/dsh-llm';
import type {} from '@deepseek-ai/dsh-workspace';
import type {} from '@deepseek-ai/dsh-session-query';
import { workspace, type Messenger, type SessionAddress } from './core.js';
import { childTransport } from './child-transport.js';
import type { Task, TaskEvent } from './task-schema.js';

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'plugin:dsh-sessivra-task': { kind: 'plugin:dsh-sessivra-task'; taskId: string; eventId: string };
  }
}

import { managedBySuperagent, requireSessivraSession } from './session-ownership.js';

export class TaskTransport {
  private children;
  constructor(private ctx: Context, private messenger: Messenger) { this.children = childTransport(ctx); }
  live(id: string) { return this.ctx.agents.get(id as Agent['id']); }
  foreign(agent: Agent) {
    const visited = new Set<string>();
    let header: SessionAddress | undefined = agent.session.header;
    while (header && !visited.has(header.id)) {
      if (managedBySuperagent(header)) return true;
      visited.add(header.id);
      header = header.parentSession ? this.live(header.parentSession)?.session.header : undefined;
    }
    return false;
  }
  caller(agent: Agent) {
    if (this.foreign(agent)) throw new Error('SUPERAGENT_OWNS_SESSION');
    if (this.live(agent.id) !== agent) throw new Error('TASK_CALLER_NOT_ACTIVE');
  }
  private async address(id: string): Promise<SessionAddress> {
    requireSessivraSession(id);
    if (this.ctx.get('workspaceRegistry')?.archivedSessionIds.includes(id as Agent['id'])) throw new Error('TASK_SESSION_ARCHIVED');
    const live = this.live(id);
    if (live) return { ...live.session.header };
    const controller = this.ctx.get('sessionController');
    if (controller?.inspect) {
      const found = await controller.inspect(id);
      if (!found) throw new Error('TASK_SESSION_UNAVAILABLE');
      return found.meta;
    }
    const query = this.ctx.get('sessionQuery');
    if (!query) throw new Error('TASK_SESSION_UNAVAILABLE');
    const observed = await query.observeSession(id as Agent['id'], { projectionMode: 'none' });
    try { return { ...observed.header }; } finally { observed[Symbol.dispose](); }
  }
  async bind(owner: Agent, target: string) {
    this.caller(owner);
    if (!this.ctx.agents.roots().includes(owner) || owner.session.header.origin === 'subagent') throw new Error('TASK_COORDINATOR_MUST_BE_CONVERSATION');
    const assignee = await this.address(target), coordinator = await this.address(owner.id);
    if (managedBySuperagent(assignee) || managedBySuperagent(coordinator)) throw new Error('SUPERAGENT_OWNS_SESSION');
    if (target === owner.id) throw new Error('TASK_SELF_ASSIGNMENT');
    if (assignee.origin === 'subagent' && !await this.children.inspect(owner, target)) throw new Error('TASK_CHILD_NOT_OWNED');
    this.caller(owner);
    const sourceCwd = workspace(coordinator.cwd), targetCwd = workspace(assignee.cwd);
    if (!sourceCwd || !targetCwd) throw new Error('TASK_WORKSPACE_REQUIRED');
    return {
      coordinator: { id: owner.id as string, cwd: sourceCwd, child: false },
      assignee: { id: target, cwd: targetCwd, child: assignee.origin === 'subagent' },
      grantAt: this.messenger.taskPair(coordinator, assignee),
    };
  }
  /** Synchronous final guard, also used by model-context assembly. No grant is created. */
  permitted(task: Task): boolean {
    try {
      const addresses = [task.coordinator, task.assignee].map(bound => {
        if (this.ctx.get('workspaceRegistry')?.archivedSessionIds.includes(bound.id as Agent['id'])) throw new Error();
        requireSessivraSession(bound.id);
        const live = this.live(bound.id);
        if (live && this.foreign(live)) throw new Error('SUPERAGENT_OWNS_SESSION');
        if (live && (workspace(live.session.header.cwd) !== bound.cwd || (live.session.header.origin === 'subagent') !== bound.child)) throw new Error();
        return { id: bound.id, cwd: bound.cwd };
      });
      return this.messenger.taskPair(addresses[0], addresses[1]) === task.grantAt;
    } catch { return false; }
  }
  async validate(task: Task, agent?: Agent) {
    if (agent) {
      this.caller(agent);
      const bound = [task.coordinator, task.assignee].find(entry => entry.id === agent.id);
      if (!bound || workspace(agent.session.header.cwd) !== bound.cwd) throw new Error('TASK_ACCESS_DENIED');
    }
    const owner = await this.address(task.coordinator.id), target = await this.address(task.assignee.id);
    for (const [actual, expected] of [[owner, task.coordinator], [target, task.assignee]] as const) {
      if (managedBySuperagent(actual)) throw new Error('SUPERAGENT_OWNS_SESSION');
      if (actual.id !== expected.id || workspace(actual.cwd) !== expected.cwd || (actual.origin === 'subagent') !== expected.child) throw new Error('TASK_SESSION_CHANGED');
    }
    if (task.assignee.child) {
      const parent = this.live(task.coordinator.id);
      if (!parent) throw new Error('TASK_PARENT_NOT_OPEN');
      if (!await this.children.inspect(parent, task.assignee.id)) throw new Error('TASK_CHILD_NOT_OWNED');
    }
    if (agent) this.caller(agent);
    if (!this.permitted(task) || this.messenger.taskPair(owner, target) !== task.grantAt) throw new Error('TASK_PERMISSION_REVOKED');
  }
  async deliver(task: Task, event: TaskEvent): Promise<void> {
    await this.validate(task);
    const input: UserMessage = Object.freeze({ id: event.messageId as UserMessage['id'], role: 'user' as const,
      source: { kind: 'plugin:dsh-sessivra-task' as const, taskId: task.id, eventId: event.id },
      content: [{ type: 'text' as const, text: event.text }],
    });
    if (event.target === task.assignee.id && task.assignee.child) {
      const parent = this.live(task.coordinator.id);
      if (!parent) throw new Error('TASK_PARENT_NOT_OPEN');
      const recipient = await this.children.inspect(parent, task.assignee.id);
      if (!recipient) throw new Error('TASK_CHILD_NOT_OWNED');
      await this.validate(task);
      let entered = false;
      try { await this.children.send(parent, recipient, input, event.kind === 'start' ? 'queue' : 'insert', new AbortController().signal, () => {
        if (!this.permitted(task)) throw new Error('TASK_PERMISSION_REVOKED'); entered = true;
      }); }
      catch (error) { if (!entered) throw error; throw new Error('TASK_DISPATCH_UNCERTAIN'); }
      return;
    }
    let target = this.live(event.target);
    if (!target) {
      const controller = this.ctx.get('sessionController');
      if (!controller?.resolveAgent) throw new Error('TASK_OPEN_SESSION_TO_CONTINUE');
      const result = await controller.resolveAgent(event.target);
      if ('error' in result) throw new Error('TASK_SESSION_RESUME_FAILED');
      target = this.live(event.target);
    }
    await this.validate(task);
    if (!target || this.live(event.target) !== target || !this.ctx.agents.roots().includes(target)) throw new Error('TASK_TARGET_CHANGED');
    // Task events never cancel a running tool. Notifications and answers enter
    // at the next step, including an answer that unblocks the current task.
    try { if (event.kind === 'start') target.followup(input); else target.steer(input); }
    catch { throw new Error('TASK_DISPATCH_UNCERTAIN'); }
  }
  observed(event: TaskEvent): 'observed' | 'delivered' | undefined {
    const target = this.live(event.target);
    if (!target) return undefined;
    const matches = (message: UserMessage) => message.source.kind === 'plugin:dsh-sessivra-task' && message.source.eventId === event.id && message.source.taskId === event.taskId;
    if (target.session.deriveMessages().some(message => message.role === 'user' && matches(message))) return 'observed';
    if ([...target.inbox.nextStep, ...target.inbox.nextTurn].some(matches)) return 'delivered';
    return undefined;
  }
}
