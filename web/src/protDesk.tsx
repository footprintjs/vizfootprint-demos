/**
 * THE PROTEIN WORKBENCH — the composition, and the only file that knows all
 * four layers exist.
 *
 * ── THE FOUR LAYERS, and the reason they are apart ─────────────────────────
 * The author's ruling for this desk: *design this space as theme separate,
 * components separate, business logic, data logic separate. Don't tangle these
 * — make it reusable.* So:
 *
 *   1. THEME       `./workbench/theme.css` + `./workbench/tokens.ts` — every
 *                  colour, radius, shadow and font family, once.
 *   2. COMPONENTS  `./workbench/Chrome.tsx`, `Stepper.tsx`, `StagePanel.tsx`,
 *                  `ChartCard.tsx`, `Search.tsx` — props in, markup out. None
 *                  of them imports the session, a hook that reads it, `fetch`,
 *                  or anything from `src/prot/`.
 *   3. BUSINESS    `./workbench/bands.ts`, `steps.ts`, `panel.ts`,
 *                  `charts.ts`, `results.ts`, and `./protStages.ts` which was
 *                  already this — pure functions from the run to the props.
 *   4. DATA        `./protRows.ts`, `./protProjection.tsx` and
 *                  `src/prot/session.ts` — the only code here that touches the
 *                  session.
 *
 * THIS file is the wiring 4 → 3 → 2, and nothing else. `tests/prot-layers.test.ts`
 * reads every module in `./workbench/` and fails if a component reaches the
 * data layer — because a component that takes only props can later move into
 * `vizfootprint-ui` and serve every desk, and one that reaches into a session
 * can never move.
 *
 * ── WHY NOT `vizfootprint-studio/desk` ─────────────────────────────────────
 * The other three demos wear the packaged `Desk`, and should: it is a whole
 * provenance cockpit for one line of wiring. This page is TOOL-DRIVEN UI — a
 * search box, a numbered stage stepper across the top, the dashboard centred
 * with the stage in action focused — and that layout cannot be expressed inside
 * a desk whose top strip is the time bar and whose arrangement comes from the
 * session's own layout fold. So this page composes the PARTS a desk is made of,
 * every one of them the library's own: `ChartFrame`, `SelectionChips`,
 * `SavedSelections`, `CommitLog`, `GapsPanel`, `Sheet`, `ProseText`.
 *
 * ── TWO DISCIPLINES, kept ──────────────────────────────────────────────────
 *   1. **ONE session view.** Every piece here reads the `SessionView` the page
 *      made. A second source of truth is how a desk starts lying.
 *   2. **NOTHING IS DROPPED SILENTLY.** The packaged desk shows a reader more
 *      than this page does, and {@link NotHere} names every piece of it in the
 *      page's own words.
 *
 * ── AND THE FOCUS IS DERIVED, never hand-wired ─────────────────────────────
 * When the cursor sits at a stage, the charts THAT STAGE PRODUCED are the hero
 * and the rest recede. That set is an intersection of two things the session
 * already carries — what the stage's acts landed and what each view binds — and
 * `./protStages.ts` · `chartsOfStage` computes it. The layout FOLLOWS it, so
 * moving the stepper moves the big card and no card is hard-coded as the big
 * one.
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
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
  useSessionView,
  type SessionView,
  type SheetSessionLike,
} from 'vizfootprint-ui';
import type { EntryCredit, ProtCounts } from '../../src/prot/etl.js';
import type { ActOutcome, ProtRun } from '../../src/prot/orchestrator.js';
import { STRUCTURE_VIEW } from '../../src/prot/def.js';
import { useProtCells, type ProtCell, type ProtDeskData } from './protCells.js';
import { useProtProjection } from './protProjection.js';
import { ActRow, RunNarrative } from './protTrace.js';
import { chartsOfStage, stageAtCursor, stepperStages, type StepperStage } from './protStages.js';
import { FactsStrip, WorkbenchHeader } from './workbench/Chrome.js';
import { ChartCard, ViewerBox } from './workbench/ChartCard.js';
import { StagePanel } from './workbench/StagePanel.js';
import { StageStepper } from './workbench/Stepper.js';
import { factsStrip, methodLine } from './workbench/bands.js';
import { chainChips, ownerLine, splitByFocus, stageOfChart } from './workbench/charts.js';
import { stagePanel } from './workbench/panel.js';
import { STEPPER_LABEL, stepViews, stepperNote } from './workbench/steps.js';
import { useWorkbenchInk } from './workbench/tokens.js';

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
  /** Which commit the pictures are drawn at, in the page's own words. */
  readonly rowsNote: ReactNode;
  /** The desk's own declared title (`src/prot/def.ts` · `PROT_WORDS`). */
  readonly title: string;
  /** The entry's credit, read out of its own header records — the header band's whole content. */
  readonly credit: EntryCredit;
  /** What the parse counted — the facts strip's residues and chains. */
  readonly counts: ProtCounts;
  /** The way back to the search. */
  onSearchAgain(): void;
}

