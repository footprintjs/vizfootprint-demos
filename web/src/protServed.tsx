/**
 * THE PROTEIN DESK, SERVED — the same desk, with a process standing behind it,
 * and the ONE thing that buys: stage 5.
 *
 * ── WHY THIS PAGE EXISTS, AND WHAT IT IS NOT ───────────────────────────────
 * `web/site/prot/entry.tsx` is the published desk. It performs stages 1 to 4 in
 * a browser — the archive, two services and two engines all answer a page — and
 * it says out loud that it cannot perform stage 5, because a static page cannot
 * hold the key that would call a model (`src/prot/plan.ts` · step 5). **That is
 * the architecture and not a shortfall, and nothing here changes it:** this page
 * is not in the static build, the published desk's sentence is untouched, and
 * `tests/prot-plan.test.ts` is the test that keeps it that way.
 *
 * This is the LOCAL page, for somebody who cloned the project and ran it:
 *
 *   npm run serve      # the demo API on 5290 — the door and the committed bytes
 *   npm run web:dev    # http://localhost:5291/prot/  (this page, /api proxied)
 *
 * ── WHERE EACH HALF LIVES, and the reason the split is this way ────────────
 * The PAGE holds the dashboard, the commit log and the rows, exactly as the
 * published one does — so stage 5's ranking lands on the SAME log as every
 * other stage's, and the crossfilter reaches it without anybody wiring a second
 * anything. The SERVER holds only the part a static page cannot do: standing in
 * front of a model with a key (`server/prot-doors.ts`). So the evidence goes UP
 * as the findings ledger this run's own recorders produced, and the ranked list
 * with its citations and the judge's verdicts comes back DOWN.
 *
 * One record, not two. A server-side session would have been a second answer to
 * *where did this column come from*.
 *
 * ── AND THE STAGE SAYS WHICH OF THE THREE THINGS HAPPENED ──────────────────
 * Every state reaches the stepper as an OUTCOME and the card as a sentence:
 * a ranking that landed, a stage that ran and was refused, or a process with no
 * key — which is a different reason from the published build's and is shown as
 * its own (`server/prot-doors.ts` · `chooseHotspotDriver`).
 *
 * ── AND THE PAGE SAYS WHAT IT IS DOING WHILE IT DOES IT ────────────────────
 * The author's question, watching this page boot: *"why is this not live status
 * support instead of this static text?"* It was one paragraph, over a boot that
 * really performs six http reads, an ETL, a dashboard build, three probe
 * gestures, four stages and a model call — every one of them a fact this
 * function held and threw away.
 *
 * It reports all of them now ({@link BootWatch} → `./workbench/boot.ts` →
 * `./workbench/BootReport.tsx`), under one law: **progress is a REPORT —
 * transient, reaching no commit, never evidence, and nothing computes from it.
 * A stage's STATE is a fact and belongs on screen; a PAYLOAD never does.**
 *
 * For stage 5 that law has a sharp edge and it is the author's decision rather
 * than a question left open: **SHOW THE ACT, NEVER THE ANSWER.** No partial
 * ranking text reaches this screen at any point, and the reason is measured
 * rather than reasoned — `src/prot/streamReports.ts` carries it.
 */
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { cellOrderToLayoutValue, createSessionView, sessionSource } from 'vizfootprint-ui';
import { ARRANGEMENT_PROP, ARRANGEMENT_SCOPE } from './workbench/arrangement.js';
import 'vizfootprint-ui/styles.css';
import { loadStructureOverHttp, readCommittedOverHttp, PROT_COMMITTED_READS, type HttpWatch } from '../../src/prot/http.js';
import { conservationEvidenceFor } from '../../src/prot/conservationEvidence.js';
import { annotationEvidenceFor } from '../../src/prot/annotationEvidence.js';
import { entryCredit, protTables, type EntryCredit } from '../../src/prot/etl.js';
import { INTERFACE_VIEW, PROT_WORDS, RESIDUES_TABLE, RESIDUE_KEY, STRUCTURE_VIEW } from '../../src/prot/def.js';
import { landHotspots, openProtSurfaceAsync, protSurfaceProblems, residuesAt, type ProtBootWatch, type ProtSurface } from '../../src/prot/session.js';
import { ARCHIVE_LICENCE, EXAMPLE_ENTRY, browserArchive, openEntryBytes } from '../../src/prot/archive.js';
import { blockingSentence, entryNotes, readEntryBytes, type EntryNote } from '../../src/prot/entryNotes.js';
import { HOTSPOTS_ACT, HOTSPOTS_STAGE, HOTSPOT_RANK_COLUMN, STREAM_DIED, coverRefusal, hotspotLedger, hotspotSlot, landedThrough, notTheEndOfTheRun, type HotspotFailure, type HotspotLedger, type HotspotOutcome } from '../../src/prot/hotspots.js';
import type { HotspotReport } from '../../src/prot/streamReports.js';
import type { ActOutcome } from '../../src/prot/orchestrator.js';
// THE DOOR, in the one module that reaches outside this browser — and the one
// a test can import without mounting a page (`./protDoor.ts` says why).
import { DOOR, askDoorForHotspots, askDoorState, type DoorState } from './protDoor.js';
import { EntryNotes, ProtLanding, entryInUrl, urlForEntry } from './protLanding.js';
import { useResiduesAtCursor } from './protRows.js';
import { ProtDesk, RunStepper } from './protDesk.js';
import type { HotspotCardInput } from './workbench/panel.js';
import { NOTHING_REPORTED, bootNow, bootSteps, type BootReport as BootReported } from './workbench/boot.js';
import { BootLine } from './workbench/BootReport.js';
import type { ProtDeskData } from './protCells.js';
import './workbench/theme.css';
import type { Row } from './derive.js';
import { Broken, Reading, sentenceOf } from '../site/boot.js';

