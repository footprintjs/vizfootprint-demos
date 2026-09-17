/**
 * THE PROTEIN DESK, STATIC — the fourth demo, with no server behind it, opening
 * on a question rather than on a file.
 *
 * ── THE PAGE HAS FOUR STATES, and each one is a sentence ────────────────────
 *
 *   `landing`  nobody has asked yet: the desk's title, one search box and one
 *              named example (`web/src/protLanding.tsx`). A reader who arrives
 *              here FROM a refusal sees it, verbatim, above the box.
 *   `reading`  an entry is being opened. The STEPPER is already on screen,
 *              filling as each act lands — the boot hands it every outcome as it
 *              comes back (`src/prot/orchestrator.ts` · `ProtRunWatch`) — and it
 *              says in a sentence that there is no cursor to move yet.
 *   `ready`    the desk, with the entry's credit and WHAT THIS DESK CANNOT SAY
 *              about this entry above it. The stepper is at the top and IS the
 *              cursor: clicking a stage seeks the record and every picture
 *              follows (`web/src/protDesk.tsx`, `web/src/protRows.ts`).
 *   `broken`   something threw. The sentence, and nothing drawn.
 *
 * ── THE BOOT, in the order a server would do it ─────────────────────────────
 *   1. WHICH ENTRY. The address carries it (`?entry=1AY7`), so a reader can
 *      share what they are looking at; no address means nobody has asked.
 *   2. THE BYTES (`src/prot/archive.ts` · `openEntryBytes`). The committed
 *      example reads the file this repository committed and calls the archive
 *      NOT AT ALL; every other entry costs one small record, which the gate
 *      judges — size, and whether there is any protein in it — before a
 *      structure file is downloaded at all.
 *   3. ONE MODEL (`src/prot/entryNotes.ts` · `readEntryBytes`). A file with 116
 *      models is the same structure fitted 116 times; the parse and the viewer
 *      are handed the first, and the page says so.
 *   4. THE ETL, unchanged — it was always pure.
 *   5. WHAT THIS DESK CANNOT SAY about this entry, read off those bytes
 *      (`entryNotes`) and printed beside the credit. One of them BLOCKS: an
 *      entry with no residue row draws nothing, and says that instead.
 *   6. the dashboard, the two stages, and a session view over an IN-PROCESS
 *      session (`sessionSource`), not a poll.
 *
 * The one thing this page owns that the other three do not is the CREDIT line,
 * and it is read rather than typed: the entry's own TITLE, AUTHOR and JRNL
 * records, quoted out of the bytes the page just read.
 */
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createSessionView, sessionSource } from 'vizfootprint-ui';
import 'vizfootprint-ui/styles.css';
import { loadStructureOverHttp } from '../../../src/prot/http.js';
import { entryCredit, protTables, skippedTotal, type EntryCredit } from '../../../src/prot/etl.js';
import { PROT_WORDS, RESIDUES_TABLE } from '../../../src/prot/def.js';
import { openProtSurfaceAsync, protSurfaceProblems, type ProtSurface } from '../../../src/prot/session.js';
import { EXAMPLE_ENTRY, browserArchive, openEntryBytes } from '../../../src/prot/archive.js';
import { blockingSentence, entryNotes, readEntryBytes, type EntryNote } from '../../../src/prot/entryNotes.js';
import type { ActOutcome } from '../../../src/prot/orchestrator.js';
import { EntryNotes, ProtLanding, entryInUrl, urlForEntry } from '../../src/protLanding.js';
import { useResiduesAtCursor, type ResiduesNow } from '../../src/protRows.js';
import { ProtDesk } from '../../src/protDesk.js';
import { ProtStepper } from '../../src/protStepper.js';
import { stepperStages } from '../../src/protStages.js';
import type { ProtDeskData } from '../../src/protCells.js';
import type { Row } from '../../src/derive.js';
import { Broken, Reading, WhatIsMissing, sentenceOf, siteBase } from '../boot.js';

