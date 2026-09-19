/**
 * THE FIFTH DESK'S DEFINITION — one table, four pictures, six acts, and TWO
 * SCORES THAT NEVER BECOME ONE.
 *
 * ── WHAT THIS DESK IS FOR ──────────────────────────────────────────────────
 * It is a DETERMINISTIC ALTERNATIVE to ranking hot spots by showing a model a
 * picture of five measurement tracks and asking it to read residue numbers off
 * the pixels. Nothing here is ranked by a model; the score is arithmetic and
 * lands as a column like any other measurement, bindable to any chart.
 *
 * It stands BESIDE the protein desk (`src/prot/def.ts`), which is untouched.
 * That desk's own model-based stage 5 is a different and deliberate design —
 * the findings ledger, the citation discipline, the hallucination door — and is
 * neither replaced nor deprecated. Both open the same PDB entry, so the two can
 * be compared on the same molecule, which is the whole reason this is a fifth
 * desk and not an edit to the fourth.
 *
 * ── THE FOUR DECISIONS THIS DEF IS BUILT ON ────────────────────────────────
 *   1. THE STRUCTURE OWNS THE RESIDUE AXIS. Every track joins onto
 *      `residue_key`, minted from the PDB's own chain and residue number
 *      (`src/prot/etl.ts` · `residueKey`). No track brings its own sequence and
 *      nothing is joined by position. A track with nothing to say about a
 *      residue is ABSENT — never 0, never a default.
 *   2. TWO SCORES, NOT ONE SUM. `hotspot_structural` is what is true of THIS
 *      molecule; `hotspot_prior` is what somebody has already published about
 *      something similar. {@link TOGETHER_VIEW} is the picture of the cell a
 *      blended number would have destroyed: high on both.
 *   3. SPATIAL EXTENT, NOT A SEQUENCE WINDOW. A hot spot is a connected
 *      component under a Cα distance cutoff (`./extent.ts`), so its members are
 *      its residues and no range is ever produced — and therefore none is ever
 *      clamped.
 *   4. THE MODEL EXPLAINS; IT NEVER RANKS. No prose stage is built in this
 *      packet, and `./analyses.ts` · `WHAT_A_PROSE_STAGE_WOULD_BE` says exactly
 *      what one would be rather than leaving half a shape behind.
 *
 * ── THE ENTRY ──────────────────────────────────────────────────────────────
 * Whatever entry the host parsed. The committed example is the same file the
 * protein desk opens — `1AY7`, a two-chain protein–protein complex, wwPDB's
 * CC0 archive, credited in `data/prot/PROVENANCE.json`.
 */
import type { LinkDecl } from 'vizfootprint/def';
import type { AnalysisSlot, DashboardDef, DataSourceDef, ViewEncodingDecl } from 'vizfootprint/agent';
import type { EncodingRules } from 'vizfootprint/def';
import type { ProseDecl } from 'vizfootprint/prose';
import type { ActorMeta } from 'vizfootprint/selection';
import type { ProtTables, ResidueRow } from '../prot/etl.js';
import { ACT_KEY_COLUMN, ACT_TABLE } from '../prot/analyses.js';
import type { AnnotationEvidence } from '../prot/annotationEvidence.js';
import { HYDROPATHY_COLUMN, PATCH_COLUMN, PRIOR_BASIS_COLUMN, PRIOR_COLUMN, STRUCTURAL_BASIS_COLUMN, STRUCTURAL_COLUMN, hotAnalyses } from './analyses.js';
import { CA_CUTOFF } from './extent.js';
import { INTERFACE_FLOOR, W_BURIAL, W_CROSSING, W_DOMAIN, W_EPITOPE, W_HYDROPATHY, W_TIGHTNESS } from './score.js';

// ── the table, and the guard that keeps its name one name ───────────────────

export const RESIDUES_TABLE = 'residues';
export const RESIDUE_KEY = 'residue_key';

/**
 * The acts are declared over `ACT_TABLE`.`ACT_KEY_COLUMN` and this def declares
 * its own spelling — the `src/prot/def.ts` guard, for the same reason and with
 * the same verdict: a demo that will not start beats one whose column is a name
 * nothing lands.
 */