/**
 * STAGE 5, ATTEMPTED AND REFUSED — an outcome the PAGE writes, because there is
 * no act to have refused.
 *
 * It is what makes the stepper honest: without an outcome for stage 5 the mark
 * would still carry the PUBLISHED build's reason (*not on this build*), which
 * is false about a build with a server standing behind it. With one, the mark
 * says the step ran and was refused and carries THIS reason
 * (`web/src/protStages.ts` · `performed`).
 */
const refusedHere = (refusal: string): ActOutcome => ({ stage: HOTSPOTS_STAGE, act: HOTSPOTS_ACT, commit: null, refusal, materialized: [] });

/** What the boot produces. Stage 5's half is `null` until the ask comes back. */
interface Booted {
  readonly entry: string;
  readonly surface: ProtSurface;
  readonly checks: readonly string[];
  readonly credit: EntryCredit;
  readonly notes: readonly EntryNote[];
  readonly door: DoorState;
  /** Stage 5's own outcome — the act that landed, or the refusal this page wrote. */
  readonly hotspotOutcome: ActOutcome | null;
  /** What the card shows, folded by `workbench/panel.ts`. */
  readonly hotspots: HotspotCardInput | null;
  /**
   * THE LEDGER THE ASK WAS MADE FROM — kept so a RETRY asks the SAME QUESTION.
   *
   * It is the one the boot folded at the end of the run
   * (`src/prot/hotspots.ts` · `notTheEndOfTheRun` refuses any other read), and
   * re-folding it later would be a different question: a reader's own
   * selection has moved the cursor by then. `null` where nothing was ever
   * asked, and the retry control is then absent for want of a question.
   */
  readonly ledger: HotspotLedger | null;
  /** What the boot reported, whole — for the record drawer, where the detail lives (`./workbench/boot.ts` · `bootSteps`). */
  readonly report: BootReported;
}

type Opened = { readonly ok: true; readonly booted: Booted } | { readonly ok: false; readonly sentence: string };

/**
 * SOMEBODY WATCHING THE WHOLE BOOT — every hook the boot can report through,
 * in one shape.
 *
 * ── WHY THE PAGE REPORTS ITS BOOT AT ALL ───────────────────────────────────
 * It was a static paragraph (`web/site/boot.tsx` · `Reading`) saying the page
 * *is fetching the committed files over http and running the same ETL the
 * server runs* — true, and true for the whole of a boot in which this page
 * performs six http reads, an ETL, a dashboard build, three probe gestures,
 * four stages and a model call. The author asked why that was not live status,
 * and the answer was that every one of those was a fact the page held and threw
 * away.
 *
 * Every hook here carries a STATE or a COUNT and never a payload: no row, no
 * value of the data, and — for stage 5 — no part of an answer
 * (`src/prot/streamReports.ts` has the measured reason that is the sharpest
 * case of the same law).
 */
interface BootWatch extends ProtBootWatch {
  /** The committed files, as each is asked for and comes back. */
  readonly http: HttpWatch;
  /** The ETL's own counts. */
  onParsed?(parsed: { readonly residues: number; readonly chains: number }): void;
  /** What stage 5's ask is doing, act by act — a count or a declared word, never a word the model wrote. */
  onAsking?(report: HotspotReport): void;
  /** Stage 5's own outcome, once it has one — so the boot's last row stops being *in flight*. */
  onHotspots?(outcome: ActOutcome): void;
  /** The report as it stands, for the two places the boot hands it back. */
  reported(): BootReported;
}

/**
 * ONE ENTRY, OPENED — the published page's own six steps (`web/site/prot/
 * entry.tsx` walks through them), reading its bytes from the door instead of
 * from beside the page, plus the seventh this page exists for.
 *
 * THE SLOT IS OPENED BEFORE THE RUN AND FILLED AFTER IT, and that order is the
 * whole shape of stage 5: the act has to be DECLARED when the def is built, and
 * its answer cannot exist until the stages it reads have landed
 * (`src/prot/hotspots.ts` · `HotspotSlot`). A door with no key gets no slot at
 * all — an act declared for a stage nothing can perform is the lie
 * `src/prot/plan.ts` refuses.
 */
