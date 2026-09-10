/**
 * ETL — the NASA Exoplanet Archive's two tables, shaped for vizfootprint.
 * Layer 1 (data), the adapter side: the committed slice in, plain rows out,
 * nothing invented and NOTHING DERIVED.
 *
 * Three tables, by the grain each question is asked at:
 *
 *   `measurements`  one row per PUBLISHED MEASUREMENT — a planet as one paper
 *                   reported it. 20,598 rows over 6,360 planets, so a planet
 *                   has as many rows as papers that measured it (TrES-2 b has
 *                   26; 1,900 planets have exactly one).
 *   `planets`       one row per PLANET — the archive's own COMPOSITE. One
 *                   number per parameter, each carrying which reference that
 *                   number came from — and for 1,608 radii and 2,977 masses
 *                   that reference is the archive itself, not a paper.
 *   `references`    one row per REFERENCE either table points at, keyed by the
 *                   archive's own stable key. The dimension both relations
 *                   land on.
 *
 * ── WHAT IS NOT HERE, and that is the whole point ───────────────────────────
 * No `n`, no `spread`, no `disagrees`, no `delta`. Every one of those is
 * computable from these three tables, so the DEF declares them as acts and the
 * SESSION lands them as commits (`./def.ts` → `EXO_ANALYSES`). A count this
 * file wrote would be a number with no act behind it: the reader could see it
 * and never ask where it came from. The grid demo makes the same choice for its
 * positions, for the same reason — a number that is not on the trace is a
 * number a replay cannot promise.
 *
 * The three columns this file DOES add are not derivations, they are
 * TRANSLATIONS: `radius_state` / `mass_state` word what the archive's limit
 * flags say (`./absence.ts`), and `ref` is the archive's own key taken out of
 * the HTML anchor it ships inside (`./names.ts`). Both are Layer-1 adapter
 * work — reading the source's own message — and neither can be spelled as an
 * act because the op grammar has no regular expressions and no vocabulary of
 * silences.
 *
 * ── ONE KEY, CHOSEN BY THE DATA ─────────────────────────────────────────────
 * A reference arrives as an HTML anchor and the anchor is NOT a key: over the
 * slice the archive spells 2,375 references with 2,685 distinct anchor strings
 * — `JOHNSON_ET_AL__2010` appears four ways. Keying on the anchor would count
 * one paper up to four times, and "how many publications measured this planet"
 * is exactly the question view 2 asks. So the key is `ref`, the archive's own
 * `refstr`, and the raw anchor rides along as `pl_refname` — the receipt, kept
 * verbatim, so nothing is taken on trust.
 *
 * **This module runs in a browser.** Reading the committed CSVs off disk needs
 * node, so it lives beside this one in `./snapshot.ts` — the rule the other two
 * demos state and the same reason: a module that pulls a runtime into every
 * importer is a module every importer pays for.
 */
import { parseCSVTyped } from 'vizfootprint/data';
import { figureOf, numberOrNull, type Absence, type Bound } from './absence.js';
import { archiveNoteFor, massKindNoteFor, parseReference, referenceKindOf, type ReferenceKind } from './names.js';

// ── the archive's column names, in one place ─────────────────────────────────

/** The `ps` columns this ETL reads — the archive's exact header text, as `data/exo/fetch.mjs` asked for them. */
export const PS_COLUMNS = {
  planet: 'pl_name',
  host: 'hostname',
  letter: 'pl_letter',
  planetsInSystem: 'sy_pnum',
  solutionType: 'soltype',
  defaultFlag: 'default_flag',
  reference: 'pl_refname',
  pubdate: 'pl_pubdate',
  period: 'pl_orbper',
  radius: 'pl_rade',
  radiusErrUpper: 'pl_radeerr1',
  radiusErrLower: 'pl_radeerr2',
  radiusLimit: 'pl_radelim',
  mass: 'pl_bmasse',
  massErrUpper: 'pl_bmasseerr1',
  massErrLower: 'pl_bmasseerr2',
  massLimit: 'pl_bmasselim',
  massKind: 'pl_bmassprov',
  discoveryYear: 'disc_year',
  discoveryMethod: 'discoverymethod',
  distance: 'sy_dist',
} as const;