if (ACT_TABLE !== RESIDUES_TABLE || ACT_KEY_COLUMN !== RESIDUE_KEY) {
  throw new Error(`the acts are declared over "${ACT_TABLE}"."${ACT_KEY_COLUMN}" and this def declares "${RESIDUES_TABLE}"."${RESIDUE_KEY}" — src/prot/analyses.ts and src/hot/def.ts have drifted`);
}

// ── the views, named once ────────────────────────────────────────────────────

/** THE STRUCTURAL RUN — how much THIS molecule says each residue is a hot spot, along the sequence, one line per chain. */
export const STRUCTURAL_VIEW = 'structural';
/** THE PRIOR RUN — how much ALREADY-PUBLISHED work says so, drawn the same way beside it. */
export const PRIOR_VIEW = 'prior';
/**
 * THE PICTURE THE TWO SCORES EXIST FOR — one dot per residue, structural
 * across, prior up, coloured by the patch it belongs to.
 *
 * This is why there is no blended column. A weighted sum of the two puts a
 * residue that is strong evidence on this molecule and a residue somebody once
 * published a domain about at the same height, and a reader can never take them
 * apart again. Here the top-right corner is the answer, the bottom-right is
 * *this molecule says so and nobody has written it down*, and the top-left is
 * *somebody wrote it down and this molecule does not show it* — three different
 * statements, all of them visible, none of them reachable from one number.
 */
export const TOGETHER_VIEW = 'together';
/** THE PATCHES — the residues of every component, with the structural score as their height and the patch as their colour. */
export const PATCHES_VIEW = 'patches';
/** The sheet — every residue, every landed column, and the receipt. */
export const SHEET_VIEW = 'sheet';

/** The views, in the order a reader meets them. */
export const HOT_VIEWS = [STRUCTURAL_VIEW, PRIOR_VIEW, TOGETHER_VIEW, PATCHES_VIEW, SHEET_VIEW] as const;

// ── who drives what ──────────────────────────────────────────────────────────

const STRUCTURAL: ActorMeta = {
  actor: 'user',
  label: 'What this molecule says: contacts across the interface, burial, hydrophobicity',
  does: 'press a position to keep that residue — and only once the stage that scores them has landed; before it, the library refuses the gesture by naming the column it cannot read. The line stops where a residue has no structural score at all, rather than dipping to zero',
};
const PRIOR: ActorMeta = {
  actor: 'user',
  label: 'What is already published: an IEDB epitope, and how deep inside a Pfam domain the residue sits',
  does: 'press a position to keep that residue. This line is NOT the one beside it on a different scale — it is a different question, about somebody else\'s work rather than about this file, and the two are never added together',
};
const TOGETHER: ActorMeta = {
  actor: 'user',
  label: 'The two scores against each other, one dot per residue',
  does: 'drag across the structural axis to keep a range of it — the runs narrow, the patch bars drop and the sheet follows. The corner a reader wants is the top right: high on both',
};
const PATCHES: ActorMeta = {
  actor: 'user',
  label: 'The residues of every spatial patch, coloured by which patch',
  does: 'press a bar to keep that residue. A patch is a connected component in three dimensions, so its residues are not a range of sequence positions and two of them can be in different chains',
};
const SHEET: ActorMeta = {
  actor: 'user',
  label: 'Every residue, every track, both scores and the basis of each',
  does: 'read the rows behind every picture, including the two basis columns that say which terms each score rests on, and export the receipt',
};

// ── the data ─────────────────────────────────────────────────────────────────

/**
 * THE ONE TABLE — the same rows `src/prot/etl.ts` parses, declared for THIS
 * desk's question.
 *
 * It is a separate declaration from the protein desk's rather than a shared
 * one, and that is deliberate: a `ColumnDecl` says what a column MEANS ON THIS
 * DASHBOARD, and the two desks mean different things by the same rows. This one
 * declares no `phi` and no `psi` — nothing here draws a backbone angle, and a
 * declared column no picture binds is an offer to an agent that this desk
 * cannot honour. The alpha carbon's three coordinates ARE declared, because
 * they are what the extent stage reads.
 *
 * Every column an ACT lands is declared by the act that lands it
 * (`./analyses.ts` · `readOutput`), never here: the `hotspot_rank` precedent
 * next door — a def that speaks for a column it does not own is a second owner
 * of the same fact.
 */
