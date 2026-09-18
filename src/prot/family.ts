/**
 * WHICH FAMILY A CHAIN IS IN, AND THAT FAMILY'S CURATED ALIGNMENT — the two
 * InterPro doors.
 *
 * Both were measured with `Origin: https://footprintjs.github.io` and both
 * answer `access-control-allow-origin: *`, which is the fact that unblocked
 * this stage: we do not need to SEARCH a sequence database, because for a
 * protein in a known family the alignment already exists and is served to a
 * browser.
 *
 *   `entry/pfam/protein/uniprot/<ACCESSION>/`      which Pfam families the
 *       accession matches, and over which residues OF THE UNIPROT SEQUENCE.
 *   `wwwapi/entry/pfam/<PFAM>/?annotation=alignment:seed`
 *       the family's SEED alignment, in Stockholm, whose own `#=GF AC` line
 *       carries the accession AND the version this desk cites.
 *
 * ── TWO DOORS THIS DESK DELIBERATELY DOES NOT OPEN ─────────────────────────
 * **Our own sequence is not a row in the family alignment.** Measured: `grep
 * P05798` over the full PF00545 alignment finds 0 rows, and over the seed 0
 * rows. So the query cannot simply read its own line, which is why there is a
 * placement to compute at all.
 *
 * **InterPro serves sequence coordinates and no model positions.** The match
 * below is `{start: 5, end: 92, score: 8.1e-20}` and carries nothing about
 * which HMM position each residue is at, so there is no free residue→column
 * mapping to be had from it either.
 *
 * And **ConSurf-DB is not a third door**: its URLs answer 404 with an HTML
 * error page and no CORS header at all. Note the SHAPE of that — an HTML
 * document answering a declared data URL is precisely what the library's
 * carrier guard exists to refuse (`./http.ts` records what it cost the CSV
 * door), and it is why `./stockholm.ts` checks the first character before it
 * parses anything.
 *
 * ── THE ALIGNMENT ARRIVES GZIPPED, AND THAT IS NOT THIS CODE'S PROBLEM ─────
 * The alignment endpoint answers `content-type: text/plain` with
 * `content-encoding: gzip` — 27,581 bytes on the wire for 142,618 bytes of
 * Stockholm. A content coding is transport, so `fetch` hands over the text and
 * a reader here sees the alignment. It is written down because the two byte
 * counts are both true and are easy to quote as one another.
 */
import { knock, quoted, type ArchiveFetch, type FromArchive } from './archive.js';
import { parseStockholm, type StockholmAlignment } from './stockholm.js';

/** The two endpoints, in one place, so no call site spells one. */
export const INTERPRO_URLS = {
  matches: (accession: string): string => `https://www.ebi.ac.uk/interpro/api/entry/pfam/protein/uniprot/${accession}/`,
  alignment: (pfam: string): string => `https://www.ebi.ac.uk/interpro/wwwapi/entry/pfam/${pfam}/?annotation=alignment:seed`,
} as const;

/**
 * ONE PFAM MATCH — which family, and which residues OF THE REFERENCE SEQUENCE
 * it covers.
 *
 * `from`/`to` are UniProt positions, which is why hop 3 exists: they have to be
 * carried into the entity's own numbering before a residue of this desk can be
 * named (`./mapping.ts` · `entityPositionsOfReferenceRange`).
 */
export interface PfamMatch {
  /** The family accession WITHOUT a version (`PF00545`) — this record carries none; the alignment's header does. */
  readonly family: string;
  /** The family's own name, as InterPro gives it (`ribonuclease`). */
  readonly name: string | null;
  /** The first and last reference position the match covers. */
  readonly from: number;
  readonly to: number;
  /** The match score InterPro reports, or `null` — quoted, never interpreted here. */
  readonly score: number | null;
  /** How long the reference sequence is, as the match record states it. */
  readonly referenceLength: number | null;
}

/** A finite number, or `null`. The match record's numbers arrive as numbers; nothing is coerced. */
const finite = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * THE MATCHES FOR ONE ACCESSION, off bytes somebody already has — the fixture
 * door and the live door's shared half.
 *
 * A match with no `start`/`end` is DROPPED: a fragment whose range this desk
 * cannot read is a range it must not guess, and a guessed range places every
 * residue of the domain somewhere.
 */
