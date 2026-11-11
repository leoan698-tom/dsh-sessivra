import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';

async function existingDirectory(path: string | undefined) {
  if (!path || !isAbsolute(path)) return;
  const canonical = await realpath(path).catch(() => undefined);
  if (canonical && await stat(canonical).then(value => value.isDirectory(), () => false)) return canonical;
}

function contains(root: string, path: string) {
  const suffix = relative(root, path);
  return !isAbsolute(suffix) && suffix !== '..' && !suffix.startsWith('..' + sep);
}

export async function resolveImportWorkspace(options: {
  original: string;
  explicit?: string;
  declared?: string[];
  registered?: string[];
  fallback?: string;
}): Promise<{ cwd: string; recoveredProject: boolean } | undefined> {
  if (options.explicit) {
    const cwd = await existingDirectory(options.explicit);
    return cwd ? { cwd, recoveredProject: false } : undefined;
  }
  const original = await existingDirectory(options.original);
  if (original) return { cwd: original, recoveredProject: false };
  const worktree = /^(.*)[\\/]\.claude[\\/]worktrees[\\/][^\\/]+/i.exec(options.original)?.[1];
  const project = await existingDirectory(worktree);
  if (project) return { cwd: project, recoveredProject: true };
  const declared = [...new Set((await Promise.all((options.declared ?? []).map(existingDirectory))).filter(path => path !== undefined))];
  const ancestors = isAbsolute(options.original)
    ? [...new Set([...declared, ...(options.registered ?? [])])].filter(path => isAbsolute(path) && contains(path, options.original))
      .sort((a, b) => b.length - a.length)
    : [];
  for (const ancestor of ancestors) {
    const cwd = await existingDirectory(ancestor);
    if (cwd) return { cwd, recoveredProject: true };
  }
  if (declared.length === 1) return { cwd: declared[0]!, recoveredProject: true };
  const cwd = await existingDirectory(options.fallback);
  return cwd ? { cwd, recoveredProject: false } : undefined;
}
