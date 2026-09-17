/**
 * THE PROTEIN DESK, COMPOSED FROM THE PIECES — one page's departure from the
 * packaged desk, and the only one in this repository.
 *
 * ── WHY NOT `vizfootprint-studio/desk` ─────────────────────────────────────
 * The other three demos wear the packaged `Desk`, and should: it is a whole
 * provenance cockpit for one line of wiring. This page is TOOL-DRIVEN UI — a
 * search box, a numbered stage stepper across the top, the dashboard centred
 * with the stage in action focused — and that layout cannot be expressed inside
 * a desk whose top strip is the time bar and whose arrangement comes from the
 * session's own layout fold. So this page composes the PARTS a desk is made of,
 * every one of them the library's own:
 *
 *   `ChartFrame`       measure a cell and let the chart fill it
 *   `SelectionChips`   what is selected, and the way to clear it
 *   `SavedSelections`  the named pictures, applied by their id
 *   `CommitLog`        every commit, each one a seek
 *   `GapsPanel`        every unmet request, typed and never dropped
 *   `Sheet`            the residues table at the cursor
 *   `ProseText`        the dashboard's own summary, with its refs live
 *
 * and this page's own two: `./protStepper.tsx` (the stepper) and
 * `./protProjection.tsx` (the `DeskProjection` the cells read).
 *
 * ── TWO DISCIPLINES, kept ──────────────────────────────────────────────────
 *   1. **ONE session view.** Every piece here reads the `SessionView` the page
 *      made — the stepper, the chips, the log, the sheet, the cells and the rows
 *      at the cursor. A second source of truth is how a desk starts lying.
 *   2. **NOTHING IS DROPPED SILENTLY.** The packaged desk shows a reader more
 *      than this page does, and {@link NotHere} names every piece of it in the
 *      page's own words — including the one the author deferred on purpose (the
 *      fine time cursor) and the honest consequence of deferring it.
 *
 * ── THE FOCUS IS DERIVED, never hand-wired ─────────────────────────────────
 * When the cursor sits at a stage, the charts THAT STAGE PRODUCED are the focus
 * and the rest recede. That set is an intersection of two things the session
 * already carries — what the stage's acts landed and what each view binds — and
 * `./protStages.ts` · `chartsOfStage` computes it. The one link that cannot be
 * computed is declared beside the view it is about (`src/prot/def.ts` ·
 * `PROT_RECEIPTS`), with the reason.
 */
import { useMemo, type ReactNode } from 'react';
import {
  ChartFrame,
  CommitLog,
  GapsPanel,
  ProseText,
  SavedSelections,
  SelectionChips,
  Sheet,
  VizPanel,
  sessionSheetData,
  themeAttr,
  themeStyle,
  useSessionView,
  type SessionView,
  type SheetSessionLike,
} from 'vizfootprint-ui';
import type { ActOutcome, ProtRun } from '../../src/prot/orchestrator.js';
import { useProtCells, type ProtDeskData } from './protCells.js';
import { useProtProjection } from './protProjection.js';
import { ProtStepper } from './protStepper.js';
import { chartsOfStage, stageAtCursor, stepperStages } from './protStages.js';

export interface ProtDeskProps {
  /** THE one session view — made by the page, read by every piece below. */
  readonly view: SessionView;
  /** Everything the cells draw from (`./protCells.tsx` · `ProtDeskData`). */
  readonly data: ProtDeskData;
  /** The finished run, or `null` while its stages are still dispatching. */
  readonly run: ProtRun | null;
  /** The acts that have come back so far, in dispatch order — the run's own once it has finished. */
  readonly outcomes: readonly ActOutcome[];
  /** The def's own data checks plus this surface's problems — shown, never counted and hidden. */
  readonly checks: readonly string[];
  /**
   * The session the SHEET reads — the same one the view is over, read
   * structurally (`vizfootprint-ui` · `SheetSessionLike`: three methods).
   *
   * The port is built HERE and memoised, rather than handed in as a factory: a
   * `SheetData` whose identity changed every render would empty the grid's own
   * block cache on every paint, and the page cannot memoise an inline arrow.
   */
  readonly session: SheetSessionLike;
  /** The table the sheet shows. */
  readonly table: string;
  /** Which commit the pictures are drawn at, in the page's own words — above the charts, where it is about them. */
  readonly rowsNote: ReactNode;
}

const PAPER = '#f7f8fa';
const RULE = '#dfe4ea';
const MUTED = '#5a6572';
const FONT = '12px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif';

/**
 * ONE CELL — the host's chart at its measured size, with its label, its ✕ and
 * its caption.
 *
 * `data-chart` carries the cell's address, exactly as the packaged cockpit's
 * own cell does (`vizfootprint-ui` · `VizCockpit`): it is how a reader's
 * developer tools, and `tests/prot-cursor.smoke.test.ts`, name one picture
 * rather than the page.
 */