/** The `pscomppars` columns this ETL reads. Its provenance is PER PARAMETER — one `*_reflink` each — and it has no `pl_refname` at all. */
export const PSCOMPPARS_COLUMNS = {
  planet: 'pl_name',
  host: 'hostname',
  letter: 'pl_letter',
  planetsInSystem: 'sy_pnum',
  period: 'pl_orbper',
  periodRef: 'pl_orbper_reflink',
  radius: 'pl_rade',
  radiusLimit: 'pl_radelim',
  radiusRef: 'pl_rade_reflink',
  mass: 'pl_bmasse',
  massLimit: 'pl_bmasselim',
  massKind: 'pl_bmassprov',
  massRef: 'pl_bmasse_reflink',
  discoveryYear: 'disc_year',
  discoveryMethod: 'discoverymethod',
  discoveryRef: 'disc_refname',
  distance: 'sy_dist',
} as const;

/** The character between a planet's name and its index in a minted `measurement_id`. */
export const MEASUREMENT_ID_MARKER = '#';

// ── the rows ─────────────────────────────────────────────────────────────────

/** One published measurement: a planet as ONE paper reported it. */
export interface MeasurementRow {
  /**
   * The key, MINTED: `<pl_name>#<index within that planet>`. The archive
   * publishes no row id, and the index is the row's position among its own
   * planet's rows IN THE COMMITTED FILE — which is stable because the fetch
   * orders by `pl_name, pl_pubdate, pl_refname` (`data/exo/fetch.mjs`). Reorder
   * the query and these ids move, which is why the order is pinned there and
   * not here.
   */
  readonly measurement_id: string;
  readonly pl_name: string;
  readonly hostname: string;
  /** The archive's stable reference key, taken out of the anchor — what `references` is keyed on. */
  readonly ref: string;
  /** The archive's own words for that reference. */
  readonly ref_label: string;
  /** The RAW anchor, exactly as the archive published it — the receipt behind `ref`. */
  readonly pl_refname: string;
  /** `YYYY-MM`, the archive's own spelling. */
  readonly pl_pubdate: string;
  /** The publication year, parsed from `pl_pubdate`. */
  readonly pub_year: number | null;
  /** 1 when this is the solution the archive treats as the planet's default, 0 otherwise. */
  readonly default_flag: number | null;
  readonly pl_orbper: number | null;
  /** Earth radii. Kept for a `limit` as well as a measurement, because a bound is a number. */
  readonly pl_rade: number | null;
  readonly pl_radeerr1: number | null;
  readonly pl_radeerr2: number | null;
  readonly radius_state: Absence;
  /** `upper` or `lower` when `radius_state` is `limit`; null otherwise. */
  readonly radius_bound: Bound | null;
  /** Earth masses. */
  readonly pl_bmasse: number | null;
  readonly pl_bmasseerr1: number | null;
  readonly pl_bmasseerr2: number | null;
  readonly mass_state: Absence;
  readonly mass_bound: Bound | null;
  /** The archive's `pl_bmassprov` word: `Mass`, `Msini`, … — null when this row published no mass. */
  readonly mass_kind: string | null;
  readonly disc_year: number | null;
  readonly discoverymethod: string;
  /** Parsecs, as this row reported it — the archive carries it per row, and many rows leave it empty. */
  readonly sy_dist: number | null;
  readonly [k: string]: string | number | null;
}

/** One planet, as the archive's COMPOSITE table assembles it — one number per parameter, each with its own provenance. */
export interface PlanetRow {
  readonly pl_name: string;
  readonly hostname: string;
  readonly pl_letter: string;
  /** How many planets the archive knows in this system. */
  readonly sy_pnum: number | null;
  readonly pl_orbper: number | null;
  readonly pl_rade: number | null;
  readonly radius_state: Absence;
  readonly radius_bound: Bound | null;
  readonly pl_bmasse: number | null;
  readonly mass_state: Absence;
  readonly mass_bound: Bound | null;
  /** `M-R relationship` here means the mass is a MODEL computed from the radius — 2,974 of the 6,360 planets. */
  readonly mass_kind: string | null;
  /** Which reference the composite's radius came from — `references.ref`. */
  readonly radius_ref: string | null;
  /** `publication` or `archive`: whether that radius came from a paper or from the archive's own calculation. */
  readonly radius_ref_kind: ReferenceKind | null;
  readonly mass_ref: string | null;
  readonly mass_ref_kind: ReferenceKind | null;
  readonly period_ref: string | null;
  readonly period_ref_kind: ReferenceKind | null;
  readonly disc_year: number | null;
  readonly discoverymethod: string;
  readonly disc_ref: string | null;
  readonly sy_dist: number | null;
  readonly [k: string]: string | number | null;
}

