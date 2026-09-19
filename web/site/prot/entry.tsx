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
 *   5b. THE CURATED ALIGNMENTS the conservation stage CITES
 *      (`src/prot/conservationEvidence.ts`). The committed example reads five
 *      committed files and calls no service; every other entry costs three
 *      small reads, each refusing in a sentence.
 *   5c. WHAT IS ALREADY KNOWN about those sequences, which the functional
 *      annotation stage lands (`src/prot/annotationEvidence.ts`). The committed
 *      example reads four more committed files and calls no service; every
 *      other entry costs two small reads per chain, each refusing in a
 *      sentence. THIS IS THE STEP THIS PAGE COULD NOT TAKE until the stage was
 *      built — it was blocked by US and by nothing external, and the way that
 *      ends is by doing the work.
 *   6. the dashboard, the four stages, and a session view over an IN-PROCESS
 *      session (`sessionSource`), not a poll.
 *
 * The one thing this page owns that the other three do not is the CREDIT line,
 * and it is read rather than typed: the entry's own TITLE, AUTHOR and JRNL
 * records, quoted out of the bytes the page just read.
 */
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { cellOrderToLayoutValue, createSessionView, sessionSource } from 'vizfootprint-ui';
import { ARRANGEMENT_PROP, ARRANGEMENT_SCOPE } from '../../src/workbench/arrangement.js';
import 'vizfootprint-ui/styles.css';
import { loadStructureOverHttp, readCommittedOverHttp } from '../../../src/prot/http.js';
import { conservationEvidenceFor } from '../../../src/prot/conservationEvidence.js';
import { annotationEvidenceFor } from '../../../src/prot/annotationEvidence.js';
import { entryCredit, protTables, skippedTotal, type EntryCredit } from '../../../src/prot/etl.js';
import { PROT_WORDS, RESIDUES_TABLE } from '../../../src/prot/def.js';
import { openProtSurfaceAsync, protSurfaceProblems, type ProtSurface } from '../../../src/prot/session.js';
import { ARCHIVE_LICENCE, EXAMPLE_ENTRY, browserArchive, openEntryBytes } from '../../../src/prot/archive.js';
import { blockingSentence, entryNotes, readEntryBytes, type EntryNote } from '../../../src/prot/entryNotes.js';
import type { ActOutcome } from '../../../src/prot/orchestrator.js';
import { EntryNotes, ProtLanding, entryInUrl, urlForEntry } from '../../src/protLanding.js';
import { useResiduesAtCursor, type ResiduesNow } from '../../src/protRows.js';
import { ProtDesk, RunStepper } from '../../src/protDesk.js';
import type { ProtDeskData } from '../../src/protCells.js';
// LAYER 1, LOADED ONCE: the tokens every band, card and mark of this page is
// drawn from (`web/src/workbench/theme.css`). Nothing else on this page
// declares a colour.
import '../../src/workbench/theme.css';
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
  /**
   * STEP 5b — THE CURATED ALIGNMENTS THE CONSERVATION STAGE CITES, gathered
   * BEFORE the dashboard is built.
   *
   * It is a fifth-and-a-half step rather than part of the ETL because the data
   * is not this file's: it is somebody else's published, versioned work, and
   * the stage's whole claim is that it cites it rather than computing it
   * (`src/prot/conservationEvidence.ts`). The committed example reads the five
   * files this repository committed and calls no service AT ALL — the same
   * routing the bytes get, for the same two reasons — and every other entry
   * costs three small reads from the archive and InterPro, each one of which
   * refuses in a sentence rather than throwing.
   *
   * It is awaited rather than raced with the parse because the def needs it:
   * an act declared with no evidence lands its own refusal, which is honest and
   * is not what a reader of the example should get.
   */
  const evidence = await conservationEvidenceFor(entry, { committed: readCommittedOverHttp(siteBase()), archive: browserArchive });
  /**
   * STEP 5c — WHAT IS ALREADY KNOWN ABOUT THIS ENTRY'S SEQUENCES, gathered
   * BEFORE the dashboard is built, exactly as 5b is and for the same reason.
   *
   * AND THIS IS THE STEP THE PUBLISHED PAGE COULD NOT TAKE UNTIL NOW. Step 6 of
   * the plan was blocked by US — work outstanding, with nothing external in the
   * way — and the way it was unblocked was by doing the work rather than by
   * finding a server: UniProt, InterPro and the IEDB all answer a browser
   * directly, so a static page really performs this stage. The committed
   * example reads four committed files and calls NO service at all, the same
   * routing the bytes and the alignments get.
   */
  const annotation = await annotationEvidenceFor(entry, { committed: readCommittedOverHttp(siteBase()), archive: browserArchive });
  const surface = await openProtSurfaceAsync(read.artifact, { onOutcome }, evidence, null, annotation);
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
      {/*
        THE COMPOSED DESK, not the packaged one (`web/src/protDesk.tsx` says
        why, and names every piece of the packaged desk this page does without).
        The COUNTING CAPTION reaches it through the session rather than through a
        prop: the def declares the dashboard's `caption` slot as
        `protCaption(tables)`, so the summary on screen is the definition's own
        words at the cursor and the page cannot disagree with it.

        THE HEADER BAND takes the entry's CREDIT and the parse's COUNTS, because
        that is what the design puts up there — the id, the deposited title, the
        method, the resolution and the licence, every one of them read off the
        file's own records (`src/prot/etl.ts` · `entryCredit`).
      */}
      <ProtDesk
        view={view}
        data={data}
        run={surface.run}
        outcomes={surface.run?.outcomes ?? []}
        checks={checks}
        session={surface.session}
        table={RESIDUES_TABLE}
        rowsNote={rowsNote(residues)}
        name={PROT_WORDS.name}
        claim={PROT_WORDS.title}
        credit={booted.credit}
        counts={surface.tables.counts}
        /*
          THE READER'S ARRANGEMENT OF THE DESK, LANDED — and it goes through the
          VIEW, never beside it, for the reason `onSelectPicks` carries in full:
          a dispatch beside the view the pictures are folded at is a SECOND
          CURSOR, and the act lands while nothing on screen moves.

          The door is the library's GENERIC layout one. `setLayoutNote` lands
          ONE `navigate` on `layout:dashboard` with the plain words the commit log
          will show, and that commit is INERT by construction at the session tier
          — it never enters a filter, never reaches `foldDiff` and can never move
          a row count. It branches at the cursor like any act and `rebuildFold`
          restores it, which is the whole reason the arrangement travels: seek
          behind the swap and the desk comes back to how it was.

          Nothing is read back through here: the desk reads `state.layout.order`.
        */
        onArrange={async (order, words) => {
          const done = await view.setLayoutNote({ scope: ARRANGEMENT_SCOPE, prop: ARRANGEMENT_PROP, value: cellOrderToLayoutValue([...order]), words });
          return done.ok ? null : done.sentence;
        }}
        onSearchAgain={onSearchAgain}
        record={<PageFoot booted={booted} surface={surface} onSearchAgain={onSearchAgain} />}
      />
    </>
  );
}

