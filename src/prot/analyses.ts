/**
 * THE FOUR DECLARED ACTS — everything this desk computes beyond what the file
 * says, as analyses the session performs and the log records.
 *
 * Before this module the protein desk landed NOTHING: every column it drew was
 * read off the entry's own coordinate records, and `./session.ts` said so. Now
 * three stages run and the screen gains a picture when each one ends — two of
 * them declared analyses over the same committed bytes, and the third over a
 * curated alignment somebody else published.
 *
 * | stage         | act                | channel   | what lands                                               |
 * |---------------|--------------------|-----------|----------------------------------------------------------|
 * | interactions  | {@link PAIRS_ACT}    | `table`   | `interactions` — one row per non-covalent contact         |
 * | interactions  | {@link CONTACTS_ACT} | `columns` | `contacts`, `interface_contacts`, `interface_separation`  |
 * | surface       | {@link SURFACE_ACT}  | `columns` | `sasa`, `relative_sasa`                                   |
 * | conservation  | {@link CONSERVATION_ACT} | `columns` | `conservation`, `conservation_basis`                  |
 *
 * ── AND THE FOURTH ACT IS THE ONE WHOSE DATA IS NOT THIS FILE'S ────────────
 * Three of them compute over the entry's own coordinates. The conservation act
 * CITES a curated family alignment this project did not build — accession and
 * version read out of the alignment's own header — and computes only where our
 * residues sit in it, by the WEAKER of two methods, which the page says
 * wherever it shows one of its numbers (`./placement.ts`). It is also the act
 * that emptied `PROT_UNAVAILABLE_STAGES`, and that list's own note is where
 * the reversal is written down.
 *
 * ── WHY STAGE A LANDS TWO ACTS, AND NOT ONE ─────────────────────────────────
 * This is the packet's finding, so it is written where the shape it forced
 * lives. A declared analysis has exactly ONE output channel, and the two things
 * stage A produces are at two different GRAINS: a contact is a PAIR of
 * residues, and a chart is only on the grammar if its table is in the data
 * space. The library's law (`vizfootprint` · `src/session/session.ts` ·
 * `aggregateOf`, in its own words: *an analysis whose table nobody can write
 * down has no act to belong to, so its rows stay in its own answer*) is that a
 * `table` output enters the data space ONLY when the analysis is a `builtin:
 * 'aggregate'` record — because the slot, the key, the relation back to the
 * parent and the replay all come from that record. A pair table computed by
 * third-party code is not an aggregate of anything the derive grammar can
 * spell, so `interactions` never becomes a table the def can name:
 *
 *   - `mintedTables` does not see it, so the def door refuses a layer over it —
 *     measured on this very def: *encodings[…].layers[0].table "interactions"
 *     is not a declared data table, and no declared analysis mints it*;
 *   - with no declared table there is no declared RELATION either, so no
 *     crossfilter clause reaches the pairs and no `builtin: 'layout'` can read
 *     them as its edges;
 *   - and a read of the name refuses at every cursor alike — *no table
 *     "interactions" here* — before the act and after it, so that refusal can
 *     never be the progression's evidence.
 *
 * So {@link PAIRS_ACT} lands the pairs where the library says they live — in
 * the act's own answer, which `./session.ts` holds and the receipt cell draws —
 * and {@link CONTACTS_ACT} lands the same evidence at the RESIDUE grain, where
 * the columns channel does reach the data space and a declared chart really is
 * refused before the act and drawn after it. Two acts, one stage, one finding.
 *
 * ── THE PRICE, stated ───────────────────────────────────────────────────────
 * Each act parses its own headless structure and runs its own compute — three
 * parses and two interaction passes over one file, 150–200 ms of compute inside
 * a boot measured end to end at about 340 ms (`./molstar.ts` has the per-piece
 * figures and the machine they were taken on). Nothing is cached
 * between acts on purpose: an act that trusted another act's in-memory answer
 * would be a cache the log cannot see, and 60 ms is not worth a second thing to
 * be wrong about.
 *
 * ── WHAT THE FLOWCHART ARGS CARRY, and what they deliberately do not ────────
 * A footprintjs stage's arguments must survive `structuredClone`, and they land
 * on the analysis run's own commit log. So the args carry the residue KEYS (the
 * alignment the columns channel needs) and `structureCharacters` — the one
 * thing about the file a host can vouch for (`./session.ts` ·
 * `StructureArtifact.characters`) — and the 169,371-character TEXT is closed
 * over instead of passed. That keeps the bytes off three commit logs while
 * still recording WHICH bytes each act read, which is the honest half of a
 * provenance nobody can carry (see `./http.ts` for why no carrier will take
 * this file).
 */
