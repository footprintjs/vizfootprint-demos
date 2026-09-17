/**
 * THE PROTEIN DESK'S DEFINITION — one table, six views, three declared acts, and
 * the first third-party chart this repository has ever hosted.
 *
 * ── The file, and whose it is ───────────────────────────────────────────────
 * This definition is built from WHATEVER ENTRY the host parsed — `protDef` takes
 * the tables and the bytes — so every count in its prose below is folded from
 * those rows and none of it is typed. The entry described here is the EXAMPLE,
 * the one file this repository committed (`src/prot/archive.ts` ·
 * `EXAMPLE_ENTRY`); the search box opens any other
 * (`web/src/protLanding.tsx`), and what this desk cannot say about one is read
 * off its bytes by `./entryNotes.ts`.
 *
 *   entry      `1AY7` — a two-chain protein–protein complex. The depositors
 *              call chain A GUANYL-SPECIFIC RIBONUCLEASE SA and chain B
 *              BARSTAR (its own COMPND records; nothing here says more about
 *              the science than the file does).
 *   from       https://files.rcsb.org/download/1AY7.pdb — the RCSB Protein
 *              Data Bank's copy of the wwPDB entry, in the legacy PDB format.
 *   terms      wwPDB releases its archive into the public domain under the
 *              CC0 1.0 Universal dedication
 *              (https://www.wwpdb.org/about/usage-policies), commercial use
 *              included. CC0 asks for nothing; the archive asks that the
 *              depositors and the primary citation be credited, so both travel
 *              in `data/prot/PROVENANCE.json` and the page prints them.
 *   size       169,371 bytes, committed verbatim, sha256 in that same record.
 *   rows       185 residues, from 1,488 ATOM records — and every record the
 *              parse did not keep is counted with its reason
 *              (`./etl.ts` · `skippedOf`).
 *
 * ── The question this desk asks ─────────────────────────────────────────────
 * **Where is a residue, what shape is its backbone there — and what is it
 * touching?** The file answers the first in three dimensions and the second in
 * two angles, and this desk puts one reader in front of both: the same residue,
 * picked in a real 3D molecular viewer or on a Ramachandran scatter, is the same
 * row in both pictures and in the sheet.
 *
 * The third question the file does NOT answer, and two declared acts do
 * (`./analyses.ts`): a stage finds every non-covalent contact in the entry with
 * Mol*'s own interaction engine, and a second rolls a solvent probe over it.
 * Each lands its evidence as a commit with its own chart — so two of the six
 * views ARRIVE, and the read of either is refused in the library's own words
 * until its stage has ended and again the moment a reader steps the cursor back
 * behind that commit. That progression is what this desk is now for; every
 * other statement below is about what makes it honest.
 *
 * ── The one thing a reader must know about the 3D view ──────────────────────
 * `structure` is drawn by Mol* — somebody else's code, wrapped as a CONFORMED
 * RENDERER (`web/src/molstarRenderer.ts`, at whatever protocol version
 * `vizfootprint-ui` · `RENDERER_PROTOCOL_VERSION` names; pinning the number
 * here would rot on every additive minor, so the renderer reads it and
 * `tests/prot-renderer.test.ts` asserts the two still speak the same MAJOR).
 * Two consequences are declared rather than explained:
 *
 *   1. it has NO positional channel. Where a residue is drawn comes from the
 *      file's coordinates, not from a binding, so the only channel it declares
 *      is `color` — and the def says which columns may land there
 *      ({@link PROT_ENCODING_RULES}), because with no requirement the encoding
 *      plane would offer a reader the x coordinate as a hue.
 *   2. the bytes it draws are NOT in this definition. The library's source port
 *      carries `rows | csv | json` and a structure file is none of those, so
 *      the PDB text reaches the mount beside the session (`./session.ts` ·
 *      `ProtSurface.structure`) and carries no version the way a declared
 *      table does. That is a gap in the library, written down here rather than
 *      papered over: every OTHER byte this desk draws is stamped on its
 *      commits, and these are not.
 */
import type { LinkDecl } from 'vizfootprint/def';
import type { AnalysisSlot, DashboardDef, DataSourceDef, ViewEncodingDecl } from 'vizfootprint/agent';
import type { EncodingRules } from 'vizfootprint/def';
import type { ProseDecl } from 'vizfootprint/prose';
import type { ActorMeta } from 'vizfootprint/selection';
import type { ProtTables, ResidueRow } from './etl.js';
import { ACT_KEY_COLUMN, ACT_TABLE, CONTACTS_COLUMN, INTERFACE_CONTACTS_COLUMN, INTERFACE_SEPARATION_COLUMN, INTERACTIONS_TABLE, PAIRS_ACT, PROT_STAGES, RELATIVE_SASA_COLUMN, SASA_COLUMN, protAnalyses } from './analyses.js';

// ── the views, named once ────────────────────────────────────────────────────

