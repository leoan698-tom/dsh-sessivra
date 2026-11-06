/** Older reports may mix implementation details and status notes into a single paragraph.
 * Quote short, unqualified totals from that submission; leave the full report in the record. */
export function resultOverview(result: { summary: string; evidence: string[] }) {
  const paragraphs = result.summary.trim().split(/\r?\n\s*\r?\n/);
  const paragraph = paragraphs[0]
    .replace(/(?:^|(?<=[。！？\n]))\s*(?:等待|等候)(?:桌面)?(?:人工|用户)?验收[。.!！]?\s*$/, '').trim();
  const facts = new Map<string, Set<string>>();
  if (paragraphs.length === 1 && paragraph.length > 90) {
    for (const source of [paragraph, ...result.evidence]) {
      for (const clause of source.split(/[，、；。\n]/u)) {
        const match = /^(总[\p{Script=Han}]{1,4})\s*[:：]?\s*(\d+(?:\.\d+)?\s*[\p{Script=Han}]{1,3})$/u.exec(clause.trim());
        if (!match) continue;
        const [, label, value] = match;
        const values = facts.get(label) ?? new Set<string>();
        values.add(value.replace(/\s/g, ''));
        facts.set(label, values);
      }
    }
  }
  const highlights = [...facts].filter(([, values]) => values.size === 1)
    .map(([label, values]) => label + ' ' + [...values][0]);
  const lead = highlights.length ? paragraph.split(/(?<=[。！？])|\n/)[0] : paragraph;
  return { text: lead || '执行会话已提交结果', highlights };
}