async function boot(entry: string, watch: BootWatch): Promise<Opened> {
  const onOutcome = watch.onOutcome;
  const door = await askDoorState();
  const base = DOOR();
  /**
   * THE READS, WATCHED — and the watcher is handed to the two loaders rather
   * than wrapped around them, because the loaders are the only code holding the
   * `Response`: whether a total is KNOWN is a question only they can answer
   * (`src/prot/http.ts` · `FileRead.total`).
   *
   * The PUBLISHED page passes none and reads exactly the same bytes the same
   * way (`web/site/prot/entry.tsx`).
   */
  const http = watch.http;
  const opened = await openEntryBytes(entry, { committed: () => loadStructureOverHttp(base, http), archive: browserArchive });
  if (!opened.ok) return opened;
  const read = readEntryBytes(opened.value.bytes.at, opened.value.bytes.text);
  // THE ETL, REPORTED — off the tables it produced, which this boot was folding
  // and throwing away
  const tables = protTables(read.artifact.text);
  watch.onParsed?.({ residues: tables.counts.residues, chains: tables.counts.chains.length });
  const notes = entryNotes(read, tables);
  const blocked = blockingSentence(notes);
  if (blocked !== null) return { ok: false, sentence: blocked };
  const evidence = await conservationEvidenceFor(entry, { committed: readCommittedOverHttp(base, http), archive: browserArchive });
  /*
    WHAT IS ALREADY KNOWN, gathered before the dashboard is built — the same
    step the published page takes, and for the same reason the alignment above
    it is gathered here: the data is not this file's, so a def that fetched it
    behind its caller's back would be a def making a request nobody declared.
    The committed example reads four committed files and calls no service at
    all.
  */
  const annotation = await annotationEvidenceFor(entry, { committed: readCommittedOverHttp(base, http), archive: browserArchive });
  const slot = door.mode === 'none' ? null : hotspotSlot();
  const surface = await openProtSurfaceAsync(read.artifact, watch, evidence, slot, annotation);
  const common = {
    entry,
    surface,
    credit: entryCredit(read.artifact.text),
    notes,
    door,
  };
  // NO KEY: the stage did not run, and the reason is the DOOR'S rather than the
  // published build's. Both halves of the screen are told — the stepper through
  // an outcome, the card through the sentence — so the mark and the words cannot
  // disagree about why.
  /**
   * STAGE 5 DID NOT RUN, AND THE PAGE SAYS WHICH KIND OF *did not* — one
   * closure, three callers below, so the stepper and the card are told by the
   * same line and cannot disagree about why.
   */
  const notAsked = async (outcome: HotspotOutcome & { readonly ok: false }, ledger: HotspotLedger | null = null): Promise<Opened> => {
    const refused = refusedHere(outcome.sentence);
    onOutcome?.(refused);
    watch.onHotspots?.(refused);
    return {
      ok: true,
      booted: {
        ...common,
        checks: [...(await surface.dashboard.lintData()), ...protSurfaceProblems(surface)],
        hotspotOutcome: refused,
        hotspots: { outcome, judge: door.judge?.said ?? 'no second source read anything: nothing was asked of a model, so nothing was judged', at: null, landed: null },
        ledger,
        report: watch.reported(),
      },
    };
  };
  // NO KEY: the stage did not run, and the reason is the DOOR'S rather than the
  // published build's.
  if (door.mode === 'none' || slot === null) {
    return notAsked({ ok: false, kind: 'no-key', sentence: door.reason ?? 'the door did not say why stage 5 cannot run here, which is itself worth reporting', verdicts: [] });
  }
  // THE LEDGER, OFF THIS RUN'S OWN RECORDERS — the rows at the cursor and the
  // acts' own `materialized`, never a number computed again for the model
  const rows = await residuesAt(surface.session, surface.tables);
  /**
   * WHICH CURSOR THIS STAGE IS ABOUT — the end of the run, and the guard says
   * so rather than leaving it to the fact that a boot happens to read there.
   *
   * It is checked on the PAGE because the page is the only place that holds the
   * run and the read together (`src/prot/hotspots.ts` · `notTheEndOfTheRun`
   * carries the whole argument). A read from anywhere else is refused and no
   * model is asked: a ranking folded from part of the evidence would answer a
   * question nobody asked.
   */
  const partial = notTheEndOfTheRun(surface.run, rows.cursor);
  if (partial !== null) return notAsked({ ok: false, kind: 'not-the-end', sentence: partial, verdicts: [] });
  const ledger = hotspotLedger(surface.run, rows.rows, rows.cursor);
  /**
   * AND A PILE THIS PAGE ALREADY KNOWS IS DOOMED NEVER GOES ON THE WIRE.
   *
   * The door judges the cover again off what arrives, and it must — it is what
   * spends the call. But a page that posted seventy kilobytes of facts to be
   * told they are not a cover would be spending a round trip to read a sentence
   * it could already read. One owner (`coverRefusal`), two callers.
   */
  const doomed = coverRefusal(ledger);
  if (doomed !== null) return notAsked(doomed, ledger);
  const answer = await askDoorForHotspots(ledger, watch.onAsking);
  // FROZEN THE MOMENT IT ARRIVES: the act lands before anything on this page
  // compares the ranking to anything else
  const outcome = answer.ok ? await landHotspots(surface, answer) : refusedHere(answer.sentence);
  onOutcome?.(outcome);
  watch.onHotspots?.(outcome);
  return {
    ok: true,
    booted: {
      ...common,
      // read AFTER the act, so a column it could not land is in this list
      checks: [...(await surface.dashboard.lintData()), ...protSurfaceProblems(surface)],
      hotspotOutcome: outcome,
      // THE TWO COMMITS the answer sits between: the one its evidence was read
      // at (the end of the run) and the one the ranking itself landed as. The
      // card prints both, so it declares which cursor it is about rather than
      // being taken for a picture of wherever the reader is standing.
      hotspots: { outcome: answer, judge: door.judge?.said ?? 'the door named no judge', at: ledger.at ?? landedThrough(surface.run), landed: outcome.commit },
      // THE LEDGER IS KEPT so a retry asks the SAME question, and the report so
      // the record drawer can carry the boot's own account
      ledger,
      report: watch.reported(),
    },
  };
}

