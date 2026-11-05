import React from 'react';
import type { StoredEntry } from '@deepseek-ai/dsh-client-ui-slots';
interface HeaderSlots {
    entriesOfSlot(name: string): readonly StoredEntry[];
    subscribe(name: string, listener: () => void): () => void;
    register(options: object, component: React.ComponentType<never>): () => void;
}
/** Reuse live native components under separately owned child-slot names.
 * Never redeclare a Host slot or modify its registration or render authority.
 */
export declare function mirrorNativePaneHeader(slots: HeaderSlots): () => void;
export {};
