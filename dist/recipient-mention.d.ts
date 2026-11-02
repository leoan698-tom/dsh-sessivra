/**
 * Compatibility parser for legacy recipient text. New @ chips use the Host's
 * dsh-session: context references and exact metadata-based messaging targets.
 */
export interface RecipientMention {
    targetId: string;
    label: string;
}
/** Parse only the dedicated recipient scheme from direct user text. */
export declare function recipientMentions(text: string): RecipientMention[];
