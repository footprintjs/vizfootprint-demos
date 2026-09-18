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
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ChartFrame,
  CommitLog,
  GapsPanel,
  ProseText,
  SavedSelections,
  SelectionChips,
  Sheet,
  framePad,
  sessionSheetData,
  themeAttr,
  useSessionView,
  type SessionView,
  type SheetSessionLike,
} from 'vizfootprint-ui';
import type { EntryCredit, ProtCounts } from '../../src/prot/etl.js';
import type { ActOutcome, ProtRun } from '../../src/prot/orchestrator.js';
import { STRUCTURE_VIEW } from '../../src/prot/def.js';
import { AXIS_ROOM, useProtCells, type ProtCell, type ProtDeskData } from './protCells.js';
import { useProtProjection } from './protProjection.js';
import { ActRow, RunNarrative, narrativeTitle } from './protTrace.js';
import { actColumnsOf, chartsOfStage, stageAtCursor, stepperStages, type StepperStage } from './protStages.js';
import { Count, Disclosure, RecordDrawer, RegionDivider, WorkbenchHeader, type DividerAction } from './workbench/Chrome.js';
import { BlockedGroup, ChartCard, ChartTile, ViewerBox } from './workbench/ChartCard.js';
import { StageStepper } from './workbench/Stepper.js';
import { methodLine } from './workbench/bands.js';
import {
  DIVIDER_HINT,
  DIVIDER_LABEL,
  DIVIDER_TRACK,
  SPLIT_DEFAULT,
  SPLIT_STORAGE_KEY,
  byPlanStep,
  chainChips,
  clampShare,
  columnTracks,
  dividerFloors,
  dividerValues,
  ownerLine,
  parseSplit,
  promoteCardLabel,
  promoteChartLabel,
  rowTracks,
  serialiseSplit,
  shapeOfView,
  shareAfterStep,
  shareAtEdge,
  shareAtPointer,
  splitByFocus,
  stageOfChart,
  stopSentence,
  trackPx,
  type DividerId,
  type RegionSplit,
  type SplitStop,
} from './workbench/charts.js';
import { BLOCKED_CARDS, stageWords, type BlockedCard } from './workbench/panel.js';
import { STEPPER_LABEL, actsLabelOf, stepViews } from './workbench/steps.js';
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
  /**
   * WHICH COMMIT THE PICTURES ARE DRAWN AT, in the page's own words — and
   * whether that line is QUIET.
   *
   * A quiet line is a plain statement of where the cursor is standing, and it
   * goes into the panel's fold with the rest of the long prose. A LOUD one is
   * a refused read or a read in flight: the pictures below are then falling
   * back to the file's own columns, or are still the previous cursor's, and a
   * page that folded that away would be showing the parse and calling it the
   * record. So the page says which it is and the panel obeys.
   */
  readonly rowsNote: { readonly line: ReactNode; readonly quiet: boolean };
  /**
   * WHAT THE PAGE IS CALLED (`src/prot/def.ts` · `PROT_WORDS.name`) — the
   * header's first slot. A name is not data about the run.
   */
  readonly name: string;
  /**
   * THE DESK'S CLAIM ABOUT ITSELF (`PROT_WORDS.title`) — a sentence, and a
   * different kind of word from the name. It rides the panel's fold, where a
   * reader meets it once rather than in the slot a name belongs in.
   */
  readonly claim: string;
  /** The entry's credit, read out of its own header records — the header band's whole content. */
  readonly credit: EntryCredit;
  /** What the parse counted — the facts strip's residues and chains. */
  readonly counts: ProtCounts;
  /**
   * WHAT THE PAGE ADDS TO THE RECORD — its own credit, its provenance and the
   * static-build note.
   *
   * It arrives as a prop rather than being rendered after this component
   * because the page must not scroll: everything there is goes inside the one
   * viewport, and the record drawer at the bottom edge is where the page's own
   * foot belongs now (`web/site/prot/entry.tsx` hands it over).
   */
  readonly record: ReactNode;
  /** The way back to the search. */
  onSearchAgain(): void;
}

/** What the fold holding the dashboard's own words is called. */
const ABOUT_TITLE = 'About this dashboard and this desk — the definition’s own summary at this cursor, and the claim this desk makes about itself';

/** What that fold is called — the one place the count of omissions is spelled. */
const NOT_HERE_TITLE = 'What the other three desks show and this page does not — seven things it does without, each one named rather than quietly missing, one affordance it no longer announces, one thing it adds, one thing it remembers that is not on the record, and one request it makes';

/**
 * WHAT THE OTHER THREE DESKS SHOW AND THIS PAGE DOES NOT — named, because an
 * omission nobody announced is a lie by arrangement.
 *
 * It draws no chrome of its own any more: the composition folds it through the
 * ONE disclosure shape this desk uses everywhere (`workbench/Chrome.tsx` ·
 * `Disclosure`). Every word of the list is unchanged.
 */
function NotHere(): JSX.Element {
  return (
    <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
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
        <b>And one thing it no longer says out loud:</b> that the marks are clickable. The other three desks keep a selection strip on screen at all times, which reads <i>no selection — click a mark, shift-click to add, drag across
        bars for a run</i> before anybody has clicked anything. That is an instruction rather than a fact, and this desk&rsquo;s instrument has no room between the stepper and the charts for either — so the strip appears only once
        there IS a selection, in the library&rsquo;s own words. <b>The consequence, said plainly:</b> a reader arriving here is not told that clicking a mark selects a residue, dragging an axis keeps a range, and shift-clicking adds to
        what is already kept. Every one of those still works, and every one of them lands a real commit on the record below.
      </li>
      <li>
        <b>And one thing this page remembers that is not on the record:</b> where you put the two dividers between the focus and its satellite panes. That is a LAYOUT PREFERENCE and not an analytical act — it lands no commit, appears
        nowhere on the log below and nothing in the session&rsquo;s own account of itself mentions it — so it is kept in this browser&rsquo;s own storage, for you only, and it travels with no saved picture and no link. Clearing this
        site&rsquo;s data puts both boundaries back where the page had them, and so does pressing <code>Enter</code> on a divider.
      </li>
      <li>
        <b>And one request this page makes that the other three do not:</b> it asks <code>fonts.googleapis.com</code> for IBM Plex Sans, Serif and Mono. That is a THIRD-PARTY REQUEST from a page that otherwise makes none — every byte of data
        here is the repository&rsquo;s own — so it is named rather than made quietly. Each family carries a real fallback stack, so a blocked request changes the letters and nothing else.
      </li>
    </ul>
  );
}

