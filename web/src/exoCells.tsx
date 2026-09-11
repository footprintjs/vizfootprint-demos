/**
 * THE EXOPLANET DESK'S CELLS — three charts over the archive's three tables and
 * the one an act mints.
 *
 * The shell (`vizfootprint-studio/desk`) draws the band, the ✎, the ✕, the time
 * strip, the editor and the sheet; what is here is this demo's own:
 *
 *   `mass_radius`  the composite's accepted radius against its accepted mass,
 *                  one dot per planet, on LOGARITHMIC axes — the log–log
 *                  figure this field publishes. Which curve each axis is drawn
 *                  on is not decided here: the def declares it on the view's
 *                  frame (`SCATTER_FRAME`), the session projects that
 *                  declaration verbatim, and {@link transformOf} reads it off
 *                  the projection. There is no drawn window any more, and no
 *                  planet is filtered out for being too big.
 *   `spread`       a histogram of how many published radii each planet has,
 *                  over the table the aggregate act MINTED. Not over the data:
 *                  this cell cannot compute those rows and does not try. A bar
 *                  is CLICKABLE — an interval over the minted table's `radii` —
 *                  and before the act that mints that table has landed, the
 *                  library refuses the click in a sentence naming the act.
 *   `by_year`      references by publication year, off the reference table.
 *
 * ── The captions carry the silences ─────────────────────────────────────────
 * This data is quiet in ways a chart smooths over unless somebody says them out
 * loud, so each is COUNTED here, from the rows on screen, and printed under the
 * chart where it happens:
 *
 *   1. the accepted number came from NO paper — the archive calculated it
 *      (scatter caption, counted);
 *   2. the accepted mass is a MODEL from the radius (`M-R relationship`)
 *      (scatter caption);
 *   3. planets with no published radius are in no bar of the histogram at all
 *      (histogram caption, counted as the gap between the planets and the
 *      minted rows);
 *   4. a reference the composite cites that no confirmed measurement row does,
 *      and therefore has no year to be counted under (year caption);
 *   5. a dot plotted from a BOUND rather than a measurement — the composite's
 *      accepted radius or mass for that planet is only an upper or lower
 *      limit, and the scatter draws it at that number anyway because the
 *      encoding vocabulary has no way to mark a bound differently (scatter
 *      caption, counted from the same rows the dots come from — never a
 *      reason to leave the dot off, only a reason to say what it is);
 *   6. a planet a LOGARITHM cannot place — an accepted mass or radius of zero
 *      or below. The library's fold counts those as `ResolvedDomain.excluded`
 *      and the chart prints the count in the picture; the caption counts the
 *      same thing with the library's own `placeable` predicate, so the words
 *      and the marks can never disagree (scatter caption, counted).
 *
 * ── And one thing this file may NOT do ──────────────────────────────────────
 * Recompute the derived table. It arrives from the session, read once where no
 * clause could exist (`src/exo/session.ts` · `derivedRowsAt`), and the
 * histogram bins it here — binning is drawing, and `VizHistogram` takes ready
 * bins by contract. What it never does is fold `measurements` into counts of
 * its own: that fold is an ACT, it landed as a commit, and a second
 * implementation on screen would be the one nobody tested.
 */
import { useMemo, type ReactNode } from 'react';
import { VizBar, VizHistogram, VizScatter, keepPredicate, placeable, type ChartDomain, type HistogramBinDatum, type ScaleKind, type ScatterDatum, type SessionViewState } from 'vizfootprint-ui';
import type { DeskChart, DeskProjection, DeskSilence } from 'vizfootprint-studio/desk';
import { categoryCounts, emitIntent, judgedHere, pickedFrom, type Row } from './derive.js';
import { DISAGREES_COLUMN, SCATTER_ADDRESS, SCATTER_VIEW, SPREAD_ADDRESS, SPREAD_COLUMN, SPREAD_VIEW, BY_YEAR_VIEW } from '../../src/exo/def.js';