/**
 * THE PAGE'S OWN FOOT — the credit the archive asks for, what this desk cannot
 * say about this entry, and the static-build note.
 *
 * It USED TO SIT UNDER THE DESK, and the author's ruling moved it: *"I don't
 * want a scrolling dashboard."* So it goes where the rest of the record went —
 * inside the drawer at the bottom edge of the instrument
 * (`web/src/protDesk.tsx` takes it as `record`, `workbench/Chrome.tsx` ·
 * `RecordDrawer` argues the shape). Not one word of it changed; what changed is
 * that reaching it is one press instead of one scroll, and its presence is
 * named on the shut bar.
 */
function PageFoot({ booted, surface, onSearchAgain }: { readonly booted: Booted; readonly surface: ProtSurface; onSearchAgain(): void }): JSX.Element {
  const { notes } = booted;
  return (
    <>
      {/*
        THE CREDIT AND THE ENTRY'S OWN LINE, in the record rather than under the desk.
        The design puts a 60px header at the top and the workbench owns it now,
        so these move DOWN rather than away: the archive asks that the
        depositors and the primary citation be credited, this desk names every
        sentence it cannot say about the entry, and both are still on the page
        in the words they were read in.
      */}
      {/*
        THE PAGE'S OWN FOOT, on the theme's tokens: one glass card, the same
        edge and radius as every other card, hairlines between the three blocks.
        NOT ONE WORD OF THEIR CONTENT CHANGES — this is clothes. The static-build
        note in particular keeps every clause, which is why it arrives here
        `bare` (`web/site/boot.tsx` · `WhatIsMissing`) rather than in its own
        saturated box: the words are the same and
        `tests/prot-tail.test.tsx` compares them.
      */}
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
            boxShadow: 'var(--pw-shadow-card)',
            fontSize: 12,
            lineHeight: 1.55,
            color: 'var(--pw-mid-2)',
          }}
        >
          <EntryNotes entry={booted.entry} notes={notes} cost={booted.cost} onSearchAgain={onSearchAgain} />
          <span aria-hidden style={{ height: 1, background: 'var(--pw-rule)' }} />
          <Credit credit={booted.credit} characters={surface.structure.characters} skipped={skippedTotal(surface.tables.skipped)} />
          <span aria-hidden style={{ height: 1, background: 'var(--pw-rule)' }} />
          {/*
            IN A PARAGRAPH, and it has to be: `bare` answers a FRAGMENT of
            inline prose, and a fragment dropped straight into this grid makes
            every `<b>` in it a grid item of its own — which a real browser
            showed as the sentence broken into a dozen lines. It is one
            paragraph, so it goes in one `<p>`.
          */}
          <p style={{ margin: 0 }}>
            <WhatIsMissing
              bare
              extra={
                <>
                  {' '}
                  And one thing that is missing on <i>every</i> build of this desk, server or not: <b>a version for the structure file</b>. The other three desks declare their tables through the library's
                  source port, so a carrier vouches for what it read and every commit carries that version. A structure file is not rows, CSV or JSON — no carrier will take it — so these bytes reach the 3D
                  viewer as an argument, and travelling back to an earlier commit gives you the rows that were true then with whatever file the page is holding now. The desk says it under the viewer too,
                  because that is the picture it affects.
                </>
              }
            />
          </p>
        </section>
      </div>
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
function rowsNote(residues: ResiduesNow): { readonly line: JSX.Element; readonly quiet: boolean } {
  const NOTE: React.CSSProperties = { fontSize: 12, lineHeight: 1.5, margin: '.4rem 0 0' };
  if (residues.refused !== null) {
    return {
      // LOUD: the panel keeps this one visible
      quiet: false,
      line: (
        <p role="status" style={{ ...NOTE, color: 'var(--pw-refuse-ink)' }}>
          the rows at this commit were refused, in the library&rsquo;s own words: <i>{residues.refused}</i> — the pictures below fall back to the columns the file itself gave, so nothing an act landed is on them
        </p>
      ),
    };
  }
  if (residues.reading) {
    return {
      // ALSO LOUD: the pictures on screen are the PREVIOUS cursor's, and a
      // reader has to be told that while it is true
      quiet: false,
      line: (
        <p role="status" style={{ ...NOTE, color: 'var(--pw-mid-2)' }}>
          reading the rows at the commit you just moved to — the pictures below are still the previous one&rsquo;s until it answers
        </p>
      ),
    };
  }
  return {
    // QUIET: a plain statement of where the cursor is standing, which is what
    // the follow-up round moved into the panel's fold
    quiet: true,
    /*
      SHORTER BY SIX WORDS, AND BY NO FACT: the row count and the commit are
      both still here, and it is still the read's OWN answer
      (`ResiduesNow.cursor`) rather than what this page believes the cursor to
      be. It sits in the header band beside the method line, and the old
      wording wrapped that band to two rows at 1280 — 94px against 60 — which
      is 34px the pictures wanted more than the sentence did.
    */
    line: (
      <p role="status" style={{ ...NOTE, color: 'var(--pw-mid-2)' }}>
        {residues.rows.length.toLocaleString('en-US')} rows, as they stand at{' '}
        {residues.cursor === null ? 'the root of this log — no act has landed yet' : `commit ${residues.cursor}`}
      </p>
    ),
  };
}