/** The 3D view — Mol*, bound through the renderer contract. */
export const STRUCTURE_VIEW = 'structure';
/** The Ramachandran scatter — phi against psi, one dot per residue. */
export const RAMA_VIEW = 'rama';
/**
 * STAGE A'S CHART — how many contacts across the interface each residue is in,
 * over sequence position. A BAR and not a heatmap, and the choice has a reason:
 * a heatmap of chain-A residue against chain-B residue is the picture of the
 * PAIRS, and the pairs are the one thing on this desk that cannot be on the
 * grammar (`./analyses.ts` says why). A bar is the picture of the COLUMN, the
 * column is in the data space, and the whole point of the packet is a chart
 * that is refused before its act and drawn after it.
 */
export const INTERFACE_VIEW = 'interface';
/** STAGE B'S CHART — accessible surface area over sequence position, one run per chain. */
export const SURFACE_VIEW = 'surface';
/**
 * THE RECEIPT — the pair table, as rows.
 *
 * Not a chart and not on the grammar: it draws the rows the `interactionPairs`
 * act hands back in its own answer, because the library lands a computed table
 * into the data space only for a `builtin: 'aggregate'` record
 * (`./analyses.ts`). It is declared as a VIEW all the same, so the desk's
 * actor registry, its words and its capability envelope say out loud what this
 * picture can and cannot do — a picture with no declaration is the thing this
 * repository refuses, and "it has no clause and cannot be filtered" is a
 * statement worth making rather than leaving to be discovered.
 */
export const PAIRS_VIEW = 'pairs';
/** The residue table. */
export const SHEET_VIEW = 'sheet';

/** Every view this def declares, in the order a reader meets them. */
export const PROT_VIEWS = [STRUCTURE_VIEW, RAMA_VIEW, INTERFACE_VIEW, SURFACE_VIEW, PAIRS_VIEW, SHEET_VIEW] as const;

/**
 * THE RECEIPT VIEWS — which view draws WHICH ACT'S OWN ANSWER, by the act that
 * answers it. The one link on this desk that has to be written down.
 *
 * Every other "which charts did this stage produce" is an INTERSECTION and is
 * computed (`web/src/protStages.ts` · `chartsOfStage`): an act says which
 * columns it landed (`ActOutcome.materialized`) and a view says which columns it
 * binds (the encoding fold at its address), so the answer is derivable from
 * what the session already carries and nobody has to type a map.
 *
 * A RECEIPT breaks that, and the reason is the finding this desk exists to
 * produce: {@link PAIRS_VIEW} draws the pair table, the pair table is not in the
 * data space (`./analyses.ts` says why the library cannot put it there), so it
 * binds NO column and the intersection can never reach it. The wire carries no
 * act→view link either — a view declares a chart kind, channels and
 * capabilities, and none of those names an analysis. So this one pair is
 * declared, here, beside the view it is about, rather than hidden inside a
 * screen: the alternative is a stepper that silently drops the one picture an
 * act cut by hand.
 *
 * `web/src/protCells.tsx` draws that cell off `ProtDeskData.run.pairs` under this
 * same {@link PAIRS_VIEW} constant, so the two cannot spell it differently.
 */
export const PROT_RECEIPTS: Readonly<Record<string, string>> = { [PAIRS_ACT]: PAIRS_VIEW };

/** The one table, and the column its rows are identified by — both named once, so no reader spells either. */
export const RESIDUES_TABLE = 'residues';
export const RESIDUE_KEY = 'residue_key';

/**
 * THE TWO NAMES `./analyses.ts` HAS TO SPELL, judged against these — once, at
 * load.
 *
 * That module cannot import them (this one imports IT, because it declares the
 * acts), so it spells them itself and this is the guard. WHY A THROW AND NOT A
 * COMMENT: both ways it can drift are silent — the acts would read a table that
 * is not there and align to a column that is not there, and the two charts over
 * their output would simply never draw. The `../nndss/population.ts` ·
 * `BROUGHT` precedent: a demo that will not start beats one whose column is a
 * name nothing lands.
 */
if (ACT_TABLE !== RESIDUES_TABLE || ACT_KEY_COLUMN !== RESIDUE_KEY) {
  throw new Error(`the acts are declared over "${ACT_TABLE}"."${ACT_KEY_COLUMN}" and this def declares "${RESIDUES_TABLE}"."${RESIDUE_KEY}" — src/prot/analyses.ts and src/prot/def.ts have drifted`);
}

/**
 * NO LAYER ADDRESSES ON THIS DESK, and that is worth one sentence because the
 * exoplanet desk beside it is all layers.
 *
 * A layer exists to name a TABLE a view reads that the default one is not
 * (`vizfootprint/def` README, "Layers"). This dashboard has exactly one table
 * and every view reads it, so every view binds at its own level and a gesture
 * lands at the view's own id. Declaring a one-layer frame per view would put a
 * second address in front of every reader for nothing.
 */

// ── who drives what ──────────────────────────────────────────────────────────

