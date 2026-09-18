/**
 * THE ARCHIVE'S THREE DOORS — how this desk reaches an entry it was not built
 * with, and what it refuses before it reads a byte.
 *
 * The other three demos are built over a COMMITTED snapshot: the bytes are in
 * the repository, the ETL shapes them, and the only thing a reader can change
 * is the picture. This desk keeps that file as its EXAMPLE and adds a door to
 * the whole archive — so the interesting work is not the fetch, it is the
 * JUDGEMENT. An entry the curators of the PDB published in 1997 is not the
 * shape of an entry published in 2019, and every way the two differ is a way
 * this desk can be quietly wrong.
 *
 * ── THE THREE ENDPOINTS, and what each one is for ───────────────────────────
 *
 *   {@link ARCHIVE_URLS.search}   full text in, entry ids out. One POST.
 *   {@link ARCHIVE_URLS.entry}    one entry's own record: the title, the
 *                                 method, how many chains, how many models and
 *                                 HOW MANY ATOMS — which is the number the
 *                                 gate below reads before deciding to download
 *                                 anything at all.
 *   {@link ARCHIVE_URLS.file}     the fixed-column PDB text the ETL parses and
 *                                 the 3D view draws.
 *
 * All three answer `Access-Control-Allow-Origin: *`, which is what makes a
 * static page with no server behind it able to ask them at all.
 *
 * ── NO VERSION, STILL ───────────────────────────────────────────────────────
 * Everything `./http.ts` says about the committed file is true twice over here:
 * a structure file is not `rows`, `csv` or `json`, so no carrier will take it,
 * nothing vouches for the bytes and no commit carries their version. What this
 * module adds is not provenance — it is a sentence for every way the read can
 * go wrong, which is the only honest thing a door can add.
 *
 * ── WHY `fetch` IS AN ARGUMENT ──────────────────────────────────────────────
 * {@link ArchiveFetch} is the smallest shape these three calls need: a URL, an
 * optional POST, and an answer with `ok`, `status` and `text()`. The browser's
 * own `fetch` satisfies it through {@link browserArchive}, and a test hands in
 * a fake — so every refusal below is asserted against the bytes a service
 * really answers with, and no test in this repository depends on the network.
 * `text()` and never `json()`, deliberately: the search answers **204 with an
 * empty body** when nothing matches, and `json()` on that throws a parse error
 * where the truth is "nothing matched". And all three go through {@link knock},
 * so a door that REJECTS — an offline browser, a blocked request — is a
 * sentence like any other refusal and never an unhandled promise.
 */
import { entryId } from './etl.js';

/** The three public endpoints, in one place, so no call site spells one. */
export const ARCHIVE_URLS = {
  search: 'https://search.rcsb.org/rcsbsearch/v2/query',
  /**
   * THE ARCHIVE'S OWN GRAPHQL DOOR — how `src/prot/entities.ts` asks for the
   * four mapping fields and nothing else.
   *
   * It is here beside the other three because a URL of this service belongs to
   * one owner. The REST record for one polymer entity is 13,827 bytes, most of
   * it a taxonomy lineage nothing on this desk reads; GraphQL is the archive's
   * own way of asking for a shape, so one request answers for every chain and
   * the committed fixture is small enough to read by eye.
   */
  graphql: 'https://data.rcsb.org/graphql',
  entry: 'https://data.rcsb.org/rest/v1/core/entry/',
  file: 'https://files.rcsb.org/download/',
} as const;

/** What a door answered — the thing, or the SENTENCE a reader is shown. Never a throw, never an empty chart. */
export type FromArchive<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly sentence: string };

/** The part of a `fetch` answer these three doors read. */
export interface ArchiveAnswer {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}

/** The part of `fetch` these three doors call — a URL, an optional POST, an answer. */
export type ArchiveFetch = (url: string, init?: { readonly method: string; readonly headers: Readonly<Record<string, string>>; readonly body: string }) => Promise<ArchiveAnswer>;

/**
 * The browser's own `fetch`, as {@link ArchiveFetch} — the one adapter, in one
 * place, so the modules below never name the global.
 */
export const browserArchive: ArchiveFetch = (url, init) => fetch(url, init);

