/**
 * THE MEASURED DESK — the fifth desk's composition, and it wears the FOURTH
 * desk's clothes because it is the same instrument with different dials.
 *
 * ── THE DEFECT THIS FILE CLOSES ────────────────────────────────────────────
 * This page used to be built with `vizfootprint-studio/desk` · `Desk`, the
 * library's packaged cockpit, while the protein desk beside it — the one it
 * exists to be COMPARED WITH, on the same entry, one link apart — is the
 * workbench (`web/src/protDesk.tsx`). Two desks built to be read side by side
 * wearing two different layouts means a reader cannot tell whether a difference
 * on screen is the SCORING or the SCREEN, which is the only question either
 * page is for. The author's ruling: *"I expected you to use exactly this same
 * UI/UX for this, because both are same purpose."*
 *
 * So every component on this page is the workbench's own module, imported and
 * not copied: `WorkbenchHeader`, `StageStepper`, `ChartCard`, `ChartTile`,
 * `PaneHome`, `RegionDivider`, `RecordDrawer`, `Disclosure`, `Count`, and the
 * theme those are all drawn from. `tests/hot-layers.test.ts` asserts it by
 * import, so a later change that quietly forks one of them fails.
 *
 * ── THE FOUR LAYERS, exactly as the fourth desk keeps them ─────────────────
 *   1. THEME       `../workbench/theme.css` + `../workbench/tokens.ts`. Not one
 *                  colour is written here.
 *   2. COMPONENTS  `../workbench/Chrome.tsx`, `ChartCard.tsx`, `Stepper.tsx` —
 *                  props in, markup out, unchanged.
 *   3. BUSINESS    `../workbench/charts.ts`, `steps.ts`, `arrangement.ts`,
 *                  `bands.ts`, and this desk's OWN `./stages.ts` — pure
 *                  functions from the run to the props.
 *   4. DATA        `../protProjection.tsx`, `../protRows.ts` and
 *                  `src/hot/session.ts` — the only code here that touches the
 *                  session.
 *
 * THIS file is the wiring 4 → 3 → 2 and nothing else, which is the same
 * sentence `web/src/protDesk.tsx` opens with.
 *
 * ── WHAT IS NOT HERE, and why each absence is a fact rather than a cut ──────
 *   * NO 3D VIEWER. This desk draws no molecule (`tests/hot-site.test.ts`
 *     pins that it loads no byte of one), so `ViewerBox` has nothing to hold.
 *   * NO `Recommendation` AND NO `BlockedGroup`. Those two draw what a MODEL
 *     said at a stage and the steps a build will not run. This desk asks no
 *     model and declares nothing it does not dispatch: six stages, six acts,
 *     all six landed. A blocked card here would be a card about nothing.
 *   * NO SEARCH. The fourth desk opens on a question; this one opens on the
 *     committed entry, so the header's way-back slot is absent rather than a
 *     button with no destination (`../workbench/Chrome.tsx` ·
 *     `WorkbenchHeaderProps.searchAgain`, widened for exactly this).
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
  cellOrderFromLayoutValue,
  framePad,
  sessionSheetData,
  themeAttr,
  useSessionView,
  type SessionView,
  type SheetSessionLike,
} from 'vizfootprint-ui';
import type { DeskChart } from 'vizfootprint-studio/desk';
import type { InteractionSession } from 'vizfootprint/agent';
import type { EntryCredit, ProtTables } from '../../../src/prot/etl.js';
import type { ActOutcome } from '../../../src/prot/orchestrator.js';
import { HOT_ENCODINGS, HOT_WORDS, RESIDUES_TABLE } from '../../../src/hot/def.js';
import { residuesAt as hotResiduesAt, type HotRun } from '../../../src/hot/session.js';
import type { ResiduesAtCursor } from '../../../src/hot/session.js';
import { AXIS_ROOM, useHotCells, type HotDeskData } from './cells.js';
import { HOT_RECEIPTS, hotCardWords, hotStepperStages } from './stages.js';
import type { Row } from '../derive.js';
import { useProtProjection } from '../protProjection.js';
import { useResiduesAtCursor, type ResiduesNow } from '../protRows.js';
import { ActRow } from '../protTrace.js';
import { actColumnsOf, chartsOfStage, stageAtCursor, type StepperStage } from '../protStages.js';
import { Count, Disclosure, RecordDrawer, RegionDivider, WorkbenchHeader, type DividerAction } from '../workbench/Chrome.js';
import { ChartCard, ChartTile, PaneHome, type ArrangeHandle } from '../workbench/ChartCard.js';
import {
  ARRANGEMENT_PROP,
  arrangePanes,
  arrangementSaid,
  defaultPaneOrder,
  dropLabel,
  heldLabel,
  heldSaid,
  homeSaid,
  pickUpLabel,
  slotsOf,
  stripSlots,
  swapPanes,
} from '../workbench/arrangement.js';
import { StageStepper } from '../workbench/Stepper.js';
import { methodLine } from '../workbench/bands.js';
import {
  DIVIDER_HINT,
  DIVIDER_LABEL,
  DIVIDER_TRACK,
  REGION_PAD,
  SPLIT_DEFAULT,
  clampShare,
  columnTracks,
  dividerFloors,
  dividerValues,
  parseSplit,
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
} from '../workbench/charts.js';
import { STEPPER_LABEL, actsLabelOf, stepViews } from '../workbench/steps.js';

/**
 * WHERE THIS DESK'S ARRANGEMENT LANDS — `layout:hot-desk.panes`, its own scope
 * and not the fourth desk's.
 *
 * The prop is the workbench's (`../workbench/arrangement.ts` ·
 * `ARRANGEMENT_PROP`) because it means the same thing on both desks — a
 * permutation over the panes. The SCOPE is this desk's own, because a commit
 * that said `layout:protein-desk` on the measured desk's log would be naming
 * the wrong instrument in the reader's own record.
 */
