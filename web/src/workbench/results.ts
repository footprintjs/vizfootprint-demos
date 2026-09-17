/**
 * SCREEN ONE, AS RULES — LAYER 3: what a result row shows, and the one place
 * the desk's own search rule is written down. Pure; no React, no DOM, no
 * session.
 *
 * (It is `results.ts` and not `search.ts` because `./Search.tsx` is the
 * component beside it, and two files whose names differ only in case cannot
 * both exist on a case-insensitive filesystem.)
 *
 * ── THE ROWS SHOW WHAT THE DATA API ANSWERS, AND NOTHING ELSE ──────────────
 * The design's row reads `id / title / method · resolution · chains ·
 * residues`. The archive's own record answers the method, the chain count, the
 * model count and the DEPOSITED ATOM count — it answers no resolution and no
 * residue count, because a residue count is something only the parse knows and
 * nothing has been downloaded at this point. So the row prints the archive's
 * own line, split where the design splits it ({@link ListedEntry.summary}
 * through `src/prot/archive.ts` · `summaryParts`) and re-worded nowhere.
 *
 * Two facts the design's board gets to show and this one does not, therefore:
 * the resolution and the residue count. Both are in the FILE, and the file has
 * not been fetched.
 */
import { EXAMPLE_ENTRY, summaryParts, type ListedEntry } from '../../../src/prot/archive.js';
import type { ResultRowView } from './Search.js';

/**
 * THE DESK'S OWN RULE, in one place — which door a reader's words go through.
 *
 * It is a description of `src/prot/archive.ts` · `looksLikeEntryId` and of the
 * landing's own two branches, and it is written here once so the empty state
 * and the nothing-matched state cannot come to say different things about the
 * same rule.
 */
export const SEARCH_RULE =
  `Four characters that look like an entry id (${EXAMPLE_ENTRY}, case-insensitive) open that entry from the RCSB Protein Data Bank’s copy of the wwPDB archive. ` +
  `Anything else searches the archive’s full text and lists what it finds, with each entry’s own title, method and chain count read off the archive’s record. An empty box opens the example.`;

/** The second of the two facts: a word search matches the deposited title, so fewer words match more entries. */
export const SEARCH_BREADTH = 'Word searches match the archive’s own full text, so fewer words usually match more entries.';

/** One row per entry the archive answered with, laid out the way the design lays it out and re-worded nowhere. */
export function resultRows(listed: readonly ListedEntry[]): readonly ResultRowView[] {
  return listed.map((row): ResultRowView => {
    if (row.summary === null) return { entry: row.entry, title: null, meta: row.line, refusal: row.refusal };
    const { title, rest } = summaryParts(row.summary);
    return { entry: row.entry, title, meta: rest.length === 0 ? null : rest.join(' · '), refusal: row.refusal };
  });
}
