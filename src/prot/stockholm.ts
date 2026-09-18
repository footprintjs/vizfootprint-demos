/**
 * THE STOCKHOLM READER — somebody else's curated alignment, parsed, with its
 * own accession and VERSION read out of its own header.
 *
 * This desk does not build an alignment and will never build one. The
 * conservation of a column is a fact about a few hundred to a few thousand
 * sequences that a family's curators aligned, published and versioned, and the
 * only honest way to use it is to CITE IT: the page names `PF00545.26` —
 * accession and version — the way it names the PDB entry its coordinates came
 * from. So this module's whole job is to read the citation and the columns, and
 * `./conservation.ts` scores the columns without ever asking where they came
 * from.
 *
 * ── THE VERSION IS READ AND NEVER TYPED ─────────────────────────────────────
 * `#=GF AC   PF00545.26` is the file's own statement of which release of which
 * family this is. A version typed into this repository would be a version that
 * can drift from the bytes it names on the next Pfam release, and the drift
 * would be silent — the same score, attributed to an alignment nobody served.
 * So {@link parseStockholm} refuses a file with no `#=GF AC` line at all rather
 * than defaulting the version away.
 *
 * ── WHAT IS REFUSED, and why each refusal is its own sentence ───────────────
 * Three of them, and the first is the one the library's own carrier guard
 * exists for: a service that is down answers an HTML ERROR PAGE with a
 * `text/plain` content type, and an HTML document handed to a parser becomes
 * rows nobody can read (`src/prot/http.ts` records what that cost the CSV
 * door). So the first character is checked before anything else is.
 *
 * ── WHAT IT DELIBERATELY DOES NOT READ ─────────────────────────────────────
 * `#=GC seq_cons` — Pfam's own consensus line — is present in these files and
 * is NOT what this desk scores over. It is written in a reduced alphabet of
 * physicochemical classes, which is a different quantity from a residue
 * consensus, and a column's conservation has to come from the column's own
 * residues for the entropy below it to mean anything. So the `#=GC` lines are
 * skipped with every other annotation and the consensus this desk uses is
 * derived from the rows (`./conservation.ts` · `consensusOf`), which is the one
 * thing about this alignment that is ours.
 */

/**
 * EVERY CHARACTER THAT IS NOT A RESIDUE — Pfam writes a gap as `.` where the
 * model inserts and `-` where a sequence deletes, and `~` appears in alignments
 * from other tools.
 *
 * All three are ONE state for the score's purposes: "this sequence has no
 * residue in this column" is one fact, and splitting it three ways by which
 * tool wrote the file would make the same alignment score differently depending
 * on who exported it.
 */
export const GAP_CHARACTERS: ReadonlySet<string> = new Set(['.', '-', '~']);

/** Whether a character of an aligned row is a gap rather than a residue. */
export const isGap = (character: string): boolean => GAP_CHARACTERS.has(character);

/** One curated alignment, as a reader of it needs it: the citation, and the rows. */
export interface StockholmAlignment {
  /** The family accession WITHOUT its version (`PF00545`) — what a match record names. */
  readonly accession: string;
  /** The version the file itself declares (`26`), or `null` for an `#=GF AC` that carries none. */
  readonly version: string | null;
  /** The citation this desk prints: accession and version exactly as the header spells them (`PF00545.26`). */
  readonly cited: string;
  /** The family's own identifier (`#=GF ID`), or `null`. */
  readonly identifier: string | null;
  /** The family's own description (`#=GF DE`), or `null`. */
  readonly description: string | null;
  /** What the header says its sequence count is (`#=GF SQ`), or `null` — the CLAIM, beside {@link StockholmAlignment.rows}'s count. */
  readonly declaredCount: number | null;
  /** Who curated it (`#=GF AU`), for the credit line — `null` where the header carries none. */
  readonly authors: string | null;
  /** One aligned row per sequence, every row the same length — the columns the score is computed over. */
  readonly rows: readonly string[];
  /** How many columns wide it is. */
  readonly columns: number;
}

/** A read either produced an alignment or a sentence saying why not — never a throw, the `src/prot/archive.ts` discipline. */
export type FromAlignment = { readonly ok: true; readonly value: StockholmAlignment } | { readonly ok: false; readonly sentence: string };

