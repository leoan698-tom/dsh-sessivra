import { useEffect } from 'react';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { InputActions, SessionInput } from '@deepseek-ai/dsh-client-ui-conversation/client';

/** Use the Host's reference codec and editor, preserving draft chips and attachments. */
export function createSessionReferenceDrop() {
  const inputs = new Map<string, (source: string, label: string) => boolean>();
  return {
    register(id: string, actions: InputActions, input: SessionInput) {
      const insert = (source: string, label: string) => {
        const encoded = btoa(Array.from(new TextEncoder().encode(JSON.stringify(source)), byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
        const mention = `@[${label.replace(/[\\\[\]]/g, '\\$&')}](dsh-session:${encoded})`;
        const selection = actions.captureInsertion();
        // A drag must never replace selected draft text.
        const inserted = input.insertReference({ source: 'reference', ref: mention, label, appearance: 'session', clipboardText: mention }, { ...selection, start: selection.end });
        if (inserted) { actions.persistDraft(); input.focus(); }
        return inserted;
      };
      inputs.set(id, insert);
      return () => { if (inputs.get(id) === insert) inputs.delete(id); };
    },
    insert(target: string, source: string, label: string) { return inputs.get(target)?.(source, label) ?? false; },
  };
}

export function SessionReferenceDropInput(props: PropsRuntime<'conversation.input.overlay'> & {
  referenceDrop: ReturnType<typeof createSessionReferenceDrop>; sessionInput: SessionInput;
}) {
  useEffect(() => props.referenceDrop.register(props.sessionId, props.inputActions, props.sessionInput), [props.referenceDrop, props.sessionId, props.inputActions, props.sessionInput]);
  return null;
}