/** One reference — a paper, or the archive speaking. The dimension both relations land on. */
export interface ReferenceRow {
  /** The archive's own stable key (`refstr`). */
  readonly ref: string;
  /** The archive's own words, trimmed. When the archive spells one key several ways, the first spelling in file order. */
  readonly label: string;
  readonly href: string;
  readonly kind: ReferenceKind;
  /**
   * The year, parsed from the `pl_pubdate` of the first measurement row citing
   * it. NULL for a reference only the composite table points at: `pscomppars`
   * publishes no `pl_pubdate`, so there is no date to parse and none is
   * invented.
   *
   * SPELLED THE WAY `measurements` SPELLS IT, deliberately. A link between two
   * views carries a CLAUSE, and a clause names a field: the year bar can only
   * narrow the sheet because the column it emits on is a column the sheet's
   * table also has. Two honest names for one fact would have made that edge
   * undeclarable.
   */
  readonly pub_year: number | null;
  /** The archive's own `YYYY-MM`, or null for the same reason — and again the measurements table's own spelling. */
  readonly pl_pubdate: string | null;
  /** `measurements`, `composite`, or `both` — which of the two tables points at this reference. */
  readonly cited_in: 'measurements' | 'composite' | 'both';
  /** The typed-in gloss for an archive-internal key (`./names.ts`), or null — never the key echoed back. */
  readonly note: string | null;
  readonly [k: string]: string | number | null;
}

/** Cells by state, per figure and per table — the honest counts, never a summary that hides a silence. */
export interface ExoCounts {
  readonly measurements: number;
  readonly planets: number;
  readonly references: number;
  readonly publications: number;
  readonly archiveSources: number;
  /** Radius cells of `measurements`, by state. */
  readonly measurementRadius: Readonly<Record<Absence, number>>;
  readonly measurementMass: Readonly<Record<Absence, number>>;
  /** Radius cells of the COMPOSITE, by state. */
  readonly compositeRadius: Readonly<Record<Absence, number>>;
  readonly compositeMass: Readonly<Record<Absence, number>>;
  /** Composite radii whose reference is the archive itself rather than a paper. */
  readonly calculatedRadii: number;
  readonly calculatedMasses: number;
  /** Planets with no row the archive marks as their default solution. */
  readonly planetsWithoutDefault: number;
  readonly planetsWithOneMeasurement: number;
  readonly mostMeasurementsForOnePlanet: number;
  /** How many references the archive spells with more than one anchor string — the reason `ref` is the key. */
  readonly referencesWithSeveralAnchors: number;
  /** `pl_bmassprov` words on the composite, counted — `M-R relationship` is a model, not a measurement. */
  readonly compositeMassKinds: Readonly<Record<string, number>>;
}

export interface ExoTables {
  readonly measurements: readonly MeasurementRow[];
  readonly planets: readonly PlanetRow[];
  readonly references: readonly ReferenceRow[];
  readonly counts: ExoCounts;
}

// ── the parse ────────────────────────────────────────────────────────────────

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : String(v ?? ''));
const textOrNull = (v: unknown): string | null => {
  const s = text(v);
  return s === '' ? null : s;
};
const zeroed = (): Record<Absence, number> => ({ present: 0, limit: 0, 'not-measured': 0, unknown: 0 });

/** `2008-01` → 2008. Null when the archive published no date, never a guess at one. */
export function yearOf(pubdate: unknown): number | null {
  const s = text(pubdate);
  const m = /^(\d{4})/.exec(s);
  return m === null ? null : Number(m[1]);
}

/** Parse both committed CSVs into the three tables. */
export function exoTables(psCsv: string, pscompparsCsv: string): ExoTables {
  return exoTablesFromRows(parseCSVTyped(psCsv).rows, parseCSVTyped(pscompparsCsv).rows);
}

/** The same ETL over rows a source adapter already decoded (the data-source layer's `format: 'csv'`). */
export function exoTablesFromRows(ps: readonly Record<string, unknown>[], pscomppars: readonly Record<string, unknown>[]): ExoTables {
  const refs = new Map<string, ReferenceRow>();
  const anchorsByRef = new Map<string, Set<string>>();
  const measurements = measurementRows(ps, refs, anchorsByRef);
  const planets = planetRows(pscomppars, refs);
  const references = [...refs.values()].sort((a, b) => (a.ref < b.ref ? -1 : 1));
  return { measurements, planets, references, counts: countsOf(measurements, planets, references, anchorsByRef) };
}