/** What the boot produces: a live session with three commits on it, the rows it will draw, the data checks, whose entry this is, and what this desk cannot say about it. */
interface Booted {
  readonly entry: string;
  readonly surface: ProtSurface;
  readonly checks: readonly string[];
  readonly credit: EntryCredit;
  readonly notes: readonly EntryNote[];
  /** The gate's own cost sentence, or `null` for the example — nothing was downloaded for it. */
  readonly cost: string | null;
}

/** A boot either opens a desk or refuses in a sentence. Only a THROW is `broken`. */
type Opened = { readonly ok: true; readonly booted: Booted } | { readonly ok: false; readonly sentence: string };

/**
 * ONE ENTRY, OPENED — the six steps of the file header, in order.
 *
 * The parse runs here and again inside `openProtSurfaceAsync`, and that is a
 * deliberate two lines rather than an options object: the notes need the table
 * BEFORE the dashboard is built (a blocking note must stop the build), the
 * parse is one pass over the file's lines and a pure function of the same
 * bytes, and the interaction engine that follows it is orders of magnitude the
 * larger cost.
 */
async function boot(entry: string, onOutcome: (outcome: ActOutcome) => void): Promise<Opened> {
  const opened = await openEntryBytes(entry, { committed: () => loadStructureOverHttp(siteBase()), archive: browserArchive });
  if (!opened.ok) return opened;
  const read = readEntryBytes(opened.value.bytes.at, opened.value.bytes.text);
  const notes = entryNotes(read, protTables(read.artifact.text));
  const blocked = blockingSentence(notes);
  if (blocked !== null) return { ok: false, sentence: blocked };
  const surface = await openProtSurfaceAsync(read.artifact, { onOutcome });
  return {
    ok: true,
    booted: {
      entry,
      surface,
      checks: [...(await surface.dashboard.lintData()), ...protSurfaceProblems(surface)],
      credit: entryCredit(read.artifact.text),
      notes,
      cost: opened.value.cost,
    },
  };
}

function StaticProtDesk({ booted, onSearchAgain }: { readonly booted: Booted; onSearchAgain(): void }): JSX.Element {
  const { surface, checks, notes } = booted;
  /**
   * ONE session view, and EVERY piece of this page reads it — the stepper, the
   * charts, the chips, the commit log, the gaps, the sheet and the rows at the
   * cursor.
   *
   * It is memoised rather than built in the JSX because the stepper is a CONTROL
   * for the same cursor the charts are folded at: two views over one session
   * would be two cursors, and a reader clicking a stage would move the one the
   * pictures are not reading.
   */
  const view = useMemo(() => createSessionView(sessionSource(surface.session), { as: 'user', defaultLayout: 'grid' }), [surface.session]);
  /**
   * THE ROWS AT THE CURSOR, RE-READ WHEN IT MOVES — `web/src/protRows.ts` ·
   * `useResiduesAtCursor`, and the whole reason the stepper is a control.
   *
   * This used to be `surface.residues`: the boot's one read, handed to the cells
   * as data, which froze every picture at the boot's cursor while the record
   * moved underneath it.
   */
  const residues = useResiduesAtCursor(view, surface.session, surface.tables, surface.residues);
  const data: ProtDeskData = {
    // THE SESSION'S ROWS, not the ETL's — three of the five columns the new
    // charts draw are acts' outputs and are not in the data at all, so they
    // exist only where the act landed and only the session can say so
    // (`src/prot/session.ts` · `residuesAt`). A refused read falls back to the
    // parse's own rows, which still carry everything the file said — and the
    // refusal is PRINTED below rather than covered by that fallback.
    // ONE CAST, at the one crossing this page makes: the library's `Row` has
    // `unknown` values and a cell's `Row` has the four a cell can draw. The
    // exoplanet page's `rowsOf` is the same cast for the same reason — the rows
    // really are records of those values, and a page is where the two vocabularies
    // meet.
    residues: (residues.refused === null ? residues.rows : surface.tables.residues) as readonly Row[],
    counts: surface.tables.counts,
    skipped: surface.tables.skipped,
    structure: surface.structure,
    run: surface.run,
    refusals: surface.refusals,
    notes,
  };
  return (
    <>
      <EntryNotes entry={booted.entry} notes={notes} cost={booted.cost} onSearchAgain={onSearchAgain} />
      {/*
        THE COMPOSED DESK, not the packaged one (`web/src/protDesk.tsx` says
        why, and names every piece of the packaged desk this page does without).
        The COUNTING CAPTION reaches it through the session rather than through a
        prop: the def declares the dashboard's `caption` slot as
        `protCaption(tables)`, so the summary on screen is the definition's own
        words at the cursor and the page cannot disagree with it.
      */}
      <ProtDesk
        view={view}
        data={data}
        run={surface.run}
        outcomes={surface.run?.outcomes ?? []}
        checks={checks}
        session={surface.session}
        table={RESIDUES_TABLE}
        rowsNote={<RowsNote residues={residues} />}
      />
    </>
  );
}