const STRUCTURE: ActorMeta = {
  actor: 'user',
  label: 'The complex, in three dimensions',
  does: 'click a residue to select it — the scatter and the sheet follow; the camera is the viewer’s own and nothing here records it',
};
const RAMA: ActorMeta = {
  actor: 'user',
  label: 'Backbone angles, residue by residue',
  does: 'drag across the phi axis to keep a range of backbone angles — the 3D view greys every residue the range drops',
};
const INTERFACE: ActorMeta = {
  actor: 'user',
  label: 'Contacts across the interface, residue by residue',
  does: 'click a bar to select that residue — but only once the act that counts the contacts has landed; before it, the library refuses the gesture by naming the column it cannot read',
};
const SURFACE: ActorMeta = {
  actor: 'user',
  label: 'How much of each residue the solvent can reach',
  does: 'drag across the run to keep a range of sequence positions — and, as with the bars, only once the act that rolled the probe has landed',
};
const PAIRS: ActorMeta = {
  actor: 'user',
  label: 'Every contact the engine found, as rows',
  does: 'read the pairs, the atoms, the engine’s own word for each one and how far apart the two ends are — this table has no gesture at all, because its rows are not in the data space',
};
const SHEET: ActorMeta = {
  actor: 'user',
  label: 'Every residue, as the file gives it — and everything the two stages landed on it',
  does: 'read the rows behind every picture, oldest chain first, and export the receipt',
};

/**
 * The dashboard's DECLARED words — the title, and the caption a reader sees
 * before any entry is open (the landing's own description).
 *
 * THE CAPTION HERE COUNTS NOTHING, and that is the packet that opened the
 * archive's door: it used to say "185 residues", which is true of the committed
 * example and false of every other entry a reader can now pick. The counting
 * version is {@link protCaption}, folded from the rows the host parsed, and the
 * def declares THAT one — so the words on the desk cannot outrun the entry they
 * are about.
 */
const CAPTION_TAIL =
  'drawn in three dimensions by Mol* — code this project did not write — and again as the two angles that describe each residue’s backbone. Both of those are read straight off the file. The other two pictures are not there when the page opens: a stage finds every non-covalent contact in the entry, a second rolls a solvent probe over it, and each one lands its evidence as a commit. Until a stage ends its chart is refused at the read, in the library’s own words, and stepping the cursor back behind that commit refuses it again — the screen un-builds because the log does.';

export const PROT_WORDS = {
  title: 'One residue, four pictures — and two of them arrive',
  caption: `A protein structure as its depositors solved it, ${CAPTION_TAIL}`,
} as const;

/**
 * The dashboard's caption WITH THIS ENTRY'S OWN COUNTS in it — the one the def
 * declares, and the one the desk shows. See {@link PROT_WORDS}.
 *
 * The counts are folded from the rows the host parsed, and the rest of the
 * sentence is the same prose the landing shows, from the same constant — so the
 * two can never say different things about the machinery while differing about
 * the entry.
 */
export function protCaption(tables: ProtTables): string {
  const { counts } = tables;
  const chains = counts.chains.map((c) => `${c.chain}: ${String(c.residues)}`).join(', ');
  const scale = counts.chains.length === 0 ? 'not one residue with a backbone to measure' : `${String(counts.residues)} residues in ${String(counts.chains.length)} ${counts.chains.length === 1 ? 'chain' : 'chains'} (${chains})`;
  return `A protein structure as its depositors solved it: ${scale}, ${CAPTION_TAIL}`;
}

// ── the table, declared ──────────────────────────────────────────────────────

/**
 * ONE TABLE, and its key is the join key `./etl.ts` mints: `"<chain>:<resnum>"`.
 *
 * `source: { format: 'rows', via: 'inline' }` rather than a bare `rows:` array,
 * for the reason the exoplanet desk declares its measurements that way: an
 * inline source is still a SOURCE, so the carrier vouches for a version
 * (`inline:<size>-<hash>`) and every commit on this desk carries it. The rows
 * are the ETL's output and the PDB file is what the ETL read — which means the
 * version stamped on a commit is the version of the ROWS, not of the file.
 * Nothing in the def can say the file's own digest; `data/prot/PROVENANCE.json`
 * records it and this comment is the only bridge between the two.
 *
 * WHY NO `absence` DECLARATION, when two columns are silent for four residues:
 * a table's absence entry speaks for the ROW, and a residue with no phi still
 * has a psi, a position and a name — the exoplanet desk's whole lesson, one
 * table smaller. The honest alternative is a state column per angle
 * (`phi_state`, `psi_state`), and this desk does not have one: the two angles
 * are `null` where the geometry is not in the file, the def door accepts a
 * measure that is sometimes null, the charts leave those marks off and the
 * captions COUNT them. What that costs is written down in the report for this
 * packet — a `null` measure carries no vocabulary, so nothing on the wire says
 * WHY it is null, and every consumer that wants the reason re-derives it from
 * "first or last residue of its chain".
 */
