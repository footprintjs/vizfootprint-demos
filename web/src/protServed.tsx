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
 */
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createSessionView, sessionSource } from 'vizfootprint-ui';
import 'vizfootprint-ui/styles.css';
import { loadStructureOverHttp, readCommittedOverHttp } from '../../src/prot/http.js';
import { conservationEvidenceFor } from '../../src/prot/conservationEvidence.js';
import { entryCredit, protTables, type EntryCredit } from '../../src/prot/etl.js';
import { INTERFACE_VIEW, PROT_WORDS, RESIDUES_TABLE, RESIDUE_KEY } from '../../src/prot/def.js';
import { landHotspots, openProtSurfaceAsync, protSurfaceProblems, residuesAt, type ProtSurface } from '../../src/prot/session.js';
import { ARCHIVE_LICENCE, EXAMPLE_ENTRY, browserArchive, openEntryBytes } from '../../src/prot/archive.js';
import { blockingSentence, entryNotes, readEntryBytes, type EntryNote } from '../../src/prot/entryNotes.js';
import { HOTSPOTS_ACT, HOTSPOTS_STAGE, coverRefusal, hotspotLedger, hotspotSlot, landedThrough, notTheEndOfTheRun, type HotspotFailure, type HotspotLedger, type HotspotOutcome } from '../../src/prot/hotspots.js';
import type { ActOutcome } from '../../src/prot/orchestrator.js';
import { EntryNotes, ProtLanding, entryInUrl, urlForEntry } from './protLanding.js';
import { useResiduesAtCursor } from './protRows.js';
import { ProtDesk, RunStepper } from './protDesk.js';
import type { HotspotCardInput } from './workbench/panel.js';
import type { ProtDeskData } from './protCells.js';
import './workbench/theme.css';
import type { Row } from './derive.js';
import { Broken, Reading, sentenceOf } from '../site/boot.js';

/**
 * WHERE THE DOOR IS, and it is also where the committed bytes are.
 *
 * `src/prot/http.ts`'s loaders take a BASE and resolve every declared path
 * against it (`src/data/files.ts` holds the paths, and the static build copies
 * the same names beside the published page). So one base answers both halves:
 * `/api/prot/data/prot/1ay7.pdb` is the door serving the file this repository
 * committed, and `/api/prot/hotspots` is the door asking a model — the same
 * prefix, proxied in dev and same-origin in a build.
 */
const DOOR = (): URL => new URL('/api/prot/', window.location.href);

/** What the door says about itself — `server/prot-doors.ts` · `ProtStateWire`, read defensively because a wire is a boundary. */
interface DoorState {
  readonly mode: 'live' | 'scripted' | 'none';
  readonly model?: string;
  readonly reason?: string;
  readonly judge?: { readonly said: string; readonly weaker: boolean };
  readonly tag: string;
}

async function askDoorState(): Promise<DoorState> {
  const at = new URL('state', DOOR()).href;
  const res = await fetch(at);
  if (!res.ok) throw new Error(`the demo API at ${at} answered ${String(res.status)} ${res.statusText} — this page is the SERVED protein desk and needs it: run \`npm run serve\` beside it, or open the published desk, which performs stages 1 to 4 with no server at all`);
  return (await res.json()) as DoorState;
}

/** ONE ASK — the run's own evidence up, the ranked list with its citations and the judge's verdicts down. */
async function askDoorForHotspots(ledger: HotspotLedger): Promise<HotspotOutcome> {
  const res = await fetch(new URL('hotspots', DOOR()).href, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // THE LEDGER'S OWN FIELDS AND NOTHING INVENTED FOR THE REQUEST: the facts,
    // the residue keys the door judges a named residue against, the sentence
    // about which residues it covers, and which acts it was read off
    body: JSON.stringify({ facts: ledger.facts, residues: ledger.residues, basis: ledger.basis, from: ledger.from, at: ledger.at }),
  });
  const said = (await res.json()) as Partial<{ readonly ok: boolean; readonly kind: string; readonly sentence: string }> & Record<string, unknown>;
  if (said.ok === true) return said as unknown as HotspotOutcome;
  /**
   * A REFUSAL OFF THE WIRE, read defensively — the door's own `kind` when it is
   * one of the failures this stage has a vocabulary for, and `threw` when it is
   * not. A kind nobody declared would let the screen branch on a word the
   * library has never heard of; the SENTENCE is what a reader sees either way,
   * and it is the door's, verbatim.
   */
  const kinds: readonly HotspotFailure[] = ['no-key', 'no-evidence', 'unreachable', 'timeout', 'refused', 'threw', 'malformed', 'cites-nothing', 'nothing-left'];
  const kind = kinds.find((one) => one === said.kind) ?? 'threw';
  return {
    ok: false,
    kind,
    sentence: typeof said.sentence === 'string' ? said.sentence : `the demo API answered ${String(res.status)} and no sentence — stage 5 did not run, and the door said nothing this page can print`,
    verdicts: [],
  };
}

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
}

