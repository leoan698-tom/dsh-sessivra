import type { StoredEntry } from '@deepseek-ai/dsh-client-ui-slots';
interface View {
    id: string;
    label: string;
}
interface ViewState {
    views: readonly View[];
    current?: string | null;
    selectView(id: string): void;
}
export declare function createHeaderViews(): {
    getSnapshot: () => Map<string, ViewState>;
    subscribe: (listener: () => void) => () => void;
    register(id: string, state: ViewState): () => void;
};
export type HeaderViews = ReturnType<typeof createHeaderViews>;
/** Share the native header's scoped Store and injected view actions through its public action seat. */
export declare function wireHeaderViews(slots: {
    entriesOfSlot(name: string): readonly StoredEntry[];
    subscribe(name: string, listener: () => void): () => void;
    register(options: object, component: React.ComponentType<never>): () => void;
}, headerViews: HeaderViews): () => void;
export {};
