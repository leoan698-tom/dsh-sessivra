/** Keep old draft chips serializable while the Host owns the single @ menu. */
export function createLegacyRecipientSource() {
    const canonical = (ref) => ref.replace(/\]\(dsh-message-target:([A-Za-z0-9_-]+)\)$/u, '](dsh-session:$1)');
    return {
        trigger: '@',
        name: 'messenger-target',
        showGroupTitle: false,
        candidates: async () => [],
        codec: {
            clipboardText: canonical,
            serialize: (ref) => Promise.resolve(canonical(ref)),
        },
    };
}