export const HOT_ARRANGEMENT_SCOPE = 'hot-desk';

/** Per reader, per browser, and never on the session: a pane's size is furniture, not a finding. */
const SPLIT_STORAGE_KEY = 'pw.hot.dividers.v1';

/** This browser's remembered boundaries, read safely — storage that throws costs the memory and nothing else. */
function rememberedSplit(): RegionSplit {
  try {
    return parseSplit(window.localStorage.getItem(SPLIT_STORAGE_KEY));
  } catch {
    return SPLIT_DEFAULT;
  }
}

const ABOUT_TITLE = 'About this dashboard and this desk — the definition’s own summary at this cursor, and the claim this desk makes about itself';

export interface HotDeskProps {
  /** THE one session view — made by the page, read by every piece below. */
  readonly view: SessionView;
  /** The session this desk's rows and sheet are read from — one session, read two ways (`SheetSessionLike` is three of its methods). */
  readonly session: InteractionSession;
  /** The rows the sheet and the row-following read need the shape of. */
  readonly tables: ProtTables;
  /** The boot's own answer, stamped with the commit it was read at — the seed the cursor-following read starts from. */
  readonly seed: ResiduesAtCursor;
  /** The patches and the pre-act refusal — everything the cells draw that is not a row (`./cells.tsx` · `HotDeskData`). */
  readonly data: Omit<HotDeskData, 'residues'>;
  /** The finished run, or `null` while its stages are still dispatching. */
  readonly run: HotRun | null;
  /** The acts that have come back so far, in dispatch order. */
  readonly outcomes: readonly ActOutcome[];
  /** The def's own data checks plus this surface's problems — shown, never counted and hidden. */
  readonly checks: readonly string[];
  /** The entry's credit, read out of its own header records — the header band's content. */
  readonly credit: EntryCredit;
  /** What the page adds to the record: its own provenance and the static-build note. */
  readonly record: ReactNode;
  /** The reader's arrangement, landed through the page's own door. Absent ⇒ no handle is drawn rather than a dead one. */
  onArrange?(order: readonly string[], words: string): Promise<string | null>;
}

