/** Superagent derives these session IDs from its durable store, independently of display titles. */
export function isRepositoryAgent(id) {
    return !!id && /^(worker|orchestrator)-[a-f0-9]{32}$/.test(id);
}
export function requireSessivraSession(id) {
    if (isRepositoryAgent(id))
        throw new Error('SUPERAGENT_OWNS_SESSION');
}
export function managedBySuperagent(header) {
    return (isRepositoryAgent(header.id) ||
        isRepositoryAgent(header.parentSession) ||
        header.agentPreset === 'dsh-superagent-router' ||
        header.agentPreset === 'dsh-superagent-worker');
}