function Cell({
  id,
  label,
  height,
  focused,
  caption,
  live,
  onClear,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly height: number;
  readonly focused: boolean;
  readonly caption: ReactNode;
  readonly live: boolean;
  onClear(): void;
  readonly children: (size: { readonly width: number; readonly height: number }) => ReactNode;
}): JSX.Element {
  return (
    <section
      data-chart={id}
      data-focused={focused ? 'true' : undefined}
      aria-label={label}
      style={{
        border: `1px solid ${focused ? '#b9cfe3' : RULE}`,
        borderRadius: 10,
        background: '#fff',
        padding: '.5rem .6rem .6rem',
        boxShadow: focused ? '0 1px 6px rgba(20,48,80,.08)' : undefined,
        // a cell that is not the focus recedes rather than disappearing: it is
        // still the record, and a reader can still read it
        opacity: focused ? 1 : 0.86,
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr',
        minWidth: 0,
      }}
    >
      <header style={{ display: 'flex', gap: '.5rem', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h3 style={{ font: '600 12.5px/1.4 system-ui, sans-serif', margin: 0, color: '#20303f' }}>
          {label}
          {focused ? <span style={{ font: FONT, color: '#3d7fbf' }}> · the stage in action</span> : null}
        </h3>
        {/* THE ✕, and only when there is a clause to clear: a pill that cleared
            nothing would be a control about nothing */}
        {live ? (
          <button type="button" onClick={onClear} aria-label={`clear the ${label} selection`} style={{ font: FONT, background: '#fff', border: `1px solid ${RULE}`, borderRadius: 999, padding: '0 .45rem', cursor: 'pointer', color: MUTED }}>
            ✕ clear
          </button>
        ) : null}
      </header>
      {/*
        A FLEX COLUMN, and it has to be: `.vzf-chart-frame` is styled
        `flex: 1; min-height: 0`, so it fills a flex parent and collapses to
        nothing inside a block one — and a frame of zero height measures zero,
        renders nothing and never grows, because what would have grown it is the
        chart it is not drawing. The explicit height is this page's; the frame
        measures it and hands the chart a viewBox that matches the CSS box 1:1.
      */}
      <div style={{ display: 'flex', flexDirection: 'column', height, minWidth: 0 }}>
        <ChartFrame>{(size) => children(size)}</ChartFrame>
      </div>
      <p style={{ font: '11.5px/1.45 system-ui, sans-serif', color: MUTED, margin: '.4rem 0 0' }}>{caption}</p>
    </section>
  );
}

/**
 * WHAT THE PACKAGED DESK SHOWS AND THIS PAGE DOES NOT — named, because an
 * omission nobody announced is a lie by arrangement.
 *
 * The fine time cursor is first because it is the one a reader will look for:
 * the author deferred it on purpose, and the honest consequence of deferring it
 * is the second sentence — a reader's own gestures land on this record exactly
 * as the stages' acts did, and this page offers no way to step through them.
 */
function NotHere(): JSX.Element {
  return (
    <details style={{ font: FONT, color: '#4a5462', background: '#fffbe9', border: '1px solid #e8dfae', borderRadius: 8, padding: '.55rem .8rem', margin: '.6rem 0 0' }}>
      <summary style={{ cursor: 'pointer' }}>
        <b>What the other three desks show and this page does not</b> — seven things it does without, each one named rather than quietly missing, and one it adds
      </summary>
      <ul style={{ margin: '.4rem 0 0', paddingLeft: '1.1rem' }}>
        <li>
          <b>The fine time cursor.</b> The library ships a time strip — a bar of every commit, with step-back, step-forward, a jump box and a &ldquo;return to now&rdquo;. It is deliberately not on this page: the stepper is the STAGES&rsquo; cursor and the fine one is
          deferred. <b>The consequence, said plainly:</b> every gesture a reader makes here — a residue clicked in 3D, a drag across an axis — lands a real commit on this same record, and this page offers no way to step through those. They are on the
          commit log below, and a click there seeks to one; what is missing is the strip that walks them one at a time.
        </li>
        <li>
          <b>Named paths.</b> Acting from a past cursor FORKS the log, the packaged desk names the new path the moment it is born and offers the way back, and this page draws no path list at all. So a reader who selects something while standing at an
          earlier stage is on a new line of work with nothing on screen saying so — the one omission here that can surprise somebody, which is why it is second.
        </li>
        <li>
          <b>Bookmarks and Present mode.</b> No way to name a beat and no slideshow over the named ones.
        </li>
        <li>
          <b>The chart editor drawer.</b> The ✎ and its panel are not here. Re-encoding still works, because the affordance rides the chart: click an axis label and the encoding picker opens on the chart itself, greyed with the library&rsquo;s own reasons.
        </li>
        <li>
          <b>The Text tool.</b> No notes on the dashboard, so no words of a reader&rsquo;s own with links into the record.
        </li>
        <li>
          <b>The Story tab.</b> No scroll-lens post built from the bookmarks.
        </li>
        <li>
          <b>The Data tab&rsquo;s acts.</b> The sheet below is READ-ONLY here: no add-a-column, no cut-an-aggregate, no export, and no arrangement acts (sort, hide, reorder, freeze) — which on the packaged desk are real
          commits that travel with the cursor. The Sources tab and its refresh are missing too, as they are on every static build: these bytes are what the repository committed.
        </li>
        <li>
          <b>And one thing this page shows that the packaged desk does not:</b> the GAPS panel — every request the session refused, typed and in its own words, including the two gestures this desk makes at its own unlanded charts before the stages run.
        </li>
      </ul>
    </details>
  );
}

/** The whole desk. See the file header for what it is composed of and what it deliberately is not. */
export function ProtDesk({ view, data, run, outcomes, checks, session, table, rowsNote }: ProtDeskProps): JSX.Element {
  const state = useSessionView(view);
  /** The sheet's port, built once per session and table — see {@link ProtDeskProps.session}. */
  const sheetPort = useMemo(() => sessionSheetData(session, { table }), [session, table]);
  const { desk, notice } = useProtProjection(view, state);
  // Called ONCE, unconditionally, from this body — the rule `vizfootprint-studio/desk`
  // · `DeskCharts` states, and the reason the cells may use hooks inside it.
  const cells = useProtCells(desk, data);

  const stages = useMemo(() => stepperStages(outcomes, run), [outcomes, run]);
  /** Where the cursor is standing, in stages — the last stage that had landed by then. */
  const here = stageAtCursor(stages, state.activePathIds, state.cursor);
  /** WHICH PICTURES THAT STAGE PRODUCED — derived (see the file header). */
  const focus = useMemo(() => new Set(here === null ? [] : chartsOfStage(here, desk.shown)), [here, desk.shown]);

  /** Which views hold a LIVE clause — what the ✕ on a cell is about. `cleared` is `null`, whatever the kind. */
  const liveViews = useMemo(() => new Set(state.selections.filter((s) => s.value !== null).map((s) => s.viewId)), [state.selections]);

  const hero = cells.filter((c) => focus.has(c.clauseId ?? c.id) || focus.has(c.id));
  const rest = cells.filter((c) => !hero.includes(c));
  const summary = state.dashboard?.prose.find((p) => p.slot === 'caption');

  const cell = (c: (typeof cells)[number], height: number, focused: boolean): JSX.Element => (
    <Cell
      key={c.id}
      id={c.id}
      label={desk.label(c.id)}
      height={height}
      focused={focused}
      caption={c.caption}
      live={liveViews.has(c.clauseId ?? c.id)}
      onClear={() => void view.clear(c.clauseId ?? c.id, `clear ${desk.label(c.id)}`)}
    >
      {(size) => c.render(size)}
    </Cell>
  );

  return (
    <div className="vzf" data-theme={themeAttr(undefined)} style={{ ...(themeStyle(undefined) as React.CSSProperties), background: PAPER, font: FONT, color: '#20303f' }}>
      {/* THE STEPPER IS THE CURSOR — the control the whole page turns on */}
      <ProtStepper
        stages={stages}
        run={run}
        here={here}
        // THE SEEK, and its answer handed straight back for the stepper to
        // print. It is not ALSO kept here: the stepper already shows a refused
        // seek in the session's own words beside the control that asked for it,
        // and the same sentence in two places reads as two refusals.
        onSeek={async (commitId) => {
          const answered = await view.seek(commitId);
          return answered.ok ? null : answered.sentence;
        }}
      />

      {/* what is selected, and the named pictures — the library's own two pieces */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.6rem', alignItems: 'baseline', margin: '.7rem 0 0' }}>
        <SelectionChips
          selections={state.selections}
          cleared={state.cleared}
          links={state.links}
          labels={Object.fromEntries(state.views.map((v) => [v.viewId, desk.label(v.viewId)]))}
          onClear={(id) => void view.clear(id, `clear ${desk.label(id)}`)}
          // NOT point-free: the chip strip wires this straight to a DOM handler,
          // and a bare `view.clearAll` would receive the click EVENT as the
          // commit's own words.
          onClearAll={() => void view.clearAll()}
          onSetPolarity={(id, exclude) => void view.setPolarity(id, exclude, `${exclude ? 'exclude' : 'keep'} the ${desk.label(id)} selection`)}
          onSave={(id) => {
            const name = window.prompt(`Save the ${desk.label(id)} selection as…`);
            if (name !== null && name.trim() !== '') desk.savePicture(name.trim(), { viewId: id });
          }}
        />
        <SavedSelections saved={state.saved} selections={state.selections} labels={Object.fromEntries(state.views.map((v) => [v.viewId, desk.label(v.viewId)]))} onApply={desk.applyPicture} />
      </div>

      {/* the dashboard's own summary, at the cursor, with its refs still live */}
      {summary === undefined ? null : (
        <p style={{ margin: '.5rem 0 0', color: MUTED }}>
          <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 10.5, opacity: 0.6, marginRight: 4 }}>summary</span>{' '}
          <ProseText text={summary.text} refs={summary.refs} onSeek={(id) => void view.seek(id)} onBookmark={desk.seekBookmark} describeCommit={desk.describeCommit} />
        </p>
      )}

      {/* the page's own refusals — the projection's acts, in the words they came back in */}
      {notice === null ? null : (
        <p role="alert" style={{ margin: '.5rem 0 0', color: '#8a2b2b' }}>
          ⚠ {notice}
        </p>
      )}

      {rowsNote}

      {/* WHICH PICTURES THE STAGE OWNS — said, so the arrangement is never a riddle */}
      <p style={{ margin: '.5rem 0 .3rem', color: MUTED }}>
        {here === null
          ? state.cursor === null
            ? 'the cursor is at the root of this log, so no stage has landed yet and nothing is singled out below'
            : 'the cursor is not on this desk’s active path, so this page cannot say which stage you are standing in — it draws no branch map, and guessing would be worse than saying so'
          : hero.length === 0
            ? `the cursor is standing in the “${here.label}” stage, and no chart on this desk is drawn from what it landed — so nothing is singled out below`
            : `the cursor is standing in the “${here.label}” stage, and the ${hero.length === 1 ? 'chart' : `${String(hero.length)} charts`} it produced ${hero.length === 1 ? 'is' : 'are'} the focus: ${hero
                .map((c) => desk.label(c.id))
                .join(', ')}. Which charts a stage owns is an INTERSECTION of the columns its acts landed with the columns each view binds — nobody typed that list.`}
      </p>

      {/*
        THE DASHBOARD, CENTRED, with the stage in action focused.

        The band that RECEDES is weighted, not equal: a cell declares its own
        `weight` (`./protCells.tsx` gives the 3D view 5 and the receipt 3) and
        that is the host saying how much room its picture needs. Spending it is
        what the library's own flow preset does with the same number; ignoring it
        would be this shell quietly overruling the cells.
      */}
      <div style={{ display: 'grid', gap: '.6rem', maxWidth: '84rem', margin: '0 auto' }}>
        {hero.length === 0 ? null : <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.6rem' }}>{hero.map((c) => <div key={c.id} style={{ flex: `${String(c.weight ?? 1)} 1 24rem`, minWidth: 0, display: 'grid' }}>{cell(c, 420, true)}</div>)}</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.6rem' }}>
          {rest.map((c) => (
            <div key={c.id} style={{ flex: `${String(c.weight ?? 1)} 1 19rem`, minWidth: 0, display: 'grid' }}>
              {cell(c, hero.length === 0 ? 340 : 260, false)}
            </div>
          ))}
        </div>
      </div>

      {/* THE RECORD, in the library's own panels */}
      <div style={{ display: 'grid', gap: '.6rem', gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))', maxWidth: '84rem', margin: '.8rem auto 0' }}>
        <VizPanel title={`Commit log (${state.commits.length.toLocaleString('en-US')})`} collapsible defaultCollapsed>
          <CommitLog commits={state.commits} onSeek={(id) => void view.seek(id)} />
        </VizPanel>
        <VizPanel title={`Every request the session refused (${state.gaps.length.toLocaleString('en-US')})`} collapsible defaultCollapsed>
          <GapsPanel gaps={state.gaps} heading={false} />
        </VizPanel>
        <VizPanel title={`What the data checks said (${checks.length.toLocaleString('en-US')})`} collapsible defaultCollapsed>
          {checks.length === 0 ? (
            <p style={{ margin: 0, color: MUTED }}>the definition&rsquo;s own checks and this surface&rsquo;s own found nothing to report on this entry</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', color: MUTED }}>
              {checks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          )}
        </VizPanel>
        <VizPanel title={`The ${table} table at the cursor`} collapsible defaultCollapsed>
          {/* READ-ONLY, and at the cursor: the version keys the grid's blocks, so a
              seek and a refresh both empty them rather than painting old rows */}
          <Sheet data={sheetPort} table={table} cursor={state.cursor} version={state.sources?.[table]?.version} height={320} />
        </VizPanel>
      </div>

      <div style={{ maxWidth: '84rem', margin: '0 auto' }}>
        <NotHere />
      </div>
    </div>
  );
}