function ServedProtDesk({ booted, onSearchAgain }: { readonly booted: Booted; onSearchAgain(): void }): JSX.Element {
  const { surface, checks, notes } = booted;
  /** What the session said if it refused the picks as a selection — shown with the desk's other checks, never swallowed. */
  const [pickRefusal, setPickRefusal] = useState<string | null>(null);
  /**
   * EVERY RETRY'S OWN ANSWER AND ACT, in the order they were asked — and NOTHING
   * is overwritten.
   *
   * The boot's own attempt is on `booted`; these are the ones a reader asked
   * for. Both halves are kept per attempt because they are two records: the
   * ANSWER is what the card shows, and the OUTCOME is what the stepper and the
   * record drawer fold.
   */
  const [attempts, setAttempts] = useState<readonly { readonly answer: HotspotOutcome; readonly outcome: ActOutcome }[]>([]);
  /** `true` while a retry is on the wire — the card's fourth state, and a control that is not pressable again. */
  const [asking, setAsking] = useState(false);
  /** What that ask is DOING, act by act — the report, never the answer (`src/prot/streamReports.ts`). */
  const [report, setReport] = useState<HotspotReport | null>(null);
  const view = useMemo(() => createSessionView(sessionSource(surface.session), { as: 'user', defaultLayout: 'grid' }), [surface.session]);
  const residues = useResiduesAtCursor(view, surface.session, surface.tables, surface.residues);
  /** The outcomes the stepper folds: the run's own, plus stage 5's. */
  const outcomes = useMemo(
    () => [...(surface.run?.outcomes ?? []), ...(booted.hotspotOutcome === null ? [] : [booted.hotspotOutcome]), ...attempts.map((one) => one.outcome)],
    [surface.run, booted.hotspotOutcome, attempts],
  );
  /**
   * WHAT THE CARD SHOWS — the LATEST attempt, with every earlier one still on
   * the stepper's act rows and in the record drawer.
   *
   * `asked` is how many times the stage has been asked in this run: the boot's
   * one plus the reader's. It is deliberately NOT the library's own corrective
   * re-ask count — *the library judged 2 answers against the declared shape* is
   * a different fact from *a reader pressed retry twice*, and one number
   * answering two questions is one of them lost.
   */
  const hotspots = useMemo((): HotspotCardInput | null => {
    if (booted.hotspots === null) return null;
    const asked = 1 + attempts.length;
    if (asking) return { ...booted.hotspots, outcome: null, asking: report, asked };
    const latest = attempts[attempts.length - 1];
    if (latest === undefined) return { ...booted.hotspots, asked };
    return { ...booted.hotspots, outcome: latest.answer, landed: latest.outcome.commit, asked };
  }, [booted.hotspots, attempts, asking, report]);
  /**
   * THE PAYOFF — the model's picks as a live selection on the desk's own
   * crossfilter, and it is ONE dispatch at a view the def already declares.
   *
   * `interface` binds `residue_key` on its category channel (`src/prot/def.ts`
   * · `PROT_ENCODINGS`), so a many-value select there is the same gesture a
   * reader makes by clicking a bar — which means the 3D view recolours, the
   * backbone-angle scatter dims and the two runs narrow, all through the
   * machinery that was already there. No new chart, no new link, and nothing
   * marked from a literal: the residues are the ones on the answer.
   */
  const onSelectPicks = useCallback(
    (picks: readonly string[]): void => {
      /*
        THROUGH THE VIEW, AND NOT THROUGH THE SESSION — a REAL BROWSER is what
        taught this, and the failure was silent.

        It dispatched straight on the session first. The act landed, the log
        grew, and **not one picture moved**: 185 dots stayed 185, and no pane
        said a clause had reached it. Every other gesture on this desk goes
        through `view.emit` (`./protCells.tsx` · `emit`), which is the ONE
        cursor the charts are folded at — *two views over one session would be
        two cursors, and a reader pressing this would move the one the pictures
        are not reading* (`web/site/prot/entry.tsx` says it about the view it
        memoises). A dispatch beside that view is exactly that second cursor.

        And it is a MATCH rather than six points: the emission carries the list
        and its polarity as one `MatchValue`, which is what *a set is a point's
        plural, never a new capability* means on the wire. `interface` declares
        `point`, and the library's own law is that a view declaring only point
        ACCEPTS a match.
      */
      // A REFUSED GESTURE IS NEVER SWALLOWED — and this is the THIRD shape of
      // that guard on this line. The first `void`ed the promise, so a refused
      // emission looked exactly like one that was accepted and changed nothing,
      // which is the failure this desk is built against. The second caught a
      // rejection the door never threw, so it guarded nothing at all. The door
      // ANSWERS now, so the reader gets the session's own sentence.
      void view
        .emit(
          INTERFACE_VIEW,
          { rawValue: { values: [...picks] }, encoding: { kind: 'match', field: RESIDUE_KEY } },
          `keep the ${String(picks.length)} residues a model ranked as hot spots, so every other picture on this desk narrows to them`,
        )
        .then((done) => {
          if (!done.ok) setPickRefusal(done.sentence);
        });
    },
    [view],
  );
  /**
   * THE PICKS AS MARKS IN THE STRUCTURE — and it is a BINDING, never a paint.
   *
   * The ranking landed `hotspot_rank` on `residues` like any other stage's
   * column (`src/prot/hotspots.ts` · `hotspotsAnalysis`), and the 3D view
   * declares a colour channel (`src/prot/def.ts` · `PROT_ENCODINGS`). So the
   * whole of this feature is one REENCODE at a view the def already declares,
   * through the same door every picture on this desk re-encodes through
   * (`./protCells.tsx` · `reencode`): no new chart kind, no new emission kind,
   * no hand-placed highlight, and nothing marked from a literal.
   *
   * ── WHAT THE DECLARATION HAD TO SAY FIRST ──────────────────────────────────
   * The rebind was REFUSED until the column was declared. The structure view's
   * colour takes a column with distinct values, the engine reads a landed `int`
   * as a magnitude, and the door said so by name — *hotspot_rank is not one*.
   * The answer was a declaration of what the column IS (`src/prot/def.ts` ·
   * `RANK_DECLARED`: a rank is a PLACE, like `resnum`), never a widened house
   * rule.
   *
   * ── AND THE REFUSAL IS THE SESSION'S OWN WORDS, WHICH IT DID NOT USED TO BE ─
   * This page used to ask the RECORD afterwards — a second `overview()` round
   * trip, re-reading the encoding fold at the cursor, and if the channel was not
   * carrying what was asked for it printed a sentence THIS PAGE wrote, standing
   * in for one the session had already said and thrown away. That was a
   * workaround for a FINDING this desk filed, and the library has since taken
   * it: eighteen doors now hand back what the session said, so the whole
   * read-back is deleted and the reader gets the reason rather than this page's
   * guess at it.
   */
  const onPaintByRank = useCallback(
    (bound: boolean): void => {
      const field = bound ? 'chain' : HOTSPOT_RANK_COLUMN;
      void view.reencode(STRUCTURE_VIEW, 'color', field).then((done) => {
        if (!done.ok) setPickRefusal(done.sentence);
      });
    },
    [view],
  );
  /**
   * ASK THE MODEL AGAIN — on the LIVE session, and the earlier refusal STAYS.
   *
   * ── THE ONE LAW THIS IS BUILT AROUND ──────────────────────────────────────
   * **The record must survive the retry.** A page reload re-runs stages 1 to 4
   * and mints a fresh log, which destroys the record the ranking is
   * pre-registered against — *you cannot retry your way to a cleaner history*,
   * and that discipline is the whole reason stage 5 lands a commit before
   * anything checks it (`src/prot/session.ts` · `landHotspots`). So this
   * re-asks on the session that is already open, lands its own act, and the
   * first attempt's outcome is kept beside it: two asks, two entries, neither
   * overwriting the other, both on the stepper's act rows.
   *
   * ── AND IT ASKS THE SAME QUESTION ─────────────────────────────────────────
   * The LEDGER is the one the boot folded at the end of the run, kept on
   * {@link Booted.ledger}. Re-folding it now would be a different question: a
   * reader's own selection has moved the cursor since, and stage 5 is asked
   * once from the rows at the end of what stages 1 to 4 landed
   * (`src/prot/hotspots.ts` · `notTheEndOfTheRun`).
   */
  const onRetryHotspots = useCallback((): void => {
    if (asking || booted.ledger === null) return;
    setAsking(true);
    setReport(null);
    void askDoorForHotspots(booted.ledger, setReport)
      .then(async (answer) => {
        const landed = answer.ok ? await landHotspots(surface, answer) : refusedHere(answer.sentence);
        // KEPT, NOT REPLACED: the attempts accumulate, so the stepper's act
        // rows and the record drawer hold every one of them
        setAttempts((was) => [...was, { answer, outcome: landed }]);
      })
      .catch((error: unknown) => {
        const sentence = error instanceof Error ? error.message : String(error);
        setAttempts((was) => [...was, { answer: { ok: false, kind: 'threw', sentence: `the retry threw before the door answered: ${sentence}`, verdicts: [] }, outcome: refusedHere(sentence) }]);
      })
      .finally(() => {
        setAsking(false);
        setReport(null);
      });
  }, [asking, booted.ledger, surface]);
  const data: ProtDeskData = {
    residues: (residues.refused === null ? residues.rows : surface.tables.residues) as readonly Row[],
    counts: surface.tables.counts,
    skipped: surface.tables.skipped,
    structure: surface.structure,
    run: surface.run,
    refusals: surface.refusals,
    notes,
  };
  return (
    <ProtDesk
      view={view}
      data={data}
      run={surface.run}
      outcomes={outcomes}
      // A REFUSED GESTURE IS NEVER SWALLOWED, and the sentence no longer names
      // WHICH gesture: two controls arrive through this slot now (the picks as
      // a selection, and the rank on the 3D view's colour), and a line that
      // said "as a selection" over a refused rebind would be the page naming
      // the wrong act.
      checks={pickRefusal === null ? checks : [...checks, `a gesture this page made on the model's answer was refused, in the library's own words: ${pickRefusal}`]}
      session={surface.session}
      table={RESIDUES_TABLE}
      rowsNote={{ quiet: true, line: <ServedRowsNote rows={residues.rows.length} cursor={residues.cursor} refused={residues.refused} /> }}
      name={PROT_WORDS.name}
      claim={PROT_WORDS.title}
      credit={booted.credit}
      counts={surface.tables.counts}
      hotspots={hotspots}
      onSelectPicks={onSelectPicks}
      onPaintByRank={onPaintByRank}
      onRetryHotspots={onRetryHotspots}
      asking={asking}
      /*
        THE READER'S ARRANGEMENT OF THE DESK, LANDED — and it goes through the
        VIEW, never beside it, for the reason `onSelectPicks` carries in full:
        a dispatch beside the view the pictures are folded at is a SECOND
        CURSOR, and the act lands while nothing on screen moves.

        The door is the library's GENERIC layout one. `setLayoutNote` lands ONE
        `navigate` on `layout:protein-desk` — THIS desk's own scope, where it
        used to borrow the cockpit's `layout:dashboard` because no door existed
        for a third-party scope — and that commit is INERT by construction at
        the session tier: it never enters a filter, never reaches `foldDiff` and
        can never move a row count. It branches at the cursor like any act and
        `rebuildFold` restores it, which is the whole reason the arrangement
        travels: seek behind the swap and the desk comes back to how it was.

        `words` is THIS DESK'S OWN SENTENCE and the door requires it, so the
        commit rail reads what the desk says its act did instead of the machine
        list `layout order: a, b, c`. And the door ANSWERS: its refusal is
        returned rather than left for the caller to discover by re-reading the
        fold.

        Nothing is read back through here: the desk reads its own scope off
        `state.layouts`.
      */
      onArrange={async (order, words) => {
        const done = await view.setLayoutNote({ scope: ARRANGEMENT_SCOPE, prop: ARRANGEMENT_PROP, value: cellOrderToLayoutValue([...order]), words });
        return done.ok ? null : done.sentence;
      }}
      boot={bootSteps(booted.report)}
      onSearchAgain={onSearchAgain}
      record={<ServedFoot booted={booted} onSearchAgain={onSearchAgain} />}
    />
  );
}