import { flowChart } from 'footprintjs';
import type { RunnableFlowChart } from 'footprintjs';
import type { AnalysisDef, AnalysisResult, ColumnsOutput, OutputColumnType, TableOutput } from 'vizfootprint/analysis';
import type { AnalysisSlot } from 'vizfootprint/def';
import { entryId } from './etl.js';
import { SCORE_IS, SCORE_IS_NOT } from './conservation.js';
import { ALIGNMENT_USED, type ConservationEvidence } from './conservationEvidence.js';
import { foldConservation, type ConservationCounts } from './conservationFold.js';
import { PLACEMENT_HERE, PLACEMENT_STRATEGIES } from './placement.js';
import { headlessEntry } from './molstar.js';
import { protInteractions, residueContactColumns, type DroppedContacts, type InteractionCounts, type InteractionRow } from './interactions.js';
import { protSurface, type SurfaceCounts } from './surface.js';

// ── the names, once ──────────────────────────────────────────────────────────

/** The act ids, as the def declares them and the session dispatches them. */
export const PAIRS_ACT = 'interactionPairs';
export const CONTACTS_ACT = 'residueContacts';
export const SURFACE_ACT = 'residueSurface';
export const CONSERVATION_ACT = 'residueConservation';

/** The table {@link PAIRS_ACT} cuts. Never a declared table — see the file header. */
export const INTERACTIONS_TABLE = 'interactions';

/**
 * THE TABLE THE ACTS RUN OVER AND THE COLUMN THEY ALIGN TO — spelled here, and
 * JUDGED against the def's own names at load.
 *
 * `./def.ts` owns `RESIDUES_TABLE` and `RESIDUE_KEY`, and it IMPORTS this
 * module (it declares the acts), so importing them back would be a cycle. Two
 * spellings of one name is the thing this repository refuses, so the def checks
 * these against its own the moment it loads (`./def.ts`, just under the import)
 * — the `../nndss/population.ts` · `BROUGHT` precedent: a demo that will not
 * start beats one whose column is a name nothing lands.
 */
export const ACT_TABLE = 'residues';
export const ACT_KEY_COLUMN = 'residue_key';

/** The columns {@link CONTACTS_ACT} lands on `residues`. */
export const CONTACTS_COLUMN = 'contacts';
export const INTERFACE_CONTACTS_COLUMN = 'interface_contacts';
export const INTERFACE_SEPARATION_COLUMN = 'interface_separation';
/** The columns {@link SURFACE_ACT} lands on `residues`. */
export const SASA_COLUMN = 'sasa';
export const RELATIVE_SASA_COLUMN = 'relative_sasa';
/**
 * The columns {@link CONSERVATION_ACT} lands on `residues`.
 *
 * `conservation_basis` is not decoration and is not a label: the two chains of
 * this entry are scored against TWO DIFFERENT curated alignments, over
 * different numbers of sequences, so a reader who read chain A's 0.8 and chain
 * B's 0.8 as one scale would be comparing two different claims. The warning
 * belongs in the DATA, beside the number, where a caption cannot be missed —
 * and it carries the accession WITH ITS VERSION, read out of the alignment's
 * own header (`./stockholm.ts`).
 */
export const CONSERVATION_COLUMN = 'conservation';
export const CONSERVATION_BASIS_COLUMN = 'conservation_basis';

/**
 * WHAT EACH COLUMN OF THE INTERACTION TABLE MEANS — declared here because
 * nothing else can declare it.
 *
 * A table in `def.data` carries a `ColumnDecl` per column: a role, a scale, a
 * unit, a label. The table this act cuts is not in `def.data` and never will be
 * (the file header says why), so there is no door to hang those facts on. This
 * list is the substitute: the act's `TableOutput.schema` is built from it, the
 * receipt cell heads its columns from it, and the meanings are the same
 * sentences a `label` would have carried.
 *
 * The `kind` vocabulary is Mol*'s own `InteractionType`, lowercased by
 * `./interactions.ts`. All ten words are named below even though the committed
 * entry only produces three, and even though three of the providers are OFF:
 * an absent `ionic` row means *nobody asked for ionic contacts*, which is a
 * different statement from *there are none*, and a reader can only tell the two
 * apart if the vocabulary and the provider list are both on the page.
 * `tests/prot-interactions.test.ts` pins these ten words against the engine's
 * own enum, so a Mol* upgrade that adds a kind fails a test rather than a
 * caption.
 */
