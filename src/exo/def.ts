/**
 * THE EXOPLANET DASHBOARD DEFINITION — layers 2–4 as data, over the NASA
 * Exoplanet Archive.
 *
 * The third demo's whole declaration: the THREE tables `src/exo/etl.ts`
 * produces, which column of each carries its silence, the relations that make a
 * measurement point at a planet and at a paper, the views and who drives each,
 * the FIVE acts that compute everything this demo shows, and the
 * multiple-comparison budget. vizfootprint's validator refuses what it cannot
 * enforce.
 *
 * ── The question ────────────────────────────────────────────────────────────
 * The archive publishes the same fact twice. `pscomppars` says a planet's
 * radius is 1.12 Earth radii; `ps` says which papers measured it and what each
 * of them got. **Does the accepted number agree with the published ones?** —
 * and, one step behind it, **where did the accepted number even come from?**
 * (For 1,608 of the 6,360 radii and 2,977 of the masses: from the archive's own
 * calculation, not from a paper. Its own `*_reflink` columns say so.)
 *
 * ── Nothing is derived in the data ──────────────────────────────────────────
 * No count, no spread, no disagreement and no delta is in the committed tables
 * or in the ETL. All five are declared HERE, as acts, and land as commits when
 * the surface dispatches them ({@link EXO_ANALYSES}). That is the demo: a
 * reader who asks where a number came from gets an act, a cause and a commit —
 * not a column somebody computed before they arrived.
 *
 * ── Why `measurements` is the default table ─────────────────────────────────
 * The session's crossfilter, its acts and its ledger all read ONE table, and
 * the row this dataset is really about is A PLANET AS ONE PAPER REPORTED IT.
 * `planets` rides beside it as the composite's one-row-per-planet answer, and
 * `references` as the dimension both point at.
 *
 * ── The one thing this def CANNOT declare, and what it does instead ─────────
 * A table's `absence` declaration — the only place `carries` can be spelled —
 * speaks for the ROW: the library reads a row whose state is not `present` as
 * having no value in ANY column, and its data door refuses a table that says
 * otherwise. The archive puts THREE parameters on one row, each with its own
 * silence: a paper that published a period and no radius is an ordinary row
 * here, and `radius_state` cannot speak for it without saying something false.
 * So `measurements` declares no table-level absence, `radius_state` and
 * `mass_state` are declared ABSENCE WORDS per column (which is what keeps a
 * state off every magnitude channel), and the honesty a `carries` declaration
 * would have bought is bought instead by SAYING IT IN THE ACTS: the aggregate
 * carries `where radius_state is "present"`, and the delta is a conditional
 * that answers nothing on a row whose radius is a bound. Both are visible in
 * the commit and in the why-sentence, which is better than an implicit law —
 * and the gap is written down in `src/exo/absence.ts` · `CARRIES_NOTE`
 * rather than worked around in silence.
 */
import type { Expr, LinkDecl, Measure } from 'vizfootprint/def';
import { layerAddress } from 'vizfootprint/def';
import type { AnalysisSlot, DashboardDef, DataSourceDef, RelationDecl, ViewEncodingDecl } from 'vizfootprint/agent';
import type { ProseDecl } from 'vizfootprint/prose';
import type { ActorMeta } from 'vizfootprint/selection';
import { ABSENCE_FIELD, PRESENT } from './absence.js';
import type { ExoTables } from './etl.js';

const ALPHA = 0.05;

/** The op-vocabulary version every declaration below is written against (`vizfootprint/derive` → `OPS_VERSION`). */
const OPS = 1;

// ── who drives what ──────────────────────────────────────────────────────────

const MASS_RADIUS: ActorMeta = { actor: 'user', label: 'Mass and radius, as the archive accepts them', does: 'click a planet to read every value ever published for it; shift-click for several' };
const SPREAD: ActorMeta = { actor: 'user', label: 'How many published radii each planet has', does: 'click a bar to select the planets measured that many times — but only once the act that mints this table has landed' };
const BY_YEAR: ActorMeta = { actor: 'user', label: 'References by year', does: 'pick a year: every reference the archive dates to it' };
// The SHEET: every measurement row the charts see, read through the same link
// graph as any chart — its own clause excluded, the others' applied. Grain [] : one mark per row.
const SHEET: ActorMeta = { actor: 'user', label: 'Every published value', does: "scroll every publication for the planet in view, oldest first, and export the receipt" };

/** Every view this def declares. */
export const EXO_VIEWS = ['mass_radius', 'spread', 'by_year', 'sheet'] as const;

/** The scatter's id, and the one layer under it — a layer because a VIEW has no table of its own, and this one draws the composite. */
export const SCATTER_VIEW = 'mass_radius';
export const SCATTER_LAYER = 'planets';
/** Where a click on a dot lands. */
export const SCATTER_ADDRESS = layerAddress(SCATTER_VIEW, SCATTER_LAYER);

