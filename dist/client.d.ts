import type { Context } from '@deepseek-ai/cordis';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import { type TreeApi } from './session-tree.js';
interface Api {
    selectRecipient(sourceId: string, targetId: string, label: string): Promise<RemoteResult<unknown>>;
}
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteNamespaceMap {
        sessionMessenger: Api;
        sessionCollaboration: TreeApi;
    }
}
export declare const inject: string[];
export declare function apply(ctx: Context): Promise<void>;
export {};