export const INTERACTION_COLUMNS: readonly { readonly name: string; readonly type: OutputColumnType; readonly meaning: string }[] = [
  { name: 'interaction_key', type: 'string', meaning: 'the contact — "<residue_a>|<residue_b>|<n>", minted by src/prot/interactions.ts · interactionKey, where n counts the contacts between that same pair' },
  { name: 'residue_a', type: 'string', meaning: 'one end, as a "<chain>:<resnum>" key of the residues table — the file\'s own order, chain then number, and never a direction' },
  { name: 'residue_b', type: 'string', meaning: 'the other end, the same way' },
  { name: 'atom_a', type: 'string', meaning: 'the file\'s own name for the first atom of that end\'s feature (NE2, OD1, CA)' },
  { name: 'atoms_a', type: 'int', meaning: 'how many atoms that feature has: 1 means the separation below is the distance between atom_a and atom_b exactly; more means it is between centroids' },
  { name: 'atom_b', type: 'string', meaning: 'the same for the other end' },
  { name: 'atoms_b', type: 'int', meaning: 'the same for the other end' },
  { name: 'feature_a', type: 'string', meaning: 'the engine\'s own word for what that end IS, lowercased: hydrogen donor, hydrogen acceptor, aromatic ring, positive charge, negative charge, halogen donor, halogen acceptor, hydrophobicatom, weak hydrogen donor, ionic type partner, dative bond partner, transition metal, ionic type metal, none — spelled as the engine spells them, run-together word and all. This is where a hydrogen bond\'s direction lives, because the contact itself carries none' },
  { name: 'feature_b', type: 'string', meaning: 'the same for the other end' },
  {
    name: 'kind',
    type: 'string',
    meaning:
      'the engine\'s own taxonomy word, lowercased. The whole vocabulary is its ten: ionic interaction, cation-pi interaction, pi stacking, hydrogen bond, halogen bond, hydrophobic contact, metal coordination, weak hydrogen bond, water bridge — and unknown interaction, the word for a contact it found and cannot name. Which of them can ever appear is decided by the providers Mol* has ON, which this desk reads rather than sets: a word from an off provider is absent because nobody asked, not because the entry has none',
  },
  { name: 'separation', type: 'float', meaning: 'the distance between the two features\' centres, in ångström — the quantity the engine\'s own contact test thresholds on, and for a one-atom feature the heavy-atom separation exactly' },
  { name: 'crosses_chains', type: 'boolean', meaning: 'true where the two ends are in different chains: the interface, which is what this desk is about' },
];

/** The schema the act declares for its table — built from {@link INTERACTION_COLUMNS}, never typed twice. */
export const INTERACTION_SCHEMA: Readonly<Record<string, OutputColumnType>> = Object.fromEntries(INTERACTION_COLUMNS.map((c) => [c.name, c.type]));

// ── what each act's answer carries beyond its channel ────────────────────────

/**
 * The counts ride OUT ON THE OUTPUT, beside the channel's own keys.
 *
 * `rankAnalysis` in the library does the same thing (its `TableOutput` carries a
 * whole `ranking` record), and the reason is the same: a caption has to say how
 * many contacts were dropped and why, and the only place a caller of
 * `declareAnalysis` can read a fact the channel has no field for is the output
 * it hands back. Nothing here reaches the data space; `./session.ts` keeps it
 * beside the session for the cells, exactly as it keeps the structure bytes.
 */
export interface PairsOutput extends TableOutput {
  readonly rows: readonly InteractionRow[];
  readonly counts: InteractionCounts;
  readonly dropped: readonly DroppedContacts[];
}

export interface ContactsOutput extends ColumnsOutput {
  readonly counts: InteractionCounts;
  readonly dropped: readonly DroppedContacts[];
}

export interface SurfaceOutput extends ColumnsOutput {
  readonly counts: SurfaceCounts;
}

/**
 * The conservation act's answer — the two columns' counts, and every sentence
 * a reader must see.
 *
 * `refusals` rides out on the output for the reason `PairsOutput.dropped` does:
 * a chain with no family scores nothing while the OTHER chain's score stands,
 * so the act LANDS and still has something to say. A refusal that only existed
 * when the whole act failed would leave that state silent, which is the one
 * failure this stage may not have.
 */
export interface ConservationOutput extends ColumnsOutput {
  /** `null` only where no evidence was gathered at all — see {@link NO_CONSERVATION_EVIDENCE}. */
  readonly counts: ConservationCounts | null;
  readonly refusals: readonly string[];
}