function hotSources(residues: readonly ResidueRow[]): Record<string, DataSourceDef> {
  return {
    [RESIDUES_TABLE]: {
      source: { format: 'rows', via: 'inline', at: residues },
      key: RESIDUE_KEY,
      columns: {
        residue_key: { role: 'identifier', label: 'residue — the chain and the number the file gives it, as "<chain>:<resnum>". THE AXIS every track joins onto' },
        chain: { role: 'dimension', label: 'chain, as the file labels it' },
        // a POSITION in a sequence, never a magnitude — the `src/prot/def.ts` argument, unchanged
        resnum: { role: 'dimension', scale: 'discrete', label: 'residue number within its chain, as the depositors numbered it' },
        resname: { role: 'dimension', label: 'the amino acid, in the file’s three-letter code — what the hydropathy table is looked up on' },
        ca_x: { role: 'measure', unit: 'ångström', label: 'alpha carbon, x — the file’s own frame, and what the patches are computed over' },
        ca_y: { role: 'measure', unit: 'ångström', label: 'alpha carbon, y — the file’s own frame, and what the patches are computed over' },
        ca_z: { role: 'measure', unit: 'ångström', label: 'alpha carbon, z — the file’s own frame, and what the patches are computed over' },
      },
    },
  };
}

// ── the encoding surface ─────────────────────────────────────────────────────

/** A coordinate is WHERE the residue is, and the patches are computed from all three — spending a channel on one of them would say the same fact twice. */
export const HOT_ENCODING_RULES: EncodingRules = {
  onInvalid: 'refuse',
  ruleScope: 'view',
  rules: (['ca_x', 'ca_y', 'ca_z'] as const).map((column) => ({
    rule: 'never-on' as const,
    column,
    channels: ['color', 'size'] as const,
    sentence: 'the alpha carbon’s {column} is WHERE the residue is, and it is what the patches are grouped by — putting it on {channel} would encode the same fact twice and disagree with itself',
  })),
};

/**
 * THE FOUR SURFACES, declared before their columns exist — exactly as the
 * protein desk declares its act-fed charts, and for the same reason: the READ
 * is what judges a binding, at every cursor, so a gesture here is refused in the
 * library's own words (*no column "hotspot_structural" in table "residues"*)
 * until the act lands, and refused again the moment a reader steps the cursor
 * back behind that commit.
 *
 * `x: 'resnum'` on both runs and never the residue key — the library's own law,
 * *an identifier along a run is a lie about order* — so both chains are drawn
 * over one numbering and told apart by colour.
 *
 * THE PATCH BAR BORROWS ITS HEIGHT from the score stage, which lands one commit
 * EARLIER than the extent stage that owns the picture. That is the protein
 * desk's law, kept here on purpose: *a picture may borrow a column from a stage
 * that lands earlier, never from one that lands later.*
 */
export const HOT_ENCODINGS: readonly ViewEncodingDecl[] = [
  { viewId: STRUCTURAL_VIEW, chartKind: 'line', channels: ['x', 'y', 'color'], initial: { x: 'resnum', y: STRUCTURAL_COLUMN, color: 'chain' } },
  { viewId: PRIOR_VIEW, chartKind: 'line', channels: ['x', 'y', 'color'], initial: { x: 'resnum', y: PRIOR_COLUMN, color: 'chain' } },
  { viewId: TOGETHER_VIEW, chartKind: 'scatter', channels: ['x', 'y'], initial: { x: STRUCTURAL_COLUMN, y: PRIOR_COLUMN } },
  { viewId: PATCHES_VIEW, chartKind: 'bar', channels: ['category', 'y', 'color'], initial: { category: RESIDUE_KEY, y: STRUCTURAL_COLUMN, color: PATCH_COLUMN } },
];

