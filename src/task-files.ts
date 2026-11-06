/** Preserve submitted artifact order; a plain file path may also be supplied as result evidence. */
export function taskFiles(task: { checkpoint: { artifacts: string[] }; result?: { evidence: string[] } }) {
  const files = [...task.checkpoint.artifacts];
  for (const evidence of task.result?.evidence ?? []) {
    const path = evidence.trim();
    if (/^(?:[A-Za-z]:[\\/]|\/)[^\r\n]+?\.[\w+-]+$/.test(path) && !path.includes('::') && !files.includes(path))
      files.push(path);
  }
  return files;
}
export const fileName = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() || path;