/**
 * THE EXAMPLE, BY ITS ID — the entry whose bytes this repository committed.
 *
 * It is declared here and read off the file's own HEADER record everywhere else
 * (`./etl.ts` · `entryId`); {@link exampleIsTheCommittedEntry} is the check
 * that the two agree, and `tests/prot-archive.test.ts` runs it against the
 * committed bytes. A name that could drift from the bytes it names is a name
 * worth pinning.
 */
export const EXAMPLE_ENTRY = '1AY7';

/** Whether the committed bytes really are the entry {@link EXAMPLE_ENTRY} names. */
export const exampleIsTheCommittedEntry = (structureText: string): boolean => entryId(structureText) === EXAMPLE_ENTRY;

/**
 * IS THIS AN ENTRY ID OR A QUESTION? — the one rule that decides which door a
 * reader's words go through.
 *
 * A legacy PDB id is four characters: a digit 1–9 and then three letters or
 * digits (`1AY7`, `4HHB`). The archive also issues EXTENDED ids
 * (`pdb_00001ay7`) for the entries that outgrew that space; this desk does not
 * accept them, and {@link entryIdRefusal} says so in words rather than sending
 * a reader's typo to the search service and listing whatever came back.
 */
export const looksLikeEntryId = (words: string): boolean => /^[1-9][A-Za-z0-9]{3}$/.test(words.trim());

/** What a reader is told when the address asked for something that is not an entry id. */
export const entryIdRefusal = (words: string): string =>
  `"${words}" is not a PDB entry id: an id is four characters — a digit and then three letters or digits, like "${EXAMPLE_ENTRY}". The archive's newer extended ids (pdb_0000…) are not read by this desk. Nothing was fetched.`;

// ── reading JSON without trusting it ────────────────────────────────────────

/** An object, or `null` — never a cast that assumes the service answered the shape it documents. */
export const objectOf = (value: unknown): Readonly<Record<string, unknown>> | null => (typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null);

