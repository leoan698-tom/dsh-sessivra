import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { type Messenger } from './core.js';
import type { Task, TaskEvent } from './task-schema.js';
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        'plugin:dsh-sessivra-task': {
            kind: 'plugin:dsh-sessivra-task';
            taskId: string;
            eventId: string;
        };
    }
}
export declare class TaskTransport {
    private ctx;
    private messenger;
    private children;
    constructor(ctx: Context, messenger: Messenger);
    live(id: string): Agent | undefined;
    foreign(agent: Agent): boolean;
    caller(agent: Agent): void;
    private address;
    bind(owner: Agent, target: string): Promise<{
        coordinator: {
            id: string;
            cwd: string;
            child: boolean;
        };
        assignee: {
            id: string;
            cwd: string;
            child: boolean;
        };
        grantAt: number;
    }>;
    /** Synchronous final guard, also used by model-context assembly. No grant is created. */
    permitted(task: Task): boolean;
    validate(task: Task, agent?: Agent): Promise<void>;
    deliver(task: Task, event: TaskEvent): Promise<void>;
    observed(event: TaskEvent): 'observed' | 'delivered' | undefined;
}