/**
 * WHAT THE OTHER THREE DESKS SHOW AND THIS PAGE DOES NOT — named, because an
 * omission nobody announced is a lie by arrangement.
 */
function NotHere(): JSX.Element {
  return (
    <details style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--pw-mid-2)', background: 'var(--pw-glass-card)', border: '1px solid var(--pw-rule-button)', borderRadius: 'var(--pw-r-card)', padding: '.55rem .8rem', margin: '.6rem 0 0' }}>
      <summary style={{ cursor: 'pointer' }}>
        <b>What the other three desks show and this page does not</b> — seven things it does without, each one named rather than quietly missing, one it adds, and one request it makes
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
        <li>
          <b>And one request this page makes that the other three do not:</b> it asks <code>fonts.googleapis.com</code> for IBM Plex Sans, Serif and Mono. That is a THIRD-PARTY REQUEST from a page that otherwise makes none — every byte of data
          here is the repository&rsquo;s own — so it is named rather than made quietly. Each family carries a real fallback stack, so a blocked request changes the letters and nothing else.
        </li>
      </ul>
    </details>
  );
}

/**
 * WHAT ONE STAGE'S EXPANDER OPENS: the acts it really dispatched, and the
 * reason where there is one.
 *
 * Exported because two compositions need it — this desk and the page's
 * `reading` phase ({@link RunStepper}) — and because the stepper's test drives
 * the real detail rather than a stand-in for it.
 */
