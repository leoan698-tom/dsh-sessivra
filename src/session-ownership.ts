/** Superagent derives these session IDs from its durable store, independently of display titles. */
export function isRepositoryAgent(id?: string | null) {
  return !!id && /^(worker|orchestrator)-[a-f0-9]{32}$/.test(id);
}
export function requireSessivraSession(id: string) {
  if (isRepositoryAgent(id)) throw new Error('SUPERAGENT_OWNS_SESSION');
}

export function managedBySuperagent(header: { id: string; agentPreset?: string; parentSession?: string }) {
  return (
    isRepositoryAgent(header.id) ||
    isRepositoryAgent(header.parentSession) ||
    header.agentPreset === 'dsh-superagent-router' ||
    header.agentPreset === 'dsh-superagent-worker'
  );
}
