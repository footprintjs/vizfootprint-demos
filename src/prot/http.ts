/**
 * THE COMMITTED ENTRY, OVER HTTP — the browser half of the protein desk.
 *
 * `./snapshot.ts` reads the file off disk; a page has no disk. The other three
 * demos answer that by declaring the same table `via: 'http'` and letting the
 * library's http CARRIER fetch it (`src/exo/http.ts` and its siblings), which
 * is what puts a version on every commit the page lands.
 *
 * THIS DOOR CANNOT DO THAT, and the reason is one line of the library: the
 * source port's formats are `rows | csv | json` (`vizfootprint/source` ·
 * `SOURCE_FORMATS`) and a PDB file is text in fixed columns. So this is a bare
 * `fetch`, and everything the carrier would have given is gone with it:
 *
 *   - no `version` (an ETag, a Last-Modified, a hash of the bytes) and
 *     therefore no stamp on any commit;
 *   - no `retrievedAt`, so the Sources tab has nothing to show;
 *   - no typed refusal — `unavailable`, `too-large`, `timeout`, `unauthorized`
 *     are the carrier's vocabulary (`SOURCE_REFUSALS`), and what a caller gets
 *     here is whatever `fetch` threw, wrapped in a sentence written below;
 *   - no conditional read, so `dashboard.refresh()` can never see this file
 *     move.
 *
 * Declaring the file through the carrier anyway was TRIED, on this very entry,
 * and what each format answers is why this door exists:
 *
 *   `json` → refused, and well: *table "residues" file source …/1ay7.pdb:
 *            format json: the text is not JSON*
 *   `rows` → refused in the same shape
 *   `csv`  → refused too, now, by the DOOR rather than the decoder
 *            (`vizfootprint` · `src/def/declaredTable.ts ·
 *            notTheDeclaredTable`): *the csv source landed 2,090 rows and
 *            none of the columns this table declares — declared
 *            "residue_key", …, arrived "HEADER    COMPLEX
 *            (ENZYME/INHIBITOR)              14-NOV-97   1AY7". A document is
 *            never a table by accident…* — measured on this entry.
 *            THIS DESK IS WHY THAT GUARD EXISTS: until it was written, `csv`
 *            accepted the file — 2,090 rows, a version
 *            (`mtime:…;size:169371`) and not one word of doubt, the HEADER
 *            line as the column NAME and every other line a value under it.
 *            The decoder still parses any text (a one-column CSV is
 *            legitimate, so no syntactic rule could tell a table from a
 *            document); the judgement lives where the DECLARATION is.
 *
 * So a refusal is what the carrier now answers — but a refusal is not a
 * structure either. A version bought with a table nobody can read is not a
 * version, so this door fetches the bytes plainly and says what it cannot
 * vouch for.
 */
import { structureArtifact, type StructureArtifact } from './session.js';
import { PROT_FILES } from '../data/files.js';

export { PROT_FILES };

/**
 * The committed entry, fetched — the browser's `loadStructure`.
 *
 * The refusal sentence names the URL and the status, because that is all there
 * is to name: no carrier vouched for these bytes, so there is no version to
 * report and no typed reason to carry.
 */
export async function loadStructureOverHttp(base: string | URL): Promise<StructureArtifact> {
  const at = new URL(PROT_FILES.structure, base).href;
  const res = await fetch(at);
  if (!res.ok) throw new Error(`the structure file at ${at} answered ${String(res.status)} ${res.statusText} — this desk has nothing to draw without it`);
  const text = await res.text();
  // the one check a bare fetch can still make: a PDB entry begins with a HEADER
  // record, so an error page served with a 200 is caught rather than parsed
  if (!text.startsWith('HEADER')) throw new Error(`the bytes at ${at} are not a PDB entry (no HEADER record on the first line) — nothing was parsed`);
  return structureArtifact(at, text);
}
