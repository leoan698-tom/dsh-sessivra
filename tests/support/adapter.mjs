import { decide, frames } from './protocol.mjs';


export const name = 'dsh-session-messenger-at-fixture';
export const inject = ['llm', 'tools'];

export function createAdapter(io) {
  const model = { provider: 'at27-free', id: 'fixture', name: 'AT27 deterministic fixture', inputModalities: ['text'] };
  const adapter = {
    providerInfo: provider => ({ id: provider, name: 'AT27 offline' }),
    providerRetryPolicy: () => undefined,
    listModels: async () => [model],
    resolveModel: async () => ({ ...model, context: { contextWindow: 100000 } }),
    prepareCall: async () => ({ model: { ...model, context: { contextWindow: 100000 } }, stream: options => adapter.stream(options) }),
    async *stream(options) {
      if (options.provider !== 'at27-free' || options.model !== 'fixture') throw new Error('AT27_ROUTE_ONLY');
      const targets = await io.loadTargets();
      const decision = decide(options.messages ?? [], targets);
      const caseName = decision.callId?.match(/at27-tool-(?:selected|send)-(\w+)-01/)?.[1]?.toUpperCase() ??
        (decision.text?.match(/AT27_\w+_(IDLE|BUSY|LATER|CROSS|COLD)/)?.[1] ?? 'OTHER');
      await io.record(caseName, decision.kind === 'tool' ? decision.name : 'text', decision.kind === 'tool' ? decision.callId : decision.text);
      for (const frame of frames(decision)) yield frame;
    },
  };
  return adapter;
}

export function createWaitTool(wait) {
  return {
    name: 'synthetic_wait',
    description: 'AT27 deterministic test only: wait for the bounded test gate.',
    parameters: { type: 'object', properties: { case: { type: 'string', enum: ['N4'] } }, required: ['case'] },
    output: { schema: {}, render: (_args, result) => [{ type: 'text', text: JSON.stringify(result) }] },
    execute: async (args, exec) => {
      if (args?.case !== 'N4') throw new Error('AT27_GATE_CASE');
      return wait(exec.agent, exec.signal);
    },
  };
}