/**
 * Note one reference, keyed by the archive's own key.
 *
 * The FIRST spelling wins for the label and the link: the archive publishes
 * several anchors for some keys, and picking the first in file order makes the
 * table a function of the committed bytes rather than of a sort nobody declared.
 * `cited_in` grows to `both` when the other table turns out to point at it too.
 */
function noteReference(refs: Map<string, ReferenceRow>, anchor: unknown, where: 'measurements' | 'composite', pubdate: string | null): { readonly ref: string; readonly label: string; readonly kind: ReferenceKind } | null {
  const parsed = parseReference(anchor);
  if (parsed === null) return null;
  const { refstr, label, href } = parsed;
  const kind = referenceKindOf(href);
  const seen = refs.get(refstr);
  if (seen === undefined) {
    refs.set(refstr, { ref: refstr, label, href, kind, pub_year: yearOf(pubdate), pl_pubdate: pubdate, cited_in: where, note: archiveNoteFor(refstr) });
  } else if (seen.cited_in !== where && seen.cited_in !== 'both') {
    refs.set(refstr, { ...seen, cited_in: 'both' });
  }
  return { ref: refstr, label, kind };
}

/** `ps` → one row per published measurement, with the ids minted per planet in file order. */
function measurementRows(ps: readonly Record<string, unknown>[], refs: Map<string, ReferenceRow>, anchorsByRef: Map<string, Set<string>>): readonly MeasurementRow[] {
  const seenPerPlanet = new Map<string, number>();
  const out: MeasurementRow[] = [];
  for (const r of ps) {
    const planet = text(r[PS_COLUMNS.planet]);
    const index = seenPerPlanet.get(planet) ?? 0;
    seenPerPlanet.set(planet, index + 1);
    const anchor = text(r[PS_COLUMNS.reference]);
    const pubdate = text(r[PS_COLUMNS.pubdate]);
    const reference = noteReference(refs, anchor, 'measurements', pubdate === '' ? null : pubdate);
    if (reference !== null) {
      const anchors = anchorsByRef.get(reference.ref) ?? new Set<string>();
      anchors.add(anchor);
      anchorsByRef.set(reference.ref, anchors);
    }
    const radius = figureOf(r[PS_COLUMNS.radius], r[PS_COLUMNS.radiusLimit]);
    const mass = figureOf(r[PS_COLUMNS.mass], r[PS_COLUMNS.massLimit]);
    out.push({
      measurement_id: `${planet}${MEASUREMENT_ID_MARKER}${String(index)}`,
      pl_name: planet,
      hostname: text(r[PS_COLUMNS.host]),
      // an unparseable anchor keeps the empty key rather than a minted one: a reference
      // nobody can name is not a reference this table may invent (never seen in the slice)
      ref: reference?.ref ?? '',
      ref_label: reference?.label ?? '',
      pl_refname: anchor,
      pl_pubdate: pubdate,
      pub_year: yearOf(pubdate),
      default_flag: numberOrNull(r[PS_COLUMNS.defaultFlag]),
      pl_orbper: numberOrNull(r[PS_COLUMNS.period]),
      pl_rade: radius.value,
      pl_radeerr1: numberOrNull(r[PS_COLUMNS.radiusErrUpper]),
      pl_radeerr2: numberOrNull(r[PS_COLUMNS.radiusErrLower]),
      radius_state: radius.state,
      radius_bound: radius.bound,
      pl_bmasse: mass.value,
      pl_bmasseerr1: numberOrNull(r[PS_COLUMNS.massErrUpper]),
      pl_bmasseerr2: numberOrNull(r[PS_COLUMNS.massErrLower]),
      mass_state: mass.state,
      mass_bound: mass.bound,
      mass_kind: textOrNull(r[PS_COLUMNS.massKind]),
      disc_year: numberOrNull(r[PS_COLUMNS.discoveryYear]),
      discoverymethod: text(r[PS_COLUMNS.discoveryMethod]),
      sy_dist: numberOrNull(r[PS_COLUMNS.distance]),
    });
  }
  return out;
}