/** A finite number at a key, or `null` — an absent count is never read as zero. */
export const numberAt = (record: Readonly<Record<string, unknown>> | null, key: string): number | null => {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

/** A non-empty string at a key, or `null`. */
export const textAt = (record: Readonly<Record<string, unknown>> | null, key: string): string | null => {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
};

/** The parsed body, or `null` when the answer was not JSON at all. */
export const jsonOf = (body: string): Readonly<Record<string, unknown>> | null => {
  try {
    return objectOf(JSON.parse(body));
  } catch {
    return null;
  }
};

/** The first characters of an answer nobody could parse — quoted, so a refusal names what really arrived. */
export const quoted = (body: string, howMany = 120): string => `${body.slice(0, howMany).replace(/\s+/g, ' ').trim()}${body.length > howMany ? '…' : ''}`;

/** What one knock came back with: the status, and the body as text. */
export interface Knocked {
  readonly ok: boolean;
  readonly status: number;
  readonly body: string;
}

/**
 * THE ONE KNOCK — and the reason every door below goes through it.
 *
 * `fetch` does not answer when there is nobody to answer: it REJECTS, with the
 * browser's own words (`Failed to fetch`), and so does reading a body that
 * stops mid-stream. A rejection out of these doors would reach a click handler
 * on the landing and become an unhandled promise — a reader left with the box
 * they typed in and no sentence at all. So the throw is caught HERE, once, and
 * turned into the same shape as every other refusal.
 *
 * The sentence names the address and quotes what was thrown, and it says the
 * one thing a reader of a server-less page needs to know: this request went
 * from their browser to the archive, so an offline browser, a blocked request
 * and a DNS failure all look exactly like this.
 */
export async function knock(doors: ArchiveFetch, at: string, init?: { readonly method: string; readonly headers: Readonly<Record<string, string>>; readonly body: string }): Promise<FromArchive<Knocked>> {
  try {
    const answer = await doors(at, init);
    return { ok: true, value: { ok: answer.ok, status: answer.status, body: await answer.text() } };
  } catch (error) {
    return {
      ok: false,
      sentence: `nothing answered at ${at} — ${error instanceof Error ? error.message : String(error)}. This page has no server behind it, so it asks the archive from your browser: an offline browser, a blocked request and a name that does not resolve all arrive here.`,
    };
  }
}

// ── door one: the search ────────────────────────────────────────────────────

/** What the search answered: the ids it listed, and how many it says there are in all. */
export interface ArchiveSearch {
  readonly ids: readonly string[];
  readonly total: number;
}

/** How many entries the landing lists for one question. A reader picks one; a list nobody can read is not a list. */
export const SEARCH_ROWS = 6;

/**
 * FULL TEXT IN, ENTRY IDS OUT.
 *
 * Four answers, four sentences, and the one that matters is the second: the
 * service answers **204 No Content** when nothing matches, so "nothing in the
 * archive says those words" is read off the STATUS and never guessed from an
 * empty list.
 */
export async function searchArchive(words: string, doors: ArchiveFetch, opts?: { readonly rows?: number }): Promise<FromArchive<ArchiveSearch>> {
  const asked = words.trim();
  const rows = opts?.rows ?? SEARCH_ROWS;
  const body = JSON.stringify({
    query: { type: 'terminal', service: 'full_text', parameters: { value: asked } },
    return_type: 'entry',
    request_options: { paginate: { start: 0, rows } },
  });
  const knocked = await knock(doors, ARCHIVE_URLS.search, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  if (!knocked.ok) return knocked;
  const answer = knocked.value;
  if (answer.status === 204) return { ok: false, sentence: `the archive's search answered 204 (no content) for "${asked}" — nothing in the PDB's full text matches those words` };
  const text = answer.body;
  if (!answer.ok) return { ok: false, sentence: `the archive's search at ${ARCHIVE_URLS.search} answered ${String(answer.status)} for "${asked}" — this desk has nothing to list. It said: ${quoted(text)}` };
  const parsed = jsonOf(text);
  if (parsed === null) return { ok: false, sentence: `the archive's search answered ${String(answer.status)} with something that is not JSON — the first characters are "${quoted(text)}"` };
  const set = Array.isArray(parsed['result_set']) ? (parsed['result_set'] as readonly unknown[]) : [];
  const ids = set.flatMap((row) => {
    const id = textAt(objectOf(row), 'identifier');
    return id === null ? [] : [id.toUpperCase()];
  });
  const total = numberAt(parsed, 'total_count') ?? ids.length;
  if (ids.length === 0) return { ok: false, sentence: `the archive's search reported ${String(total)} matches for "${asked}" and listed no entry id — there is nothing here to open` };
  return { ok: true, value: { ids, total } };
}

// ── door two: the entry's own record ────────────────────────────────────────

/**
 * ONE ENTRY, AS THE ARCHIVE RECORDS IT — every field `null` where the record
 * does not carry it, because an absent count is not a count of zero.
 *
 * These are the numbers the landing lists a result by and the numbers
 * {@link gateOf} judges a download by. They are the ARCHIVE's, read off its
 * own JSON; what the BYTES say is read separately and by somebody else
 * (`./entryNotes.ts`), and where the two disagree the bytes win — they are what
 * was parsed.
 */
export interface EntrySummary {
  readonly entry: string;
  /** The entry's title, in the depositors' words. */
  readonly title: string | null;
  /** Every experimental method the entry names (`X-RAY DIFFRACTION`, `SOLUTION NMR`, …). */
  readonly methods: readonly string[];
  /** How many models the deposition holds. More than one is the NMR case, and the desk reads the first. */
  readonly models: number | null;
  /** How many polymer CHAINS were deposited — one means there is no interface to find. */
  readonly chains: number | null;
  /** How many polymer entities are protein, and how many are nucleic acid. Zero protein means nothing for this desk to read. */
  readonly proteinEntities: number | null;
  readonly nucleicEntities: number | null;
  /** Deposited atoms — the size, BEFORE anything is downloaded. */
  readonly atoms: number | null;
  /** The archive's own word for what the polymers are (`heteromeric protein`, `protein/DNA`, …). */
  readonly composition: string | null;
}

/**
 * THE ENTRY RECORD, or the archive's own refusal.
 *
 * A 404 carries a `message` the service wrote (`No data found for entryId: …`)
 * and the sentence a reader sees QUOTES it: an id that does not exist is a fact
 * the archive states, not one this desk infers from a status code.
 */
export async function entryRecord(id: string, doors: ArchiveFetch): Promise<FromArchive<EntrySummary>> {
  const asked = id.trim().toUpperCase();
  const at = `${ARCHIVE_URLS.entry}${asked}`;
  const knocked = await knock(doors, at);
  if (!knocked.ok) return knocked;
  const answer = knocked.value;
  const text = answer.body;
  const parsed = jsonOf(text);
  if (!answer.ok) {
    const said = textAt(parsed, 'message');
    return { ok: false, sentence: `the archive has no entry "${asked}": its record at ${at} answered ${String(answer.status)}${said === null ? ` and said "${quoted(text)}"` : ` — ${said}`}` };
  }
  if (parsed === null) return { ok: false, sentence: `the archive's record for "${asked}" answered ${String(answer.status)} with something that is not JSON — the first characters are "${quoted(text)}"` };
  const info = objectOf(parsed['rcsb_entry_info']);
  const methods = (Array.isArray(parsed['exptl']) ? (parsed['exptl'] as readonly unknown[]) : []).flatMap((row) => {
    const method = textAt(objectOf(row), 'method');
    return method === null ? [] : [method];
  });
  return {
    ok: true,
    value: {
      entry: asked,
      title: textAt(objectOf(parsed['struct']), 'title'),
      methods,
      models: numberAt(info, 'deposited_model_count'),
      chains: numberAt(info, 'deposited_polymer_entity_instance_count'),
      proteinEntities: numberAt(info, 'polymer_entity_count_protein'),
      nucleicEntities: numberAt(info, 'polymer_entity_count_nucleic_acid'),
      atoms: numberAt(info, 'deposited_atom_count'),
      composition: textAt(info, 'polymer_composition'),
    },
  };
}

/**
 * WHAT THE ARCHIVE RELEASES ITS FILES UNDER — the dedication, in the archive's
 * own words.
 *
 * It is here rather than in a page's markup because a licence is a fact about
 * the source, and two spellings of one fact is the thing this repository
 * refuses: the desk's credit paragraph and the workbench header both read this
 * one constant, and `tests/prot-etl.test.ts` pins it against
 * `data/prot/PROVENANCE.json` · `license.dedication`, which is the record the
 * fetch script wrote. A page that typed the word would be a page making a
 * legal claim of its own.
 */
export const ARCHIVE_LICENCE = 'CC0 1.0 Universal';

/**
 * A SUMMARY SPLIT THE WAY A LIST READS IT — the title on its own, and the rest
 * of the archive's own line beside it.
 *
 * One owner for both shapes: {@link summaryLine} joins these back into the
 * single sentence the landing has always printed, and the workbench's results
 * rows put the title on one line and `rest` on the next, exactly as the design
 * lays them out. Neither re-words the archive.
 */
export function summaryParts(summary: EntrySummary): { readonly title: string; readonly rest: readonly string[] } {
  return {
    title: summary.title === null ? 'the archive\'s record carries no title for this entry' : summary.title.toLowerCase(),
    rest: [
      summary.methods.length === 0 ? 'no method named' : summary.methods.join(' and ').toLowerCase(),
      summary.chains === null ? 'no chain count' : `${String(summary.chains)} ${summary.chains === 1 ? 'chain' : 'chains'}`,
      summary.models === null || summary.models <= 1 ? null : `${String(summary.models)} models`,
      summary.atoms === null ? 'no atom count' : `${summary.atoms.toLocaleString('en-US')} atoms`,
    ].filter((p): p is string => p !== null),
  };
}

/** One line a reader can read a search result by — the title, the method and the chains, each named only where the record carries it. */
export function summaryLine(summary: EntrySummary): string {
  const { title, rest } = summaryParts(summary);
  return [title, ...rest].join(' · ');
}

// ── the gate: what is refused before a byte is read ─────────────────────────

/**
 * THE CEILING, DECLARED.
 *
 * Everything this desk does with an entry happens in the browser tab: the
 * fixed-column parse, Mol*'s interaction engine over every atom pair in range,
 * and a solvent probe sampled per atom. So the size is refused BEFORE the
 * download, off the archive's own deposited-atom count, and the number is
 * DECLARED rather than discovered when a tab stops answering. The committed
 * example deposits 1,678 atoms, so the ceiling is about thirty times it.
 *
 * WHAT NOBODY HAS MEASURED, said out loud: how long an entry AT the ceiling
 * takes in a browser. This repository has no bench for it, so the number is a
 * declared limit and not a budget — and a bigger claim than that would be a
 * number nobody checked.
 *
 * It is not a claim about how long anything takes: nothing in this repository
 * has measured that, and a number nobody measured does not belong on a screen.
 */
export const ATOM_CEILING = 50_000;

/** The gate's answer: the cost, stated, or the sentence that stopped the read. */
export type EntryGate = { readonly ok: true; readonly cost: string } | { readonly ok: false; readonly sentence: string };

/**
 * WHAT THIS ENTRY WILL COST, OR WHY IT IS NOT ATTEMPTED — judged on the
 * archive's record alone, with nothing downloaded.
 *
 * Three refusals, and each one is a fact off the record rather than a guess:
 *
 *   - NO ATOM COUNT: the record does not say how big the entry is, so the desk
 *     cannot tell what the file costs before reading it. It fails CLOSED: a
 *     ceiling nobody can check is not a ceiling.
 *   - ABOVE THE CEILING: the count with the ceiling beside it.
 *   - NO PROTEIN POLYMER: every column this desk draws is a protein fact — the
 *     two backbone angles, the key `<chain>:<resnum>` — so an entry of nucleic
 *     acid or sugar alone has nothing here to read.
 */
export function gateOf(summary: EntrySummary): EntryGate {
  if (summary.atoms === null) {
    return { ok: false, sentence: `the archive's record for ${summary.entry} carries no deposited atom count, so this desk cannot tell what the file would cost before reading it — and a ceiling nobody can check is not a ceiling. Nothing was downloaded.` };
  }
  if (summary.atoms > ATOM_CEILING) {
    return {
      ok: false,
      sentence: `${summary.entry} deposits ${summary.atoms.toLocaleString('en-US')} atoms and this desk will not attempt more than ${ATOM_CEILING.toLocaleString('en-US')}: the parse, Mol*'s interaction engine and the solvent probe all run in this browser tab, so the ceiling is declared rather than discovered when the tab stops answering. Nothing was downloaded.`,
    };
  }
  if (summary.proteinEntities === 0) {
    return {
      ok: false,
      sentence: `${summary.entry} deposits no protein polymer${summary.composition === null ? '' : ` (the archive calls it "${summary.composition}")`}: every column this desk draws is a protein fact — the two backbone angles, and the residue key "<chain>:<resnum>" — so there is nothing here for it to read. Nothing was downloaded.`,
    };
  }
  return {
    ok: true,
    cost: `${summary.entry} deposits ${summary.atoms.toLocaleString('en-US')} atoms${summary.chains === null ? '' : ` in ${String(summary.chains)} polymer ${summary.chains === 1 ? 'chain' : 'chains'}`}${summary.models === null || summary.models <= 1 ? '' : ` and ${String(summary.models)} models`} — read off the archive's own record before anything was downloaded, and under this desk's ceiling of ${ATOM_CEILING.toLocaleString('en-US')} atoms.`,
  };
}

// ── door three: the bytes ───────────────────────────────────────────────────

/** Bytes somebody fetched, and where from. The shape `./session.ts` · `structureArtifact` takes. */
export interface ArchiveBytes {
  readonly at: string;
  readonly text: string;
}

/**
 * THE FIXED-COLUMN FILE, or the sentence that explains its absence.
 *
 * The 404 here is not the same fact as the 404 on the record: the entry EXISTS
 * and the archive publishes no PDB-format file for it, because the format's
 * columns cannot hold a structure that large. That is a different sentence, and
 * a reader who is told "no such entry" about a ribosome has been misinformed.
 */
export async function downloadEntry(id: string, doors: ArchiveFetch): Promise<FromArchive<ArchiveBytes>> {
  const asked = id.trim().toUpperCase();
  const at = `${ARCHIVE_URLS.file}${asked}.pdb`;
  const knocked = await knock(doors, at);
  if (!knocked.ok) return knocked;
  const answer = knocked.value;
  if (answer.status === 404) {
    return {
      ok: false,
      sentence: `the archive publishes no PDB-format file for ${asked} (${at} answered 404), although the entry exists: a structure too large for the format's fixed columns is released as mmCIF only, and this desk reads the fixed-column format. Nothing was parsed.`,
    };
  }
  if (!answer.ok) return { ok: false, sentence: `the structure file at ${at} answered ${String(answer.status)} — this desk has nothing to draw without it` };
  const text = answer.body;
  // the one check a bare fetch can still make, and the same one `./http.ts`
  // makes on the committed file: a PDB entry begins with a HEADER record, so an
  // error page served with a 200 is caught rather than parsed
  if (!text.startsWith('HEADER')) return { ok: false, sentence: `the bytes at ${at} are not a PDB entry (no HEADER record on the first line) — nothing was parsed` };
  return { ok: true, value: { at, text } };
}

// ── the router: which door an entry goes through ────────────────────────────

/** The two doors an entry can come through: the committed bytes, and the archive. */
export interface EntryDoors {
  /**
   * THE COMMITTED EXAMPLE'S BYTES — the page's own http loader (`./http.ts`)
   * or the node snapshot (`./snapshot.ts`), never the archive.
   */
  committed(): Promise<ArchiveBytes>;
  /** Everything else: `fetch`, or a test's fake. */
  readonly archive: ArchiveFetch;
}

/** What {@link openEntryBytes} produced: the bytes, and the archive's record when there was one to read. */
export interface OpenedEntry {
  readonly bytes: ArchiveBytes;
  /** `null` for the example — its bytes are in this repository, so no record was asked for. */
  readonly summary: EntrySummary | null;
  /** The gate's cost sentence, or `null` for the example — nothing was downloaded for it. */
  readonly cost: string | null;
}

/**
 * ONE ENTRY, OPENED — the record, the gate, the bytes, in that order.
 *
 * THE EXAMPLE NEVER TOUCHES THE ARCHIVE. Its bytes are committed
 * (`data/prot/1ay7.pdb`), which is what makes this demo work with the network
 * unplugged and what keeps the example's provenance the one in
 * `data/prot/PROVENANCE.json` rather than whatever the archive serves today.
 * `tests/prot-archive.test.ts` asserts the archive door is called ZERO times on
 * that path.
 *
 * For every other entry the order is the point: the RECORD first (one small
 * JSON), then {@link gateOf} on what it said, and only then the file — so an
 * entry this desk will not attempt costs a reader one request and a sentence,
 * not a download they cannot use.
 */
export async function openEntryBytes(id: string, doors: EntryDoors): Promise<FromArchive<OpenedEntry>> {
  const asked = id.trim().toUpperCase();
  if (!looksLikeEntryId(asked)) return { ok: false, sentence: entryIdRefusal(id.trim()) };
  if (asked === EXAMPLE_ENTRY) return { ok: true, value: { bytes: await doors.committed(), summary: null, cost: null } };
  const record = await entryRecord(asked, doors.archive);
  if (!record.ok) return record;
  const gate = gateOf(record.value);
  if (!gate.ok) return { ok: false, sentence: gate.sentence };
  const bytes = await downloadEntry(asked, doors.archive);
  if (!bytes.ok) return bytes;
  return { ok: true, value: { bytes: bytes.value, summary: record.value, cost: gate.cost } };
}

// ── the landing's list ──────────────────────────────────────────────────────

/** One entry as a landing lists it: what it is, and whether this desk will open it. */
export interface ListedEntry {
  readonly entry: string;
  /** The line a reader reads it by — {@link summaryLine}, or nothing when the record could not be read. */
  readonly line: string | null;
  /**
   * The record itself, for a lister that lays the same facts out in more than
   * one line ({@link summaryParts}) — `null` when the record could not be read,
   * which is the same condition as a `null` {@link ListedEntry.line}.
   *
   * It carries no fact {@link ListedEntry.line} does not; it is the same answer
   * unjoined, so a layout can choose where the rules go without any reader of
   * this list re-wording the archive.
   */
  readonly summary: EntrySummary | null;
  /** Why this desk will not open it: the archive's refusal, or the gate's. `null` when it will. */
  readonly refusal: string | null;
}

/**
 * THE SEARCH'S IDS, EACH WITH ITS OWN RECORD — one small request per listed
 * entry, in parallel.
 *
 * A row is listed even when its record could not be read: dropping it would
 * make a list of five look like a list of four, and "the archive listed this id
 * and then would not describe it" is a fact worth a line. The GATE runs here
 * too, so an entry above the ceiling says so on the list rather than after a
 * reader has clicked it and waited.
 *
 * One call per id because the three endpoints named at the top of this file are
 * the three this desk has verified as callable from a page with no server; the
 * batch and GraphQL doors are not among them, and a door nobody checked is not
 * a door.
 */
export async function listEntries(ids: readonly string[], doors: ArchiveFetch): Promise<readonly ListedEntry[]> {
  return Promise.all(
    ids.map(async (entry): Promise<ListedEntry> => {
      const record = await entryRecord(entry, doors);
      if (!record.ok) return { entry, line: null, summary: null, refusal: record.sentence };
      const gate = gateOf(record.value);
      return { entry, line: summaryLine(record.value), summary: record.value, refusal: gate.ok ? null : gate.sentence };
    }),
  );
}
