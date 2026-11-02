/** Retry only an unpublished Windows atomic replacement; never retry dispatch. */
export declare function persistWithContentionRetry(save: () => Promise<void>): Promise<void>;