export function pfamMatchesOf(answered: unknown): readonly PfamMatch[] {
  const results = typeof answered === 'object' && answered !== null && Array.isArray((answered as { results?: unknown }).results) ? ((answered as { results: readonly unknown[] }).results) : [];
  return results.flatMap((value) => {
    const result = value as { metadata?: { accession?: unknown; name?: unknown }; proteins?: readonly unknown[] };
    const family = typeof result.metadata?.accession === 'string' ? result.metadata.accession : null;
    if (family === null) return [];
    const name = typeof result.metadata?.name === 'string' ? result.metadata.name : null;
    return (result.proteins ?? []).flatMap((value2) => {
      const protein = value2 as { protein_length?: unknown; entry_protein_locations?: readonly unknown[] };
      const referenceLength = finite(protein.protein_length);
      return (protein.entry_protein_locations ?? []).flatMap((value3) => {
        const location = value3 as { score?: unknown; fragments?: readonly unknown[] };
        const score = finite(location.score);
        return (location.fragments ?? []).flatMap((value4) => {
          const fragment = value4 as { start?: unknown; end?: unknown };
          const from = finite(fragment.start);
          const to = finite(fragment.end);
          if (from === null || to === null) return [];
          return [{ family, name, from, to, score, referenceLength } satisfies PfamMatch];
        });
      });
    });
  });
}

/**
 * WHICH FAMILIES ONE UNIPROT ACCESSION IS IN.
 *
 * ```ts
 * const read = await pfamMatches('P05798', browserArchive);
 * read.ok && read.value.map((m) => `${m.family} ${String(m.from)}..${String(m.to)}`);
 * // ['PF00545 5..92']
 * ```
 *
 * An accession InterPro has no Pfam match for comes back as an EMPTY LIST and
 * not a refusal: "this chain is in no Pfam family" is a true answer about the
 * chain, and the desk says it by name for that chain while the other chain's
 * score still stands.
 */
export async function pfamMatches(accession: string, doors: ArchiveFetch): Promise<FromArchive<readonly PfamMatch[]>> {
  const at = INTERPRO_URLS.matches(accession);
  const knocked = await knock(doors, at);
  if (!knocked.ok) return knocked;
  const answer = knocked.value;
  /*
    NO CONTENT IS AN ANSWER, and it has to be read BEFORE the parse.

    204 is the service's own "no content" and carries an empty body — and `fetch`
    reports a 204 as `ok`, so a reader that only looked at `ok` would hand an
    empty string to `JSON.parse` and report a syntax error where the service had
    said something perfectly clear. 404 is its "no match". All three mean the
    same thing about the CHAIN: it is in no family this desk can look up, which
    is a list of none rather than a failure — and the desk then says so by name
    for that chain while every other chain's score stands.
  */
  if (answer.status === 204 || answer.status === 404 || answer.body.trim() === '') return { ok: true, value: [] };
  if (!answer.ok) {
    return { ok: false, sentence: `the family service at ${at} answered ${String(answer.status)} for "${accession}", so which family this chain belongs to is unknown and no residue of it is scored. It said: ${quoted(answer.body)}` };
  }
  try {
    return { ok: true, value: pfamMatchesOf(JSON.parse(answer.body)) };
  } catch {
    return { ok: false, sentence: `the family service at ${at} answered ${String(answer.status)} with something that is not JSON — the first characters are "${quoted(answer.body)}". No residue of this chain is scored.` };
  }
}

/**
 * ONE FAMILY'S CURATED SEED ALIGNMENT — the work this desk cites.
 *
 * The parse is `./stockholm.ts`'s, which is where the HTML refusal and the
 * "no `#=GF AC`, so no version, so no score" refusal live. This door adds only
 * what is about the SERVICE: a status that is not 200, and nothing answering
 * at all.
 */
export async function familyAlignment(pfam: string, doors: ArchiveFetch): Promise<FromArchive<StockholmAlignment>> {
  const at = INTERPRO_URLS.alignment(pfam);
  const knocked = await knock(doors, at);
  if (!knocked.ok) return knocked;
  const answer = knocked.value;
  if (!answer.ok) {
    return { ok: false, sentence: `the alignment service at ${at} answered ${String(answer.status)} for ${pfam}, so the curated alignment this score would come from was never read and no residue of this chain is scored. It said: ${quoted(answer.body)}` };
  }
  const read = parseStockholm(answer.body);
  return read.ok ? read : { ok: false, sentence: `${pfam} at ${at}: ${read.sentence}` };
}