/** What a def built with no family evidence says — the fifth refusal, and the one that is about this build rather than about the data. */
export const NO_CONSERVATION_EVIDENCE =
  'no family evidence was gathered for this entry, so nothing was placed and no residue is scored. The curated alignment this stage cites is read before the dashboard is built — from the files this repository committed for the example, or from the three services for any other entry — and this dashboard was built without it.';

/**
 * THE ONE CAST IN THIS FILE, and the packaging fact behind it.
 *
 * `AnalysisDef.build()` is declared as returning `import('footprintjs').FlowChart`,
 * so the library's type for a chart and the consumer's have to be the SAME
 * declaration. They are not here: this repository resolves `footprintjs` to a
 * hoisted 9.18.0 and `vizfootprint` — a `file:` sibling — carries its own
 * 9.16.1 under its own `node_modules`, and `FlowChart` reaches a `StageContext`
 * with PRIVATE fields, which makes two copies of one class nominally different
 * types. The chart this file builds really is a chart the library can run (the
 * acts land; `tests/prot-progression.test.ts` runs all three); what fails is
 * only the identity of the declaration, so the cast asserts exactly the thing
 * the runtime already proves and nothing more.
 *
 * It is ONE function rather than three casts so there is one place to delete
 * when the two copies become one (the `vitest.config.ts` · `dedupe` precedent,
 * which says the same thing about React).
 */
type LibraryChart = ReturnType<AnalysisDef['build']>;
const libraryChart = (chart: RunnableFlowChart): LibraryChart => chart as unknown as LibraryChart;

/** What every act's `toRunInput` hands its flowchart: the alignment, and which bytes. See the file header. */
interface ActArgs {
  readonly residueKeys: readonly string[];
  readonly structureCharacters: number;
}

/**
 * WHAT THE CONSERVATION ACT'S ARGS CARRY — the alignment, and the CITATION.
 *
 * Not the alignment's bytes: 158,134 characters on a commit log, for evidence
 * that is somebody else's published file. What rides is what a reader of the
 * log needs to check the claim — which family at which version, over how many
 * sequences, and which of the two placement methods ran.
 */
interface ConservationArgs {
  readonly residueKeys: readonly string[];
  readonly entry: string | null;
  readonly cites: readonly { readonly chain: string; readonly cited: string; readonly sequences: number; readonly which: string }[];
  readonly method: string;
  readonly weaker: boolean;
}

/** The rows the session reads at the cursor, narrowed to the one column these acts need. */
type KeyedRow = Readonly<Record<string, unknown>>;

/** The keys of the rows the session handed over, in the order it handed them — the alignment the columns channel judges against. */
const keysOf = (rows: readonly KeyedRow[]): readonly string[] => rows.map((r) => String(r[ACT_KEY_COLUMN]));

/** What every act reads on `residues`. Inert documentation, and the slice read-set hint. */
const RESIDUE_INPUTS = [{ column: ACT_KEY_COLUMN, role: 'identifier' as const }];

/**
 * An act's own array of values, off the finished run's state — the shape the
 * library's columns channel reads (`writeColumns` takes
 * `snapshot.sharedState[<column>]` as an array over the table's row order).
 *
 * Total over `unknown` because a snapshot is a boundary: a stage that threw
 * before its write leaves the key absent, and the honest answer there is an
 * EMPTY list, which the session then refuses by name (*produced no values for
 * column "…"*) rather than materialising a column of silences.
 */
function valuesAt(state: Readonly<Record<string, unknown>>, column: string): readonly unknown[] {
  const values = state[column];
  return Array.isArray(values) ? (values as readonly unknown[]) : [];
}

// ── the acts ─────────────────────────────────────────────────────────────────

/**
 * STAGE A, ACT ONE — the contacts, as a table.
 *
 * ```ts
 * const commit = await session.declareAnalysis(PAIRS_ACT, { cause });
 * const out = commit.result.ok ? (commit.result.output as PairsOutput) : undefined;
 * out?.rows.length;        // 224 on the committed entry
 * out?.counts.crossing;    // 21 — the interface
 * ```
 */