export { SCATTER_VIEW, SCATTER_ADDRESS, SPREAD_VIEW, SPREAD_ADDRESS, BY_YEAR_VIEW };

// ── the vocabulary's colours ─────────────────────────────────────────────────

/** The four absence words, kept apart by sight as well as by name. */
export const STATE_COLOR: Record<string, string> = { present: '#2f7d5b', limit: '#0b7285', 'not-measured': '#5f6f83', unknown: '#a83a3a' };
export const colorOfState = (s: string): string => STATE_COLOR[s] ?? '#888';

/** Where a number came from: a paper, or the archive itself. Two words, two colours, no third. */
export const colorOfProvenance = (kind: string | undefined): string => (kind === 'archive' ? '#b8681a' : kind === 'publication' ? '#4c6ef5' : '#888');

/** One steady colour per publication year, so a bar keeps its colour as the set changes. */
const YEAR_PALETTE = ['#4c6ef5', '#e8590c', '#2b8a3e', '#862e9c', '#c92a2a', '#0b7285', '#e67700', '#5f3dc4', '#087f5b', '#a61e4d', '#364fc7', '#d9480f'];
export const colorOfYear = (year: string | undefined): string => {
  if (year === undefined) return '#888';
  let h = 0;
  for (const c of year) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return YEAR_PALETTE[h % YEAR_PALETTE.length]!;
};

/** The cells the story figure is built from, in the order a reader meets them. */
export const EXO_STORY_FIGURE = [SCATTER_VIEW, SPREAD_VIEW, BY_YEAR_VIEW] as const;

// ── what the page hands in ───────────────────────────────────────────────────

export interface ExoDeskData {
  readonly measurements: readonly Row[];
  readonly planets: readonly Row[];
  readonly references: readonly Row[];
  /** The table the aggregate MINTED, with the two derived columns on it — from the session, never recomputed here. */
  readonly derived: readonly Row[];
  /** The sentence the session refused the derived window with, when it did. */
  readonly derivedRefused?: string | null;
  readonly absence: { readonly field: string; readonly states: readonly string[]; readonly note?: string };
}

// ── the silences: the host's own arithmetic, handed to the desk's panel ─────

/**
 * How much of each silence there is, and which planets carry it — over EVERY
 * measurement row regardless of the selection, because a silence is a fact
 * about the table and not about what is currently on screen.
 */
export function useExoSilences(data: ExoDeskData): readonly DeskSilence[] {
  const { measurements, absence } = data;
  return useMemo(
    () =>
      absence.states
        .filter((s) => s !== 'present')
        .map((state) => {
          const inState = measurements.filter((r) => r[absence.field] === state);
          const byPlanet = new Map<string, string[]>();
          for (const r of inState) {
            const who = String(r['pl_name']);
            byPlanet.set(who, [...(byPlanet.get(who) ?? []), String(r['ref_label'])]);
          }
          return { state, total: inState.length, areas: [...byPlanet.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 12) };
        }),
    [measurements, absence.states, absence.field],
  );
}

// ── the cells ────────────────────────────────────────────────────────────────

/** A coordinate is a coordinate only when it is a real number. */
const placed = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * WHICH CURVE A VIEW'S AXES ARE DRAWN ON — read off the session's projection of
 * the DEF's declared frame (`ViewView.frame`, projected verbatim), never a
 * constant written here.
 *
 * This is the whole reason the transform lives on the frame and not in a chart
 * prop somebody types: an axis's nature is a declaration, it travels with the
 * definition the session actually runs on, and a cell that decided it locally
 * would be a second owner of the picture. `ChartDomain.transform` is the
 * renderer's half of the same word, so what comes out of here goes straight in.
 *
 * Absent for a view that declares no frame (and on an older wire), which is the
 * linear axis every chart drew before the key existed.
 */