/** The credit the archive asks for, in the entry's own words. */
function Credit({ credit, characters, skipped }: { readonly credit: EntryCredit; readonly characters: number; readonly skipped: number }): JSX.Element {
  return (
    <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--pw-mid-2)', margin: '.4rem 0 0' }}>
      Structure <b>{credit.entry}</b> — {credit.title.toLowerCase()} — from the RCSB Protein Data Bank's copy of the wwPDB archive (
      <code>
        https://files.rcsb.org/download/{credit.entry}.pdb
      </code>
      , {characters.toLocaleString('en-US')} characters). Determined by {credit.experiment.toLowerCase()}
      {credit.resolution === null ? '' : ` at ${credit.resolution} Å`} and deposited by {credit.depositors}; the primary citation the entry names is <i>{credit.citation}</i>. wwPDB releases its data files into
      the public domain under the {ARCHIVE_LICENCE} dedication, which asks for nothing; the archive asks that the depositors and that citation be credited, which is what this line is. Every word of it is read out of the file's own header records — nothing here is retyped. The desk's table keeps {skipped.toLocaleString('en-US')} fewer
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
    // ALREADY OPENING THIS ONE — do nothing. A boot runs four stages, two of them over Mol*'s
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

  if (phase.status === 'landing') return <ProtLanding name={PROT_WORDS.name} claim={PROT_WORDS.title} caption={PROT_WORDS.caption} doors={browserArchive} refusal={phase.sentence} onOpen={open} />;
  if (phase.status === 'broken') return <Broken sentence={phase.sentence} />;
  if (phase.status === 'reading') {
    return (
      <Reading
        what={`entry ${phase.entry}${phase.entry === EXAMPLE_ENTRY ? " from this repository's own committed bytes" : ' from the archive'}, the 3D viewer that draws it, and the four stages that place its residues in their families' alignments, find its contacts, measure its surface and look up what is already known about it`}
        extra={
          // THE SAME STEPPER a reader will use on the desk, already on screen
          // and filling as each act lands. Nothing is seekable here and the note
          // says so: the cursor is the session view's and there is no session
          // view yet, so no mark is a control rather than offering a click that
          // would refuse every time.
          <RunStepper outcomes={phase.outcomes} />
        }
      />
    );
  }
  return <StaticProtDesk booted={phase.booted} onSearchAgain={searchAgain} />;
}

const mount = document.getElementById('root');
if (mount === null) throw new Error('the page has no #root to mount into');
/**
 * THE GROUND, from the theme layer and from nowhere else.
 *
 * `web/src/workbench/theme.css` declares `body.pw-body` — the design's grid and
 * its three radial glows, in both palettes — and this is the one line that puts
 * the class on. The page's own HTML carries layout and no colour at all, so
 * there is exactly one owner of every colour on this page.
 */
document.body.classList.add('pw-body');
createRoot(mount).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