function pairsAnalysis(structureText: string): AnalysisDef<readonly KeyedRow[], PairsOutput> {
  return {
    id: PAIRS_ACT,
    kind: 'transform',
    produces: 'table',
    inputs: RESIDUE_INPUTS,
    honesty: {
      notes:
        'The contacts are Mol*\'s, not this desk\'s: which kinds are looked for is read off the engine\'s own provider defaults and never set here. A contact with an end the residues table has no row for is DROPPED and counted with its reason, never half-drawn. The rows of this table never enter the data space — the library lands a computed table only for a builtin aggregate — so no chart over it is on the grammar and no clause reaches it.',
    },
    build: () =>
      libraryChart(
      flowChart<{ readonly interactions: readonly InteractionRow[]; readonly counts: InteractionCounts; readonly dropped: readonly DroppedContacts[] }>(
        'Find every non-covalent contact in the entry',
        async (scope) => {
          const args = scope.$getArgs() as unknown as ActArgs;
          const entry = await headlessEntry(structureText, entryId(structureText));
          const found = await protInteractions(entry, args.residueKeys);
          scope.$setValue('interactions', found.interactions);
          scope.$setValue('counts', found.counts);
          scope.$setValue('dropped', found.dropped);
        },
        'contacts',
      ).build()),
    toRunInput: (rows): ActArgs => ({ residueKeys: keysOf(rows), structureCharacters: structureText.length }),
    readOutput: ({ snapshot }): AnalysisResult<PairsOutput> => {
      const state = snapshot.sharedState as Readonly<Record<string, unknown>>;
      const rows = valuesAt(state, 'interactions') as readonly InteractionRow[];
      return {
        ok: true,
        output: {
          as: 'table',
          name: INTERACTIONS_TABLE,
          schema: INTERACTION_SCHEMA,
          rows,
          counts: state['counts'] as InteractionCounts,
          dropped: state['dropped'] as readonly DroppedContacts[],
        },
      };
    },
  };
}

/**
 * STAGE A, ACT TWO — the same contacts, at the residue grain, as columns on
 * `residues`.
 *
 * This is the act a declared chart depends on: before it, the library refuses a
 * gesture at the interface bar in its own words (*no column
 * "interface_contacts" in table "residues"*); after it, the same gesture lands.
 * Seek the cursor back past this commit and the refusal returns, word for word,
 * which is the whole claim of this packet.
 */
function contactsAnalysis(structureText: string): AnalysisDef<readonly KeyedRow[], ContactsOutput> {
  return {
    id: CONTACTS_ACT,
    kind: 'transform',
    produces: 'columns',
    inputs: RESIDUE_INPUTS,
    honesty: {
      notes:
        'One row of `residues` is one residue, so these three columns are a FOLD of the pair table onto its ends. `interface_separation` is ABSENT — never 0 — for a residue with no contact across the chains: "does not touch another chain" is not a distance.',
    },
    build: () =>
      libraryChart(
      flowChart<{ readonly contacts: readonly number[]; readonly interface_contacts: readonly number[]; readonly interface_separation: readonly (number | null)[]; readonly counts: InteractionCounts; readonly dropped: readonly DroppedContacts[] }>(
        'Count each residue’s contacts, and the ones that cross the interface',
        async (scope) => {
          const args = scope.$getArgs() as unknown as ActArgs;
          const entry = await headlessEntry(structureText, entryId(structureText));
          const found = await protInteractions(entry, args.residueKeys);
          const columns = residueContactColumns(args.residueKeys, found.interactions);
          scope.$setValue(CONTACTS_COLUMN, columns.contacts);
          scope.$setValue(INTERFACE_CONTACTS_COLUMN, columns.interface_contacts);
          scope.$setValue(INTERFACE_SEPARATION_COLUMN, columns.interface_separation);
          scope.$setValue('counts', found.counts);
          scope.$setValue('dropped', found.dropped);
        },
        'fold-contacts',
      ).build()),
    toRunInput: (rows): ActArgs => ({ residueKeys: keysOf(rows), structureCharacters: structureText.length }),
    readOutput: ({ snapshot }): AnalysisResult<ContactsOutput> => {
      const state = snapshot.sharedState as Readonly<Record<string, unknown>>;
      return {
        ok: true,
        output: {
          as: 'columns',
          table: ACT_TABLE,
          columns: {
            [CONTACTS_COLUMN]: { type: 'int' },
            [INTERFACE_CONTACTS_COLUMN]: { type: 'int' },
            [INTERFACE_SEPARATION_COLUMN]: { type: 'float' },
          },
          counts: state['counts'] as InteractionCounts,
          dropped: state['dropped'] as readonly DroppedContacts[],
        },
      };
    },
  };
}

/**
 * STAGE B — how much of each residue the solvent can reach, as two columns on
 * `residues`.
 *
 * The same progression as stage A's second act, one commit later: the run chart
 * over sequence position is refused at the read until this lands, and refused
 * again the moment a reader steps back behind it.
 */