export function StageDetail({ stage, run, onSeek, say }: { readonly stage: StepperStage; readonly run: ProtRun | null; onSeek(commitId: string): Promise<string | null>; say(sentence: string | null): void }): JSX.Element {
  return (
    <section aria-label={`the acts of stage ${String(stage.number)}, ${stage.label}`} style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--pw-mid-2)' }}>
      {/* THE STATE'S OWN LINE, which the quiet stepper no longer prints under the mark */}
      <p style={{ margin: '0 0 .3rem' }}>{stage.subtitle}</p>
      {/* AND THE REASON, VERBATIM — a refusal's own sentence, or the measured reason this desk cannot perform the stage */}
      {stage.detail === null ? null : (
        <p style={{ margin: '0 0 .3rem', color: stage.state === 'refused' ? 'var(--pw-refuse-ink)' : 'var(--pw-mid-2)' }}>{stage.detail}</p>
      )}
      <p style={{ margin: '0 0 .3rem' }}>
        {stage.acts.length === 0
          ? stage.state === 'unavailable'
            ? 'this stage dispatched nothing because it cannot run here at all — the reason above is measured, not assumed'
            : 'no act of this stage was dispatched, so there is no row here — a row that is missing is an act that did not happen, and a greyed box would be a promise'
          : `${stage.acts.length.toLocaleString('en-US')} of the ${stage.declared.toLocaleString('en-US')} acts this stage declares came back, in the order it dispatched them. Each row seeks to its own commit.`}
      </p>
      {stage.acts.length === 0 ? null : (
        <ol aria-label="the acts this stage dispatched, in dispatch order" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {stage.acts.map((outcome, index) => (
            <ActRow key={`${outcome.stage}/${outcome.act}/${String(index)}`} outcome={outcome} run={run} say={say} onSeek={onSeek} />
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * THE SAME STEPPER, WHILE THE RUN IS STILL DISPATCHING — already on screen, and
 * filling as each act lands (`src/prot/orchestrator.ts` · `ProtRunWatch`).
 *
 * Nothing is seekable here and the note says so: the cursor these stages move
 * belongs to the session view, and there is no session view until the last act
 * has landed. This is the composition for the page's `reading` phase — one
 * stage in flight, drawn with the design's only moving mark.
 */
export function RunStepper({ outcomes }: { readonly outcomes: readonly ActOutcome[] }): JSX.Element {
  const [said, setSaid] = useState<string | null>(null);
  const stages = stepperStages(outcomes, null);
  const nowhere = (): Promise<string | null> => Promise.resolve('the run is still going, so there is no cursor to move yet — the desk arrives with the last act');
  const steps = stepViews(stages, null, false, (stage) => <StageDetail stage={stage} run={null} onSeek={nowhere} say={setSaid} />);
  return <StageStepper steps={steps} label={STEPPER_LABEL} note={stepperNote(stages, false)} refusedSeek={said} onSeek={() => setSaid('nothing here is a control yet — the cursor arrives with the desk')} />;
}

/** The whole workbench. See the file header for the four layers and what this file is allowed to do. */
export function ProtDesk({ view, data, run, outcomes, checks, session, table, rowsNote, title, credit, counts, onSearchAgain }: ProtDeskProps): JSX.Element {
  // ── LAYER 4: the data ─────────────────────────────────────────────────────
  const state = useSessionView(view);
  const sheetPort = useMemo(() => sessionSheetData(session, { table }), [session, table]);
  const { desk, notice } = useProtProjection(view, state);
  // Called ONCE, unconditionally, from this body — the rule `vizfootprint-studio/desk`
  // · `DeskCharts` states, and the reason the cells may use hooks inside it.
  const root = useRef<HTMLDivElement>(null);
  const ink = useWorkbenchInk(root);
  // Called ONCE, unconditionally, from this body — with the resolved ink, which
  // is how the design's two chain colours reach the library's charts (through
  // their own `colorOf`, never through a selector into their SVG).
  const cells = useProtCells(desk, data, ink);
  const [said, setSaid] = useState<string | null>(null);

  // ── LAYER 3: the rules ───────────────────────────────────────────────────
  const stages = useMemo(() => stepperStages(outcomes, run), [outcomes, run]);
  /** Where the cursor is standing, in stages — the last stage that had landed by then. */
  const here = stageAtCursor(stages, state.activePathIds, state.cursor);
  /** WHICH PICTURES THAT STAGE PRODUCED — derived (see the file header). */
  const focus = useMemo(() => new Set(here === null ? [] : chartsOfStage(here, desk.shown)), [here, desk.shown]);
  const { hero, rest } = splitByFocus(cells, focus);
  /** Which views hold a LIVE clause — what the ✕ on a card is about. `cleared` is `null`, whatever the kind. */
  const liveViews = useMemo(() => new Set(state.selections.filter((s) => s.value !== null).map((s) => s.viewId)), [state.selections]);
  const summary = state.dashboard?.prose.find((p) => p.slot === 'caption');

  /**
   * THE SEEK, and its answer handed straight back for the stepper to print. It
   * is not ALSO kept here: the same sentence in two places reads as two
   * refusals.
   */
  const seek = async (commitId: string): Promise<string | null> => {
    const answered = await view.seek(commitId);
    return answered.ok ? null : answered.sentence;
  };
  const steps = stepViews(stages, here, true, (stage) => <StageDetail stage={stage} run={run} onSeek={seek} say={setSaid} />);
  const words = stagePanel({ here, run, counts, cursor: state.cursor, onPath: state.cursor !== null && state.activePathIds.includes(state.cursor), focused: hero.map((c) => desk.label(c.id)) });

  /** ONE CARD, wired: the library's picture inside this desk's frame. */
  const card = (c: ProtCell, focused: boolean, height: number): JSX.Element => {
    const label = desk.label(c.id);
    const clauseId = c.clauseId ?? c.id;
    return (
      <ChartCard
        key={c.id}
        id={c.id}
        label={label}
        focused={focused}
        // THE ONE VISIBLE LINE — the LIBRARY'S own derived prose slot
        // (`src/prot/def.ts` declares `howToRead` as derived and the library
        // writes it at every read). `null` for a view that declares no encoding
        // surface to derive one from, and the card then says nothing.
        howToRead={desk.proseOf(c.id).find((p) => p.slot === 'howToRead')?.text ?? null}
        // EMPTY, for every library chart: `VizLine` draws its own legend inside
        // its SVG whenever it is split into two or more series, and the library
        // offers no way to turn that off — so chips here would say chain A and
        // chain B twice. The chips the design asks for are on the viewer well
        // below, which is this desk's own frame. (A finding, reported.)
        legend={[]}
        footLeft={c.foot}
        footRight={ownerLine(stageOfChart(stages, c.id, desk.shown), 'from the file’s own columns — no act landed these')}
        // THE LONG NOTE, BEHIND THE DISCLOSURE AND NEVER DELETED: this is the
        // caption the desk always had, with every silence it counts.
        note={c.caption ?? null}
        noteLabel="Full note"
        noteAria={`the full note for ${label}`}
        clear={liveViews.has(clauseId) ? { label: `clear the ${label} selection`, onPress: () => void view.clear(clauseId, `clear ${label}`) } : null}
        height={height}
      >
        <ChartFrame>
          {(size) =>
            c.id === STRUCTURE_VIEW ? <ViewerBox chips={chainChips(counts, ink)}>{c.render(size)}</ViewerBox> : c.render(size)
          }
        </ChartFrame>
      </ChartCard>
    );
  };

  // ── LAYER 2: the components ──────────────────────────────────────────────
  return (
    <div ref={root} className="vzf pw-scope" data-theme={themeAttr(undefined)} style={{ fontFamily: 'var(--pw-font-sans)', fontSize: 13, color: 'var(--pw-ink)' }}>
      <WorkbenchHeader title={title} entry={credit.entry} entryTitle={credit.title.toLowerCase()} method={methodLine(credit)} searchAgain="New search" onSearchAgain={onSearchAgain} />

      <FactsStrip label="what this entry is, counted" items={factsStrip(counts, run)} nothing="nothing has been counted on this entry yet" />

      {/* THE STEPPER IS THE CURSOR — the control the whole page turns on */}
      <StageStepper steps={steps} label={STEPPER_LABEL} note={stepperNote(stages, true)} refusedSeek={said} onSeek={(key) => void seek(stages.find((s) => s.stage === key)?.commit ?? '').then(setSaid, (e: unknown) => setSaid(`that seek threw: ${e instanceof Error ? e.message : String(e)}`))} />

      {/* THE ONE PANEL — the stage the reader is on, in the run's own words */}
      <StagePanel {...words}>
        {rowsNote}
        {notice === null ? null : (
          <p role="alert" style={{ margin: '.4rem 0 0', fontSize: 12.5, color: 'var(--pw-refuse-ink)' }}>
            ⚠ {notice}
          </p>
        )}
        {summary === undefined ? null : (
          <p style={{ margin: '.4rem 0 0', fontSize: 12.5, color: 'var(--pw-mid-2)' }}>
            <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 10.5, opacity: 0.6, marginRight: 4 }}>summary</span>{' '}
            <ProseText text={summary.text} refs={summary.refs} onSeek={(id) => void view.seek(id)} onBookmark={desk.seekBookmark} describeCommit={desk.describeCommit} />
          </p>
        )}
      </StagePanel>

      {/* what is selected, and the named pictures — the library's own two pieces */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.6rem', alignItems: 'baseline', padding: '14px 24px 0' }}>
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

      {/* THE FOCUSED STAGE'S PICTURE, FULL WIDTH — and which one that is, is derived */}
      {hero.length === 0 ? null : (
        <div style={{ padding: '28px 24px 0', display: 'grid', gap: 24, gridTemplateColumns: hero.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(min(100%, 32rem), 1fr))' }}>{hero.map((c) => card(c, true, 420))}</div>
      )}

      {/* AND THE REST, IN TWO COLUMNS */}
      {/* TWO COLUMNS, as the design draws them — `min(100%, 32rem)` rather than a
          media query so the band folds to one column on a narrow screen without
          this file knowing any breakpoint. */}
      <div style={{ padding: '24px 24px 32px', display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 32rem), 1fr))' }}>{rest.map((c) => card(c, false, hero.length === 0 ? 340 : 280))}</div>

      {/* THE RECORD, in the library's own panels */}
      <div style={{ padding: '0 24px 24px', display: 'grid', gap: '.6rem', gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))' }}>
        <VizPanel title={`Commit log (${state.commits.length.toLocaleString('en-US')})`} collapsible defaultCollapsed>
          <CommitLog commits={state.commits} onSeek={(id) => void view.seek(id)} />
        </VizPanel>
        <VizPanel title={`Every request the session refused (${state.gaps.length.toLocaleString('en-US')})`} collapsible defaultCollapsed>
          <GapsPanel gaps={state.gaps} heading={false} />
        </VizPanel>
        <VizPanel title={`What the data checks said (${checks.length.toLocaleString('en-US')})`} collapsible defaultCollapsed>
          {checks.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--pw-mid-2)' }}>the definition&rsquo;s own checks and this surface&rsquo;s own found nothing to report on this entry</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--pw-mid-2)' }}>
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

      <div style={{ padding: '0 24px 32px', fontSize: 12, color: 'var(--pw-mid-2)' }}>
        {/* THE RECORDER'S OWN ACCOUNT OF THE WHOLE RUN, in full and in order — the
            panel above quotes the first few of a stage's; this is all of them */}
        <RunNarrative run={run} />
        <NotHere />
      </div>
    </div>
  );
}