type Opened = { readonly ok: true; readonly booted: Booted } | { readonly ok: false; readonly sentence: string };

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
async function boot(entry: string, onOutcome: (outcome: ActOutcome) => void): Promise<Opened> {
  const door = await askDoorState();
  const base = DOOR();
  const opened = await openEntryBytes(entry, { committed: () => loadStructureOverHttp(base), archive: browserArchive });
  if (!opened.ok) return opened;
  const read = readEntryBytes(opened.value.bytes.at, opened.value.bytes.text);
  const notes = entryNotes(read, protTables(read.artifact.text));
  const blocked = blockingSentence(notes);
  if (blocked !== null) return { ok: false, sentence: blocked };
  const evidence = await conservationEvidenceFor(entry, { committed: readCommittedOverHttp(base), archive: browserArchive });
  const slot = door.mode === 'none' ? null : hotspotSlot();
  const surface = await openProtSurfaceAsync(read.artifact, { onOutcome }, evidence, slot);
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
  const notAsked = async (outcome: HotspotOutcome & { readonly ok: false }): Promise<Opened> => {
    const refused = refusedHere(outcome.sentence);
    onOutcome(refused);
    return {
      ok: true,
      booted: {
        ...common,
        checks: [...(await surface.dashboard.lintData()), ...protSurfaceProblems(surface)],
        hotspotOutcome: refused,
        hotspots: { outcome, judge: door.judge?.said ?? 'no second source read anything: nothing was asked of a model, so nothing was judged', at: null, landed: null },
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
  if (doomed !== null) return notAsked(doomed);
  const answer = await askDoorForHotspots(ledger);
  // FROZEN THE MOMENT IT ARRIVES: the act lands before anything on this page
  // compares the ranking to anything else
  const outcome = answer.ok ? await landHotspots(surface, answer) : refusedHere(answer.sentence);
  onOutcome(outcome);
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
    },
  };
}

function ServedProtDesk({ booted, onSearchAgain }: { readonly booted: Booted; onSearchAgain(): void }): JSX.Element {
  const { surface, checks, notes } = booted;
  /** What the session said if it refused the picks as a selection — shown with the desk's other checks, never swallowed. */
  const [pickRefusal, setPickRefusal] = useState<string | null>(null);
  const view = useMemo(() => createSessionView(sessionSource(surface.session), { as: 'user', defaultLayout: 'grid' }), [surface.session]);
  const residues = useResiduesAtCursor(view, surface.session, surface.tables, surface.residues);
  /** The outcomes the stepper folds: the run's own, plus stage 5's. */
  const outcomes = useMemo(() => [...(surface.run?.outcomes ?? []), ...(booted.hotspotOutcome === null ? [] : [booted.hotspotOutcome])], [surface.run, booted.hotspotOutcome]);
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
      void view
        .emit(
          INTERFACE_VIEW,
          { rawValue: { values: [...picks] }, encoding: { kind: 'match', field: RESIDUE_KEY } },
          `keep the ${String(picks.length)} residues a model ranked as hot spots, so every other picture on this desk narrows to them`,
        )
        .catch((error: unknown) => {
          // A REFUSED GESTURE IS NEVER SWALLOWED. The first version of this
          // `void`ed the promise, so a session that refused the emission looked
          // exactly like one that accepted it and changed nothing — which is
          // the failure this desk is built against.
          setPickRefusal(error instanceof Error ? error.message : String(error));
        });
    },
    [view],
  );
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
      checks={pickRefusal === null ? checks : [...checks, `the model's picks were refused as a selection, in the library's own words: ${pickRefusal}`]}
      session={surface.session}
      table={RESIDUES_TABLE}
      rowsNote={{ quiet: true, line: <ServedRowsNote rows={residues.rows.length} cursor={residues.cursor} refused={residues.refused} /> }}
      name={PROT_WORDS.name}
      claim={PROT_WORDS.title}
      credit={booted.credit}
      counts={surface.tables.counts}
      hotspots={booted.hotspots}
      onSelectPicks={onSelectPicks}
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
  | { readonly status: 'reading'; readonly entry: string; readonly outcomes: readonly ActOutcome[] }
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
    setPhase({ status: 'reading', entry, outcomes: [] });
    const live: ActOutcome[] = [];
    void boot(entry, (outcome) => {
      live.push(outcome);
      setPhase((was) => (was.status === 'reading' && was.entry === entry ? { ...was, outcomes: [...live] } : was));
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
        extra={<RunStepper outcomes={phase.outcomes} />}
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