function surfaceAnalysis(structureText: string): AnalysisDef<readonly KeyedRow[], SurfaceOutput> {
  return {
    id: SURFACE_ACT,
    kind: 'transform',
    produces: 'columns',
    inputs: RESIDUE_INPUTS,
    honesty: {
      notes:
        'Shrake–Rupley as Mol* implements it, at the engine\'s OWN default parameters (read, not set: probe 1.4 Å, 92 sphere points, non-polymer atoms not occluding). The value is the accessible surface of the whole polymer with the deposited solvent taken away, so an interface residue is small because a NEIGHBOURING CHAIN is in the way. The relative value is absent — never 0 — where the reference table has no maximum for the residue type, because the engine\'s own convenience would have divided by alanine\'s and said nothing.',
    },
    build: () =>
      libraryChart(
      flowChart<{ readonly sasa: readonly (number | null)[]; readonly relative_sasa: readonly (number | null)[]; readonly counts: SurfaceCounts }>(
        'Roll a solvent probe over the complex, residue by residue',
        async (scope) => {
          const args = scope.$getArgs() as unknown as ActArgs;
          const entry = await headlessEntry(structureText, entryId(structureText));
          const found = await protSurface(entry, args.residueKeys);
          scope.$setValue(SASA_COLUMN, found.sasa);
          scope.$setValue(RELATIVE_SASA_COLUMN, found.relative_sasa);
          scope.$setValue('counts', found.counts);
        },
        'shrake-rupley',
      ).build()),
    toRunInput: (rows): ActArgs => ({ residueKeys: keysOf(rows), structureCharacters: structureText.length }),
    readOutput: ({ snapshot }): AnalysisResult<SurfaceOutput> => {
      const state = snapshot.sharedState as Readonly<Record<string, unknown>>;
      return {
        ok: true,
        output: {
          as: 'columns',
          table: ACT_TABLE,
          columns: { [SASA_COLUMN]: { type: 'float' }, [RELATIVE_SASA_COLUMN]: { type: 'float' } },
          counts: state['counts'] as SurfaceCounts,
        },
      };
    },
  };
}

/**
 * STAGE C — HOW CONSERVED EACH RESIDUE IS, as two columns on `residues`.
 *
 * ── THE ONE ACT ON THIS DESK WHOSE DATA IS SOMEBODY ELSE'S ─────────────────
 * The other three compute over the entry's own coordinates. This one CITES a
 * curated alignment of a few hundred sequences that this project did not build
 * — `PF00545.26`, accession and version, read out of the file's own Stockholm
 * header rather than typed (`./stockholm.ts`) — and computes exactly one
 * thing: where our residues sit in it. Four hops carry a column of that
 * alignment to a row of this desk and each one is READ
 * (`./conservationFold.ts` has the table; `./mapping.ts` owns the two the
 * annotation stage will want too).
 *
 * ── AND IT IS PLACED BY THE WEAKER OF TWO METHODS, WHICH THE PAGE SAYS ─────
 * `./placement.ts` is a port with two arms. The right one is the family's own
 * profile HMM and it is declared here and refuses by name, because the HMM
 * needs HMMER and a static page has nothing to run it on. What ran is a
 * pairwise alignment to a consensus folded from the alignment's columns, and
 * every number this act lands travels with the clause that says so — in the
 * honesty note below, in the stage's own panel line and on the card.
 *
 * ── THE EVIDENCE IS CLOSED OVER, LIKE THE STRUCTURE TEXT ───────────────────
 * The two alignments are 158,134 characters between them and they would ride
 * on this act's commit log as arguments. So the evidence is closed over and the
 * ARGS carry the citation instead: which alignment, with its version, how many
 * sequences it holds and which method placed against it — the declarative facts
 * a reader of the log needs, and the same choice the other three acts make
 * about the structure file.
 */