/**
 * WHICH COMMIT THE PICTURES ARE DRAWN AT, and what went wrong if anything did.
 *
 * Three states, three sentences, and none of them is silent:
 *
 *   - a read IN FLIGHT — the rows on screen are still the previous cursor's, and
 *     the page says so rather than blanking the charts;
 *   - a REFUSED window — the library's own sentence, verbatim, above pictures
 *     that fall back to the file's own columns. The fallback is real and is
 *     therefore named: a page that swapped the rows quietly would be showing the
 *     parse and calling it the record;
 *   - a read that answered — the commit the rows came from, so the pictures and
 *     the stepper can never be read as disagreeing about where the cursor is.
 */
function RowsNote({ residues }: { readonly residues: ResiduesNow }): JSX.Element {
  const NOTE: React.CSSProperties = { font: '12px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif', margin: '.4rem 0 0' };
  if (residues.refused !== null) {
    return (
      <p role="status" style={{ ...NOTE, color: '#8a2b2b' }}>
        the rows at this commit were refused, in the library&rsquo;s own words: <i>{residues.refused}</i> — the pictures below fall back to the columns the file itself gave, so nothing an act landed is on them
      </p>
    );
  }
  return (
    <p role="status" style={{ ...NOTE, color: '#5a6572' }}>
      {residues.reading
        ? 'reading the rows at the commit you just moved to — the pictures below are still the previous one’s until it answers'
        : `every picture below is drawn from the ${residues.rows.length.toLocaleString('en-US')} residue rows as they stand at ${residues.cursor === null ? 'the root of this log — no act has landed yet' : `commit ${residues.cursor}`}`}
    </p>
  );
}

/** The credit the archive asks for, in the entry's own words. */
function Credit({ credit, characters, skipped }: { readonly credit: EntryCredit; readonly characters: number; readonly skipped: number }): JSX.Element {
  return (
    <p style={{ font: '12px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif', color: '#5a6572', margin: '.4rem 0 0' }}>
      Structure <b>{credit.entry}</b> — {credit.title.toLowerCase()} — from the RCSB Protein Data Bank's copy of the wwPDB archive (
      <code>
        https://files.rcsb.org/download/{credit.entry}.pdb
      </code>
      , {characters.toLocaleString('en-US')} characters). Determined by {credit.experiment.toLowerCase()} and deposited by {credit.depositors}; the primary citation the entry names is{' '}
      <i>{credit.citation}</i>. wwPDB releases its data files into the public domain under the CC0 1.0 Universal dedication, which asks for nothing; the archive asks that the depositors and that citation be
      credited, which is what this line is. Every word of it is read out of the file's own header records — nothing here is retyped. The desk's table keeps {skipped.toLocaleString('en-US')} fewer
      coordinate records than the file has, and says which and why under the viewer.
    </p>
  );
}

/** The four states of this page. See the file header. */
type Phase =
  | { readonly status: 'landing'; readonly sentence: string | null }
  | { readonly status: 'reading'; readonly entry: string; readonly outcomes: readonly ActOutcome[] }
  | { readonly status: 'ready'; readonly booted: Booted }
  | { readonly status: 'broken'; readonly sentence: string };

