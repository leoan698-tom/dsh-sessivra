import type { Context } from '@deepseek-ai/cordis';
import type { Messenger } from './core.js';
import type { Collaboration } from './collaboration.js';
import type { ReferenceTargets } from './reference-target.js';
import type { LocalCli } from './local-cli.js';
import { Tasks } from './tasks.js';
export declare function installTasks(ctx: Context, messenger: Messenger, collaboration: Collaboration, references: ReferenceTargets, localCli: LocalCli): Promise<Tasks>;