function conservationAnalysis(evidence: ConservationEvidence | null): AnalysisDef<readonly KeyedRow[], ConservationOutput> {
  const strategy = PLACEMENT_STRATEGIES[PLACEMENT_HERE];
  return {
    id: CONSERVATION_ACT,
    kind: 'transform',
    produces: 'columns',
    inputs: RESIDUE_INPUTS,
    honesty: {
      notes:
        `The alignment is CITED, not built: ${evidence === null ? 'no family alignment was read for this entry' : evidence.chains.flatMap((c) => c.families.map((f) => `${f.alignment.cited} (${String(f.alignment.rows.length)} sequences, the ${ALIGNMENT_USED} alignment)`)).join(' and ') || 'no family alignment was read for this entry'}. ` +
        `WHAT THE SCORE IS: ${SCORE_IS} ${SCORE_IS_NOT} ` +
        `WHICH METHOD PLACED IT: ${strategy.said}. ${strategy.why} ` +
        'A residue outside the family\'s domain region, or one the placement gapped, has NO score — absent, never zero — and the count is on the card.',
    },
    build: () =>
      libraryChart(
        flowChart<{ readonly conservation: readonly (number | null)[]; readonly conservation_basis: readonly (string | null)[]; readonly counts: ConservationCounts | null; readonly refusals: readonly string[] }>(
          'Place each residue in its family’s curated alignment and score its column',
          (scope) => {
            const args = scope.$getArgs() as unknown as ConservationArgs;
            if (evidence === null) {
              scope.$setValue('counts', null);
              scope.$setValue('refusals', [NO_CONSERVATION_EVIDENCE]);
              return;
            }
            const fold = foldConservation(evidence, args.residueKeys, PLACEMENT_HERE);
            // NOTHING PLACED MEANS NO COLUMN, and the library is what says so:
            // writing 185 nulls would put a column on the table that means
            // nothing, while writing nothing at all leaves the session to
            // refuse the read by name (*produced no values for column
            // "conservation"*) exactly as it does for an act that threw.
            if (fold.counts.scored > 0) {
              scope.$setValue(CONSERVATION_COLUMN, fold.conservation);
              scope.$setValue(CONSERVATION_BASIS_COLUMN, fold.conservation_basis);
            }
            scope.$setValue('counts', fold.counts);
            scope.$setValue('refusals', fold.refusals);
          },
          'place-and-score',
        ).build(),
      ),
    toRunInput: (rows): ConservationArgs => ({
      residueKeys: keysOf(rows),
      entry: evidence?.entry ?? null,
      // THE CITATION, ON THE LOG: which alignment, at which version, over how
      // many sequences, placed by which method. The bytes stay closed over.
      cites: (evidence?.chains ?? []).flatMap((chain) => chain.families.map((family) => ({ chain: chain.chain, cited: family.alignment.cited, sequences: family.alignment.rows.length, which: ALIGNMENT_USED }))),
      method: PLACEMENT_HERE,
      weaker: strategy.weaker,
    }),
    readOutput: ({ snapshot }): AnalysisResult<ConservationOutput> => {
      const state = snapshot.sharedState as Readonly<Record<string, unknown>>;
      return {
        ok: true,
        output: {
          as: 'columns',
          table: ACT_TABLE,
          columns: { [CONSERVATION_COLUMN]: { type: 'float' }, [CONSERVATION_BASIS_COLUMN]: { type: 'string' } },
          counts: (state['counts'] as ConservationCounts | null) ?? null,
          refusals: (valuesAt(state, 'refusals') as readonly string[]) ?? [],
        },
      };
    },
  };
}

/**
 * THE THREE ACTS, as the def declares them — over the bytes the def was built
 * on.
 *
 * `structureText` is the entry's own text, and it is a PARAMETER rather than
 * something read here for the reason every module in this folder gives: reading
 * a file needs node, and this one runs in a browser (`./snapshot.ts` and
 * `./http.ts` are the two doors that fetch it).
 */
export function protAnalyses(structureText: string, evidence: ConservationEvidence | null = null): Readonly<Record<string, AnalysisSlot>> {
  // THE ORDER IS {@link PROT_ACT_ORDER}'S, and `tests/prot-def.test.ts` pins
  // that: a registry in a different order from the list the orchestrator
  // dispatches off would make the def's own key order a second, silent
  // statement about which act lands first.
  //
  // THE FIRST ACT READS NO BYTES OF THE FILE. Its evidence is somebody else's
  // published alignment, gathered before the dashboard was built, and a def
  // built without it declares the act anyway — which lands a refusal rather
  // than a missing stage. See {@link NO_CONSERVATION_EVIDENCE}.
  return {
    [CONSERVATION_ACT]: conservationAnalysis(evidence) as unknown as AnalysisSlot,
    [PAIRS_ACT]: pairsAnalysis(structureText) as unknown as AnalysisSlot,
    [CONTACTS_ACT]: contactsAnalysis(structureText) as unknown as AnalysisSlot,
    [SURFACE_ACT]: surfaceAnalysis(structureText) as unknown as AnalysisSlot,
  };
}

/**
 * THE THREE STAGES AND THEIR ACTS, IN THE ORDER THEY MUST LAND — the list the
 * orchestrator dispatches off and the captions name their stage from, so the
 * words on screen and the commits on the log cannot spell the acts differently.
 *
 * The order is not a dependency chain — it is the order a READER meets the
 * pictures in, which is what the packet is about. Each act's `intent` is the
 * sentence the ledger carries, written down once here.
 *
 * CONSERVATION IS FIRST, for two reasons that agree: the PLAN publishes it as
 * step 2, the earliest analysis stage of the pipeline (`./plan.ts`), and it is
 * the one act that parses no headless structure — so the first picture to
 * arrive is the one that costs the least to land. The two interaction acts and
 * the surface act read the same two things after it (the entry's bytes and the
 * residue keys) and still land in the order they always did, which is why the
 * cursor comes to rest on the surface run exactly as it did before.
 */
