// Pure, deterministic RC2 stream decisions. Only DSH model/tool messages enter here.
const cases = Object.freeze({
  IDLE: { id: 'at27-idle-01', target: 'idle' },
  BUSY: { id: 'at27-busy-01', target: 'idle' },
  LATER: { id: 'at27-later-01', target: 'idle' },
  CROSS: { id: 'at27-cross-01', target: 'cross' },
  COLD: { id: 'at27-cold-01', target: 'cold' },
});
const textOf = message => (message?.content ?? []).filter(block => block?.type === 'text').map(block => block.text).join('\n');
const toolCall = (messages, from, name) => {
  for (let i = messages.length - 1; i > from; i--) {
    for (const block of messages[i]?.content ?? []) if (messages[i]?.role === 'assistant' && block?.type === 'tool-call' && block.name === name) return block;
  }
  return undefined;
};
const toolResult = (messages, from, id) => messages.slice(from + 1).find(message => message?.role === 'tool' && message.toolCallId === id);
const decodedResult = result => {
  if (!result || result.isError) return undefined;
  try { return JSON.parse(textOf(result)); } catch { return undefined; }
};
const call = (name, id, args) => ({ kind: 'tool', name, callId: id, args });
const say = text => ({ kind: 'text', text });

const isContext = message => message?.source?.kind === 'runtime-context' ||
  (message?.source?.kind === 'skill-catalog' && message.source.form === 'catalog');

export function decide(messages, targets = {}) {
  // RC2 AgentLoop may append a user-role runtime-context snapshot after the
  // claimed prompt. It is model context, not a new human or peer instruction.
  // Skip the producer-owned runtime snapshot and exact skill-catalog form; unknown later user-role kinds still
  // fail closed instead of replaying an older direct user request.
  const inputIndex = messages.findLastIndex(message => message?.role === 'user' && !isContext(message));
  if (inputIndex < 0) return say('AT27_NO_INPUT');
  const input = messages[inputIndex];
  const text = textOf(input);
  if (input.source?.kind === 'plugin:dsh-session-messenger') {
    const parentId = text.match(/\bmessage=(at27-[a-z-]+-01)\b/)?.[1];
    if (parentId === 'at27-idle-01') {
      const prior = toolCall(messages, inputIndex, 'session_message_reply');
      if (!prior) return call('session_message_reply', 'at27-tool-reply-idle-01', { replyTo: parentId, id: 'at27-reply-idle-01', text: 'AT27_SYNTHETIC_REPLY_IDLE' });
      const result = toolResult(messages, inputIndex, prior.id);
      return say(['delivered','claimed','processed'].includes(decodedResult(result)?.status) ? 'AT27_REPLY_SENT' : result ? 'AT27_REPLY_FAILED' : 'AT27_REPLY_PENDING');
    }
    if (parentId === 'at27-busy-01') return say('AT27_DIRECTION_APPLIED');
    if (parentId && Object.values(cases).some(value => value.id === parentId)) return say(`AT27_WORK_RECEIVED_${parentId}`);
    return say('AT27_PEER_IGNORED');
  }
  if (input.source?.kind !== 'user') return say('AT27_NO_DIRECT_USER');
  if (/\bAT27_ANALYZE_SELECT\b/.test(text)) return say('AT27_ANALYSIS_READY');
  if (/\bAT27_BUSY_BEGIN\b/.test(text)) {
    const prior = toolCall(messages, inputIndex, 'synthetic_wait');
    if (!prior) return call('synthetic_wait', 'at27-tool-wait-busy-01', { case: 'N4' });
    const result = toolResult(messages, inputIndex, prior.id);
    return say(decodedResult(result)?.released === true ? 'AT27_BUSY_RELEASED_WAITING_DIRECTION' : result ? 'AT27_BUSY_GATE_FAILED' : 'AT27_BUSY_GATE_PENDING');
  }
  const match = text.match(/\bAT27_SEND_(IDLE|BUSY|LATER|CROSS|COLD)\b/);
  if (!match) return say('AT27_NO_ACTION');
  const label = match[1], spec = cases[label];
  const selectedCall = toolCall(messages, inputIndex, 'session_message_selected_target');
  if (!selectedCall) return call('session_message_selected_target', `at27-tool-selected-${label.toLowerCase()}-01`, {});
  const selectedResult = toolResult(messages, inputIndex, selectedCall.id);
  if (!selectedResult) return say('AT27_SELECTED_PENDING');
  const selected = decodedResult(selectedResult);
  const expected = targets[spec.target];
  if (typeof expected !== 'string' || !expected || !selected || selected.target !== expected ||
      typeof selected.selectionRevision !== 'string' || !selected.selectionRevision ||
      !['granted', 'ready'].includes(selected.permission)) return say('AT27_SELECTED_BLOCKED');
  const sendCall = toolCall(messages, inputIndex, 'session_message_send');
  if (!sendCall) return call('session_message_send', `at27-tool-send-${label.toLowerCase()}-01`, {
    target: selected.target, selectionRevision: selected.selectionRevision,
    id: spec.id, text: `AT27_SYNTHETIC_TASK_${label}`,
  });
  const sendResult = toolResult(messages, inputIndex, sendCall.id);
  if (!sendResult) return say('AT27_SEND_PENDING');
  const receipt = decodedResult(sendResult);
  return say(receipt?.id === spec.id && ['delivered','claimed','processed'].includes(receipt?.status) ? `AT27_SEND_DELIVERED_${label}` : `AT27_SEND_NOT_DELIVERED_${label}`);
}

export function frames(decision) {
  if (decision.kind === 'tool') {
    const args = JSON.stringify(decision.args);
    return [
      { type: 'block-start', index: 0, blockType: 'tool-call' },
      { type: 'tool-call-delta', index: 0, id: decision.callId, name: decision.name, argumentsDelta: args },
      { type: 'block-end', index: 0, block: { type: 'tool-call', id: decision.callId, name: decision.name, arguments: args } },
      { type: 'finish', reason: { kind: 'tool-calls' } },
    ];
  }
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text: decision.text },
    { type: 'block-end', index: 0, block: { type: 'text', text: decision.text } },
    { type: 'finish', reason: { kind: 'stop' } },
  ];
}
