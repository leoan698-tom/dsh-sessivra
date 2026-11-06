/** Older reports may mix implementation details and status notes into a single paragraph.
 * Quote short, unqualified totals from that submission; leave the full report in the record. */
export declare function resultOverview(result: {
    summary: string;
    evidence: string[];
}): {
    text: string;
    highlights: string[];
};