export const PROT_STAGES: readonly {
  readonly stage: string;
  readonly label: string;
  readonly acts: readonly { readonly id: string; readonly intent: string }[];
}[] = [
  {
    stage: 'conservation',
    // THE SAME LABEL THIS STAGE HAS CARRIED SINCE IT WAS FIRST DECLARED, when
    // it was declared UNAVAILABLE. The stage changed; what it is called did not,
    // so nothing on the screen has to be re-read.
    label: 'How conserved each residue is across the family',
    acts: [
      {
        id: CONSERVATION_ACT,
        intent:
          'cite the curated alignment of the family each chain belongs to — accession and version, read out of the alignment\'s own header — score every one of its family positions by the Shannon entropy of that column, and land the score on the residues this desk\'s own rows carry by PLACING our sequence in it: absent, never zero, for a residue outside the family\'s domain region or one the placement gapped, and placed by the weaker of the two methods, which the page says wherever it shows a number',
      },
    ],
  },
  {
    stage: 'interactions',
    label: 'Every non-covalent contact in the entry',
    acts: [
      { id: PAIRS_ACT, intent: 'find every non-covalent contact Mol*\'s interaction engine reports between residues of this entry, and cut one row per contact — dropping, with a reason and a count, every contact with an end the residues table has no row for' },
      { id: CONTACTS_ACT, intent: 'fold those contacts onto the residues they touch: how many each residue is in, how many of those cross to a different chain, and the tightest of the crossing ones — absent, never zero, for a residue that touches no other chain' },
    ],
  },
  {
    stage: 'surface',
    label: 'How much of each residue the solvent can reach',
    acts: [{ id: SURFACE_ACT, intent: 'roll a 1.4 Å solvent probe over the complex and land each residue\'s accessible surface area, with the relative value beside it where the residue type has a published maximum to divide by and absent where it has none' }],
  },
];

/** Every act id, in landing order — the flat view of {@link PROT_STAGES}. */
export const PROT_ACT_ORDER: readonly string[] = PROT_STAGES.flatMap((s) => s.acts.map((a) => a.id));

/**
 * A STAGE THIS DESK DECLARED AND COULD NOT PERFORM — and the list is EMPTY
 * NOW, which is the whole story of this packet.
 *
 * ── WHAT IT SAID, AND WHY IT WAS WRONG ─────────────────────────────────────
 * For eight releases `conservation` was declared here, with a measured reason:
 * *"this stage needs a sequence-database search, and a static page cannot make
 * one — both public services answer without an access-control-allow-origin
 * header."* Every clause of that was true and the CONCLUSION was wrong,
 * because the premise underneath it was never checked: that answering *how
 * conserved is this residue* requires searching a database at all.
 *
 * It does not, for a protein in a KNOWN FAMILY. Somebody else has already
 * aligned that family's sequences, published the alignment, and versioned it —
 * and three services hand the pieces to a browser with
 * `access-control-allow-origin: *`: the archive's own entity records
 * (`./entities.ts`), InterPro's family match and that family's curated
 * alignment (`./family.ts`). So the stage runs here, as {@link PROT_STAGES}'s
 * third entry, and the only thing it computes is where our residues sit in
 * work it cites.
 *
 * ── THE LIST STAYS, AND THAT IS DELIBERATE ─────────────────────────────────
 * It is the seam a stage measured impossible on THIS build is declared
 * through: `./plan.ts` resolves a blocked step's reason from whichever list
 * owns it, and the stepper has a state and a mark for it
 * (`web/src/protStages.ts` · `'unavailable'`). Deleting the door because
 * nothing is standing in it today would mean the next such stage arrives with
 * nowhere honest to go — and the plan's own load-time judge already refuses a
 * plan that disagrees with whatever is in here.
 *
 * ── AND THE LESSON, WRITTEN WHERE THE CLAIM WAS ────────────────────────────
 * A measured refusal is worth more than a guess and is still only as good as
 * the QUESTION it was measured against. Both services really do refuse a
 * browser; nobody had asked whether the answer needed them.
 */
export const PROT_UNAVAILABLE_STAGES: readonly {
  readonly stage: string;
  readonly label: string;
  /** Why this page cannot perform it — printed on the stepper verbatim. */
  readonly why: string;
}[] = [];