/**
 * THE ACTS ONE STAGE DISPATCHED, AND WHAT EACH ONE LANDED.
 *
 * It used to hang off a caret on the stepper's own column, with three lines of
 * prose above it. The author's ruling took the prose — *no paragraphs between
 * the stepper and the charts* — and the rows came here, to the record drawer,
 * where a row of the log belongs.
 *
 * **The rows themselves are untouched, and that is deliberate.** Each one seeks
 * to its own commit and is named `seek the cursor to the commit act "<id>"
 * landed`; `tests/prot-cursor.smoke.test.ts` finds one by that name and is the
 * one test proving the pictures follow the cursor, so the name is a contract
 * and the path to it stays open.
 */
export function StageDetail({ stage, run, onSeek, say }: { readonly stage: StepperStage; readonly run: ProtRun | null; onSeek(commitId: string): Promise<string | null>; say(sentence: string | null): void }): JSX.Element {
  return (
    <section aria-label={`the acts of stage ${String(stage.number)}, ${stage.label}`} style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--pw-mid-2)' }}>
      {stage.acts.length === 0 ? (
        <p style={{ margin: 0 }}>
          {/* A MISSING ROW IS AN ACT THAT DID NOT HAPPEN. The words for WHY are
              on that stage's own card (`workbench/panel.ts` · `STEP_CARDS`) or,
              for a stage that simply has not run, in the mark's own state —
              never a greyed row here pretending to be one. */}
          <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--pw-soft-2)' }}>no act dispatched</span>
        </p>
      ) : (
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
  const steps = stepViews(stages, null, false);
  return <StageStepper steps={steps} label={STEPPER_LABEL} refusedSeek={said} onSeek={() => setSaid('nothing here is a control yet — the cursor arrives with the desk')} />;
}

/**
 * THE INSTRUMENT REGION'S OWN PADDING, in px — declared once, because two
 * things read it.
 *
 * The style below spends it, and the divider arithmetic measures the CONTENT
 * box inside it (`./workbench/charts.ts` · `shareAtPointer` is handed where
 * that box starts). Two spellings of 24 would put the boundary a pointer asked
 * for 24px away from where the pointer was.
 */
const REGION_PAD = { x: 24, top: 8, bottom: 40 } as const;

/**
 * WHAT THIS BROWSER REMEMBERS ABOUT THE BOUNDARIES — read safely, and
 * defaulting cleanly whatever it answers.
 *
 * A private window, cleared site data, a preview or a host that has blocked
 * storage all either throw or answer nothing, and every one of them means the
 * same thing: *the page's own arrangement*. The value's SHAPE is judged by
 * `./workbench/charts.ts` · `parseSplit`, and its floors are judged on every
 * render by `clampShare` against the window it is read INTO — so a fraction
 * stored at one window size cannot reproduce the broken layout at another.
 */
function rememberedSplit(): RegionSplit {
  try {
    return parseSplit(window.localStorage.getItem(SPLIT_STORAGE_KEY));
  } catch {
    return SPLIT_DEFAULT;
  }
}

/** The whole workbench. See the file header for the four layers and what this file is allowed to do. */
export function ProtDesk({ view, data, run, outcomes, checks, session, table, rowsNote, name, claim, credit, counts, record, onSearchAgain }: ProtDeskProps): JSX.Element {
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

  /*
    ── THE READER MOVES THE BOUNDARY, and the state is a LAYOUT PREFERENCE ───
    A drag is not an analytical act: it lands no commit, appears on no log and
    nothing in `why()` mentions it. So it lives here and in this browser's
    `localStorage`, never on the session — a saved picture that carried a pane's
    size would be claiming a reader's furniture was part of their finding. It is
    named in {@link NotHere} for the same reason every other omission is.

    `split` is the reader's RAW preference and is never rewritten by the window:
    the floors are applied where the layout is computed, so a boundary that
    cannot be honoured in a small window comes back when the window grows.
  */
  const instrument = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState<RegionSplit>(rememberedSplit);
  const [stop, setStop] = useState<{ readonly which: DividerId; readonly at: SplitStop } | null>(null);
  /**
   * THE REGION AS THE BROWSER LAID IT OUT — its content box, and the two
   * satellite tracks' USED sizes.
   *
   * The tracks are READ rather than re-derived (`./workbench/charts.ts` ·
   * `trackPx`), so a separator's `aria-valuenow` is the truth about the layout
   * whether the track is the page's own `clamp(16rem, 22vw, 22.5rem)` or a
   * fraction the reader chose. Re-deriving `22vw` here would have been a second,
   * drifting copy of the page's own expression.
   */
  const [laid, setLaid] = useState<{ readonly w: number; readonly h: number; readonly rail: number; readonly strip: number }>({ w: 0, h: 0, rail: 0, strip: 0 });
  const measure = useCallback((): void => {
    const el = instrument.current;
    if (el === null) return;
    const used = window.getComputedStyle(el);
    const columns = trackPx(used.gridTemplateColumns);
    const rows = trackPx(used.gridTemplateRows);
    setLaid((was) => {
      const next = {
        w: el.clientWidth - REGION_PAD.x * 2,
        h: el.clientHeight - REGION_PAD.top - REGION_PAD.bottom,
        rail: columns[2] ?? was.rail,
        strip: rows[2] ?? was.strip,
      };
      return next.w === was.w && next.h === was.h && next.rail === was.rail && next.strip === was.strip ? was : next;
    });
  }, []);
  // A LAYOUT EFFECT, so a remembered boundary is clamped BEFORE the first paint
  // rather than flashing the page's own arrangement first.
  useLayoutEffect(() => {
    const el = instrument.current;
    if (el === null) return undefined;
    measure();
    const watching = new ResizeObserver(() => measure());
    watching.observe(el);
    return () => watching.disconnect();
  }, [measure]);
  // …and again when the READER moved a boundary, which changes the tracks
  // without changing the region, so the observer above never fires for it.
  useLayoutEffect(() => {
    measure();
  }, [measure, split]);
  /*
    REMEMBERED PER READER, and never allowed to fail loudly: storage that
    throws or is absent costs the memory and nothing else — the boundary still
    moves, it is simply not there next time.
  */
  useEffect(() => {
    try {
      const raw = serialiseSplit(split);
      if (raw === null) window.localStorage.removeItem(SPLIT_STORAGE_KEY);
      else window.localStorage.setItem(SPLIT_STORAGE_KEY, raw);
    } catch {
      /* a private window, cleared site data, a preview */
    }
  }, [split]);
  /**
   * THE FOUR FLOORS — folded out of the library's OWN margin and this page's
   * own axis threshold, never out of a number chosen for the gesture
   * (`./workbench/charts.ts` · `dividerFloors` carries the table).
   *
   * `framePad` is `vizfootprint-ui`'s own union of the margins of the kinds
   * this desk draws, so the floor moves if the library's padding ever does.
   */
  const floors = useMemo(() => dividerFloors({ pad: framePad(['line', 'bar', 'point']), axisRoom: AXIS_ROOM }), []);
  /** THE SHARES THE LAYOUT GETS — the reader's, held at a floor when it asks for more than the window can give. */
  const railHeld = clampShare(split.rail, laid.w, floors.rail);
  const stripHeld = clampShare(split.strip, laid.h, floors.strip);
  /** Where each boundary STANDS, read off the used tracks — the share a key press moves from, default or not. */
  const standing = (which: DividerId): number => {
    const room = (which === 'rail' ? laid.w : laid.h) - DIVIDER_TRACK;
    return room <= 0 ? 0 : (which === 'rail' ? laid.rail : laid.strip) / room;
  };
  /**
   * ONE GESTURE ON ONE DIVIDER — the only place a share is written, and the
   * only place a floor is applied.
   *
   * The component reports the gesture and nothing else (`./workbench/Chrome.tsx`
   * · `DividerAction`); the rules turn it into a share; `clampShare` decides
   * whether it may have it and says which stop held it, which is what the page
   * then reads out in its own voice.
   */
  const act = (which: DividerId, action: DividerAction): void => {
    const el = instrument.current;
    if (el === null) return;
    const box = el.getBoundingClientRect();
    const axis = which === 'rail' ? { start: box.left + REGION_PAD.x, extent: laid.w } : { start: box.top + REGION_PAD.top, extent: laid.h };
    const stops = which === 'rail' ? floors.rail : floors.strip;
    if (action.kind === 'default') {
      // THE WAY BACK, and it leaves nothing of the reader's behind: the stored
      // key is removed, not set to the default, so a reader who resets is a
      // reader this browser has forgotten.
      setSplit(which === 'rail' ? { rail: null, strip: split.strip } : { rail: split.rail, strip: null });
      setStop(null);
      return;
    }
    const asked =
      action.kind === 'move'
        ? shareAtPointer(action.pointer, axis)
        : action.kind === 'nudge'
          ? shareAfterStep(standing(which), axis.extent, action.px)
          : shareAtEdge(stops, axis.extent, action.to);
    const held = clampShare(asked, axis.extent, stops);
    setSplit(which === 'rail' ? { rail: held.share, strip: split.strip } : { rail: split.rail, strip: held.share });
    /*
      AND `Home` / `End` SAY WHAT THEY WENT TO. They land exactly ON a floor,
      which the clamp reads as *not past it* and therefore says nothing about —
      so the sentence is set here instead. A reader who asked for the stop is
      owed the reason as much as one who pushed into it, and `min` is the focus
      at its own floor while `max` is the satellites at theirs.
    */
    const at: SplitStop = action.kind === 'edge' ? (action.to === 'min' ? 'focus' : 'satellites') : held.stop;
    setStop(at === null ? null : { which, at });
  };
  /** One divider's whole prop bundle, so the two cannot be wired differently. */
  const dividerOf = (which: DividerId): { readonly label: string; readonly hint: string; readonly now: number; readonly min: number; readonly max: number; readonly step: number; readonly stop: string | null; onAct(action: DividerAction): void } => {
    const values = dividerValues(standing(which), which === 'rail' ? laid.w : laid.h, which === 'rail' ? floors.rail : floors.strip);
    return {
      label: DIVIDER_LABEL[which],
      hint: DIVIDER_HINT[which],
      ...values,
      step: DIVIDER_TRACK,
      stop: stop === null || stop.which !== which ? null : stopSentence(which, stop.at),
      onAct: (action) => act(which, action),
    };
  };

  // ── LAYER 3: the rules ───────────────────────────────────────────────────
  const stages = useMemo(() => stepperStages(outcomes, run), [outcomes, run]);
  /** Where the cursor is standing, in stages — the last stage that had landed by then. */
  const here = stageAtCursor(stages, state.activePathIds, state.cursor);
  /**
   * WHICH PICTURES A STAGE PRODUCED — derived (see the file header), and the
   * right side of the intersection is every column every act landed, so the
   * step that landed none of them owns what the PARSE read off the file
   * (`./protStages.ts` · `chartsOfStage`).
   */
  const actColumns = useMemo(() => actColumnsOf(stages), [stages]);
  const focus = useMemo(() => new Set(here === null ? [] : chartsOfStage(here, desk.shown, actColumns)), [here, desk.shown, actColumns]);
  /**
   * WHAT THE READER PROMOTED, and the stage they promoted it in.
   *
   * The focus stays DERIVED: this is an override the reader chose, not a second
   * source of truth, and it is remembered WITH the stage it was chosen in so
   * that moving the cursor hands the focus back to the stage rather than
   * pinning a picture the new stage never produced.
   */
  const [promoted, setPromoted] = useState<{ readonly stage: string | null; readonly id: string } | null>(null);
  const promotedId = promoted !== null && promoted.stage === (here?.stage ?? null) ? promoted.id : null;

  /** THE RAIL'S ORDER — by the plan step that owns each thing (`workbench/charts.ts` · `byPlanStep`). */
  const ownerOf = (id: string): StepperStage | null => stageOfChart(stages, id, desk.shown, actColumns);
  const pictures = useMemo(() => byPlanStep(cells.map((c) => ({ step: ownerOf(c.id)?.number ?? null, item: c }))), [cells, stages, desk.shown, actColumns]);
  const cards = useMemo(() => byPlanStep(BLOCKED_CARDS.map((b) => ({ step: stages.find((s) => s.stage === b.id)?.number ?? null, item: b }))), [stages]);

  /**
   * THE FOCUS, AND THE RAIL — one picture (or the stage's own two) in the
   * focus, everything else small and one press away.
   *
   * A promotion wins; otherwise the stage's own pictures do; and when a stage
   * produced none the focus is the first picture on the desk rather than an
   * empty box, with the words for that in the chrome.
   */
  const promotedCard: BlockedCard | null = cards.find((b) => b.id === promotedId) ?? null;
  const promotedCell = pictures.find((c) => c.id === promotedId) ?? null;
  /** The pictures THIS STAGE produced, in rail order. */
  const produced = splitByFocus(pictures, focus).hero;
  /**
   * THE FOCUS SLOT HOLDS ONE PICTURE — the reader's promotion, else the first
   * the standing stage produced, else the first picture on the desk so the slot
   * is never empty. A stage's other pictures wait in the rail, a press away,
   * and the arrangement clause says so.
   */
  const hero: ProtCell | null = promotedCard !== null ? null : (promotedCell ?? produced[0] ?? pictures[0] ?? null);
  const rail = pictures.filter((c) => c !== hero);
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
  /**
   * ONE PRESS ON A COLUMN, TWO THINGS IT CAN MEAN — and the fold already named
   * which (`workbench/steps.ts` · `seekLabelOf` / `showLabelOf`).
   *
   * A stage with a commit seeks the cursor to it. A stage that will not run
   * here has no commit, so its press brings its CARD into the focus, where the
   * reason is. What it must never do is claim a commit: there is nothing to
   * move to, and a control that answered a refusal is worse than no control.
   */
  const press = (key: string): void => {
    const stage = stages.find((s) => s.stage === key);
    if (stage === undefined) return;
    if (stage.commit === null) {
      /*
        NO COMMIT, SO THE CURSOR DOES NOT MOVE — and the press still answers.
        A stage that will not run here promotes its own CARD, where the reason
        is. The step that landed at the ROOT promotes its own PICTURE: it ran,
        it landed the whole residues table, and the picture that shows that is
        its first (the 3D structure — the more representative of "we have the
        structure"; the backbone angles wait in the rail). Its card's own quiet
        line is where the page says the cursor did not move, and why.
      */
      const mine = chartsOfStage(stage, desk.shown, actColumns);
      const picture = pictures.find((c) => mine.includes(c.id)) ?? null;
      setPromoted({ stage: here?.stage ?? null, id: picture?.id ?? key });
      setSaid(null);
      return;
    }
    // A LANDED STAGE DOES BOTH: the cursor moves to the commit its last act
    // landed, and the focus goes back to what that stage produced — so a
    // promotion the reader made earlier is dropped here rather than surviving a
    // press that was about a different stage.
    setPromoted(null);
    void seek(stage.commit).then(setSaid, (e: unknown) => setSaid(`that seek threw: ${e instanceof Error ? e.message : String(e)}`));
  };
  const steps = stepViews(stages, here, true);
  const said_focus = {
    cursor: state.cursor,
    onPath: state.cursor !== null && state.activePathIds.includes(state.cursor),
    focused: produced.map((c) => desk.label(c.id)),
    inFocus: hero === null ? null : desk.label(hero.id),
    promoted: promotedCell === null ? (promotedCard?.name ?? null) : desk.label(promotedCell.id),
  };
  /** WHERE THE CURSOR IS STANDING — for the chrome, which is the only thing that still speaks about the whole screen. */
  const words = stageWords({ here, run, counts, ...said_focus });
  /**
   * AND WHAT THE FOCUSED CARD SAYS: the words of the stage that owns THAT
   * PICTURE, which is the standing stage by default and is step 1 when a reader
   * promotes the structure or the angles.
   *
   * Asked of the picture rather than of the cursor, because the card is the
   * picture's: a stage's line on a chart that stage did not produce would be
   * the misattribution this desk keeps refusing.
   */
  const heroStage = hero === null ? null : ownerOf(hero.id);
  const cardWords = heroStage === null || heroStage.stage === here?.stage ? words : stageWords({ here: heroStage, run, counts, ...said_focus });

  /**
   * ONE CARD, wired: the library's picture inside this desk's frame.
   *
   * `stage` is handed to the FIRST focused card only, and it is the whole of
   * what the removed prose band used to say: the stage's quiet line, its own
   * numbers, its refusal. The long half — the recorder's sentences and the
   * clause about the arrangement — goes into the same card's `Full note`, in
   * front of the picture's own caption, under a lead that names which stage is
   * speaking.
   */
  const card = (c: ProtCell, focused: boolean, withStage: boolean): JSX.Element => {
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
        stage={withStage ? { mark: cardWords.mark, line: cardWords.line, facts: cardWords.facts, refusal: cardWords.refusal } : null}
        footLeft={c.foot}
        // WHO PUT THESE COLUMNS ON THE DESK — the stage whose acts landed them,
        // or the STEP THAT READ THE FILE (`ownerLine` says the rest). The
        // fallback is left for a picture that binds nothing and is nobody's
        // receipt, which no view on this desk is today.
        footRight={ownerLine(ownerOf(c.id), 'a picture no step on this desk produced')}
        // THE LONG NOTE, BEHIND THE DISCLOSURE AND NEVER DELETED: this is the
        // caption the desk always had, with every silence it counts — and, on
        // the focused card, the stage's own sentences in front of it.
        note={
          withStage ? (
            <>
              <p style={{ margin: '0 0 6px' }}>
                <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 10.5, opacity: 0.6, marginRight: 4 }}>the stage that landed this</span> {cardWords.eyebrow}
              </p>
              {/* A STEP'S OWN ACCOUNT OF ITSELF, when it has one: step 1 landed
                  the whole residues table through the parse rather than through
                  an act, and that is the paragraph that says so. */}
              {cardWords.account === null ? null : <p style={{ margin: '0 0 6px' }}>{cardWords.account}</p>}
              {cardWords.sentences.map((sentence) => (
                <p key={sentence.slice(0, 48)} style={{ margin: '0 0 6px' }}>
                  {sentence}
                </p>
              ))}
              <p style={{ margin: '10px 0 6px' }}>
                <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 10.5, opacity: 0.6, marginRight: 4 }}>this picture</span>
              </p>
              {c.caption}
            </>
          ) : (
            (c.caption ?? null)
          )
        }
        noteLabel="Full note"
        noteAria={`the full note for ${label}`}
        clear={liveViews.has(clauseId) ? { label: `clear the ${label} selection`, onPress: () => void view.clear(clauseId, `clear ${label}`) } : null}
        height="fill"
      >
        <ChartFrame>
          {(size) =>
            c.id === STRUCTURE_VIEW ? <ViewerBox chips={chainChips(counts, ink)}>{c.render(size)}</ViewerBox> : c.render(size)
          }
        </ChartFrame>
      </ChartCard>
    );
  };

  /**
   * A STAGE THAT WILL NOT RUN HERE, AS A CARD — the author's instruction:
   * *"for not-available, show the widget and tell inside it a text to tell why
   * it's not there."*
   *
   * Where the picture would be, the card says why there is no picture. There is
   * NO chart inside it and no frame pretending to be one: stages 5 and 6
   * declare no views at all, and an empty axis would be the lie this desk
   * exists to avoid. The short form is the reason's own first clause; the whole
   * measured paragraph is behind the same `Full note` press every other card
   * has.
   */
  const blockedCard = (b: BlockedCard, focused: boolean): JSX.Element => (
    <ChartCard
      key={b.id}
      id={`stage:${b.id}`}
      label={`${b.name} — ${b.tag}`}
      focused={focused}
      howToRead={null}
      legend={[]}
      footLeft={b.tag}
      footRight={ownerLine(stages.find((s) => s.stage === b.id) ?? null, b.name)}
      note={
        <>
          <p style={{ margin: '0 0 6px' }}>
            <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 10.5, opacity: 0.6, marginRight: 4 }}>what this step would answer</span> {b.label}
          </p>
          <p style={{ margin: 0 }}>{b.why}</p>
        </>
      }
      noteLabel="Full note"
      noteAria={`the whole reason ${b.name} will not run on this build`}
      clear={null}
      height="fill"
    >
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, flex: '1 1 0', minHeight: 0, padding: '6px 0' }}>
        <p style={{ margin: 0, fontFamily: 'var(--pw-font-serif)', fontSize: focused ? 17 : 12.5, lineHeight: 1.45, color: 'var(--pw-prose)' }}>{b.short}</p>
        <p style={{ margin: 0, fontSize: focused ? 12.5 : 11, lineHeight: 1.45, color: 'var(--pw-mid-2)' }}>{b.label}</p>
      </div>
    </ChartCard>
  );

  /**
   * ONE TILE, wired — a name, the def's own word for what it draws, and what it
   * counts at this cursor.
   *
   * `said` is the cell's own foot line when the picture has one and the
   * LIBRARY'S OWN REFUSAL SENTENCE when it has not: a cell whose column no act
   * has landed reports `null` for its count, and at that cursor the refusal is
   * the truth about that picture. It is not a paraphrase — it is the sentence
   * the session collected from this very session before the stages ran
   * (`src/prot/session.ts` · `probeTheUnlandedColumns`), which is the same
   * sentence the focused card shows where its marks would be.
   */
  const tile = (c: ProtCell, wide: boolean): JSX.Element =>
    /*
      THE ONE PANE THAT SAYS IT RATHER THAN DRAWING IT — and the measurement is
      the argument.

      The 3D view in a right-column pane was 282×114 with a canvas of 282×67:
      an EMPTY BLACK BOX. It is the one pane whose content is a WebGL canvas
      rather than marks, so it cannot show a crossfilter the way a scatter can
      (it recolours, and at 67px that is invisible); its shape is wrong there
      (the design draws the molecule roughly square); and a camera cannot be
      fitted to a box of that aspect. An empty frame reads as broken, which is
      the one thing the honesty floor forbids — so the pane says, in its own
      words, that this picture is drawn in the focus, and a press puts it there.
      Its COUNT stays on it, because the card it comes from is the only place
      `185 residues · 2 chains drawn` is stated.
    */
    c.id === STRUCTURE_VIEW && !wide ? (
      <ChartTile
        key={c.id}
        id={c.id}
        label={desk.label(c.id)}
        said={`${c.foot ?? ''} — the 3D viewer draws in the focus, where a camera can be fitted to the molecule. Press to bring it here.`}
        promote={{ label: promoteChartLabel(desk.label(c.id)), onPress: () => setPromoted({ stage: here?.stage ?? null, id: c.id }) }}
      />
    ) : (
    <ChartTile
      key={c.id}
      id={c.id}
      label={desk.label(c.id)}
      said={c.foot ?? data.refusals[c.clauseId ?? c.id] ?? null}
      wide={wide}
      promote={{ label: promoteChartLabel(desk.label(c.id)), onPress: () => setPromoted({ stage: here?.stage ?? null, id: c.id }) }}
    >
      {/*
        THE LIBRARY'S OWN PICTURE, at whatever size the rail gives it — and LIVE:
        a pick in it is a real commit, and the crossfilter it triggers is
        visible in every other tile at once, which is the reason this layout
        exists at all. The 3D well keeps its own frame here too, without the
        chain chips, which need width this size has not got.
      */}
      <ChartFrame>{(size) => c.render(size)}</ChartFrame>
    </ChartTile>
    );
  /** The rail, split by the shape each picture wants — wide along the bottom, square and tall down the side. */
  const wide = rail.filter((c) => shapeOfView(c.id) === 'wide');
  const tall = rail.filter((c) => shapeOfView(c.id) !== 'wide');
  /**
   * AND THE COLUMN'S OWN SPLIT: the panes that DRAW take `1fr` each, the one
   * that says it instead takes its content's height.
   *
   * A word pane in a `1fr` row is the same waste the three blocked cards were
   * — it held a 127px row for two lines of text while the scatter beside it
   * wanted every pixel.
   */
  const drawnTall = tall.filter((c) => c.id !== STRUCTURE_VIEW);
  const saidTall = tall.filter((c) => c.id === STRUCTURE_VIEW);
  /** The steps that will not run here and are not the one in the focus. */
  const waiting = cards.filter((b) => b.id !== promotedId);

  // ── LAYER 2: the components ──────────────────────────────────────────────
  return (
    <div
      ref={root}
      className="vzf pw-scope"
      data-theme={themeAttr(undefined)}
      style={{
        fontFamily: 'var(--pw-font-sans)',
        fontSize: 13,
        color: 'var(--pw-ink)',
        /*
          THE INSTRUMENT FITS THE WINDOW — and the height is `height`, not
          `min-height`, which is the whole fix.
          A grid whose own height is INDEFINITE sizes an `fr` row to its
          CONTENT, so the rail's seven tiles (84px each, by their own floor)
          grew the row past the window and the page scrolled by exactly their
          overflow: measured 1,004px in a 900px window before this line. With a
          definite height the row is the space that is left, the rail scrolls
          inside itself, and `ChartFrame` finally has the definite box it needs
          to measure.
          `minmax(160px, 1fr)` keeps a floor under the pictures, and `overflow`
          stays VISIBLE: in a window too short for the bands the content spills
          and the PAGE scrolls, which is honest degradation — clipping a picture
          to nothing would not be.
        */
        height: '100dvh',
        display: 'grid',
        gridTemplateRows: 'auto auto auto minmax(160px, 1fr)',
        // the record drawer is absolutely positioned at the bottom edge of THIS
        // box, which is the viewport's height
        position: 'relative',
      }}
    >
      {/* THE NAME, in the slot the design reserves for it. The def's own claim
          about this desk is a sentence, not a name, and rides the record. */}
      {/*
        THE HEADER ANSWERS "WHAT AM I LOOKING AT", and the commit line is the
        same question about TIME rather than about the entry — so it belongs
        here, beside the id, the deposited title and the method.

        It is the ONE thing on screen that says which point in the run the
        pictures come from, and the stepper's whole purpose is to move that
        point, so it stays visible and correct through EVERY press: a seek moves
        it, and a press that only focuses (step 1, or any of the three that will
        not run) leaves it alone, which is the truth. It is derived from the
        READ's own answer and never from what this page believes the cursor to
        be (`web/src/protRows.ts` · `ResiduesNow.cursor`, and the page folds the
        sentence).
      */}
      <WorkbenchHeader
        title={name}
        entry={credit.entry}
        entryTitle={credit.title.toLowerCase()}
        method={methodLine(credit)}
        at={
          <>
            {rowsNote.line}
            {/*
              AND WHAT THIS PAGE'S OWN ACTS LAST GOT WRONG. It rode the
              selection row for one round, which was a bug: that row only
              renders when there IS a selection, so a refused act would have
              been silent. An alert belongs where it cannot be conditional.
            */}
            {notice === null ? null : (
              <span role="alert" style={{ fontSize: 11.5, color: 'var(--pw-refuse-ink)' }}>
                ⚠ {notice}
              </span>
            )}
          </>
        }
        searchAgain="New search"
        onSearchAgain={onSearchAgain}
      />

      {/*
        NOTHING BETWEEN THE HEADER AND THE STEPPER ANY MORE.

        The counted-facts band was DUPLICATION, every line of it: `185 residues
        · 2 chains` is the structure card's own foot, `224 contacts, 21
        cross-chain` is the pair table's, the kinds are in the interface card's
        full note, and `6 steps declared — 3 landed · 3 will not run` is the six
        marks themselves, which a reader can count and which say it in a better
        register than prose. So the band is gone rather than re-shuffled, and
        the two things in it that were NOT duplicates went to where they belong:
        the commit line to the header above, and the selection row below — which
        appears only when there IS a selection, because *"no selection — click a
        mark"* is an instruction and not a fact (named in {@link NotHere}, since
        dropping it drops a discoverable affordance).
      */}
      {/* THE STEPPER IS THE CURSOR — the control the whole page turns on */}
      <StageStepper steps={steps} label={STEPPER_LABEL} refusedSeek={said} onSeek={press} />

      {/*
        THE RECORD — drawn LAST and written FIRST, and the order in the markup
        is deliberate.

        It is absolutely positioned at the bottom edge of this box, so where it
        sits on screen does not depend on where it sits in the DOM. Where it
        sits in the DOM decides two other things: what a reader tabs to, and
        what `tests/prot-cursor.smoke.test.ts` finds. That test opens
        `[aria-expanded="false"]` blindly, one at a time, to reach an act's own
        seek control — so the first thing it meets has to be this bar (which
        opens and reveals the act rows) and not a card's `Full note` behind the
        panel, which an open drawer COVERS and Playwright then refuses to click.
        The act rows are the first thing inside, for the same reason.

        Never below a page scroll
        (`workbench/Chrome.tsx` · `RecordDrawer` argues the shape). Everything
        that was under the cards is in here, in the same four disclosures, plus
        the two sentences the removed panel used to fold: the dashboard's own
        declared summary and this desk's claim about itself. `record` is what the
        PAGE adds — its credit, its provenance and the static-build note.
      */}
      <RecordDrawer
        label={`open the record: ${state.commits.length.toLocaleString('en-US')} commits, ${state.gaps.length.toLocaleString('en-US')} refused requests, ${checks.length.toLocaleString('en-US')} data checks, the ${table} table at the cursor, the recorder’s own account, what this page does without, and this entry’s credit`}
        title={
          <>
            <Count>{state.commits.length.toLocaleString('en-US')}</Count> commits · <Count>{state.gaps.length.toLocaleString('en-US')}</Count> refused requests · <Count>{checks.length.toLocaleString('en-US')}</Count> data checks · the {table} table at the cursor · the
            recorder’s account · what this page does without · the credit
          </>
        }
      >
        {/*
          THE ACTS, FIRST IN THE DRAWER — every stage's, in dispatch order, each
          row seeking to its own commit. This is where the stepper's carets went.
        */}
        <div style={{ display: 'grid', gap: 14, marginBottom: 14 }}>
          {stages
            .filter((stage) => stage.acts.length > 0)
            .map((stage) => (
              <Disclosure key={stage.stage} shape="card" label={actsLabelOf(stage)} title={<>{`Stage ${stage.number.toLocaleString('en-US')} · ${stage.label}`} <Count>{stage.acts.length.toLocaleString('en-US')}</Count></>}>
                <StageDetail stage={stage} run={run} onSeek={seek} say={setSaid} />
              </Disclosure>
            ))}
        </div>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 20rem), 1fr))' }}>
          <Disclosure shape="card" label={`the commit log, ${state.commits.length.toLocaleString('en-US')} commits`} title={<>Commit log <Count>{state.commits.length.toLocaleString('en-US')}</Count></>}>
            <CommitLog commits={state.commits} onSeek={(id) => void view.seek(id)} />
          </Disclosure>
          <Disclosure shape="card" label={`every request the session refused, ${state.gaps.length.toLocaleString('en-US')} of them`} title={<>Every request the session refused <Count>{state.gaps.length.toLocaleString('en-US')}</Count></>}>
            <GapsPanel gaps={state.gaps} heading={false} />
          </Disclosure>
          <Disclosure shape="card" label={`what the data checks said, ${checks.length.toLocaleString('en-US')} of them`} title={<>What the data checks said <Count>{checks.length.toLocaleString('en-US')}</Count></>}>
            {checks.length === 0 ? (
              <p style={{ margin: 0 }}>the definition&rsquo;s own checks and this surface&rsquo;s own found nothing to report on this entry</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {checks.map((check) => (
                  <li key={check}>{check}</li>
                ))}
              </ul>
            )}
          </Disclosure>
          <Disclosure shape="card" label={`the ${table} table at the cursor`} title={<>The {table} table at the cursor</>}>
            {/* READ-ONLY, and at the cursor: the version keys the grid's blocks, so a
                seek and a refresh both empty them rather than painting old rows */}
            <Sheet className="pw-scope" data={sheetPort} table={table} cursor={state.cursor} version={state.sources?.[table]?.version} height={320} />
          </Disclosure>
        </div>
        <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
          {/* THE RECORDER'S OWN ACCOUNT OF THE WHOLE RUN, in full and in order — the
              focused card quotes the first few of a stage's; this is all of them */}
          {narrativeTitle(run) === null ? null : (
            <Disclosure shape="card" label={narrativeTitle(run) ?? ''} title={narrativeTitle(run)}>
              <RunNarrative run={run} />
            </Disclosure>
          )}
          <Disclosure shape="card" label={ABOUT_TITLE} title={ABOUT_TITLE}>
            {summary === undefined ? null : (
              <p style={{ margin: '0 0 6px' }}>
                <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 10.5, opacity: 0.6, marginRight: 4 }}>summary</span>{' '}
                <ProseText text={summary.text} refs={summary.refs} onSeek={(id) => void view.seek(id)} onBookmark={desk.seekBookmark} describeCommit={desk.describeCommit} />
              </p>
            )}
            <p style={{ margin: 0 }}>
              <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 10.5, opacity: 0.6, marginRight: 4 }}>this desk</span> {claim}
            </p>
          </Disclosure>
          <Disclosure shape="card" label={NOT_HERE_TITLE} title={NOT_HERE_TITLE}>
            <NotHere />
          </Disclosure>
          {record}
        </div>
      </RecordDrawer>
      {/*
        WHAT IS SELECTED — and only once something is.

        A live clause is information and the library's own two parts say it in
        their own words; an empty strip is an instruction, and an instruction
        between the stepper and the charts is the paragraph this desk keeps
        removing. So the row is absent at rest and returns the moment a reader
        selects anything, which is also the moment it has something to say.
      */}
      {state.selections.length === 0 && state.saved.length === 0 ? null : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '5px 24px 6px', background: 'var(--pw-glass-facts)', backdropFilter: 'var(--pw-blur-facts)', WebkitBackdropFilter: 'var(--pw-blur-facts)', borderBottom: '1px solid var(--pw-rule-faint)', minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--pw-soft)', flex: '0 0 auto' }}>selection</span>
          <span aria-hidden style={{ flex: '0 0 1px', alignSelf: 'stretch', background: 'var(--pw-rule-divider)' }} />
          <SelectionChips
            // `pw-scope` is how this desk's tokens reach INSIDE a library part
            // that re-roots `.vzf` on itself — the library's own `className`
            // door, never a selector into its markup (a finding, reported).
            className="pw-scope"
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
              const saved = window.prompt(`Save the ${desk.label(id)} selection as…`);
              if (saved !== null && saved.trim() !== '') desk.savePicture(saved.trim(), { viewId: id });
            }}
          />
          {state.saved.length === 0 ? null : (
            <SavedSelections className="pw-scope" saved={state.saved} selections={state.selections} labels={Object.fromEntries(state.views.map((v) => [v.viewId, desk.label(v.viewId)]))} onApply={desk.applyPicture} />
          )}
        </div>
      )}

      {/*
        THE INSTRUMENT, AS AN L — the focus centre-left, a strip of tiles along
        the bottom, a column of tiles down the right.

        The shape is ASPECT RATIO and nothing else: the design drew the surface
        run at 3.4 : 1 and the cross-chain bars at 3.9 : 1, and the Ramachandran
        at 1 : 1 — so what wants WIDTH waits along the bottom and what wants a
        SQUARE (or rows, which want height) waits down the side
        (`workbench/charts.ts` · `shapeOfView`, read off the def's own
        `chartKind`).

        `minHeight: 0` is load-bearing on every track and every scrollable
        child — the classic grid overflow trap. Without it a child's content
        height wins over its track's, the row grows past the window and the page
        scrolls, which is the one thing this layout may not do.

        THE FOCUS SLOT IS A FIXED SHAPE, deliberately: letting it follow the
        chart in it is the obvious next step and the author asked to see the
        fixed version first, because an area that moves under every press is
        disorienting. The report carries the measurement of what that costs the
        square-ish pictures.
      */}
      <div
        ref={instrument}
        style={{
          /*
            THE LAST ROW OF THE PAGE'S GRID, named from the end — and it has to
            be named.
            The page declares four row tracks and the band above this one comes
            and goes with the reader's own selection, so an implicitly placed
            child lands in whichever track is next: with no selection the
            instrument sat in an `auto` track and the `1fr` one below it took
            208px of empty space (measured: a 541px focus in a 749px gap).
            `-2 / -1` is the last track whatever is above it, and an empty
            `auto` track collapses to nothing.
          */
          gridRow: '-2 / -1',
          minHeight: 0,
          display: 'grid',
          /*
            THE RIGHT COLUMN SCALES BUT CANNOT BECOME USELESS: `clamp(16rem,
            22vw, 22.5rem)` — 256px at its floor, 360px at its ceiling, which is
            where the design drew it. A chart column narrowed past legibility is
            worse than one that stops shrinking, and the floor is the width at
            which a scatter still reads as a shape.
            DEGRADATION, stated: below about 700px of window the focus slot is
            narrower than this column and the instrument is cramped. It does NOT
            reflow — the column does not move under the strip and the strip does
            not wrap — because this is an instrument for a desk, and a second
            layout for a phone is a different product.
          */
          /*
            AND THE READER MAY MOVE IT. `columnTracks(null)` IS the expression
            above, spelled from its own numbers (`./workbench/charts.ts` ·
            `COLUMN_CLAMP`, the one owner of them) plus a 10px DIVIDER TRACK
            between the two columns; a share from the reader replaces the two
            outer tracks with fractions and leaves the divider alone. The `gap`
            is 0 because those ten pixels are now a track: the same ten pixels,
            so the page at rest is unchanged to the pixel and the viewport
            smoke test's numbers still hold.
          */
          gridTemplateColumns: columnTracks(railHeld.share),
          /*
            THE RECLAIMED HEIGHT GOES TO THE TILES, not to the focus slot: the
            author's call. The strip is a BAND of its own — about a third of the
            region, in `fr` and never in pixels, because a tile that draws its
            marks needs a picture's worth of height and every pane of this
            instrument resizes itself to its pane as the window changes. There
            is not one fixed pixel height in here.
          */
          gridTemplateRows: rowTracks(stripHeld.share),
          gap: 0,
          padding: `${String(REGION_PAD.top)}px ${String(REGION_PAD.x)}px ${String(REGION_PAD.bottom)}px`,
        }}
      >
        <div style={{ gridColumn: 1, gridRow: 1, minHeight: 0, minWidth: 0 }}>{promotedCard === null ? (hero === null ? null : card(hero, true, true)) : blockedCard(promotedCard, true)}</div>
        {/*
          THE BOUNDARY BETWEEN THE FOCUS AND THE STRIP BELOW IT — the row the
          `gap` used to be, now a control.

          Its floors: the strip stops where its bars stop being a band rather
          than a line, and the focus stops where it would lose its own axis
          labels — which are also this page's only encoding pickers. Neither is
          a number chosen here (`./workbench/charts.ts` · `dividerFloors`).
        */}
        <div style={{ gridColumn: 1, gridRow: 2, minHeight: 0, minWidth: 0 }}>
          <RegionDivider orientation="horizontal" {...dividerOf('strip')} />
        </div>
        {/*
          THE BOTTOM STRIP — the pictures that want width, as a row of controls.
          They are the wide charts' waiting room: one press puts one of them in
          the focus, where it has the width it was drawn for.
        */}
        <div style={{ gridColumn: 1, gridRow: 3, minWidth: 0, display: 'flex', gap: 10, alignItems: 'stretch' }}>
          {wide.map((c) => tile(c, true))}
        </div>
        {/*
          AND THE BOUNDARY BETWEEN THE FOCUS AND THE RIGHT COLUMN — the one
          with the range, because the column is the pane a reader most often
          wants more or less of. It stops at the width where a scatter still
          reads as a shape (the page's own `16rem`), and at the other end where
          the focus would be no wider than the widest tile.
        */}
        <div style={{ gridColumn: 2, gridRow: '1 / -1', minHeight: 0, minWidth: 0 }}>
          <RegionDivider orientation="vertical" {...dividerOf('rail')} />
        </div>
        {/*
          THE RIGHT COLUMN — the pictures that want a square or rows, and the
          cards of the three steps that will not run here, at their own plan
          steps. It scrolls INSIDE itself: a column cannot hold six things at
          this budget, and growing the page is not an option.
        */}
        {/*
          THE RIGHT COLUMN'S ROWS ARE NOT EQUAL, and that is what makes it read
          as a designed column rather than a fluid one: THE DRAWINGS GET `1fr`
          EACH and the text cards get `auto` — content height and no more. Five
          equal rows gave the two real charts about 120px at 1280×800 while
          three sentences took height they did not need.
        */}
        <div
          style={{
            gridColumn: 3,
            gridRow: '1 / -1',
            minHeight: 0,
            minWidth: 0,
            display: 'grid',
            gap: 10,
            // the drawings get `1fr` each; the ONE card of blocked steps takes
            // its content's height and no more (it was three cards at 59px —
            // 177px of a 583px column for three sentences)
            gridTemplateRows: `${drawnTall.map(() => 'minmax(0, 1fr)').join(' ')} ${saidTall.map(() => 'auto').join(' ')} ${waiting.length === 0 ? '' : 'auto'}`.trim().replace(/\s+/g, ' '),
            overflow: 'hidden',
          }}
        >
          {drawnTall.map((c) => tile(c, false))}
          {saidTall.map((c) => tile(c, false))}
          {/* NO MARKS TO DRAW AND NOTHING TO FILTER: three steps that will not
              run here, in one card of three rows — each row its own control,
              opening its own card where the whole reason is. */}
          {waiting.length === 0 ? null : (
            <BlockedGroup
              label="the declared steps this build will not run, and which kind of blocked each one is"
              rows={waiting.map((b) => ({ id: b.id, name: b.name, tag: b.tag, short: b.short, promote: { label: promoteCardLabel(b.name), onPress: () => setPromoted({ stage: here?.stage ?? null, id: b.id }) } }))}
            />
          )}
        </div>
      </div>

    </div>
  );
}