/** `pscomppars` → one row per planet, each parameter carrying which reference it came from. */
function planetRows(pscomppars: readonly Record<string, unknown>[], refs: Map<string, ReferenceRow>): readonly PlanetRow[] {
  return pscomppars.map((r) => {
    const radius = figureOf(r[PSCOMPPARS_COLUMNS.radius], r[PSCOMPPARS_COLUMNS.radiusLimit]);
    const mass = figureOf(r[PSCOMPPARS_COLUMNS.mass], r[PSCOMPPARS_COLUMNS.massLimit]);
    // the composite publishes no date of its own, so every reference it introduces has a null year
    const radiusRef = noteReference(refs, r[PSCOMPPARS_COLUMNS.radiusRef], 'composite', null);
    const massRef = noteReference(refs, r[PSCOMPPARS_COLUMNS.massRef], 'composite', null);
    const periodRef = noteReference(refs, r[PSCOMPPARS_COLUMNS.periodRef], 'composite', null);
    const discRef = noteReference(refs, r[PSCOMPPARS_COLUMNS.discoveryRef], 'composite', null);
    return {
      pl_name: text(r[PSCOMPPARS_COLUMNS.planet]),
      hostname: text(r[PSCOMPPARS_COLUMNS.host]),
      pl_letter: text(r[PSCOMPPARS_COLUMNS.letter]),
      sy_pnum: numberOrNull(r[PSCOMPPARS_COLUMNS.planetsInSystem]),
      pl_orbper: numberOrNull(r[PSCOMPPARS_COLUMNS.period]),
      pl_rade: radius.value,
      radius_state: radius.state,
      radius_bound: radius.bound,
      pl_bmasse: mass.value,
      mass_state: mass.state,
      mass_bound: mass.bound,
      mass_kind: textOrNull(r[PSCOMPPARS_COLUMNS.massKind]),
      radius_ref: radiusRef?.ref ?? null,
      radius_ref_kind: radiusRef?.kind ?? null,
      mass_ref: massRef?.ref ?? null,
      mass_ref_kind: massRef?.kind ?? null,
      period_ref: periodRef?.ref ?? null,
      period_ref_kind: periodRef?.kind ?? null,
      disc_year: numberOrNull(r[PSCOMPPARS_COLUMNS.discoveryYear]),
      discoverymethod: text(r[PSCOMPPARS_COLUMNS.discoveryMethod]),
      disc_ref: discRef?.ref ?? null,
      sy_dist: numberOrNull(r[PSCOMPPARS_COLUMNS.distance]),
    };
  });
}

/** The counts the provenance carries — what the slice PARSES TO, never the cut's opinion of it. */
function countsOf(
  measurements: readonly MeasurementRow[],
  planets: readonly PlanetRow[],
  references: readonly ReferenceRow[],
  anchorsByRef: ReadonlyMap<string, ReadonlySet<string>>,
): ExoCounts {
  const measurementRadius = zeroed();
  const measurementMass = zeroed();
  const perPlanet = new Map<string, number>();
  const withDefault = new Set<string>();
  for (const m of measurements) {
    measurementRadius[m.radius_state] += 1;
    measurementMass[m.mass_state] += 1;
    perPlanet.set(m.pl_name, (perPlanet.get(m.pl_name) ?? 0) + 1);
    if (m.default_flag === 1) withDefault.add(m.pl_name);
  }
  const compositeRadius = zeroed();
  const compositeMass = zeroed();
  const compositeMassKinds: Record<string, number> = {};
  let calculatedRadii = 0;
  let calculatedMasses = 0;
  for (const p of planets) {
    compositeRadius[p.radius_state] += 1;
    compositeMass[p.mass_state] += 1;
    if (p.radius_ref_kind === 'archive') calculatedRadii += 1;
    if (p.mass_ref_kind === 'archive') calculatedMasses += 1;
    const kind = p.mass_kind ?? 'none';
    compositeMassKinds[kind] = (compositeMassKinds[kind] ?? 0) + 1;
  }
  const counts = [...perPlanet.values()];
  return {
    measurements: measurements.length,
    planets: planets.length,
    references: references.length,
    publications: references.filter((r) => r.kind === 'publication').length,
    archiveSources: references.filter((r) => r.kind === 'archive').length,
    measurementRadius,
    measurementMass,
    compositeRadius,
    compositeMass,
    calculatedRadii,
    calculatedMasses,
    planetsWithoutDefault: planets.length - withDefault.size,
    planetsWithOneMeasurement: counts.filter((n) => n === 1).length,
    mostMeasurementsForOnePlanet: counts.reduce((a, b) => Math.max(a, b), 0),
    referencesWithSeveralAnchors: [...anchorsByRef.values()].filter((set) => set.size > 1).length,
    compositeMassKinds,
  };
}

/** The gloss for one mass-provenance word — re-exported so a caption need not know which module owns the words. */
export { massKindNoteFor };