/**
 * The histogram over the table an ACT mints — see {@link EXO_ANALYSES} and the
 * comment on {@link exoEncodings} — and the one layer under it, because naming
 * that table is exactly what a layer is for.
 */
export const SPREAD_VIEW = 'spread';
export const SPREAD_LAYER = 'buckets';
/** Where a click on a bar lands. Before the aggregate act has landed, the probe door refuses it BY THIS ADDRESS and names the act. */
export const SPREAD_ADDRESS = layerAddress(SPREAD_VIEW, SPREAD_LAYER);
/**
 * The bar chart over the `references` table, and the one layer under it — the
 * layer names the table, exactly as the scatter's and the histogram's do.
 */
export const BY_YEAR_VIEW = 'by_year';
export const BY_YEAR_LAYER = 'references';
/**
 * Where a click on a year lands. THE FRAME IS ITS LAYERS (`vizfootprint/def`
 * README, law 6a): this view binds nothing at its own level, so `by_year` is a
 * FRAME on the link map — not a node that reads rows — and a gesture landed at
 * the frame's own id is refused by the session in words naming this address.
 * The bar chart emits and folds here; the declared edge into the sheet leaves
 * from here too, because the def door refuses the frame as a source in the same
 * sentence.
 */
export const BY_YEAR_ADDRESS = layerAddress(BY_YEAR_VIEW, BY_YEAR_LAYER);
export const SHEET_VIEW = 'sheet';

/** The dashboard's DECLARED words — the def's prose entry and the page's fallback read the same constant. */
export const EXO_WORDS = {
  title: 'The same fact, published twice',
  caption:
    "The NASA Exoplanet Archive publishes one accepted number per planet and every number any paper ever published for it. This dashboard puts the two beside each other — and says, per planet, how far apart they are and where the accepted one came from.",
} as const;

// ── the tables an act mints, and the columns it writes ───────────────────────

/**
 * The derived table the aggregate act lands, and the columns the two derives
 * write on it. Named once, so the acts, the cells and the tests agree.
 *
 * `radii`, not `n`: the absence law means this act sees only the rows that
 * published a radius, and a measure called `n` would read as "publications",
 * which is a bigger number.
 */
export const RADII_PER_PLANET = 'radii_per_planet';
export const SPREAD_COLUMN = 'spread';
export const DISAGREES_COLUMN = 'disagrees';

/**
 * The column the bring-over lands on `measurements`, spelled the way the
 * library spells it: `<relation column>_<column>`, so bringing `pl_rade` across
 * the `measurements.pl_name → planets.pl_name` relation gives `pl_name_pl_rade`.
 * NOT a name this repo may choose — it is the produced column's real name, and
 * the delta declaration below reads it.
 */
export const ACCEPTED_RADIUS_COLUMN = 'pl_name_pl_rade';
/** The column the last derive writes: this publication's radius minus the accepted one. */
export const DELTA_COLUMN = 'delta';

const col = (name: string): Expr => ({ col: name });
const reduce = (op: 'count' | 'countDistinct' | 'min' | 'max', name: string): Expr => ({ op, args: [col(name)] });
const minus = (left: string, right: string): Expr => ({ op: 'sub', args: [col(left), col(right)] });

/** What the aggregate reads: the rows whose radius is a MEASUREMENT — declared, so the filter is on the commit and in the sentence. */
const MEASURED_RADIUS: Expr = { op: 'eq', args: [col(ABSENCE_FIELD), { lit: PRESENT }] };

/** The four measures of the aggregate, in the order they land as columns. */
const RADII_MEASURES: readonly Measure[] = [
  // `count(pl_name)` over the rows {@link MEASURED_RADIUS} let in — the publications that published a radius,
  // which is why the column is not called `n`: a bound and a silence are not publications of a number
  { as: 'radii', expr: reduce('count', 'pl_name') },
  // and how many distinct PAPERS those were: two solutions in one paper are one reference
  { as: 'refs', expr: reduce('countDistinct', 'ref') },
  { as: 'r_min', expr: reduce('min', 'pl_rade') },
  { as: 'r_max', expr: reduce('max', 'pl_rade') },
];

/**
 * THE FIVE ACTS — everything this demo computes, declared as data.
 *
 *   `radiiPerPlanet`   an AGGREGATE: one row per planet, cut from the
 *                      measurement rows visible at the cursor whose radius is a
 *                      MEASUREMENT — `where radius_state is "present"`, said out
 *                      loud, so a bound never widens a range of measurements and
 *                      the filter travels on the commit. Its group column is
 *                      `pl_name`, so the session MINTS the relation back to the
 *                      parent and a selection routes both ways with no new code.
 *                      A planet no paper published a radius for has no row here
 *                      at all, and the caption counts those rather than letting
 *                      them read as the leftmost bar.
 *   `radiusSpread`     a DERIVE on that new table: `r_max − r_min`, the width of
 *                      the published range.
 *   `radiusDisagrees`  a DERIVE on the same table: whether that width is above
 *                      zero. A boolean column, which is a thing arithmetic text
 *                      cannot spell and a declared TREE can.
 *   `acceptedRadius`   a BRING-OVER: the composite's accepted radius, carried
 *                      across the declared relation onto every measurement row.
 *   `radiusDelta`      a DERIVE on `measurements`: this publication's radius
 *                      minus the accepted one — the disagreement per
 *                      publication, as a column the sheet shows and the export
 *                      carries.
 *
 * The order is a dependency chain and `./session.ts` lands them in it: the two
 * derives need the table the aggregate mints, and the delta needs the column
 * the bring-over carries. A derive whose column is missing THROWS rather than
 * refusing, which is why the surface stops at the first refusal instead of
 * running the next act anyway.
 */