function protSources(residues: readonly ResidueRow[]): Record<string, DataSourceDef> {
  return {
    [RESIDUES_TABLE]: {
      source: { format: 'rows', via: 'inline', at: residues },
      key: RESIDUE_KEY,
      columns: {
        // the MINTED key: chain and residue number, joined by one character this
        // repository spells in exactly one place (`./etl.ts` · residueKey)
        residue_key: { role: 'identifier', label: 'residue — the chain and the number the file gives it, as "<chain>:<resnum>"' },
        chain: { role: 'dimension', label: 'chain, as the file labels it (A is the ribonuclease, B the inhibitor)' },
        // a number, and deliberately NOT a measure: a residue number is a position
        // in a sequence, so summing or averaging it means nothing. `scale:
        // 'discrete'` is what keeps it a bucket rather than a magnitude.
        resnum: { role: 'dimension', scale: 'discrete', label: 'residue number within its chain, as the depositors numbered it' },
        resname: { role: 'dimension', label: 'the amino acid, in the file’s three-letter code' },
        // WHERE the residue is: the alpha-carbon's own coordinates, in the file's
        // frame. A measure, in Ångströms — and never bound to an axis on this
        // desk, because the 3D view already draws all three and a scatter of two
        // of them would be a shadow nobody asked for.
        ca_x: { role: 'measure', unit: 'ångström', label: 'alpha carbon, x — the file’s own coordinate frame' },
        ca_y: { role: 'measure', unit: 'ångström', label: 'alpha carbon, y — the file’s own coordinate frame' },
        ca_z: { role: 'measure', unit: 'ångström', label: 'alpha carbon, z — the file’s own coordinate frame' },
        // WHAT SHAPE the backbone is: the two torsions, in degrees on (−180, 180].
        // Absent — never 0 — where an atom of the torsion is not in the file.
        phi: { role: 'measure', unit: 'degrees', label: 'phi: the torsion about the N–CA bond, measured from the previous residue’s carbon — absent for the first residue of a chain' },
        psi: { role: 'measure', unit: 'degrees', label: 'psi: the torsion about the CA–C bond, measured to the next residue’s nitrogen — absent for the last residue of a chain' },
      },
    },
  };
}

// ── the encoding surfaces ────────────────────────────────────────────────────

/**
 * THE HOUSE RULES OF A CHART KIND THE LIBRARY HAS NEVER HEARD OF.
 *
 * `chartKind` is echoed verbatim by the def door (the library parses no kind),
 * so `'structure'` is legal on arrival — and that is exactly the problem. The
 * encoding plane judges a binding with `requirementFor(chartKind, channel,
 * overrides)` (`vizfootprint/encoding` · requirements.ts): an unknown kind
 * falls through to the BY-NAME defaults, and no by-name default mentions
 * `color`. So with nothing declared here, every column of the table "fits" the
 * structure's colour — `ca_x` as a hue, the residue key as a hue — and
 * `whats_here` would offer all nine to an agent.
 *
 * `encodingRules.channels` is the seam the library already has for this, and it
 * is keyed BY KIND, so one entry answers for the kind wherever it is drawn.
 * The requirement below says what the renderer really draws: the colour of a
 * residue is looked up from the value's own text against a small palette
 * (`web/src/molstarRenderer.ts` · `paintOf`), so a DISCRETE column is the only
 * honest binding — and an identifier is refused because 185 hues is not a
 * legend. That leaves `chain` and `resname`, which is the true answer.
 *
 * THE LAW THIS KEEPS is the requirements table's own: *the door and the
 * renderer agree, kind by kind.* What this seam cannot do is say the kind has
 * no POSITIONAL channel at all — `channels: ['color']` on the view is the only
 * statement of that, and nothing refuses a def that adds `x` to it. See the
 * packet report.
 */
export const STRUCTURE_COLOR_RULE = 'a residue is coloured by looking its value up in a palette, so the structure view’s colour takes a column with distinct values ({column} is not one) — where a residue IS comes from the file, and no channel of this view can move it';

export const PROT_ENCODING_RULES: EncodingRules = {
  onInvalid: 'refuse',
  ruleScope: 'view',
  channels: {
    structure: [{ channel: 'color', scale: 'discrete', notRoles: ['identifier'], sentence: STRUCTURE_COLOR_RULE }],
  },
  rules: [
    // A coordinate is not a hue and not a size: the 3D view already places every
    // residue from all three, and spending a channel on one of them would say
    // "x means something here" twice, in two different pictures, with two
    // different answers.
    { rule: 'never-on', column: 'ca_x', channels: ['color', 'size'], sentence: 'the alpha carbon’s {column} is WHERE the residue is drawn in the 3D view — putting it on {channel} would encode the same fact twice and disagree with itself' },
    { rule: 'never-on', column: 'ca_y', channels: ['color', 'size'], sentence: 'the alpha carbon’s {column} is WHERE the residue is drawn in the 3D view — putting it on {channel} would encode the same fact twice and disagree with itself' },
    { rule: 'never-on', column: 'ca_z', channels: ['color', 'size'], sentence: 'the alpha carbon’s {column} is WHERE the residue is drawn in the 3D view — putting it on {channel} would encode the same fact twice and disagree with itself' },
    // A residue number is a position in a sequence. It is already declared
    // discrete, which keeps it off `size` by the built-in law; this says why in
    // the words a reader of this desk needs — and keeps it off the 3D view's
    // COLOUR too, which the per-kind requirement alone would have allowed
    // (declared discrete, so a legal binding: 96 hues on one chain, which is a
    // rainbow rather than a legend).
    { rule: 'never-on', column: 'resnum', channels: ['size', 'color'], sentence: 'a residue number is a place in the chain, not an amount and not a hue: residue 88 is not eleven times residue 8, and 185 colours name nothing' },
  ],
};