export function transformOf(state: Pick<SessionViewState, 'views'>, viewId: string): ChartDomain['transform'] {
  const frame = state.views.find((v) => v.viewId === viewId)?.frame;
  if (frame === undefined) return undefined;
  const curve = (channel: string): ScaleKind | undefined => frame[channel]?.transform;
  return { ...(curve('x') !== undefined ? { x: curve('x') } : {}), ...(curve('y') !== undefined ? { y: curve('y') } : {}) };
}
const num = (v: unknown, digits = 2): string => (typeof v === 'number' ? v.toFixed(digits) : '—');
const count = (n: number): string => n.toLocaleString('en-US');

/**
 * The bins of the histogram: one per distinct radius count, ascending.
 *
 * WHY one bin per value rather than a width: the column counts PUBLICATIONS,
 * and the whole numbers are the fact — a bin covering "3 to 5 papers" would
 * blur the difference between a planet measured three times and one measured
 * five, which is the difference the chart is about.
 */
export function radiiBins(derived: readonly Row[], keep: (row: Row) => boolean): readonly HistogramBinDatum[] {
  const counts = new Map<number, number>();
  for (const row of derived) {
    const radii = row['radii'];
    if (!placed(radii)) continue;
    if (!keep(row)) continue;
    counts.set(radii, (counts.get(radii) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([radii, planets]) => ({ x0: radii, x1: radii + 1, count: planets }));
}

/**
 * The cells, over the desk's projection.
 *
 * Called once, from the desk's own body, so the memos below are real hooks and
 * behave like hooks — which is the point: without them every fold re-runs on
 * every poll of a 20,598-row table.
 */
export function useExoCells(desk: DeskProjection, data: ExoDeskData): readonly DeskChart[] {
  const { measurements, planets, references, derived } = data;
  const { state, view, columns, shown } = desk;
  const selFor = desk.selFor;

  /** WHICH FIELD A CHART'S CHANNEL ENCODES — the session's answer, not a constant written here at build time. */
  const bound = (viewId: string, channel: string, fallback: string): string => desk.bound(viewId, channel, fallback);
  const massField = bound(SCATTER_VIEW, 'x', 'pl_bmasse');
  const radiusField = bound(SCATTER_VIEW, 'y', 'pl_rade');
  const yearField = bound(BY_YEAR_VIEW, 'category', 'pub_year');

  // the slices every fold below is keyed on: what is selected, what the links do with it, what was cleared
  const sel = [state.selections, state.links, state.cleared] as const;

  /** The axes the DEF declares for the scatter, read through the projection — see {@link transformOf}. */
  const scatterTransform = useMemo(() => transformOf(state, SCATTER_VIEW), [state]);

  /**
   * The dots: one per planet with BOTH numbers. EVERY one of them — there is no
   * window and nothing is filtered out for being too big, because the axes are
   * logarithmic and the whole population fits on them.
   *
   * They are handed to the chart WHOLE, including the ones a logarithm cannot
   * place: the chart is what counts those (the library's `excluded` law — the
   * picture is where a reader meets the number the marks are missing from), and
   * a cell that pre-filtered them would leave it counting zero.
   */
  const dots = useMemo<readonly ScatterDatum[]>(
    () =>
      planets.flatMap((p) => {
        const x = p[massField];
        const y = p[radiusField];
        if (!placed(x) || !placed(y)) return [];
        // the CATEGORY is where the accepted radius came from — a paper, or the archive itself
        return [{ id: String(p['pl_name']), x, y, category: String(p['radius_ref_kind'] ?? 'unknown'), row: p as Row }];
      }),
    [planets, massField, radiusField],
  );

  /**
   * SILENCE SIX: the dots the TRANSFORM cannot place — a mass or a radius of
   * zero or below, which no logarithm has an answer for.
   *
   * Counted with the library's own `placeable`, the same predicate the chart
   * draws by and the library's fold sets `ResolvedDomain.excluded` from, so the
   * caption and the note inside the picture can never report two numbers.
   */
  const unplottable = useMemo(
    () => dots.filter((d) => !placeable(scatterTransform?.x, d.x) || !placeable(scatterTransform?.y, d.y)).length,
    [dots, scatterTransform],
  );

  /** SILENCE ONE and TWO: how much of the composite came from no paper at all. */
  const assembled = useMemo(() => {
    const calculatedRadius = planets.filter((p) => p['radius_ref_kind'] === 'archive').length;
    const calculatedMass = planets.filter((p) => p['mass_ref_kind'] === 'archive').length;
    const modelled = planets.filter((p) => p['mass_kind'] === 'M-R relationship').length;
    // SILENCE FIVE: of the dots actually drawn, how many carry a BOUND rather than a
    // measurement — read off each dot's own row, never assumed from an axis
    const bounded = dots.filter((d) => (d.row as Row)['radius_state'] === 'limit' || (d.row as Row)['mass_state'] === 'limit').length;
    // a planet the composite accepts NO pair for: there is nothing to place, on any curve
    return { calculatedRadius, calculatedMass, modelled, unplaceable: planets.length - dots.length, bounded };
  }, [planets, dots]);

  /**
   * The histogram's bins, over the MINTED rows the session handed over.
   *
   * Keyed on the LAYER ADDRESS, not the view id: the bars select under
   * `spread~buckets` (that is the layer whose table they draw), so that is the
   * clause `keepPredicate` must exclude as its own. Reading it under the frame's
   * id would leave the histogram filtering itself.
   */
  const bins = useMemo(() => {
    // judgedHere: a clause naming a column these rows have not got filtered NOTHING at the
    // read door, so it must drop nothing here either (`../src/derive.ts` · judgedHere)
    const keep = keepPredicate(judgedHere(selFor(SPREAD_ADDRESS), derived));
    return radiiBins(derived, keep);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selFor reads the slices already listed
  }, [derived, ...sel]);

  /**
   * SILENCE THREE: the planets the histogram cannot show. The aggregate reads
   * only rows whose radius is a MEASUREMENT (`where radius_state is "present"`,
   * declared on the act), so a planet no paper published a radius for has no row
   * in the minted table — it is in no bar, and this is the number that says so.
   */
  const missing = planets.length - derived.length;

  /** How many of the drawn planets have publications that disagree at all — read off the DERIVED column, never recomputed. */
  const disagreeing = useMemo(() => derived.filter((r) => r[DISAGREES_COLUMN] === true).length, [derived]);
  const widest = useMemo(
    () =>
      derived.reduce<{ readonly planet: string; readonly spread: number } | null>((worst, row) => {
        const spread = row[SPREAD_COLUMN];
        if (!placed(spread)) return worst;
        return worst === null || spread > worst.spread ? { planet: String(row['pl_name']), spread } : worst;
      }, null),
    [derived],
  );

  /** References per year — one pass, whatever the number of bars. */
  const yearBars = useMemo(() => {
    const keep = keepPredicate(judgedHere(selFor(BY_YEAR_VIEW), references));
    return categoryCounts(references, yearField, keep);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selFor reads the slices already listed
  }, [references, yearField, ...sel]);

  /** SILENCE FOUR: a reference with no year — the composite cites it and no confirmed measurement row does, so no row carries its date. */
  const undated = useMemo(() => references.filter((r) => r[yearField] === null || r[yearField] === undefined).length, [references, yearField]);

  /** The planet a view is showing, read through the LINK GRAPH like every other consumer. */
  const planetFor = (viewId: string): string => pickedFrom(selFor(viewId), SCATTER_ADDRESS, 'pl_name', 'every planet in view');

  const emit = (viewId: string, verb: string) => (e: Parameters<typeof view.emit>[1]) => void view.emit(viewId, e, emitIntent(verb, e));
  const reencode = (v: string, c: string, f: string): void => void view.reencode(v, c, f);

  return [
    {
      id: SCATTER_VIEW,
      // the marks belong to the planets LAYER, so the desk's ✕ and its clear follow
      // that address and not the frame's id
      clauseId: SCATTER_ADDRESS,
      weight: 5,
      caption: (
        <>
          {[
            `${count(dots.length)} of ${count(planets.length)} planets, at the radius and mass the archive's composite ACCEPTS for them`,
            // the axes' NATURE, said in words: an axis ticked 1, 10, 100 is read as linear by anyone skimming it
            `BOTH AXES ARE LOGARITHMIC (base 10, ticked at the powers of ten) — mass against radius is the log–log figure this field publishes, and it is declared on the view's frame, not chosen here`,
            // SILENCE SIX: what the transform cannot place, counted with the library's own predicate.
            // Said in BOTH directions on purpose: a logarithm has no place for zero or a negative
            // number, and "none of these is one" is a fact a reader of a log axis needs as much as a
            // count would be. (When it is not none, the chart prints the same number in the picture,
            // because that is where the marks are missing from.)
            unplottable === 0
              ? 'and every one of them is placeable on that curve: no planet here has an accepted mass or radius of zero or below, the two things a logarithm cannot place, so nothing is left out of this picture'
              : `${count(unplottable)} of those planets are NOT drawn: a logarithm has no place for an accepted mass or radius of zero or below, so the library folds the domain over the positive values and counts the rest — the number is printed in the picture too, because that is where the marks are missing from`,
            assembled.unplaceable === 0 ? null : `${count(assembled.unplaceable)} have no accepted mass-and-radius pair to place at all`,
            // SILENCE ONE, where it happens
            `the accepted numbers are an ASSEMBLY, not a publication: ${count(assembled.calculatedRadius)} of the radii and ${count(assembled.calculatedMass)} of the masses came from the archive itself rather than from a paper (orange), and the archive's own reflink columns say so`,
            // SILENCE TWO
            `${count(assembled.modelled)} of the accepted masses are computed from the radius by a mass–radius relation — a model, not a measurement of a mass`,
            // SILENCE FIVE: a dot plotted from a bound, not a measurement — said here because nothing on
            // the chart itself marks the difference (no second shape, no second colour channel to spend)
            assembled.bounded === 0 ? null : `${count(assembled.bounded)} of these dots are plotted from a BOUND rather than a measurement — the accepted radius or mass for that planet is only an upper or lower limit, and this chart has no way to mark that differently`,
            `click a planet to fill the sheet with every value ever published for it (showing: ${planetFor(SCATTER_VIEW)})`,
          ]
            .filter((s): s is string => s !== null)
            .join(' · ')}
          {desk.words(SCATTER_VIEW)}
        </>
      ),
      render: ({ width, height }: { width: number; height: number }): ReactNode => (
        <VizScatter
          viewId={SCATTER_VIEW}
          data={dots}
          xField={massField}
          yField={radiusField}
          xLabel="accepted mass (Earth masses, log scale)"
          yLabel="accepted radius (Earth radii, log scale)"
          // the DEF's declaration, through the session's projection — this cell decides no curve
          domain={{ ...(scatterTransform !== undefined ? { transform: scatterTransform } : {}) }}
          colorOf={colorOfProvenance}
          ariaLabel={desk.altShort(SCATTER_VIEW)}
          selection={judgedHere(selFor(SCATTER_ADDRESS), planets)}
          columns={columns}
          fits={desk.fitsOf(SCATTER_VIEW)}
          encoding={shown[SCATTER_VIEW] ?? {}}
          width={width}
          height={height}
          onEmit={emit(SCATTER_ADDRESS, 'select')}
          onReencode={reencode}
        />
      ),
    },
    {
      id: SPREAD_VIEW,
      // the bars belong to the BUCKETS layer, whose table the aggregate mints — the desk's ✕
      // and its clear follow that address, and so does the probe door's refusal sentence
      clauseId: SPREAD_ADDRESS,
      weight: 4,
      caption: (
        <>
          {derived.length === 0
            ? (data.derivedRefused ?? 'the aggregate act has not landed on this session — there is no table behind this picture yet')
            : [
                `${count(derived.length)} planets have at least one PUBLISHED radius; each bar counts the planets with the same number of them`,
                // SILENCE THREE, where it happens
                missing <= 0 ? null : `the other ${count(missing)} planets are in NO bar: the act that cut this table reads only rows whose radius is a measurement (a bound is not one), so a planet no paper published a radius for has no row here at all`,
                `${count(disagreeing)} of the ${count(derived.length)} disagree with themselves — two publications, two different radii${widest === null ? '' : `; the widest is ${widest.planet}, whose published radii span ${num(widest.spread)} Earth radii`}`,
                'this table is not in the data: an aggregate act cut it at run time and two derive acts wrote its spread and its disagreement, all three on the log with their causes',
                // THE VOICE, and its one honest limit
                'click a bar to select those planets — the act lands on the log with its cause. Click it again to clear it. Before the aggregate act has landed there is no table under this picture, and the library refuses the same click in a sentence that names the act which mints it',
                // WHAT THE DEMO KNOWS AND THE LIBRARY CANNOT. This dashboard declares no edge out of
                // the histogram, so the crossfilter default sends the bucket to every other view — which
                // is right, because a bucket IS a set of planets and the rest of this dashboard is about
                // planets. The one thing that cannot travel is the COLUMN the bucket is phrased in. Why
                // that is not a broken read is the library's own sentence, printed under the sheet's rows
                // where a reader meets the rows it did not filter; nothing here restates it.
                'a bucket is a set of PLANETS, and the other charts and the sheet are about planets too — so this selection reaching them is expected, not broken. What cannot travel is the column it is phrased in: `radii` is a column of the minted table and of nothing else, and the sheet prints the library\u2019s own sentence for that under its rows',
              ]
                .filter((s): s is string => s !== null)
                .join(' · ')}
          {desk.words(SPREAD_VIEW)}
        </>
      ),
      render: ({ width, height }) =>
        derived.length === 0 ? (
          <div role="status" style={{ padding: 12, opacity: 0.7 }}>
            {data.derivedRefused ?? 'no act has landed on this session, so the table this histogram draws does not exist yet'}
          </div>
        ) : (
          <VizHistogram
            viewId={SPREAD_ADDRESS}
            data={bins}
            field="radii"
            label="published radii per planet"
            countLabel="planets"
            ariaLabel={desk.altShort(SPREAD_VIEW)}
            selection={judgedHere(selFor(SPREAD_ADDRESS), derived)}
            width={width}
            height={height}
            // an INTERVAL over the minted table's `radii` — the pair of bin edges the bar covers,
            // which is what a bucket honestly is. It lands under the layer's address, so the probe
            // door judges it against the MINTED table (and refuses it, by name, before the act)
            onEmit={emit(SPREAD_ADDRESS, 'filter')}
          />
        ),
    },
    {
      id: BY_YEAR_VIEW,
      weight: 3,
      caption: (
        <>
          {[
            `${count(references.length)} references, one bar per ${yearField} — the papers and the four archive-internal sources both other tables point at`,
            // SILENCE FOUR, where it happens
            undated === 0 ? null : `${count(undated)} carry no year: the composite cites them and no confirmed measurement row does, and the composite publishes no date — so there is nothing to parse and nothing is invented`,
            'pick a year to keep only the publications the archive dates to it',
          ]
            .filter((s): s is string => s !== null)
            .join(' · ')}
          {desk.words(BY_YEAR_VIEW)}
        </>
      ),
      render: ({ width, height }) => (
        <VizBar
          viewId={BY_YEAR_VIEW}
          data={yearBars}
          field={yearField}
          colorOf={colorOfYear}
          selection={judgedHere(selFor(BY_YEAR_VIEW), references)}
          columns={columns}
          fits={desk.fitsOf(BY_YEAR_VIEW)}
          encoding={shown[BY_YEAR_VIEW] ?? {}}
          width={width}
          height={height}
          onEmit={emit(BY_YEAR_VIEW, 'select')}
          onReencode={reencode}
        />
      ),
    },
  ];
}
