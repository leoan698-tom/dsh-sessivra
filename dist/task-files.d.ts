/** Preserve submitted artifact order; a plain file path may also be supplied as result evidence. */
export declare function taskFiles(task: {
    checkpoint: {
        artifacts: string[];
    };
    result?: {
        evidence: string[];
    };
}): string[];
export declare const fileName: (path: string) => string;
