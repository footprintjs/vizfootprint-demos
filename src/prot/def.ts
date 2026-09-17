/**
 * THE PROTEIN DESK'S DEFINITION — one table, three views, and the first
 * third-party chart this repository has ever hosted.
 *
 * ── The file, and whose it is ───────────────────────────────────────────────
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
 * **Where is a residue, and what shape is its backbone there?** The file
 * answers the first in three dimensions and the second in two angles, and this
 * desk puts one reader in front of both: the same residue, picked in a real 3D
 * molecular viewer or on a Ramachandran scatter, is the same row in both
 * pictures and in the sheet.
 *
 * ── The one thing a reader must know about the 3D view ──────────────────────
 * `structure` is drawn by Mol* — somebody else's code, wrapped as a CONFORMED
 * RENDERER (`web/src/molstarRenderer.ts`, protocol 1.9). Two consequences are
 * declared rather than explained:
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
import type { DashboardDef, DataSourceDef, ViewEncodingDecl } from 'vizfootprint/agent';
import type { EncodingRules } from 'vizfootprint/def';
import type { ProseDecl } from 'vizfootprint/prose';
import type { ActorMeta } from 'vizfootprint/selection';
import type { ProtTables, ResidueRow } from './etl.js';

// ── the views, named once ────────────────────────────────────────────────────

/** The 3D view — Mol*, bound through the renderer contract. */
export const STRUCTURE_VIEW = 'structure';
/** The Ramachandran scatter — phi against psi, one dot per residue. */
export const RAMA_VIEW = 'rama';
/** The residue table. */
export const SHEET_VIEW = 'sheet';

/** Every view this def declares, in the order a reader meets them. */
export const PROT_VIEWS = [STRUCTURE_VIEW, RAMA_VIEW, SHEET_VIEW] as const;

/** The one table, and the column its rows are identified by — both named once, so no reader spells either. */
export const RESIDUES_TABLE = 'residues';
export const RESIDUE_KEY = 'residue_key';

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
const SHEET: ActorMeta = {
  actor: 'user',
  label: 'Every residue, as the file gives it',
  does: 'read the rows behind both pictures, oldest chain first, and export the receipt',
};

/** The dashboard's DECLARED words — the def's prose entry and the page's fallback read this one constant. */
export const PROT_WORDS = {
  title: 'One residue, two pictures',
  caption:
    'A protein–protein complex as its depositors solved it: 185 residues, drawn in three dimensions by Mol* — code this project did not write — and again as the two angles that describe each backbone. Click a residue in either picture and the other one answers, because both are reading the same row.',
} as const;

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
 * TWO ENCODING SURFACES, and the third view declares none.
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
 * `sheet` declares none, for the reason all three other demos' sheets declare
 * none: it shows rows, not a mark.
 */
function protEncodings(): readonly ViewEncodingDecl[] {
  return [
    { viewId: RAMA_VIEW, chartKind: 'scatter', channels: ['x', 'y'], initial: { x: 'phi', y: 'psi' } },
    { viewId: STRUCTURE_VIEW, chartKind: 'structure', channels: ['color'], initial: { color: 'chain' } },
  ];
}

// ── the words ────────────────────────────────────────────────────────────────

/**
 * The three views' words, as a function of the ROWS — the way the exoplanet
 * desk's are, and for the same reason: the long descriptions state counts, and
 * a constant would tell a screen-reader user one population while the caption
 * beside it counted another.
 */
function protProse(tables: ProtTables): readonly ProseDecl[] {
  const { counts } = tables;
  const chains = counts.chains.map((c) => `${c.chain} (${String(c.residues)})`).join(' and ');
  return [
    {
      viewId: 'dashboard',
      slots: {
        title: { text: PROT_WORDS.title, author: { kind: 'human', by: 'the dashboard author' } },
        caption: { text: PROT_WORDS.caption, author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
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
            `The two chains of the entry — ${chains} residues — drawn as a cartoon by Mol*, a molecular viewer this project did not write and does not control. ` +
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
      viewId: SHEET_VIEW,
      // NO `howToRead` here, and the def door is why: a derived how-to-read line
      // is built from the view's BINDINGS, and the sheet declares no encoding
      // surface to build one from — *prose[3].howToRead: "sheet".howToRead is
      // derived, but "sheet" declares no encoding surface — there is nothing to
      // derive from*. The same sentence is what the structure view would earn if
      // it declared no surface either (see {@link PROT_ENCODING_RULES}).
      slots: {
        title: { text: 'Every residue, as the file gives it', author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
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
 * THE GRAIN AT EVERY ADDRESS THAT DRAWS: `[]` — one mark per ROW.
 *
 * Both pictures put one mark on one residue, and a row of this table IS one
 * residue, because `residue_key` is the table's declared key. So `[]` is the
 * true statement and `['residue_key']` would be a second one: it says the marks
 * stand for GROUPS keyed by the residue, which for a key column is a grouping
 * of one row each — and it would make every edge out of these views a
 * grain-crossing edge that the def door then requires a `fold` sentence for.
 * A fold that describes no fold is the kind of prose this repository exists to
 * delete.
 */
export function protGrains(): readonly { readonly viewId: string; readonly keys: readonly string[] }[] {
  return PROT_VIEWS.map((viewId) => ({ viewId, keys: [] }));
}

// ── the def ──────────────────────────────────────────────────────────────────

/**
 * The def over one parsed entry.
 *
 * ```ts
 * const def = protDef(protTables(readFileSync('data/prot/1ay7.pdb', 'utf8')));
 * def.defaultTable;                       // 'residues'
 * buildDashboard(def).def.encodings;      // the scatter's two channels, the structure's one
 * ```
 */
export function protDef(tables: ProtTables): DashboardDef {
  return {
    meta: { title: 'A protein complex — vizfootprint on one PDB entry' },
    data: protSources(tables.residues),
    actors: { [STRUCTURE_VIEW]: STRUCTURE, [RAMA_VIEW]: RAMA, [SHEET_VIEW]: SHEET },
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
    capabilities: [
      { viewId: STRUCTURE_VIEW, canProbe: true, encodings: ['point'] },
      { viewId: RAMA_VIEW, canProbe: true, encodings: ['interval'] },
      { viewId: SHEET_VIEW, canProbe: false },
    ],
    links: protLinks(),
    encodingRules: PROT_ENCODING_RULES,
    prose: protProse(tables),
    defaultTable: RESIDUES_TABLE,
  };
}