/**
 * FOUR ENCODING SURFACES, and two views declare none.
 *
 * `rama` is an ordinary first-party scatter over the default table: phi on x,
 * psi on y, both measures in degrees, both sometimes absent. No frame is
 * declared, and that is a decision with a cost the report names: a torsion axis
 * spans (−180, 180] BY DEFINITION, and the frame's vocabulary is words only —
 * `domain: 'union'` folded from the rows — so there is no way to declare the
 * axis a reader of a Ramachandran plot expects. The picture draws the extent of
 * the residues in it, and the caption says so rather than a cell typing a
 * window.
 *
 * `structure` declares the ONE channel it has. See {@link PROT_ENCODING_RULES}
 * for what the plane does with a kind it has never heard of.
 *
 * **`interface` and `surface` ARE DECLARED BEFORE THEIR COLUMNS EXIST, and that
 * is the point of this packet.** Both bind a column that no act has landed yet
 * — `interface_contacts` and `sasa` — so on a fresh session the two charts
 * cannot draw, and the LIBRARY is what says so: a gesture at either is refused
 * `needs-column`, *no column "interface_contacts" in table "residues"*, which
 * `./session.ts` · `probeTheUnlandedColumns` collects before the acts and the
 * cells print verbatim. After the stage lands the same gesture is accepted;
 * seek the cursor back behind that commit and it is refused again, word for
 * word. No spinner, no empty axis, no claim.
 *
 * TWO THINGS ABOUT THE CHANNELS, both deliberate:
 *
 *   - the bar binds `category` AND `y`. `category` because that is the channel
 *     `VizBar` emits on (a click is one residue), `y` because that is the
 *     channel the requirements table judges as a QUANTITY for a bar kind
 *     (`vizfootprint/encoding` · `CHART_REQUIREMENTS.bar`) — the exoplanet
 *     desk's bar needs no `y` because its bars are a COUNT of rows, and these
 *     are a column's values. An identifier on a bar's category is legal and the
 *     library says why in its own words; on a LINE's x it is not, which is the
 *     next point.
 *   - the run's x is `resnum` and NOT the residue key, because
 *     `CHART_REQUIREMENTS.line` refuses an identifier on x by name: *an
 *     identifier along a run is a lie about order*. So both chains are drawn
 *     over the SAME residue numbering (1–96 and 1–89 — they overlap), split
 *     into two series by `color: 'chain'`, and the caption says that out loud
 *     rather than letting a reader take one axis for one chain.
 *
 * WHAT THE DOOR DOES NOT JUDGE, measured rather than assumed: a VIEW-level
 * `initial` binding is not checked against the table's columns at all — a def
 * binding `value: 'utter_nonsense_column'` builds clean, even with
 * `encodingRules.onInvalid: 'refuse'`. The exoplanet desk gets that judgement
 * because its bindings sit on a LAYER, and `layerSurfacesOf` judges a layer's
 * fields against its table. So the four bindings here are declarations of
 * INTENT that nothing verifies at build; what verifies them is the read, at
 * every cursor, which is the honest place for it and the reason this packet has
 * a progression to prove at all.
 *
 * `pairs` and `sheet` declare none, for the reason all four demos' sheets do:
 * they show rows, not a mark.
 */
function protEncodings(): readonly ViewEncodingDecl[] {
  return [
    { viewId: RAMA_VIEW, chartKind: 'scatter', channels: ['x', 'y'], initial: { x: 'phi', y: 'psi' } },
    { viewId: STRUCTURE_VIEW, chartKind: 'structure', channels: ['color'], initial: { color: 'chain' } },
    { viewId: INTERFACE_VIEW, chartKind: 'bar', channels: ['category', 'y'], initial: { category: RESIDUE_KEY, y: INTERFACE_CONTACTS_COLUMN } },
    { viewId: SURFACE_VIEW, chartKind: 'line', channels: ['x', 'y', 'color'], initial: { x: 'resnum', y: SASA_COLUMN, color: 'chain' } },
  ];
}

// ── the words ────────────────────────────────────────────────────────────────

/**
 * The three views' words, as a function of the ROWS — the way the exoplanet
 * desk's are, and for the same reason: the long descriptions state counts, and
 * a constant would tell a screen-reader user one population while the caption
 * beside it counted another.
 */
/**
 * WHAT EACH CHAIN IS NUMBERED, read off the rows — `A is numbered 1–96 and B is
 * numbered 1–89`.
 *
 * Folded from `resnum` rather than from the residue COUNT, because the two are
 * not the same statement: a chain of 96 residues numbered 1–96 is a coincidence
 * of this entry (the depositors numbered both chains contiguously from 1), and
 * a chain with a gap in its numbering would make a caption built from the count
 * quietly wrong about its own axis.
 */