export const EXO_ANALYSES: Readonly<Record<string, AnalysisSlot>> = {
  radiiPerPlanet: { builtin: 'aggregate', name: RADII_PER_PLANET, table: 'measurements', ops: OPS, groupBy: ['pl_name'], measures: [...RADII_MEASURES], where: MEASURED_RADIUS },
  radiusSpread: { builtin: 'derive', table: RADII_PER_PLANET, name: SPREAD_COLUMN, column: { ops: OPS, kind: 'row', expr: minus('r_max', 'r_min') } },
  radiusDisagrees: { builtin: 'derive', table: RADII_PER_PLANET, name: DISAGREES_COLUMN, column: { ops: OPS, kind: 'row', expr: { op: 'gt', args: [minus('r_max', 'r_min'), { lit: 0 }] } } },
  acceptedRadius: { builtin: 'bringOver', table: 'measurements', from: 'planets', columns: ['pl_rade'] },
  radiusDelta: { builtin: 'derive', table: 'measurements', name: DELTA_COLUMN, column: { ops: OPS, kind: 'row', expr: { op: 'if', args: [MEASURED_RADIUS, minus('pl_rade', ACCEPTED_RADIUS_COLUMN), { lit: null }] } } },
};

/** The acts in the order they must land — the chain above, written down once. */
export const EXO_ACT_ORDER: readonly { readonly id: string; readonly table: string; readonly intent: string }[] = [
  { id: 'radiiPerPlanet', table: 'measurements', intent: 'cut one row per planet from the publications that MEASURED a radius (a bound is not a measurement): how many radii, how many papers, and the smallest and largest of them' },
  { id: 'radiusSpread', table: RADII_PER_PLANET, intent: 'derive the width of each planet\'s published radius range (largest minus smallest)' },
  { id: 'radiusDisagrees', table: RADII_PER_PLANET, intent: 'derive whether a planet\'s publications disagree at all (that width above zero)' },
  { id: 'acceptedRadius', table: 'measurements', intent: 'bring the composite\'s accepted radius across the relation onto every published measurement' },
  { id: 'radiusDelta', table: 'measurements', intent: 'derive each publication\'s distance from the accepted radius — and nothing at all where the published radius is a bound' },
];

// ── the relations ────────────────────────────────────────────────────────────

/**
 * Three relations, and the third is the one this demo exists for — and the
 * crossfilter now CROSSES it: a planet picked on the scatter travels
 * `planets.radius_ref → references.ref` to the years as the one reference the
 * composite took its radius from (`vizfootprint` · `src/session/README.md`,
 * "A clause travels a relation"; pinned in `tests/exo-session.test.ts`).
 *
 * A measurement points at its PLANET (which is what lets the bring-over carry
 * the accepted radius onto it) and at its PAPER. The composite's own radius
 * points at a reference too — and that edge is how a reader gets from "the
 * accepted radius is 2.1" to "…and it came from the archive's own calculation,
 * not from any of these papers". `kind` is left to the default the runtime
 * writes out (`many-to-one`).
 */
export const EXO_RELATIONS: readonly RelationDecl[] = [
  { from: { table: 'measurements', column: 'pl_name' }, to: { table: 'planets', column: 'pl_name' }, label: 'the planet this publication measured' },
  { from: { table: 'measurements', column: 'ref' }, to: { table: 'references', column: 'ref' }, label: 'the publication this measurement is from' },
  { from: { table: 'planets', column: 'radius_ref' }, to: { table: 'references', column: 'ref' }, label: 'where the composite took its accepted radius from' },
];

// ── the scatter's axes ───────────────────────────────────────────────────────