// ── the words ────────────────────────────────────────────────────────────────

/** The dashboard's title — the same shape the four desks beside it use. */
export const HOT_TITLE = 'Hot spots, measured — the same PDB entry, scored by arithmetic instead of by a model reading a picture';

/**
 * WHAT THIS DESK IS CALLED, and its claim about itself — the pair
 * `src/prot/def.ts` · `PROT_WORDS` declares, for the same reason and in the
 * same two registers.
 *
 * A NAME is not data about the run: it does not count anything, it does not
 * change with the entry, and it is what the workbench header's first slot is
 * reserved for (`web/src/workbench/Chrome.tsx` · `WorkbenchHeader`). The
 * CLAIM is a sentence that argues something, and a reader meets it under the
 * record's fold rather than in the slot a name goes in.
 *
 * The name says the relation out loud — this is the protein workbench with a
 * different stage 5 — because the whole reason there are two pages is that
 * they are read side by side.
 */
export const HOT_WORDS = {
  name: 'Protein Hot Spot Workbench — measured',
  title: HOT_TITLE,
} as const;

/** How the two budgets are spelled wherever this desk prints them, so the weights on screen and the weights in the fold are one fact. */
export const WEIGHTS_SAID = `structural: ${String(W_CROSSING)} interface contacts + ${String(W_TIGHTNESS)} tightest crossing separation + ${String(W_BURIAL)} burial + ${String(W_HYDROPATHY)} hydropathy · prior: ${String(W_EPITOPE)} epitope + ${String(W_DOMAIN)} depth inside a Pfam domain`;

/** One author for every sentence this def declares — they are the dashboard author's, and none of them is a model's. */
const BY_THE_AUTHOR = { kind: 'human' as const, by: 'the dashboard author' };