/** Which commit the pictures are drawn at — the read's OWN answer, never what this page believes the cursor to be. */
function ServedRowsNote({ rows, cursor, refused }: { readonly rows: number; readonly cursor: string | null; readonly refused: string | null }): JSX.Element {
  if (refused !== null) {
    return (
      <p role="status" style={{ fontSize: 12, lineHeight: 1.5, margin: '.4rem 0 0', color: 'var(--pw-refuse-ink)' }}>
        the rows at this commit were refused, in the library&rsquo;s own words: <i>{refused}</i> — the pictures below fall back to the columns the file itself gave
      </p>
    );
  }
  return (
    <p role="status" style={{ fontSize: 12, lineHeight: 1.5, margin: '.4rem 0 0', color: 'var(--pw-mid-2)' }}>
      {rows.toLocaleString('en-US')} rows, as they stand at {cursor === null ? 'the root of this log — no act has landed yet' : `commit ${cursor}`}
    </p>
  );
}

/**
 * THE PAGE'S OWN FOOT — the credit the archive asks for, what this desk cannot
 * say about this entry, and the ONE paragraph that is this page's and not the
 * published one's: what having a server behind the desk did and did not change.
 */
function ServedFoot({ booted, onSearchAgain }: { readonly booted: Booted; onSearchAgain(): void }): JSX.Element {
  const { door } = booted;
  return (
    <div style={{ padding: '0 24px 32px' }}>
      <section
        style={{
          display: 'grid',
          gap: 12,
          padding: '14px 18px',
          border: '1px solid var(--pw-edge-card)',
          borderRadius: 'var(--pw-r-card)',
          background: 'var(--pw-glass-card)',
          backdropFilter: 'var(--pw-blur-card)',
          WebkitBackdropFilter: 'var(--pw-blur-card)',
          fontSize: 12,
          lineHeight: 1.55,
          color: 'var(--pw-mid-2)',
        }}
      >
        <EntryNotes entry={booted.entry} notes={booted.notes} cost={null} onSearchAgain={onSearchAgain} />
        <span aria-hidden style={{ height: 1, background: 'var(--pw-rule)' }} />
        <p style={{ margin: 0 }}>
          Structure <b>{booted.credit.entry}</b> — {booted.credit.title.toLowerCase()} — from the RCSB Protein Data Bank&rsquo;s copy of the wwPDB archive, deposited by {booted.credit.depositors}; the primary
          citation the entry names is <i>{booted.credit.citation}</i>. wwPDB releases its data files into the public domain under the {ARCHIVE_LICENCE} dedication, which asks for nothing; the archive asks that
          the depositors and that citation be credited, which is what this line is.
        </p>
        <span aria-hidden style={{ height: 1, background: 'var(--pw-rule)' }} />
        <p style={{ margin: 0 }}>
          <b>This is the local, served desk, and exactly one thing about it differs from the published one.</b> Stages 1 to 4 ran here in this browser, the same way they run on the published page: the archive,
          InterPro and the two Mol* engines all answer a page directly, so nothing about them needs a server. What needs one is <b>stage 5</b>, because a key shipped inside a page&rsquo;s own bytes is a key
          given away — so the published desk says <i>declared, and this build cannot perform it</i>, with its measured reason, and that is the architecture rather than a shortfall.{' '}
          {door.mode === 'none'
            ? 'This process has no key either, so the stage did not run here — and it says THAT rather than the published build’s reason, which is a different fact.'
            : `Here a model was asked, over ${door.model ?? 'the door’s own driver'}, and what it said is a recommendation rather than a measurement: every rank cites the ids of the facts this run’s own stages established, a residue the run’s table has no row for is refused by name, and a standing judge’s reading of the same evidence is recorded beside the answer — ${door.judge?.weaker === true ? 'a weaker second source, and the card says so' : 'a calibrated second source'}.`}{' '}
          The dashboard, the commit log and the rows are this page&rsquo;s, as they are on the published one: stage 5&rsquo;s ranking landed as an act on <i>this</i> log, which is why the desk&rsquo;s own
          crossfilter reaches it.
        </p>
      </section>
    </div>
  );
}

