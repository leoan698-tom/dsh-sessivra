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
export function createLegacyRecipientSource() {
  const canonical = (ref: string) => ref.replace(/\]\(dsh-message-target:([A-Za-z0-9_-]+)\)$/u, '](dsh-session:$1)');
  return {
    trigger: '@',
    name: 'messenger-target',
    showGroupTitle: false,
    candidates: async () => [],
    codec: {
      clipboardText: canonical,
      serialize: (ref: string) => Promise.resolve(canonical(ref)),
    },
  };
}