/**
 * THE SCATTER'S FRAME: both axes are LOGARITHMIC, base 10.
 *
 * Planet masses in this slice run from about 0.02 to 9,535 Earth masses and the
 * radii from 0.3 to 87. Drawn linearly that is one picture of Jupiter and a
 * smudge where every rocky planet is, which is why the field's own mass–radius
 * diagram has been log–log since it had four points on it. Until the library
 * had a transform this file declared a hand-typed WINDOW instead and the cell
 * counted the giants it cut off; the window is gone, because a picture with two
 * owners — a def that names a range and a cell that filters by it — is the
 * mistake this repository exists to refuse.
 *
 * WHY THE FRAME OWNS IT AND NOT THE CELL. `transform` is not a resolution: a
 * `mode` asks whether layers share a scale (meaningless with one layer), while
 * `transform` asks WHAT THE AXIS IS, which a plain scatter needs exactly as
 * much as a stack does — so the library keeps the frame legal on a one-layer
 * view and narrows its refusals to `mode`. The declaration then travels to the
 * chart the way every other declaration does: the session projects it verbatim
 * (`overview().views[].frame`), and `web/src/exoCells.tsx` reads it from there.
 * Nothing in the cell decides which curve an axis is drawn on.
 *
 * WHAT NO DECLARATION CAN DECIDE is the cells: a logarithm has no answer for 0
 * or a negative number, and which planets those are is DATA. So the library
 * folds the domain over the positive cells and COUNTS what it could not place
 * (`ResolvedDomain.excluded`) — exclude and count, never silently drop. The
 * chart prints that count in the picture the marks are missing from, and the
 * caption says it again in the reader's own sentence.
 *
 * No `zero` here, and the def door would refuse one: a logarithmic axis has no
 * zero to anchor at.
 *
 * `mode: 'shared'` is required rather than chosen. This view HAS a layer, and on
 * a layered view the frame's shape asks every named channel how it resolves
 * across them; with one layer there is nothing to resolve, so `shared` is both
 * the default and the only honest answer. (A LAYERLESS view is where the library
 * refuses `mode` and keeps the axis keys alone.) The rest of the resolution —
 * `domain: 'union'`, `basis: 'table'`, `guide: 'merged'` — is the undeclared
 * default, and typing it out would only give it a second owner.
 */
export const SCATTER_FRAME = {
  x: { mode: 'shared', transform: 'log' },
  y: { mode: 'shared', transform: 'log' },
} as const satisfies NonNullable<ViewEncodingDecl['frame']>;

// ── the views, declared ──────────────────────────────────────────────────────

/**
 * THREE of the four views declare an encoding, and each names a table the
 * default one is not — which is the only thing a layer exists for.
 *
 * `mass_radius` reads `planets`, so it declares a one-LAYER frame, judged
 * against that table's own columns. Its frame also declares WHAT THE AXES ARE:
 * mass against radius is the log-log figure this field publishes, and the
 * library's `transform: 'log'` is the declaration that says so. See
 * {@link SCATTER_FRAME} for why the frame — and not the cell — owns it.
 *
 * `spread` reads the table the AGGREGATE MINTS, and can now say so: a layer's
 * table may be a key of `data` **or** the name of a declared analysis that
 * lands a table, because a definition that declares the act has already
 * declared the table's name and its whole column list (`pl_name` from the
 * `groupBy`, then the four measures' `as` names). Its columns are what the
 * layer binds; the two DERIVED columns (`spread`, `disagrees`) are written by
 * later acts and are read by the caption, never bound on an axis.
 *
 * WHEN that table exists is a different question, and the library answers it
 * per cursor rather than at the door: before `radiiPerPlanet` has landed, a
 * click on this view is refused as a typed `needs-act` gap naming the act
 * ("…which the act \"radiiPerPlanet\" mints — it has not landed on this path").
 * That refusal is why the histogram no longer declares `canProbe: false` — a
 * chart a reader can see and can never click, with no sentence saying why.
 *
 * `sheet` declares none for the reason the other two demos' sheets declare
 * none: it shows rows, not a mark.
 */
function exoEncodings(): readonly ViewEncodingDecl[] {
  return [
    {
      viewId: SCATTER_VIEW,
      chartKind: 'scatter',
      channels: ['x', 'y'],
      layers: [{ layerId: SCATTER_LAYER, table: 'planets', chartKind: 'scatter', channels: ['x', 'y'], initial: { x: 'pl_bmasse', y: 'pl_rade' }, label: 'Planets, as the composite table accepts them' }],
      frame: SCATTER_FRAME,
    },
    {
      viewId: SPREAD_VIEW,
      chartKind: 'histogram',
      channels: ['x'],
      // the layer names the MINTED table — a histogram over `radii`, the count of published radii per planet
      layers: [{ layerId: SPREAD_LAYER, table: RADII_PER_PLANET, chartKind: 'histogram', channels: ['x'], initial: { x: 'radii' }, label: 'Planets, grouped by how many radii were published for them' }],
    },
    { viewId: BY_YEAR_VIEW, chartKind: 'bar', channels: ['category'], layers: [{ layerId: BY_YEAR_LAYER, table: 'references', chartKind: 'bar', channels: ['category'], initial: { category: 'pub_year' }, label: 'References by year' }] },
  ];
}

// ── the three tables, declared ───────────────────────────────────────────────

