import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { InputActions, SessionInput } from '@deepseek-ai/dsh-client-ui-conversation/client';
/** Use the Host's reference codec and editor, preserving draft chips and attachments. */
export declare function createSessionReferenceDrop(): {
    register(id: string, actions: InputActions, input: SessionInput): () => void;
    insert(target: string, source: string, label: string): boolean;
};
export declare function SessionReferenceDropInput(props: PropsRuntime<'conversation.input.overlay'> & {
    referenceDrop: ReturnType<typeof createSessionReferenceDrop>;
    sessionInput: SessionInput;
}): null;