function hotProse(tables: ProtTables): readonly ProseDecl[] {
  const { counts } = tables;
  const chains = counts.chains.map((c) => `${c.chain} (${String(c.residues)})`).join(' and ');
  const caption =
    `${String(counts.residues)} residues across ${String(counts.chains.length)} chains — ${chains}. Five measurement tracks land on those residues, four of them through the acts the protein desk beside this one already declares, and a fifth by a lookup in a published hydropathy table. ` +
    `They are folded into TWO scores and never one: ${WEIGHTS_SAID}. The weights are a fixed budget that is never renormalised, so a residue can only reach the part of it its own evidence paid for, and a basis column beside each score names every term it saw and every term that was absent. ` +
    `A hot spot's EXTENT is then a connected component under ${String(CA_CUTOFF)} Å between alpha carbons, over the residues scoring above ${String(INTERFACE_FLOOR)} — which is the most a residue can score with no interface evidence at all, folded from the weights rather than chosen. A patch's members are its residues; nothing here ever produces a range, so nothing here ever has to repair one.`;
  return [
    { viewId: 'dashboard', slots: { title: { text: HOT_TITLE, author: BY_THE_AUTHOR }, caption: { text: caption, author: BY_THE_AUTHOR, levels: ['construction'] } } },
    {
      viewId: STRUCTURAL_VIEW,
      slots: {
        title: { text: 'What this molecule shows', author: BY_THE_AUTHOR, levels: ['construction'] },
        altShort: { text: 'A run of each residue’s structural hot-spot score along the sequence, one line per chain. Empty until the stage that scores them has landed.', author: BY_THE_AUTHOR, levels: ['construction'] },
        altLong: {
          text:
            `One point per residue, at the score folded from what is true of THIS molecule: ${String(W_CROSSING)} of the budget for how many contacts it makes across the interface, ${String(W_TIGHTNESS)} for the tightest of those contacts, ${String(W_BURIAL)} for how much of it the solvent can no longer reach, and ${String(W_HYDROPATHY)} for the published hydropathy of its type. ` +
            `THE LINE STOPS where a residue has no structural score at all rather than dipping to zero, because zero would be a measurement of "not a hot spot" that nothing measured. A residue that misses ONE term still has a score and the basis column beside it names what was missing. ` +
            `This picture is not there when the page opens: the column it draws is landed by an act, and until then the library refuses a read of it by name.`,
          author: BY_THE_AUTHOR,
          levels: ['construction'],
          basis: { columns: [RESIDUE_KEY, 'chain', 'resnum', STRUCTURAL_COLUMN, STRUCTURAL_BASIS_COLUMN] },
        },
        howToRead: { author: { kind: 'derived' } },
      },
    },
    {
      viewId: PRIOR_VIEW,
      slots: {
        title: { text: 'What is already published', author: BY_THE_AUTHOR, levels: ['construction'] },
        altShort: { text: 'A run of each residue’s prior hot-spot score along the sequence, one line per chain — a different question from the run beside it, never added to it.', author: BY_THE_AUTHOR, levels: ['construction'] },
        altLong: {
          text:
            `One point per residue, at the score folded from what somebody has ALREADY PUBLISHED about something similar: ${String(W_EPITOPE)} of the budget for an epitope the IEDB records, and ${String(W_DOMAIN)} for how far inside a Pfam domain the residue sits on this entry's own numbering. ` +
            `IT IS NOT THE SAME SCALE AS THE RUN BESIDE IT and the two are never combined — a residue strong on this one and weak on that one is a residue somebody wrote about and this molecule does not show, which is a real and different finding. ` +
            `Where a prior source was asked and named nothing, the term is ABSENT and the basis column says so; a residue no prior track names at all has no score here rather than a zero.`,
          author: BY_THE_AUTHOR,
          levels: ['construction'],
          basis: { columns: [RESIDUE_KEY, 'chain', 'resnum', PRIOR_COLUMN, PRIOR_BASIS_COLUMN] },
        },
        howToRead: { author: { kind: 'derived' } },
      },
    },
    {
      viewId: TOGETHER_VIEW,
      slots: {
        title: { text: 'The two scores against each other', author: BY_THE_AUTHOR, levels: ['construction'] },
        altShort: { text: 'A scatter plot of each residue’s prior score against its structural score, coloured by the spatial patch it belongs to. Drag across the horizontal axis to keep a range.', author: BY_THE_AUTHOR, levels: ['construction'] },
        altLong: {
          text:
            `One dot per residue: the structural score across, the prior score up. THIS IS THE PICTURE THE TWO COLUMNS EXIST FOR. A single weighted sum puts a residue that is strong evidence on this molecule and a residue somebody once published a domain about at the same height, and nothing can take them apart again; here the top right is high on both, the bottom right is "this molecule says so and nobody has written it down", and the top left is "somebody wrote it down and this molecule does not show it". ` +
            `A residue missing either score has no dot, which is the honest answer for a point that would need a coordinate nothing measured.`,
          author: BY_THE_AUTHOR,
          levels: ['construction'],
          basis: { columns: [STRUCTURAL_COLUMN, PRIOR_COLUMN, PATCH_COLUMN] },
        },
        howToRead: { author: { kind: 'derived' } },
      },
    },
    {
      viewId: PATCHES_VIEW,
      slots: {
        title: { text: 'The patches, residue by residue', author: BY_THE_AUTHOR, levels: ['construction'] },
        altShort: { text: 'A bar chart of the residues in every spatial patch, as tall as their structural score and coloured by which patch they belong to.', author: BY_THE_AUTHOR, levels: ['construction'] },
        altLong: {
          text:
            `One bar per residue that is in a patch at all, as tall as its structural score and coloured by the patch. A PATCH IS A CONNECTED COMPONENT under ${String(CA_CUTOFF)} Å between alpha carbons, so its residues are a SET and never a range: two of them can be forty apart in sequence, or in two different chains, and still be one patch because they are adjacent in space. ` +
            `The height is borrowed from the stage that scores, which lands one commit earlier than the stage that finds the patches — a picture may borrow a column from a stage that lands earlier and never from one that lands later.`,
          author: BY_THE_AUTHOR,
          levels: ['construction'],
          basis: { columns: [RESIDUE_KEY, STRUCTURAL_COLUMN, PATCH_COLUMN] },
        },
        howToRead: { author: { kind: 'derived' } },
      },
    },
  ];
}