function Page(): JSX.Element {
  const [phase, setPhase] = useState<Phase>({ status: 'landing', sentence: null });
  /** Which entry this page is currently opening — so an answer that arrives after a reader moved on is dropped rather than drawn. */
  const opening = useRef<string | null>(null);

  const run = useCallback((entry: string): void => {
    // ALREADY OPENING THIS ONE — do nothing. A boot runs two stages over Mol*'s
    // engines, so a double-click on a result row, or React's development-mode
    // double effect, would otherwise run the whole pipeline twice for the same
    // entry. Opening a DIFFERENT entry replaces this one, and the answer to the
    // one left behind is dropped below rather than drawn.
    if (opening.current === entry) return;
    opening.current = entry;
    setPhase({ status: 'reading', entry, outcomes: [] });
    const live: ActOutcome[] = [];
    void boot(entry, (outcome) => {
      live.push(outcome);
      // the live copy, as each act lands — the panel is already on screen
      setPhase((was) => (was.status === 'reading' && was.entry === entry ? { ...was, outcomes: [...live] } : was));
    })
      .then((opened) => {
        if (opening.current !== entry) return;
        setPhase(opened.ok ? { status: 'ready', booted: opened.booted } : { status: 'landing', sentence: opened.sentence });
      })
      .catch((e: unknown) => {
        if (opening.current === entry) setPhase({ status: 'broken', sentence: sentenceOf(e) });
      });
  }, []);

  /** What the address asks for, now — on arrival and on every back/forward. */
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

  /** A reader picked an entry: the address carries it, and the boot starts. */
  const open = useCallback(
    (entry: string): void => {
      window.history.pushState(null, '', urlForEntry(entry, window.location.href));
      run(entry);
    },
    [run],
  );

  /** Back to the question. The address drops the entry, so the shared link is the landing again. */
  const searchAgain = useCallback((): void => {
    window.history.pushState(null, '', urlForEntry(null, window.location.href));
    opening.current = null;
    setPhase({ status: 'landing', sentence: null });
  }, []);

  if (phase.status === 'landing') return <ProtLanding title={PROT_WORDS.title} caption={PROT_WORDS.caption} doors={browserArchive} refusal={phase.sentence} onOpen={open} />;
  if (phase.status === 'broken') return <Broken sentence={phase.sentence} />;
  if (phase.status === 'reading') {
    return (
      <Reading
        what={`entry ${phase.entry}${phase.entry === EXAMPLE_ENTRY ? " from this repository's own committed bytes" : ' from the archive'}, the 3D viewer that draws it, and the two stages that find its contacts and measure its surface`}
        extra={
          // THE SAME STEPPER a reader will use on the desk, already on screen
          // and filling as each act lands. `onSeek: null` is the truth here: the
          // cursor is the session view's and there is no session view yet, so the
          // circles are not buttons and the stepper says so in a sentence rather
          // than offering a control that would refuse every click.
          <ProtStepper stages={stepperStages(phase.outcomes, null)} run={null} here={null} onSeek={null} />
        }
      />
    );
  }
  const { surface, credit } = phase.booted;
  return (
    <>
      <WhatIsMissing
        extra={
          <>
            {' '}
            And one thing that is missing on <i>every</i> build of this desk, server or not: <b>a version for the structure file</b>. The other three desks declare their tables through the library's source
            port, so a carrier vouches for what it read and every commit carries that version. A structure file is not rows, CSV or JSON — no carrier will take it — so these bytes reach the 3D viewer as an
            argument, and travelling back to an earlier commit gives you the rows that were true then with whatever file the page is holding now. The desk says it under the viewer too, because that is the
            picture it affects.
          </>
        }
      />
      <Credit credit={credit} characters={surface.structure.characters} skipped={skippedTotal(surface.tables.skipped)} />
      <StaticProtDesk booted={phase.booted} onSearchAgain={searchAgain} />
    </>
  );
}

const mount = document.getElementById('root');
if (mount === null) throw new Error('the page has no #root to mount into');
createRoot(mount).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