/** The first characters of something that was supposed to be an alignment, for a refusal to quote. */
const quoted = (text: string): string => text.slice(0, 60).replace(/\s+/g, ' ').trim();

/** One `#=GF` value, or `null` — the header lines are `#=GF <TAG>   <value>`. */
function gfValue(lines: readonly string[], tag: string): string | null {
  const prefix = `#=GF ${tag}`;
  const line = lines.find((l) => l.startsWith(prefix));
  return line === undefined ? null : line.slice(prefix.length).trim();
}

/**
 * ONE ALIGNMENT, READ.
 *
 * ```ts
 * const read = parseStockholm(readFileSync('data/prot/conservation/PF00545-seed.sto', 'utf8'));
 * read.ok && read.value.cited;          // 'PF00545.26' — the file's own #=GF AC
 * read.ok && read.value.rows.length;    // 283
 * read.ok && read.value.columns;        // 241
 * ```
 *
 * The rows are ACCUMULATED BY NAME rather than taken a line at a time, because
 * Stockholm is legally interleaved: a wide alignment may be written as blocks
 * of every sequence's next 60 columns. These two files are not, and a parser
 * that assumed so would break on the next family somebody points this desk at.
 */
export function parseStockholm(text: string): FromAlignment {
  const trimmed = text.trimStart();
  // THE CARRIER GUARD'S OWN LESSON: a document is never an alignment by
  // accident. A service that is down answers HTML with a text/plain type, and
  // HTML fed to the loop below would be rows of tag soup with no complaint.
  if (trimmed.startsWith('<')) {
    return { ok: false, sentence: `the alignment service answered an HTML document where a Stockholm alignment was declared — the first characters are "${quoted(trimmed)}". Nothing was parsed: a document is never an alignment by accident.` };
  }
  if (!trimmed.startsWith('# STOCKHOLM')) {
    return { ok: false, sentence: `the alignment service answered something that is not a Stockholm alignment (no "# STOCKHOLM" on the first line) — the first characters are "${quoted(trimmed)}". Nothing was parsed.` };
  }
  const lines = trimmed.split('\n');
  const byName = new Map<string, string>();
  for (const line of lines) {
    // `#=GF`/`#=GS`/`#=GC`/`#=GR` annotations and the `//` terminator are not
    // sequences. `#=GC seq_cons` in particular is Pfam's own consensus in a
    // reduced alphabet, and this desk derives its own — see the file header.
    if (line.startsWith('#') || line.startsWith('//') || line.trim() === '') continue;
    const split = /^(\S+)\s+(\S+)\s*$/.exec(line);
    if (split === null) continue;
    byName.set(split[1]!, `${byName.get(split[1]!) ?? ''}${split[2]!}`);
  }
  const rows = [...byName.values()];
  if (rows.length === 0) {
    return { ok: false, sentence: `the alignment declares itself Stockholm and carries no aligned sequence at all — ${String(lines.length)} lines, every one of them an annotation or blank. There is no column to score.` };
  }
  const columns = rows[0]!.length;
  const ragged = rows.filter((row) => row.length !== columns).length;
  if (ragged > 0) {
    return { ok: false, sentence: `the alignment is ragged: ${String(ragged)} of its ${String(rows.length)} rows are not ${String(columns)} characters long, so its columns do not line up and a column's residues cannot be read. Nothing was scored.` };
  }
  const accessionLine = gfValue(lines, 'AC');
  if (accessionLine === null || accessionLine === '') {
    return { ok: false, sentence: `the alignment carries no "#=GF AC" line, so it does not say which family or which RELEASE it is — and a score this desk cannot attribute to a version is a score it will not show.` };
  }
  const dot = accessionLine.indexOf('.');
  const declared = gfValue(lines, 'SQ');
  const parsedCount = declared === null ? Number.NaN : Number(declared);
  return {
    ok: true,
    value: {
      accession: dot < 0 ? accessionLine : accessionLine.slice(0, dot),
      version: dot < 0 ? null : accessionLine.slice(dot + 1),
      cited: accessionLine,
      identifier: gfValue(lines, 'ID'),
      description: gfValue(lines, 'DE'),
      declaredCount: Number.isFinite(parsedCount) ? parsedCount : null,
      authors: gfValue(lines, 'AU'),
      rows,
      columns,
    },
  };
}
