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
 *
 * SINCE `vizfootprint@0379d58` THE LIBRARY HAS THE DECLARATION this paragraph
 * asks for — a RESOURCE (`{ format: 'bytes' | 'text', via, at }`) lands through
 * the same carriers, carries a version, is stamped on every commit and rides the
 * renderer's handshake (`vizfootprint` · `src/source/README.md`; the contract's
 * Law 9). This desk found that gap and does NOT yet use the door: adopting it is
 * its own packet, and until then the hand-fetch below is what runs. So the cost
 * listed here is real TODAY and no longer the library's — say which, rather than
 * letting the prose rot.
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
import { PROT_ANNOTATION_FILES, PROT_CONSERVATION_FILES, PROT_FILES } from '../data/files.js';

export { PROT_ANNOTATION_FILES, PROT_CONSERVATION_FILES, PROT_FILES };

/**
 * HOW MANY FILES A SERVED BOOT OF THE COMMITTED ENTRY READS — the structure,
 * the conservation stage's five and the annotation stage's four, which is the
 * whole list.
 *
 * The annotation stage reads SEVEN files and only four of them are its own: the
 * entity record and the two Pfam match records are the conservation stage's and
 * are counted once, where they are declared (`src/data/files.ts` ·
 * `PROT_ANNOTATION_FILES` says why they are not repeated).
 *
 * It is a TOTAL A PAGE MAY REPORT BEFORE ITS FIRST READ, because the list is
 * declared (`src/data/files.ts`) rather than discovered: nothing about the
 * order the reads happen in changes how many there are. For any OTHER entry
 * there is no such total — the archive names the accessions and the accessions
 * name the families — so a caller reporting progress for one of those has to
 * say *unknown* rather than borrow this number.
 */
export const PROT_COMMITTED_READS = 1 + PROT_CONSERVATION_FILES.length + PROT_ANNOTATION_FILES.length;

/**
 * ONE FILE THIS PAGE READ — the whole of what a bare fetch can honestly say
 * about it, as a REPORT.
 *
 * Progress is a report: it is transient, it reaches no commit, nothing computes
 * from it and no picture is drawn from it (`vizfootprint/docs/proposals/
 * data-arrival.md` §2). What lands on the record is the ROWS the ETL made from
 * these bytes, with the version the inline carrier vouched for; this is the
 * page saying what it is doing while it does it, and nothing more.
 */
export interface FileRead {
  /** The declared path, as `src/data/files.ts` spells it. */
  readonly file: string;
  /** Where it was fetched from. */
  readonly at: string;
  /** Decoded bytes, COUNTED HERE off the text this reader is about to hand on. Always a fact. */
  readonly bytes: number;
  /**
   * THE TOTAL, AND ONLY WHERE IT IS KNOWN — `null` otherwise, never a zero and
   * never a percentage of a guess.
   *
   * `content-length` is the size of what came over the wire, and a served page
   * reads its files through whatever compression the server chose: the header
   * is then the COMPRESSED size while {@link bytes} is the decoded count, and a
   * percentage of one against the other is a number that runs past 100 and
   * then stops. (Measured in the library, on its own http carrier: the trap is
   * written down there and this is the same trap one door along.)
   *
   * So the header is kept only where it AGREES with what was counted — which
   * is exactly the case where the total was known and has been reached. Any
   * other answer is *unknown*, said out loud.
   */
  readonly total: number | null;
}

/**
 * SOMEBODY WATCHING THE READS GO BY — the `./orchestrator.ts` · `ProtRunWatch`
 * shape, one tier down, and for the same reason: a promise answers once at the
 * end, which is the right shape for the bytes and the wrong shape for a reader
 * looking at a page that has not painted yet.
 *
 * A caller that passes none gets exactly today's read, byte for byte — which is
 * what the PUBLISHED desk does (`web/site/prot/entry.tsx`).
 */
export interface HttpWatch {
  /** About to fetch this declared path. */
  onFileAsked?(file: string): void;
  /** It came back, and here is what can be said about it. */
  onFileRead?(read: FileRead): void;
}

/** Decoded bytes of a string — counted, never taken off a header. */
const bytesOf = (text: string): number => new TextEncoder().encode(text).length;

/**
 * WHAT THIS RESPONSE SAID ITS TOTAL WAS, kept only where it is true of the
 * bytes in hand. See {@link FileRead.total} for the measured reason.
 */
function totalOf(res: { readonly headers: { get(name: string): string | null } }, bytes: number): number | null {
  const said = res.headers.get('content-length');
  if (said === null) return null;
  const declared = Number(said);
  return Number.isFinite(declared) && declared === bytes ? declared : null;
}

/**
 * The committed entry, fetched — the browser's `loadStructure`.
 *
 * The refusal sentence names the URL and the status, because that is all there
 * is to name: no carrier vouched for these bytes, so there is no version to
 * report and no typed reason to carry.
 */
export async function loadStructureOverHttp(base: string | URL, watch?: HttpWatch): Promise<StructureArtifact> {
  const at = new URL(PROT_FILES.structure, base).href;
  watch?.onFileAsked?.(PROT_FILES.structure);
  const res = await fetch(at);
  if (!res.ok) throw new Error(`the structure file at ${at} answered ${String(res.status)} ${res.statusText} — this desk has nothing to draw without it`);
  const text = await res.text();
  // the one check a bare fetch can still make: a PDB entry begins with a HEADER
  // record, so an error page served with a 200 is caught rather than parsed
  if (!text.startsWith('HEADER')) throw new Error(`the bytes at ${at} are not a PDB entry (no HEADER record on the first line) — nothing was parsed`);
  const bytes = bytesOf(text);
  watch?.onFileRead?.({ file: PROT_FILES.structure, at, bytes, total: totalOf(res, bytes) });
  return structureArtifact(at, text);
}

/**
 * ONE COMMITTED FILE, FETCHED — the browser adapter for
 * `./conservationEvidence.ts` · `ReadCommitted`.
 *
 * The conservation stage's evidence for the example is five committed files
 * (`src/data/files.ts` · `PROT_CONSERVATION_FILES`): the archive's entity
 * records, two family matches and two curated alignments. They live under the
 * site's own base exactly as the structure file does, and are read exactly as
 * plainly — the alignment is Stockholm text and the records are JSON, so the
 * source port has no carrier for the first of them either, and the digests
 * that would have been versions are in
 * `data/prot/conservation/PROVENANCE.json`.
 *
 * The one check this door makes is the one the CARRIER GUARD taught: a service
 * or a mis-deployed site can answer 200 with an HTML error page, and an HTML
 * document handed to a parser becomes rows nobody can read. So an answer that
 * begins with `<` is refused here by name rather than parsed — and
 * `./stockholm.ts` makes the same check again on the alignment's own text,
 * because a guard at one door is a guard for one caller.
 */
export function readCommittedOverHttp(base: string | URL, watch?: HttpWatch): (file: string) => Promise<string> {
  return async (file) => {
    const at = new URL(file, base).href;
    watch?.onFileAsked?.(file);
    const res = await fetch(at);
    if (!res.ok) throw new Error(`the committed file at ${at} answered ${String(res.status)} ${res.statusText}`);
    const text = await res.text();
    if (text.trimStart().startsWith('<')) throw new Error(`the bytes at ${at} are an HTML document and not the committed file this desk asked for — nothing was parsed`);
    const bytes = bytesOf(text);
    watch?.onFileRead?.({ file, at, bytes, total: totalOf(res, bytes) });
    return text;
  };
}
