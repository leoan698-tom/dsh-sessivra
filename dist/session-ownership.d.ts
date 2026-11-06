/** Superagent derives these session IDs from its durable store, independently of display titles. */
export declare function isRepositoryAgent(id?: string | null): boolean;
export declare function requireSessivraSession(id: string): void;
export declare function managedBySuperagent(header: {
    id: string;
    agentPreset?: string;
    parentSession?: string;
}): boolean;
