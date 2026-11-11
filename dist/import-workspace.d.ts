export declare function resolveImportWorkspace(options: {
    original: string;
    explicit?: string;
    declared?: string[];
    registered?: string[];
    fallback?: string;
}): Promise<{
    cwd: string;
    recoveredProject: boolean;
} | undefined>;