type Phase =
  | { readonly status: 'landing'; readonly sentence: string | null }
  /**
   * THE BOOT, WITH WHAT IT HAS REPORTED SO FAR.
   *
   * `outcomes` is the stepper's copy of the acts, unchanged. `report` is
   * everything else the boot does and used to throw away — the reads, the ETL,
   * the build, the probes and stage 5's ask — folded by
   * `./workbench/boot.ts` and drawn by `./workbench/BootReport.tsx`.
   *
   * Both live on the PHASE rather than in a ref, because a report nobody
   * re-renders for is a report nobody sees.
   */
  | { readonly status: 'reading'; readonly entry: string; readonly outcomes: readonly ActOutcome[]; readonly report: BootReported }
  | { readonly status: 'ready'; readonly booted: Booted }
  | { readonly status: 'broken'; readonly sentence: string };

function Page(): JSX.Element {
  const [phase, setPhase] = useState<Phase>({ status: 'landing', sentence: null });
  /**
   * WHICH ENTRY THIS PAGE IS CURRENTLY OPENING — and on this page the guard
   * costs more than it does on the published one.
   *
   * There it stops the four stages running twice (two Mol* engines, twice) on a
   * double-click or on React's development-mode double effect. Here a second
   * boot would also ASK A MODEL A SECOND TIME — a second call, a second
   * judgment, a second ranking landing a second commit on the same log. So the
   * guard is the same one `web/site/prot/entry.tsx` has, and the answer to an
   * entry a reader has moved on from is dropped rather than drawn.
   */
  const opening = useRef<string | null>(null);

  const run = useCallback((entry: string): void => {
    if (opening.current === entry) return;
    opening.current = entry;
    /**
     * THE TOTAL IS KNOWN BEFORE THE FIRST READ, for the committed entry and
     * only for it: its six files are DECLARED (`src/data/files.ts`, counted by
     * `PROT_COMMITTED_READS`). For any other entry the archive names the
     * accessions and the accessions name the families, so how many reads this
     * boot will make is not a fact anybody holds yet — and the report says
     * *unknown* rather than borrowing this entry's number
     * (`./workbench/boot.ts` · `ReadsReport.total`).
     */
    const total = entry.toUpperCase() === EXAMPLE_ENTRY ? PROT_COMMITTED_READS : null;
    setPhase({ status: 'reading', entry, outcomes: [], report: { ...NOTHING_REPORTED, reads: { ...NOTHING_REPORTED.reads, total } } });
    const live: ActOutcome[] = [];
    /**
     * THE REPORT IS ACCUMULATED HERE and handed to the phase on every change —
     * one object, so a page holds one piece of state for the whole boot.
     *
     * It is a closure rather than a ref because it is written and read in the
     * same pass: a `setPhase` that folded the reports itself would be batching
     * a hundred token reports into whatever React chose to keep.
     */
    let reported: BootReported = { ...NOTHING_REPORTED, reads: { ...NOTHING_REPORTED.reads, total } };
    const say = (next: BootReported): void => {
      reported = next;
      setPhase((was) => (was.status === 'reading' && was.entry === entry ? { ...was, report: next } : was));
    };
    void boot(entry, {
      onOutcome: (outcome) => {
        live.push(outcome);
        const outcomes = [...live];
        setPhase((was) => (was.status === 'reading' && was.entry === entry ? { ...was, outcomes, report: { ...reported, outcomes } } : was));
        reported = { ...reported, outcomes };
      },
      http: {
        onFileAsked: (file) => say({ ...reported, reads: { ...reported.reads, asking: file } }),
        onFileRead: (read) => say({ ...reported, reads: { ...reported.reads, asking: null, done: [...reported.reads.done, read] } }),
      },
      onParsed: (parsed) => say({ ...reported, parsed }),
      onBuilt: (built) => say({ ...reported, built }),
      onProbed: (probed) => say({ ...reported, probed }),
      onAsking: (asking) => say({ ...reported, asking }),
      onHotspots: (outcome) => say({ ...reported, hotspots: outcome, asking: null }),
      // THE REPORT AS IT STANDS — handed back with the boot, so the record
      // drawer on the desk that follows carries the boot's own account
      reported: () => reported,
    })
      .then((opened) => {
        if (opening.current !== entry) return;
        setPhase(opened.ok ? { status: 'ready', booted: opened.booted } : { status: 'landing', sentence: opened.sentence });
      })
      .catch((error: unknown) => {
        if (opening.current === entry) setPhase({ status: 'broken', sentence: sentenceOf(error) });
      });
  }, []);

  const fromAddress = useCallback((): void => {
    const asked = entryInUrl(window.location.search);
    if (asked.kind === 'entry') run(asked.entry);
    else {
      opening.current = null;
      setPhase({ status: 'landing', sentence: asked.kind === 'refused' ? asked.sentence : null });
    }
  }, [run]);

  useEffect(() => {
    fromAddress();
    const back = (): void => fromAddress();
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, [fromAddress]);

  const open = useCallback(
    (entry: string): void => {
      window.history.pushState(null, '', urlForEntry(entry, window.location.href));
      run(entry);
    },
    [run],
  );

  const searchAgain = useCallback((): void => {
    window.history.pushState(null, '', urlForEntry(null, window.location.href));
    opening.current = null;
    setPhase({ status: 'landing', sentence: null });
  }, []);

  if (phase.status === 'landing') return <ProtLanding name={PROT_WORDS.name} claim={PROT_WORDS.title} caption={PROT_WORDS.caption} doors={browserArchive} refusal={phase.sentence} onOpen={open} />;
  if (phase.status === 'broken') return <Broken sentence={phase.sentence} />;
  if (phase.status === 'reading') {
    return (
      <Reading
        what={`entry ${phase.entry}${phase.entry === EXAMPLE_ENTRY ? " from this repository's own committed bytes, through the demo API" : ' from the archive'}, the 3D viewer that draws it, the four stages that run in this browser, and the fifth one this process can ask a model for`}
        /**
         * THE STEPPER CARRIES THE PROGRESS, AND ONE CENTRED LINE SITS UNDER IT
         * — the author's ruling, and it is this desk's own law rather than
         * taste: *the stage stepper IS the cursor*, so a list narrating the
         * same progression beside it would be a second answer to one question.
         *
         * BOTH HALVES COME FROM ONE FOLD. `bootNow` says which step is live and
         * what the line reads; the stepper spins exactly that mark and the line
         * says exactly that act (`./workbench/boot.ts` · `BootNow`). Nothing
         * here derives either for itself.
         *
         * AND THE STEPPER SAYS STAGE 5 IS PENDING rather than NOT ON THIS BUILD
         * — the bug in the author's own screenshot, on the very build that was
         * about to run it. This page is never the build the plan's blocker is
         * about, from its first paint: it asked the door before it opened the
         * entry (`./protStages.ts` · `AwaitedSteps`).
         *
         * The boot's own DETAIL is not lost with the list: it is in the record
         * drawer on the desk that follows (`bootSteps`, drawn by `BootLog`).
         */
        instead={
          <>
            <RunStepper outcomes={phase.outcomes} host={{ awaiting: { [HOTSPOTS_STAGE]: 'not-run' }, live: bootNow(phase.report).stage }} />
            <BootLine line={bootNow(phase.report).line} running={bootNow(phase.report).stage !== null} />
          </>
        }
      />
    );
  }
  return <ServedProtDesk booted={phase.booted} onSearchAgain={searchAgain} />;
}

const mount = document.getElementById('root');
if (mount === null) throw new Error('the page has no #root to mount into');
document.body.classList.add('pw-body');
createRoot(mount).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