// ── the rest of the declaration ──────────────────────────────────────────────

/** No declared edges: the dashboard's crossfilter default is exactly right here, because every picture is about residues and so is every clause. */
function hotLinks(): readonly LinkDecl[] {
  return [];
}

/** One mark per ROW at every address that draws residues — `[]`, the `src/prot/def.ts` · `protGrains` argument, unchanged. */
export function hotGrains(): readonly { readonly viewId: string; readonly keys: readonly string[] }[] {
  return HOT_VIEWS.filter((viewId) => viewId !== SHEET_VIEW).map((viewId) => ({ viewId, keys: [] }));
}

/**
 * The def over one parsed entry, its bytes, and what is already published about
 * its sequences.
 *
 * ```ts
 * const text = readFileSync('data/prot/1ay7.pdb', 'utf8');
 * const def = hotDef(protTables(text), text);
 * Object.keys(def.analyses ?? {}).length;   // 6 — three reused, three this desk's own
 * ```
 *
 * The bytes are a parameter for the reason `protDef`'s are: two of the reused
 * acts parse a headless structure of their own, and a def whose acts read a file
 * its signature does not mention would be a def fetching something behind its
 * caller's back. The annotation evidence is a parameter for the same reason —
 * `null` is legal and lands the reused act's own refusal, which is what a def
 * built for a lint or a card sees.
 */
export function hotDef(tables: ProtTables, structureText: string, annotation: AnnotationEvidence | null = null): DashboardDef {
  return {
    meta: { title: HOT_TITLE },
    data: hotSources(tables.residues),
    actors: {
      [STRUCTURAL_VIEW]: STRUCTURAL,
      [PRIOR_VIEW]: PRIOR,
      [TOGETHER_VIEW]: TOGETHER,
      [PATCHES_VIEW]: PATCHES,
      [SHEET_VIEW]: SHEET,
    },
    analyses: hotAnalyses(structureText, annotation) as Readonly<Record<string, AnalysisSlot>>,
    encodings: HOT_ENCODINGS,
    grains: hotGrains(),
    // THE HONEST CAPABILITY ENVELOPE, one view at a time — and each one is what
    // the picture really has a gesture for, never a kind nothing emits.
    //
    // Both RUNS are drawn over a BAND (x is `resnum`, a discrete dimension), so
    // a drag lands the slots it covered and a tap lands one slot: a POINT, which
    // by the library's SET-1 law also accepts the match a drag produces. Not an
    // interval — that is the voice the protein desk's two runs declared for
    // three packets and did not have.
    // The SCATTER's only gesture is `VizScatter`'s horizontal brush, which is a
    // range of the structural score: an INTERVAL and nothing else.
    // The BAR's gesture is a press on one bar, which is one residue: a POINT.
    // The SHEET has no outbound gesture at all, so `canProbe: true` would be a
    // claim about a mark a reader can never make. It is still a consumer.
    capabilities: [
      { viewId: STRUCTURAL_VIEW, canProbe: true, encodings: ['point'] },
      { viewId: PRIOR_VIEW, canProbe: true, encodings: ['point'] },
      { viewId: TOGETHER_VIEW, canProbe: true, encodings: ['interval'] },
      { viewId: PATCHES_VIEW, canProbe: true, encodings: ['point'] },
      { viewId: SHEET_VIEW, canProbe: false },
    ],
    links: hotLinks(),
    encodingRules: HOT_ENCODING_RULES,
    prose: hotProse(tables),
    defaultTable: RESIDUES_TABLE,
  };
}

/** The basis columns' names, re-exported for the page that prints them — one spelling, `./analyses.ts`'s. */
export { HYDROPATHY_COLUMN, PATCH_COLUMN, PRIOR_BASIS_COLUMN, PRIOR_COLUMN, STRUCTURAL_BASIS_COLUMN, STRUCTURAL_COLUMN };