function exoSources(tables: ExoTables): Record<string, DataSourceDef> {
  return {
    // THE MEASUREMENTS — the default table. One row per published solution: a
    // planet as ONE paper reported it, with the archive's own words for what it
    // could and could not measure.
    measurements: {
      // declared as an (inline) SOURCE so every commit carries the version it was true of
      source: { format: 'rows', via: 'inline', at: tables.measurements },
      // NO table-level `absence`, and the header of this file says why: the
      // declaration speaks for the ROW, and these rows carry three parameters with
      // three separate silences. Both state columns are declared ABSENCE WORDS
      // below instead — which is what holds a state off every magnitude channel —
      // and the acts say in their own records what a bound may not enter.
      columns: {
        measurement_id: { role: 'identifier', label: 'minted: planet + its index among that planet’s published solutions' },
        // the four words, per PARAMETER: `limit` holds a number (an upper or lower
        // bound) and is not a silence, which is exactly what no per-column
        // declaration can say today (`src/exo/absence.ts` · `CARRIES_NOTE`)
        radius_state: { role: 'absence', label: 'whether the published radius is a measurement, a bound, or absent' },
        pl_name: { role: 'dimension', label: 'planet' },
        hostname: { role: 'dimension', label: 'host star' },
        ref: { role: 'dimension', label: 'reference (the archive’s own key)' },
        ref_label: { role: 'dimension', label: 'reference, as the archive writes it' },
        // the RAW anchor, kept: the receipt behind `ref`, so nothing here is taken on trust
        pl_refname: { role: 'dimension', label: 'the archive’s reference anchor, verbatim' },
        // `YYYY-MM` and NOT declared a date: the archive publishes no day, and a
        // column that called itself a date would invite a reader to read one off it.
        // It still sorts chronologically, which is what the sheet needs.
        pl_pubdate: { role: 'dimension', label: 'published (year and month, the archive’s own spelling)' },
        pub_year: { role: 'dimension', scale: 'continuous', label: 'published, year' },
        default_flag: { role: 'dimension', label: '1 where this is the solution the archive treats as the planet’s default' },
        pl_orbper: { role: 'measure', label: 'orbital period', unit: 'days' },
        pl_rade: { role: 'measure', label: 'radius as published', unit: 'Earth radii' },
        pl_radeerr1: { role: 'measure', label: 'radius, upper uncertainty', unit: 'Earth radii' },
        pl_radeerr2: { role: 'measure', label: 'radius, lower uncertainty', unit: 'Earth radii' },
        // which SIDE the bound is on, when radius_state says `limit`
        radius_bound: { role: 'dimension', label: 'upper or lower, when the radius is a bound' },
        pl_bmasse: { role: 'measure', label: 'mass as published', unit: 'Earth masses' },
        pl_bmasseerr1: { role: 'measure', label: 'mass, upper uncertainty', unit: 'Earth masses' },
        pl_bmasseerr2: { role: 'measure', label: 'mass, lower uncertainty', unit: 'Earth masses' },
        // the same four words for the mass — a second absence WORD on one row, which is exactly what no table-level declaration can hold
        mass_state: { role: 'absence', label: 'whether the published mass is a measurement, a bound, or absent' },
        mass_bound: { role: 'dimension', label: 'upper or lower, when the mass is a bound' },
        // `Msini` is a lower bound in physics and the archive does not flag it as a
        // limit, so neither does this def — it is a word on the row, and the prose
        // says what it means
        mass_kind: { role: 'dimension', label: 'the archive’s mass provenance: Mass, Msini, …' },
        disc_year: { role: 'dimension', scale: 'continuous', label: 'discovery year' },
        discoverymethod: { role: 'dimension', label: 'discovery method' },
        sy_dist: { role: 'measure', label: 'distance to the system, as this row reported it', unit: 'parsecs' },
      },
    },
    // THE COMPOSITE. One row per planet, and `key` is what a relation may point at.
    planets: {
      rows: tables.planets.map((r) => ({ ...r })),
      key: 'pl_name',
      // NO table-level absence here, deliberately, and for a reason the grid demo's
      // `authorities` table states one level out: a table's absence column speaks
      // for the ROW, and `radius_state` speaks for ONE figure. 50 planets have no
      // composite radius, and 43 of those carry a mass all the same — both facts are
      // true, and a table-level declaration would read the mass as absent because the
      // radius is.
      // `radius_state` is still declared an ABSENCE WORD below, so the library's own
      // law holds it off every magnitude channel: a state is a category, never a number.
      columns: {
        pl_name: { role: 'identifier', label: 'planet' },
        radius_state: { role: 'absence', label: 'whether the accepted radius is a measurement, a bound, or missing' },
        hostname: { role: 'dimension', label: 'host star' },
        pl_letter: { role: 'dimension', label: 'planet letter' },
        sy_pnum: { role: 'measure', label: 'planets known in this system' },
        pl_orbper: { role: 'measure', label: 'accepted orbital period', unit: 'days' },
        pl_rade: { role: 'measure', label: 'accepted radius', unit: 'Earth radii' },
        radius_bound: { role: 'dimension', label: 'upper or lower, when the accepted radius is a bound' },
        pl_bmasse: { role: 'measure', label: 'accepted mass', unit: 'Earth masses' },
        mass_state: { role: 'absence', label: 'whether the accepted mass is a measurement, a bound, or absent' },
        mass_bound: { role: 'dimension', label: 'upper or lower, when the accepted mass is a bound' },
        // 2,974 of the 6,360 planets say `M-R relationship` here: the accepted mass
        // was computed from the radius by a model, and no paper measured it
        mass_kind: { role: 'dimension', label: 'how the accepted mass was arrived at' },
        radius_ref: { role: 'dimension', label: 'where the accepted radius came from' },
        radius_ref_kind: { role: 'dimension', label: 'a publication, or the archive itself' },
        mass_ref: { role: 'dimension', label: 'where the accepted mass came from' },
        mass_ref_kind: { role: 'dimension', label: 'a publication, or the archive itself' },
        period_ref: { role: 'dimension', label: 'where the accepted period came from' },
        period_ref_kind: { role: 'dimension', label: 'a publication, or the archive itself' },
        disc_year: { role: 'dimension', scale: 'continuous', label: 'discovery year' },
        discoverymethod: { role: 'dimension', label: 'discovery method' },
        disc_ref: { role: 'dimension', label: 'the discovery reference' },
        sy_dist: { role: 'measure', label: 'distance to the system', unit: 'parsecs' },
      },
    },
    // THE REFERENCES — the dimension both other tables point at. No absence
    // vocabulary at all: a reference either exists or is not a row, and its `note`
    // is null for every publication BY DESIGN (the glosses are for the four keys
    // that are the archive speaking), which is not a silence about the paper.
    references: {
      rows: tables.references.map((r) => ({ ...r })),
      key: 'ref',
      columns: {
        ref: { role: 'identifier', label: 'the archive’s reference key' },
        label: { role: 'dimension', label: 'reference, as the archive writes it' },
        href: { role: 'dimension', label: 'where the archive points' },
        kind: { role: 'dimension', label: 'a publication, or the archive itself' },
        // spelled the way `measurements` spells it, so a year picked here is a clause
        // the sheet's table can answer (see ReferenceRow.pub_year)
        pub_year: { role: 'dimension', scale: 'discrete', label: 'published, year — a bucket to count in, never a magnitude' },
        pl_pubdate: { role: 'dimension', label: 'published (year and month)' },
        cited_in: { role: 'dimension', label: 'which table points at it: the measurements, the composite, or both' },
        note: { role: 'dimension', label: 'what an archive-internal key means (null for a publication — none is needed)' },
      },
    },
  };
}