/**
 * WHICH COMMIT THE PICTURES ARE DRAWN AT — the fourth desk's three sentences,
 * in this desk's own voice (`web/site/prot/entry.tsx` · `rowsNote` argues the
 * three states; none of them is silent).
 */
function rowsNote(residues: ResiduesNow): ReactNode {
  const NOTE = { fontSize: 12, lineHeight: 1.5, margin: '.4rem 0 0' } as const;
  if (residues.refused !== null) {
    return (
      <p role="status" style={{ ...NOTE, color: 'var(--pw-refuse-ink)' }}>
        the rows at this commit were refused, in the library&rsquo;s own words: <i>{residues.refused}</i>
      </p>
    );
  }
  if (residues.reading) {
    return (
      <p role="status" style={{ ...NOTE, color: 'var(--pw-mid-2)' }}>
        reading the rows at the commit you just moved to — the pictures below are still the previous one&rsquo;s until it answers
      </p>
    );
  }
  return (
    <p role="status" style={{ ...NOTE, color: 'var(--pw-mid-2)' }}>
      {residues.rows.length.toLocaleString('en-US')} rows, as they stand at{' '}
      {residues.cursor === null ? 'the root of this log — no act has landed yet' : `commit ${residues.cursor}`}
    </p>
  );
}

export function HotDesk({ view, session, tables, seed, data, run, outcomes, checks, credit, record, onArrange }: HotDeskProps): JSX.Element {
  // ── LAYER 4: the data ─────────────────────────────────────────────────────
  const state = useSessionView(view);
  const sheetPort = useMemo(() => sessionSheetData(session as SheetSessionLike, { table: RESIDUES_TABLE }), [session]);
  const { desk, notice } = useProtProjection(view, state);
  /**
   * THE ROWS AT THE CURSOR, RE-READ WHEN IT MOVES — and this desk needed it for
   * the same reason the fourth desk did.
   *
   * Every column its six acts land is resolved AT THE CURSOR, so the boot's one
   * read is the boot's cursor forever: with it, the stepper is a control that
   * changes nothing on screen. The hook is the workbench's
   * (`../protRows.ts` · `useResiduesAtCursor`) and the DOOR is this desk's own
   * (`src/hot/session.ts` · `residuesAt`), handed in.
   */
  const residues = useResiduesAtCursor(view, session, tables, seed, hotResiduesAt);
  const root = useRef<HTMLDivElement>(null);
  /**
   * Called ONCE, unconditionally, from this body — the rule
   * `vizfootprint-studio/desk` · `DeskCharts` states, and the reason the cells
   * may use hooks inside it. The rows are the CURSOR'S, falling back to the
   * parse's own when a read was refused — and the refusal is printed above
   * rather than covered by that fallback.
   */
  const cells = useHotCells(desk, {
    ...data,
    residues: (residues.refused === null ? residues.rows : tables.residues) as readonly Row[],
  });
  const [said, setSaid] = useState<string | null>(null);

  // ── the reader moves the boundaries (a layout preference, never a commit) ──
  const instrument = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState<RegionSplit>(rememberedSplit);
  const [stop, setStop] = useState<{ readonly which: DividerId; readonly at: SplitStop } | null>(null);
  const [laid, setLaid] = useState<{ readonly w: number; readonly h: number; readonly rail: number; readonly strip: number }>({ w: 0, h: 0, rail: 0, strip: 0 });
  const measure = useCallback((): void => {
    const el = instrument.current;
    if (el === null) return;
    const used = window.getComputedStyle(el);
    const columns = trackPx(used.gridTemplateColumns);
    const rows = trackPx(used.gridTemplateRows);
    setLaid((was) => {
      const next = { w: el.clientWidth - REGION_PAD.x * 2, h: el.clientHeight - REGION_PAD.top - REGION_PAD.bottom, rail: columns[2] ?? was.rail, strip: rows[2] ?? was.strip };
      return next.w === was.w && next.h === was.h && next.rail === was.rail && next.strip === was.strip ? was : next;
    });
  }, []);
  useLayoutEffect(() => {
    const el = instrument.current;
    if (el === null) return undefined;
    measure();
    const watching = new ResizeObserver(() => measure());
    watching.observe(el);
    return () => watching.disconnect();
  }, [measure]);
  useLayoutEffect(() => {
    measure();
  }, [measure, split]);
  useEffect(() => {
    try {
      const raw = serialiseSplit(split);
      if (raw === null) window.localStorage.removeItem(SPLIT_STORAGE_KEY);
      else window.localStorage.setItem(SPLIT_STORAGE_KEY, raw);
    } catch {
      /* a private window, cleared site data, a preview */
    }
  }, [split]);
  const chartPad = useMemo(() => framePad(['line', 'bar', 'point']), []);
  const floors = useMemo(() => dividerFloors({ pad: chartPad, axisRoom: AXIS_ROOM }), [chartPad]);
  const railHeld = clampShare(split.rail, laid.w, floors.rail);
  const stripHeld = clampShare(split.strip, laid.h, floors.strip);
  const standing = (which: DividerId): number => {
    const room = (which === 'rail' ? laid.w : laid.h) - DIVIDER_TRACK;
    return room <= 0 ? 0 : (which === 'rail' ? laid.rail : laid.strip) / room;
  };
  /** ONE GESTURE ON ONE DIVIDER — the only place a share is written, and the only place a floor is applied. */
  const act = (which: DividerId, action: DividerAction): void => {
    const el = instrument.current;
    if (el === null) return;
    const box = el.getBoundingClientRect();
    const axis = which === 'rail' ? { start: box.left + REGION_PAD.x, extent: laid.w } : { start: box.top + REGION_PAD.top, extent: laid.h };
    const stops = which === 'rail' ? floors.rail : floors.strip;
    if (action.kind === 'default') {
      setSplit(which === 'rail' ? { rail: null, strip: split.strip } : { rail: split.rail, strip: null });
      setStop(null);
      return;
    }
    const asked = action.kind === 'move' ? shareAtPointer(action.pointer, axis) : action.kind === 'nudge' ? shareAfterStep(standing(which), axis.extent, action.px) : shareAtEdge(stops, axis.extent, action.to);
    const held_ = clampShare(asked, axis.extent, stops);
    setSplit(which === 'rail' ? { rail: held_.share, strip: split.strip } : { rail: split.rail, strip: held_.share });
    const at: SplitStop = action.kind === 'edge' ? (action.to === 'min' ? 'focus' : 'satellites') : held_.stop;
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
  const stages = useMemo(() => hotStepperStages(outcomes, run), [outcomes, run]);
  /** Where the cursor is standing, in stages — the last stage that had landed by then. */
  const here = stageAtCursor(stages, state.activePathIds, state.cursor);
  const actColumns = useMemo(() => actColumnsOf(stages), [stages]);
  const focus = useMemo(() => new Set(here === null ? [] : chartsOfStage(here, desk.shown, actColumns, stages, HOT_RECEIPTS)), [here, desk.shown, actColumns, stages]);
  /** What the reader promoted, and the stage they promoted it in — an override, never a second source of truth. */
  const [promoted, setPromoted] = useState<{ readonly stage: string | null; readonly id: string } | null>(null);
  const promotedId = promoted !== null && promoted.stage === (here?.stage ?? null) ? promoted.id : null;
  const ownerOf = (id: string): StepperStage | null => stageOfChart(stages, id, desk.shown, actColumns, HOT_RECEIPTS);
  const pictures = cells;
  const promotedCell = pictures.find((c) => c.id === promotedId) ?? null;
  /** The pictures THIS STAGE produced. */
  const produced = splitByFocus(pictures, focus).hero;

  // ── the desk as slots, and the reader's permutation over them ─────────────
  /** Which shape each picture wants, read off THIS desk's own declaration (`src/hot/def.ts` · `HOT_ENCODINGS`). */
  const shapeOf = useCallback((id: string) => shapeOfView(id, HOT_ENCODINGS), []);
  const defaults = useMemo(() => defaultPaneOrder(pictures.map((c) => c.id), (id) => shapeOf(id) === 'wide', () => false), [pictures, shapeOf]);
  const recordedOrder = useMemo(() => cellOrderFromLayoutValue(state.layouts?.[HOT_ARRANGEMENT_SCOPE]?.[ARRANGEMENT_PROP]), [state.layouts]);
  const arranged = useMemo(() => arrangePanes(defaults, recordedOrder), [defaults, recordedOrder]);
  const stripCount = useMemo(() => stripSlots(arranged.panes, (id) => shapeOf(id) === 'wide'), [arranged.panes, shapeOf]);
  const focusPaneId: string | null = promotedCell?.id ?? produced[0]?.id ?? pictures[0]?.id ?? null;
  const slots = useMemo(() => slotsOf(arranged.panes, stripCount, focusPaneId), [arranged.panes, stripCount, focusPaneId]);
  const paneAt = useMemo(() => new Map(pictures.map((c) => [c.id, c])), [pictures]);
  const paneOf = (id: string): readonly DeskChart[] => {
    const cell = paneAt.get(id);
    return cell === undefined ? [] : [cell];
  };
  const hero: DeskChart | null = slots.focus === null ? null : (paneAt.get(slots.focus) ?? null);
  const heroStage = hero === null ? null : ownerOf(hero.id);
  /** The stage the reader is looking at — what the stepper's bar and `aria-current` follow. */
  const focusedStage: StepperStage | null = heroStage;
  const liveViews = useMemo(() => new Set(state.selections.filter((s) => s.value !== null).map((s) => s.viewId)), [state.selections]);
  const summary = state.dashboard?.prose.find((p) => p.slot === 'caption');

  // ── the arrangement act, and the report that is not one ──────────────────
  const [held, setHeld] = useState<string | null>(null);
  const dragging = useRef<{ readonly id: string; readonly x: number; readonly y: number; moved: boolean } | null>(null);
  const droppedJust = useRef(false);
  const landSwap = (a: string, b: string): void => {
    setHeld(null);
    if (onArrange === undefined) return;
    const next = swapPanes(arranged.panes, a, b);
    if (next === null) return;
    setSaid(null);
    void onArrange(next, dropLabel(a, b)).then((refusal) => {
      if (refusal !== null) setSaid(refusal);
    });
  };
  const pressHandle = (id: string): void => {
    if (droppedJust.current) {
      droppedJust.current = false;
      return;
    }
    if (held === null) {
      setHeld(id);
      setSaid(heldSaid(desk.label(id)));
      return;
    }
    if (held === id) {
      setHeld(null);
      setSaid(null);
      return;
    }
    landSwap(held, id);
  };
  const grabHandle = (id: string, at: { readonly x: number; readonly y: number }): void => {
    dragging.current = { id, x: at.x, y: at.y, moved: false };
    const move = (e: PointerEvent): void => {
      const now = dragging.current;
      if (now === null || now.moved) return;
      if (Math.abs(e.clientX - now.x) <= 4 && Math.abs(e.clientY - now.y) <= 4) return;
      now.moved = true;
      setHeld(id);
    };
    const up = (e: PointerEvent): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const now = dragging.current;
      dragging.current = null;
      if (now === null || !now.moved) return;
      droppedJust.current = true;
      const box = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-chart],[data-home]') ?? null;
      const onto = box === null ? null : (box.getAttribute('data-home') ?? box.getAttribute('data-chart'));
      if (onto === null || onto === now.id || !arranged.panes.includes(onto)) {
        setHeld(null);
        return;
      }
      landSwap(now.id, onto);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  useEffect(() => {
    if (held === null) return undefined;
    const key = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      setHeld(null);
      setSaid(null);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [held]);
  const handleOf = (id: string): ArrangeHandle | null => {
    if (onArrange === undefined) return null;
    const label = desk.label(id);
    return {
      label: held === null ? pickUpLabel(label) : held === id ? heldLabel(label) : dropLabel(desk.label(held), label),
      held: held === id,
      target: held !== null && held !== id,
      onPress: () => pressHandle(id),
      onGrab: (at) => grabHandle(id, at),
    };
  };

  /** The seek, and its answer handed straight back for the stepper to print. */
  const seek = async (commitId: string): Promise<string | null> => {
    const answered = await view.seek(commitId);
    return answered.ok ? null : answered.sentence;
  };
  /**
   * ONE PRESS ON A COLUMN. Every stage of this desk lands a commit, so every
   * press seeks — and a stage that owns no picture SAYS so rather than moving
   * the cursor in silence.
   */
  const press = (key: string): void => {
    const stage = stages.find((s) => s.stage === key);
    if (stage === undefined) return;
    if (stage.commit === null) {
      setSaid(`stage ${String(stage.number)} has landed nothing on this session, so there is no commit to move to`);
      return;
    }
    setPromoted(null);
    const owns = chartsOfStage(stage, desk.shown, actColumns, stages, HOT_RECEIPTS);
    void seek(stage.commit).then(
      (refused) =>
        setSaid(
          refused ??
            (owns.length > 0
              ? null
              : `stage ${String(stage.number)} landed ${stage.materialized.join(', ')} and no picture on this desk is drawn from those columns, so the cursor moved and the focus could not`),
        ),
      (e: unknown) => setSaid(`that seek threw: ${e instanceof Error ? e.message : String(e)}`),
    );
  };
  const steps = stepViews(stages, focusedStage, true);
  const at = rowsNote(residues);
  const cardStage = focusedStage === null ? null : hotCardWords(focusedStage);

  /** ONE CARD, wired: the library's picture inside this desk's frame — the workbench's `ChartCard`, unchanged. */
  const card = (c: DeskChart, focused: boolean): JSX.Element => {
    const label = desk.label(c.id);
    return (
      <ChartCard
        key={c.id}
        id={c.id}
        label={label}
        focused={focused}
        howToRead={desk.proseOf(c.id).find((p) => p.slot === 'howToRead')?.text ?? null}
        // EMPTY, for every library chart: `VizLine` draws its own legend inside
        // its SVG whenever it is split into two or more series (a finding the
        // fourth desk already reports).
        legend={[]}
        stage={focused && cardStage !== null ? { mark: cardStage.mark, line: cardStage.line, facts: [], refusal: cardStage.refusal } : null}
        footLeft={null}
        footRight={null}
        note={c.caption ?? null}
        noteLabel="Full note"
        noteAria={`the full note for ${label}`}
        clear={liveViews.has(c.id) ? { label: `clear the ${label} selection`, onPress: () => void view.clear(c.id, `clear ${label}`) } : null}
        arrange={handleOf(c.id)}
        height="fill"
      >
        <ChartFrame>{(size) => c.render(size)}</ChartFrame>
      </ChartCard>
    );
  };

  /** ONE TILE, wired — a name, a press that brings it into the focus, and its picture, live. */
  const tile = (c: DeskChart, wide_: boolean): JSX.Element =>
    c.id === slots.focus ? (
      <PaneHome key={c.id} id={c.id} label={desk.label(c.id)} said={homeSaid(desk.label(c.id))} arrange={handleOf(c.id)} />
    ) : (
      <ChartTile
        key={c.id}
        id={c.id}
        label={desk.label(c.id)}
        said={null}
        wide={wide_}
        arrange={handleOf(c.id)}
        promote={{ label: promoteChartLabel(desk.label(c.id)), onPress: () => setPromoted({ stage: here?.stage ?? null, id: c.id }) }}
      >
        <ChartFrame>{(size) => c.render(size)}</ChartFrame>
      </ChartTile>
    );

  const wide = slots.strip.flatMap(paneOf);
  const tall = slots.column.flatMap(paneOf);
  /**
   * THE RIGHT COLUMN'S TRACKS — and a SQUARE pane gets a SQUARE box, measured
   * off the column's own used width.
   *
   * This desk has exactly one satellite that is not a wide run, and `1fr` gave
   * it the whole column: a 1:1 scatter drawn 290 x 780, which is the shape the
   * layout law exists to prevent (`../workbench/charts.ts` · `shapeOfView` —
   * *what wants a SQUARE waits down the side*). A square pane therefore takes
   * its own width in height and no more, and the column centres what it holds,
   * so one satellite reads as a designed panel rather than a stretched one.
   * With several the tracks sum past the column and it fills exactly as the
   * fourth desk's does.
   *
   * `laid.rail` is the track the BROWSER laid out (`trackPx`), so it follows
   * the reader's own divider rather than re-deriving the page's clamp.
   */
  const columnTrack = (c: DeskChart): string => (shapeOf(c.id) === 'square' && laid.rail > 0 ? `minmax(0, ${String(Math.round(laid.rail))}px)` : 'minmax(0, 1fr)');

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
        // THE INSTRUMENT FITS THE WINDOW — `height`, never `min-height`
        // (`web/src/protDesk.tsx` carries the measurement that made it so).
        height: '100dvh',
        display: 'grid',
        gridTemplateRows: 'auto auto auto minmax(160px, 1fr)',
        position: 'relative',
      }}
    >
      <WorkbenchHeader
        title={HOT_WORDS.name}
        entry={credit.entry}
        entryTitle={credit.title.toLowerCase()}
        method={methodLine(credit)}
        at={
          <>
            {at}
            {/*
              AND WHAT THIS PAGE'S OWN ACTS LAST GOT WRONG — `notice` ONLY, and
              never `said`.
              It carried both for one round, and a browser showed the cost: a
              refused seek's sentence is already printed under the stepper
              (`StageStepper` · `refusedSeek`, beside the control that asked for
              it), so putting it here too said it twice AND wrapped the header
              band to three rows. One fact, one place, and the place is the
              control that produced it.
            */}
            {notice === null ? null : (
              <span role="alert" style={{ fontSize: 11.5, color: 'var(--pw-refuse-ink)' }}>
                ⚠ {notice}
              </span>
            )}
          </>
        }
      />

      {/* THE STEPPER IS THE CURSOR — six stages, six acts, one commit each */}
      <StageStepper steps={steps} label={STEPPER_LABEL} refusedSeek={said} onSeek={press} />

      <RecordDrawer
        label={`open the record: ${state.commits.length.toLocaleString('en-US')} commits, ${state.gaps.length.toLocaleString('en-US')} refused requests, ${checks.length.toLocaleString('en-US')} data checks, the ${RESIDUES_TABLE} table at the cursor, and what this page cannot say`}
        title={
          <>
            <Count>{state.commits.length.toLocaleString('en-US')}</Count> commits · <Count>{state.gaps.length.toLocaleString('en-US')}</Count> refused requests · <Count>{checks.length.toLocaleString('en-US')}</Count> data checks · the {RESIDUES_TABLE} table at the
            cursor · what this page cannot say
          </>
        }
      >
        {/* THE ACTS, FIRST IN THE DRAWER — every stage's, in dispatch order, each row seeking to its own commit. */}
        <div style={{ display: 'grid', gap: 14, marginBottom: 14 }}>
          {stages
            .filter((stage) => stage.acts.length > 0)
            .map((stage) => (
              <Disclosure key={stage.stage} shape="card" label={actsLabelOf(stage)} title={<>{`Stage ${stage.number.toLocaleString('en-US')} · ${stage.label}`} <Count>{stage.acts.length.toLocaleString('en-US')}</Count></>}>
                <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                  {stage.acts.map((outcome) => (
                    // `run={null}`: every act of this desk lands COLUMNS, which
                    // `landedLine` names off the outcome itself — the fourth
                    // desk's `run` argument is there for its one act whose
                    // answer is a table, and this desk declares none.
                    <ActRow key={`${outcome.stage}:${outcome.act}`} outcome={outcome} run={null} onSeek={seek} say={setSaid} />
                  ))}
                </ul>
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
          <Disclosure shape="card" label={`the ${RESIDUES_TABLE} table at the cursor`} title={<>The {RESIDUES_TABLE} table at the cursor</>}>
            <Sheet className="pw-scope" data={sheetPort} table={RESIDUES_TABLE} cursor={state.cursor} version={state.sources?.[RESIDUES_TABLE]?.version} height={320} />
          </Disclosure>
        </div>
        <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
          <Disclosure shape="card" label={ABOUT_TITLE} title={ABOUT_TITLE}>
            {summary === undefined ? null : (
              <p style={{ margin: '0 0 6px' }}>
                <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 10.5, opacity: 0.6, marginRight: 4 }}>summary</span>{' '}
                <ProseText text={summary.text} refs={summary.refs} onSeek={(id) => void view.seek(id)} onBookmark={desk.seekBookmark} describeCommit={desk.describeCommit} />
              </p>
            )}
            <p style={{ margin: 0 }}>
              <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 10.5, opacity: 0.6, marginRight: 4 }}>this desk</span> {HOT_WORDS.title}
            </p>
            {/* WHAT THE RECORDED ARRANGEMENT NAMES THAT THIS DESK HAS NO PANE FOR — said once, and the trace is never rewritten to match. */}
            {arrangementSaid(arranged.missing).map((sentence) => (
              <p key={sentence.slice(0, 40)} style={{ margin: '6px 0 0' }}>
                <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 10.5, opacity: 0.6, marginRight: 4 }}>the arrangement</span> {sentence}
              </p>
            ))}
          </Disclosure>
          {record}
        </div>
      </RecordDrawer>

      {/* WHAT IS SELECTED — and only once something is. */}
      {state.selections.length === 0 && state.saved.length === 0 ? null : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '5px 24px 6px', background: 'var(--pw-glass-facts)', backdropFilter: 'var(--pw-blur-facts)', WebkitBackdropFilter: 'var(--pw-blur-facts)', borderBottom: '1px solid var(--pw-rule-faint)', minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--pw-soft)', flex: '0 0 auto' }}>selection</span>
          <span aria-hidden style={{ flex: '0 0 1px', alignSelf: 'stretch', background: 'var(--pw-rule-divider)' }} />
          <SelectionChips
            className="pw-scope"
            selections={state.selections}
            cleared={state.cleared}
            links={state.links}
            labels={Object.fromEntries(state.views.map((v) => [v.viewId, desk.label(v.viewId)]))}
            onClear={(id) => void view.clear(id, `clear ${desk.label(id)}`)}
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

      {/* THE INSTRUMENT, AS AN L — the focus centre-left, a strip of tiles along the bottom, a column of tiles down the right. */}
      <div
        ref={instrument}
        style={{
          gridRow: '-2 / -1',
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: columnTracks(railHeld.share),
          gridTemplateRows: rowTracks(stripHeld.share),
          gap: 0,
          padding: `${String(REGION_PAD.top)}px ${String(REGION_PAD.x)}px ${String(REGION_PAD.bottom)}px`,
        }}
      >
        <div style={{ gridColumn: 1, gridRow: 1, minHeight: 0, minWidth: 0 }}>{hero === null ? null : card(hero, true)}</div>
        <div style={{ gridColumn: 1, gridRow: 2, minHeight: 0, minWidth: 0 }}>
          <RegionDivider orientation="horizontal" {...dividerOf('strip')} />
        </div>
        <div style={{ gridColumn: 1, gridRow: 3, minWidth: 0, minHeight: 0, overflow: 'hidden', display: 'grid', gap: 10, gridTemplateColumns: `repeat(${String(Math.max(1, wide.length))}, minmax(0, 1fr))`, alignItems: 'stretch' }}>
          {wide.map((c) => tile(c, true))}
        </div>
        <div style={{ gridColumn: 2, gridRow: '1 / -1', minHeight: 0, minWidth: 0 }}>
          <RegionDivider orientation="vertical" {...dividerOf('rail')} />
        </div>
        <div style={{ gridColumn: 3, gridRow: '1 / -1', minHeight: 0, minWidth: 0, display: 'grid', gap: 10, gridTemplateRows: tall.map(columnTrack).join(' '), alignContent: 'center', overflow: 'hidden' }}>
          {tall.map((c) => tile(c, false))}
        </div>
      </div>
    </div>
  );
}
