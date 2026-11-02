/**
 * Compatibility parser for legacy recipient text. New @ chips use the Host's
 * dsh-session: context references and exact metadata-based messaging targets.
 */
export interface RecipientMention { targetId: string; label: string }

const mention = /@\[((?:\\.|[^\\\]])*)\]\(dsh-message-target:([A-Za-z0-9_-]+)\)/gu;
const scheme = 'dsh-message-target:';

function decodeId(encoded: string): string {
  let value: unknown;
  try { value = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); }
  catch { throw new Error('INVALID_RECIPIENT_MENTION'); }
  if (typeof value !== 'string' || !value || Buffer.from(JSON.stringify(value), 'utf8').toString('base64url') !== encoded) throw new Error('INVALID_RECIPIENT_MENTION');
  return value;
}

/** Parse only the dedicated recipient scheme from direct user text. */
export function recipientMentions(text: string): RecipientMention[] {
  if (!text.includes(scheme)) return [];
  const found: RecipientMention[] = [];
  for (const match of text.matchAll(mention)) {
    const targetId = decodeId(match[2]);
    const label = match[1].replace(/\\([\\\[\]])/gu, '$1').trim();
    found.push({ targetId, label: label.slice(0, 160) || targetId });
  }
  // A malformed recipient token must not be silently treated as a harmless
  // context reference after the user thought they had selected a destination.
  const remainder = text.replace(mention, '');
  if (!found.length || remainder.includes(scheme)) throw new Error('INVALID_RECIPIENT_MENTION');
  return found;
}