// ── the words ────────────────────────────────────────────────────────────────

/**
 * The scatter's words, as a function of the TABLES the def was handed — the way
 * the other two demos' are.
 *
 * WHY not a constant: the long description states facts about the rows (how
 * many planets a logarithmic axis can place, how many it cannot), and `exoDef`
 * accepts any tables. A constant would tell a screen-reader user one population
 * while the caption beside it counts another — so the sighted reader would get
 * the counted truth and the blind reader a hard-coded claim.
 *
 * It says the axes are LOGARITHMIC out loud, in both the short and the long
 * description. An axis labelled 1, 10, 100 is read as linear by anyone skimming
 * it, and a screen-reader user never sees the tick spacing at all.
 *
 * The basis names columns of the DEFAULT table, which is where a prose basis is
 * judged: `pl_rade` and `pl_bmasse` are on `measurements` as well as on the
 * composite, and they are the two the sentence is about.
 */
function scatterProse(tables: ExoTables): ProseDecl {
  const drawn = tables.planets.filter((p) => typeof p.pl_rade === 'number' && typeof p.pl_bmasse === 'number');
  // what a LOGARITHM cannot place: a mass or a radius of zero or below. The same predicate the
  // chart draws by (`placeable`, vizfootprint-ui) and the library folds `excluded` with — counted
  // here so the long description and the picture can never report two different numbers.
  const placeable = drawn.filter((p) => Number(p.pl_bmasse) > 0 && Number(p.pl_rade) > 0);
  const calculated = tables.planets.filter((p) => p.radius_ref_kind === 'archive').length;
  return {
    viewId: SCATTER_VIEW,
    slots: {
      title: { text: 'Mass and radius, as the archive accepts them', author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
      altShort: { text: 'A scatter plot of accepted planet radius against accepted planet mass, one dot per planet, on logarithmic axes.', author: { kind: 'human' }, levels: ['construction'] },
      altLong: {
        text:
          `One dot per planet, placed at the radius and mass the archive's composite table accepts for it. ` +
          `BOTH AXES ARE LOGARITHMIC, base 10, ticked at the powers of ten — this is the log–log mass–radius diagram the field publishes, and the whole population fits on it rather than crowding into one corner of a linear frame. ` +
          `${String(placeable.length)} of the ${String(tables.planets.length)} planets are drawn; ` +
          `${String(drawn.length - placeable.length)} have an accepted mass or radius of zero or less, which a logarithm cannot place, and ${String(tables.planets.length - drawn.length)} have no accepted pair to place at all. ` +
          `The accepted numbers are an ASSEMBLY, not a publication: ${String(calculated)} of the radii come from the archive's own calculation rather than from a paper. ` +
          `Click a planet to see every value ever published for it.`,
        author: { kind: 'human' },
        levels: ['construction'],
        basis: { columns: ['pl_rade', 'pl_bmasse'] },
      },
    },
  };
}

/**
 * WHERE THE LINKS GO — two declared edges, and nothing declared about the
 * histogram at all.
 *
 * The two declared edges are the demo's story: a planet picked on the scatter
 * is whose publications the sheet lists, and a year picked on the bar is which
 * publications the sheet keeps. Both cross grains — a planet and a year are
 * groups, a sheet row is a row — so both state their fold, which the def door
 * requires and the ledger prints.
 *
 * THE HISTOGRAM DECLARES NOTHING, AND THAT IS NOW THE WHOLE DECLARATION. It has
 * a voice — an interval over the minted table's `radii` — so the crossfilter
 * default materializes real filter edges out of it to every other view, and
 * `radii` is a column of `radii_per_planet` and of nothing else. This file used
 * to answer that with ten hand-declared `response: 'none'` edges
 * (`spreadSilences`) plus prose of its own explaining the silence, because the
 * library used to REFUSE the whole read when a clause named a column the table
 * had not got — one gesture here killed the sheet's window and the export with
 * it.
 *
 * It does not any more, so neither do we. The library NARROWS a clause its
 * table cannot judge, reports it on the window as
 * `ReachingClause.narrowed = { column, reason }`, and names the acting view by
 * the label this def declares (`ReachingClause.fromLabel`) — see the library's
 * `src/session/README.md`, "A sentence about a column these rows do not have is
 * not a claim about these rows". Ten declarations and two paraphrases were the
 * demo re-deriving what the library now states at every read, so they are gone:
 * the read succeeds, the export walks, the clause is still LISTED, and the
 * reason is the library's own sentence rather than ours — printed under the
 * sheet's rows by the library's own grid (`vizfootprint-ui` · `narrowedSaid`),
 * which is why the layer's declared `label` is the name a reader sees there.
 * The chip under the brush says it too (`vizfootprint-ui` · `narrowedWords`,
 * one line per consumer from the overview's `narrowedFor`, each named by ITS
 * declared label), so a reader who looks at the gesture rather than the sheet
 * also hears it — one fact, two vantages.
 *
 * What the DEMO still knows, and the library cannot: a bucket is a set of
 * PLANETS, and the other two charts and the sheet are about planets too — so a
 * clause from here reaching them is expected rather than broken, and the only
 * thing that cannot travel is the column it happens to be phrased in. That
 * sentence is in the histogram's caption (`web/src/exoCells.tsx`) and nothing
 * about judgeability is retyped beside it.
 *
 * What a click on a bar DOES do is land a real commit with its cause, put the
 * selection outline on that bucket, and stand in the ledger as the question
 * somebody asked — which is what makes the refusal before the act meaningful.
 */
function exoLinks(): readonly LinkDecl[] {
  return [
    { source: SCATTER_ADDRESS, kind: 'point', target: SHEET_VIEW, response: 'filter', fold: 'every published solution for the picked planet, oldest first', label: 'a dot on the scatter is whose publications the sheet lists' },
    // the source is the LAYER, as the scatter's is: the frame `by_year` reads no rows of its own, and
    // the def door refuses an edge that names it (`links[1].source "by_year" is a frame that reads
    // only through its layers — name one: by_year~references`)
    { source: BY_YEAR_ADDRESS, kind: 'point', target: SHEET_VIEW, response: 'filter', fold: 'the publications the archive dates to the picked year', label: 'a year on the bar is which publications the sheet keeps' },
  ];
}

/**
 * The def over the three ETL'd tables.
 *
 * Nothing here is optional: all three tables come out of the SAME ETL, so an
 * exoplanet def either has all three or has no data at all.
 */
export function exoDef(tables: ExoTables): DashboardDef {
  return {
    meta: { title: 'Exoplanets — vizfootprint on the NASA Exoplanet Archive' },
    data: exoSources(tables),
    relations: EXO_RELATIONS,
    actors: { mass_radius: MASS_RADIUS, spread: SPREAD, by_year: BY_YEAR, sheet: SHEET },
    encodings: exoEncodings(),
    analyses: { ...EXO_ANALYSES },
    // Layer 4 — each view's GRAIN: the group keys its marks stand for ([] = one
    // mark per row). An edge whose source emits over one grain and whose target
    // shows another CROSSES grains and must state its fold, or the def door
    // refuses it with the sentence.
    grains: [
      // one dot per planet — the frame's grain, not the layer's (the library gives a layer none: a grain is a VIEW's, judged there)
      { viewId: SCATTER_VIEW, keys: ['pl_name'] },
      // a bar stands for every planet with the SAME number of published radii
      { viewId: SPREAD_VIEW, keys: ['radii'] },
      { viewId: BY_YEAR_VIEW, keys: ['pub_year'] },
      // the sheet stands for ROWS: grain [] is one mark per row of `measurements`
      { viewId: SHEET_VIEW, keys: [] },
    ],
    // The honest capability envelope. The scatter and the sheet can emit a point
    // (a planet, a row) and a match (shift-click) and nothing else — no interval,
    // because neither axis of either is a range a reader brushes here.
    //
    // The histogram emits an INTERVAL and only an interval: a click on a bar is a
    // bucket, a pair of bin edges over `radii`, which is what `VizHistogram`
    // really emits — not a point, and never a match, because there is no identity
    // in a bucket to hold several of. It used to declare `canProbe: false`, which
    // made every probe a `guard-failed` gap: a chart a reader could see and could
    // never click, with the DEFINITION as the reason. The library now answers the
    // real question per cursor — the table this view draws is minted by an act, so
    // before that act lands the click is a typed `needs-act` gap naming it — so
    // the view keeps its voice and the door says why it cannot speak yet.
    capabilities: [
      { viewId: SCATTER_VIEW, canProbe: true, encodings: ['point', 'match'] },
      { viewId: BY_YEAR_VIEW, canProbe: true, encodings: ['point', 'match'] },
      { viewId: SHEET_VIEW, canProbe: true, encodings: ['point', 'match'] },
      { viewId: SPREAD_VIEW, canProbe: true, encodings: ['interval'] },
    ],
    links: exoLinks(),
    // The encoding plane's HOUSE RULES, as data — the same sentences refuse a bad
    // initial binding at build, a bad rebind at dispatch, and grey the picker.
    encodingRules: {
      onInvalid: 'refuse',
      ruleScope: 'view',
      rules: [
        { rule: 'never-together', columns: ['pl_rade', 'pl_radeerr1'], sentence: 'a radius and its own uncertainty never share a scale ({column} with {other}) — one is how big the planet is, the other is how well anybody knows it' },
        { rule: 'never-on', column: 'default_flag', channels: ['x', 'y', 'size', 'color'], sentence: 'the default flag says which solution the archive PREFERS — a choice, never a magnitude and never a hue' },
        { rule: 'never-on', column: 'pub_year', channels: ['size'], sentence: 'a publication year is a date, not an area: 2001 is not half of 2020' },
        { rule: 'only-with', column: DELTA_COLUMN, companion: 'pl_name', sentence: 'a disagreement is only meaningful per planet — keep "pl_name" on the chart' },
      ],
    },
    // The PROSE plane: the words three views carry, as records with an author.
    prose: [
      {
        viewId: 'dashboard',
        slots: {
          title: { text: EXO_WORDS.title, author: { kind: 'human', by: 'the dashboard author' } },
          caption: { text: EXO_WORDS.caption, author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
        },
      },
      scatterProse(tables),
      {
        viewId: SPREAD_VIEW,
        slots: {
          title: { text: 'How many published radii each planet has', author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
          altShort: { text: 'A histogram of how many published radii each planet has, from one upward. Click a bar to select those planets.', author: { kind: 'human' }, levels: ['construction'] },
          altLong: {
            text:
              'Each bar counts the planets with the same number of published radii. The table under it does not exist until an act cuts it: an aggregate over the published measurements, then two derived columns — the width of each planet\'s published range, and whether that width is above zero. ' +
              'A bar CAN be clicked, and what happens depends on where you are in the history: before the aggregate act has landed there is no table under this picture, and the click is refused in a sentence naming the act that mints it; after the act has landed the same click selects the planets in that bucket, on the log, with its cause. ' +
              'Nothing else on the dashboard moves when you click a bar, and not because anything is switched off: this dashboard declares no edge out of the histogram, so the default rule carries the bucket to every other view — which is right, since a bucket is a set of planets and the rest of this dashboard is about planets. What cannot travel is the column the bucket is phrased in: `radii` is a column of the minted table and of nothing else, so every other view keeps all of its rows, and the sheet prints the library\u2019s own sentence for that under them. ' +
              'What it cannot show: a planet no paper published a radius for. The absence law drops such a row before the aggregate sees it, so those planets are in no bar at all, and the caption counts them instead of implying they are the leftmost bar.',
            author: { kind: 'human' },
            levels: ['construction'],
          },
        },
      },
      {
        viewId: BY_YEAR_VIEW,
        slots: {
          title: { text: 'References by year', author: { kind: 'human', by: 'the dashboard author' }, levels: ['construction'] },
          altShort: { text: 'A bar chart of how many references the archive dates to each publication year.', author: { kind: 'human' }, levels: ['construction'] },
          // the library writes the construction line itself, every read
          howToRead: { author: { kind: 'derived' } },
        },
      },
    ],
    fdr: { procedure: 'LORD++', alpha: ALPHA },
    defaultTable: 'measurements',
  };
}
