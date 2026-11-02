/** Candidate shape retained by the compatibility discovery RPC. */
export interface SessionCandidate {
    sessionId: string;
    label: string;
    displayTitle?: string;
    cwd?: string;
    sameWorkspace?: boolean;
    kind?: 'teammate' | 'standalone';
    parentId?: string;
    mention: string;
}
/** Keep old draft chips serializable while the Host owns the single @ menu. */
export declare function createLegacyRecipientSource(): {
    trigger: string;
    name: string;
    showGroupTitle: boolean;
    candidates: () => Promise<never[]>;
    codec: {
        clipboardText: (ref: string) => string;
        serialize: (ref: string) => Promise<string>;
    };
};