function numberedRanges(tables: ProtTables): string {
  return tables.counts.chains
    .map(({ chain }) => {
      const numbers = tables.residues.filter((r) => r.chain === chain).map((r) => r.resnum);
      return `${chain} is numbered ${String(Math.min(...numbers))}–${String(Math.max(...numbers))}`;
    })
    .join(' and ');
}

function protProse(tables: ProtTables): readonly ProseDecl[] {
  const { counts } = tables;
  const chains = counts.chains.map((c) => `${c.chain} (${String(c.residues)})`).join(' and ');
  return [
    {
      viewId: 'dashboard',
      slots: {
        title: { text: PROT_WORDS.title, author: { kind: 'human', by: 'the dashboard author' } },
        caption: { text: protCaption(tables), author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
      },
    },
    {
      viewId: STRUCTURE_VIEW,
      slots: {
        title: { text: 'The complex, in three dimensions', author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
        altShort: {
          text: `A three-dimensional molecular view of a ${String(counts.residues)}-residue protein complex, drawn by the Mol* viewer. Click a residue to select it.`,
          author: { kind: 'human' },
          levels: ['construction'],
        },
        altLong: {
          text:
            `The ${String(counts.chains.length)} ${counts.chains.length === 1 ? 'chain' : 'chains'} of the entry — ${chains} residues — drawn as a cartoon by Mol*, a molecular viewer this project did not write and does not control. ` +
            `WHERE EVERY RESIDUE SITS COMES FROM THE FILE and from no binding on this dashboard: there is no x channel, no y channel and no zoom this dashboard records. The camera is the viewer's own, which is why the view declares it cannot be navigated — a request to move it would be refused in words rather than lost. ` +
            `What the dashboard DOES decide is colour, and it decides it from the rows: the residue picked here or elsewhere is lit, a residue another view's selection drops is greyed, and a residue the file gives no backbone angle for is painted in the absence colour rather than in the colour of zero. ` +
            `${String(counts.phiAbsent + counts.psiAbsent)} of the ${String(counts.residues)} residues are in that last group — the first and the last residue of each chain, which have no neighbour to measure a torsion against.`,
          author: { kind: 'human' },
          levels: ['construction'],
          basis: { columns: ['residue_key', 'chain', 'phi', 'psi'] },
        },
        // the library writes the construction line itself, every read
        howToRead: { author: { kind: 'derived' } },
      },
    },
    {
      viewId: RAMA_VIEW,
      slots: {
        title: { text: 'Backbone angles, residue by residue', author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
        altShort: { text: 'A scatter plot of each residue’s psi angle against its phi angle, in degrees. Drag across the horizontal axis to keep a range.', author: { kind: 'human' }, levels: ['construction'] },
        altLong: {
          text:
            `One dot per residue, at the two torsion angles that describe its backbone: phi across, psi up, both in degrees and both read off the coordinates in the file. ` +
            `${String(counts.bothPresent)} of the ${String(counts.residues)} residues are drawn. The other ${String(counts.residues - counts.bothPresent)} are NOT: ${String(counts.phiAbsent)} have no phi (the first residue of a chain has no previous carbon to measure from) and ${String(counts.psiAbsent)} have no psi (the last has no next nitrogen), and an angle nobody can measure is absent rather than zero — which is why those residues have no dot instead of a dot in the middle. ` +
            `Both axes are the extent of the residues in this entry, not the whole (−180, 180] a torsion can take: a frame's domain is folded from the rows and there is no way to declare the wider one.`,
          author: { kind: 'human' },
          levels: ['construction'],
          basis: { columns: ['phi', 'psi'] },
        },
        howToRead: { author: { kind: 'derived' } },
      },
    },
    {
      viewId: INTERFACE_VIEW,
      slots: {
        title: { text: 'Contacts across the interface, residue by residue', author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
        altShort: { text: 'A bar chart of how many contacts to another chain each residue is part of. Empty until the stage that counts them has landed.', author: { kind: 'human' }, levels: ['construction'] },
        altLong: {
          text:
            `One bar per residue, as tall as the number of non-covalent contacts that residue makes with ANOTHER CHAIN of the same entry. ` +
            `THIS PICTURE IS NOT THERE WHEN THE PAGE OPENS, and that is the point of the desk: the column it draws is landed by an act, and until that act has landed the library refuses a read of it in its own words — no column, named — which the caption prints instead of drawing an empty axis. Step the time cursor back behind that commit and it is refused again. ` +
            `The contacts are Mol*'s, found by its own interaction engine over a headless parse of the same ${String(counts.residues)} residues, and which KINDS are looked for is read off that engine rather than chosen here. ` +
            `A residue with no contact across the chains has a bar of zero, which is a real count of nothing — while the tightest crossing contact of such a residue is ABSENT, because "does not touch another chain" is not a distance. An entry with ONE chain has no interface at all, and the desk says that sentence instead of drawing a bar of zero per residue (\`./entryNotes.ts\`).`,
          author: { kind: 'human' },
          levels: ['construction'],
          basis: { columns: [RESIDUE_KEY, 'chain', INTERFACE_CONTACTS_COLUMN, INTERFACE_SEPARATION_COLUMN] },
        },
        howToRead: { author: { kind: 'derived' } },
      },
    },
    {
      viewId: SURFACE_VIEW,
      slots: {
        title: { text: 'How much of each residue the solvent can reach', author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
        altShort: { text: 'One line per chain of each residue’s solvent-accessible surface area against its residue number. Empty until the stage that computes it has landed.', author: { kind: 'human' }, levels: ['construction'] },
        altLong: {
          text:
            `Each residue's accessible surface area in square ångström, drawn against the number the depositors gave it, with one line per chain. ` +
            `THE CHAINS SHARE THE HORIZONTAL AXIS: ${numberedRanges(tables)}, so one slot can hold a residue of each and the lines are told apart by colour, not by position. A line's x may not be an identifier — the library refuses that by name — so the axis is the number, and this sentence is what stops a reader taking it for one chain. ` +
            `LIKE THE BARS BESIDE IT, this picture arrives with its stage: the column is landed by an act, refused at the read before it and refused again behind it. ` +
            `The value is Shrake–Rupley as Mol* implements it, at that engine's own default parameters, computed with the deposited waters taken away — so a residue is small here because a neighbouring chain is in the way, which is what makes the two pictures on this desk one story.`,
          author: { kind: 'human' },
          levels: ['construction'],
          basis: { columns: ['resnum', 'chain', SASA_COLUMN, RELATIVE_SASA_COLUMN] },
        },
        howToRead: { author: { kind: 'derived' } },
      },
    },
    {
      viewId: PAIRS_VIEW,
      // NO `howToRead`, for the same reason the sheet has none: it declares no
      // encoding surface, so there are no bindings to derive a line from.
      slots: {
        title: { text: 'Every contact the engine found, as rows', author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
        altShort: { text: 'A table of every non-covalent contact in the entry: its two residues, the two atoms, the engine’s word for it and how far apart they are.', author: { kind: 'human' }, levels: ['construction'] },
      },
    },
    {
      viewId: SHEET_VIEW,
      // NO `howToRead` here, and the def door is why: a derived how-to-read line
      // is built from the view's BINDINGS, and the sheet declares no encoding
      // surface to build one from — *prose[3].howToRead: "sheet".howToRead is
      // derived, but "sheet" declares no encoding surface — there is nothing to
      // derive from*. The same sentence is what the structure view would earn if
      // it declared no surface either (see {@link PROT_ENCODING_RULES}).
      slots: {
        title: { text: 'Every residue, as the file gives it — and every column the two stages landed on it', author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
      },
    },
  ];
}

// ── the links ────────────────────────────────────────────────────────────────

/**
 * NOTHING DECLARED, and this is the whole declaration.
 *
 * The three views read ONE table at ONE grain, so a `point` on `residue_key`
 * from the 3D view is a sentence every other view's rows can answer, and the
 * crossfilter default already carries it to both of them and never back to its
 * source. A declared edge here would restate what the default does — and the
 * exoplanet desk is the worked example of what that costs: ten hand-declared
 * edges and two paraphrases of a library law, all deleted once the library
 * stated it at every read.
 *
 * The one thing a declared edge buys that the default does not is a `fold`
 * sentence for an edge that CROSSES grains, and no edge here crosses one (see
 * {@link protGrains}).
 */
function protLinks(): readonly LinkDecl[] {
  return [];
}

/**
 * THE GRAIN AT EVERY ADDRESS THAT DRAWS RESIDUES: `[]` — one mark per ROW.
 *
 * Every picture but one puts one mark on one residue, and a row of this table
 * IS one residue, because `residue_key` is the table's declared key. So `[]` is
 * the true statement and `['residue_key']` would be a second one: it says the
 * marks stand for GROUPS keyed by the residue, which for a key column is a
 * grouping of one row each — and it would make every edge out of these views a
 * grain-crossing edge that the def door then requires a `fold` sentence for.
 * A fold that describes no fold is the kind of prose this repository exists to
 * delete.
 *
 * ── AND ONE ADDRESS WITH NO GRAIN AT ALL: `pairs` ───────────────────────────
 * The receipt's marks are PAIRS of residues, so the grain law says to declare
 * it at that address — and there is nothing to declare it against. A grain
 * names GROUP KEYS, and a key is a column of the table the address reads; the
 * table `pairs` reads is the one the `interactionPairs` act cuts, which the
 * library never lands in the data space (`./analyses.ts`). So
 * `{ viewId: 'pairs', keys: ['residue_a', 'residue_b'] }` names two columns no
 * declared table has, and the door refuses it by name — *grains[5].keys[0]
 * "residue_a" is not a column of table "residues"* — which is the door being
 * right: this def really cannot say what it would be saying.
 *
 * Declaring `keys: []` instead would be WORSE than saying nothing: it means
 * "one mark per row of the table this address reads", and the rows the receipt
 * draws are not rows of `residues` at all. So the grain is ABSENT, and this
 * paragraph is the declaration — the same shape `./http.ts` uses for the
 * version no carrier will vouch for.
 */
export function protGrains(): readonly { readonly viewId: string; readonly keys: readonly string[] }[] {
  return PROT_VIEWS.filter((viewId) => viewId !== PAIRS_VIEW).map((viewId) => ({ viewId, keys: [] }));
}

// ── the def ──────────────────────────────────────────────────────────────────

/**
 * The def over one parsed entry — and over the BYTES it was parsed from.
 *
 * ```ts
 * const text = readFileSync('data/prot/1ay7.pdb', 'utf8');
 * const def = protDef(protTables(text), text);
 * def.defaultTable;                       // 'residues'
 * Object.keys(def.analyses ?? {});        // the three acts, declared
 * buildDashboard(def).def.encodings;      // four surfaces, two of them over columns no act has landed
 * ```
 *
 * ── WHY THE TEXT IS A SECOND PARAMETER ─────────────────────────────────────
 * The three declared acts read the STRUCTURE, not the rows: they parse a
 * headless Mol* model of their own and compute over its atoms
 * (`./analyses.ts`). So the def has to be built over the same bytes the ETL
 * read, and the honest way to say that is to ask for them — a def whose acts
 * read a file and whose signature does not mention one would be a def that
 * fetches something behind its caller's back. Every door that has the bytes
 * already has them: `./session.ts` from the artifact, `./cards.ts` from its
 * input.
 *
 * The text is NOT copied into the declaration. It is closed over by the acts,
 * and what rides on their commits is its character count — the one thing about
 * this file a host can vouch for (`./http.ts` and `./session.ts` say why no
 * carrier will vouch for more).
 */
export function protDef(tables: ProtTables, structureText: string): DashboardDef {
  return {
    meta: { title: 'A protein complex — vizfootprint on one PDB entry' },
    data: protSources(tables.residues),
    actors: {
      [STRUCTURE_VIEW]: STRUCTURE,
      [RAMA_VIEW]: RAMA,
      [INTERFACE_VIEW]: INTERFACE,
      [SURFACE_VIEW]: SURFACE,
      [PAIRS_VIEW]: PAIRS,
      [SHEET_VIEW]: SHEET,
    },
    // THE THREE ACTS, over the bytes this def was built on. Declared here and
    // dispatched by `./orchestrator.ts`, two stages in order — and `PROT_STAGES`
    // is the one list that says which act belongs to which stage, so the
    // captions and the chart cannot disagree about it.
    analyses: protAnalyses(structureText),
    encodings: protEncodings(),
    grains: protGrains(),
    // THE HONEST CAPABILITY ENVELOPE, one view at a time.
    //
    // `structure` emits a POINT and nothing else: a click in the viewer is one
    // residue. Not a match — the renderer implements no shift-click, and a
    // declared kind nothing emits is the flag this library refuses.
    // `rama` emits an INTERVAL and nothing else: `VizScatter`'s only gesture is
    // a horizontal brush, which is a range of phi. It has no dot click at all,
    // so a `point` here would be a voice the picture does not have.
    // `sheet` CANNOT probe, and that is not a policy — the library's own Sheet
    // has no outbound gesture and the studio desk wires none, so `canProbe:
    // true` would be a claim about a mark a reader can never make. It is still
    // a consumer: every clause reaches it and narrows its rows.
    //
    // ONE THING A READER COMPARING TIERS WILL NOTICE: the session projects
    // `structure`'s voice as `['point','match']`, not `['point']`. That is the
    // library's own law — *a view that declares 'point' may also emit 'match' —
    // a set is a point's plural, never a new capability* (`CapabilityDecl`) —
    // and the renderer's hello still declares `emissionKinds: ['point']`,
    // because a renderer may only promise what its own mount delivers. Both
    // statements are true at their own tier.
    //
    // THE TWO NEW CHARTS, and the receipt beside them:
    // `interface` emits a POINT and nothing else — `VizBar`'s gesture is a
    // click on one bar, which is one residue. Not an interval: a bar chart has
    // no brush, and the actor meta says "drag" nowhere.
    // `surface` emits an INTERVAL and nothing else — `VizLine`'s only gesture
    // is its horizontal brush, which here is a range of residue numbers. It has
    // no point click, so a `point` would be a voice the picture lacks.
    // `pairs` CANNOT probe, and for a reason no other view on this desk has:
    // its rows are not in the data space at all (`./analyses.ts`), so there is
    // no clause a gesture on it could even be ABOUT. It is not a consumer
    // either — no clause narrows it, because no clause can reach a table the
    // session does not know. It is the one picture on this desk outside the
    // grammar, and the declaration is where that is said.
    capabilities: [
      { viewId: STRUCTURE_VIEW, canProbe: true, encodings: ['point'] },
      { viewId: RAMA_VIEW, canProbe: true, encodings: ['interval'] },
      { viewId: INTERFACE_VIEW, canProbe: true, encodings: ['point'] },
      { viewId: SURFACE_VIEW, canProbe: true, encodings: ['interval'] },
      { viewId: PAIRS_VIEW, canProbe: false },
      { viewId: SHEET_VIEW, canProbe: false },
    ],
    links: protLinks(),
    encodingRules: PROT_ENCODING_RULES,
    prose: protProse(tables),
    defaultTable: RESIDUES_TABLE,
  };
}
