/**
 * THE FIFTH DESK, STATIC — hot spots scored by arithmetic, on the same entry
 * the fourth desk opens.
 *
 * ── WHY THERE IS A FIFTH PAGE AT ALL ───────────────────────────────────────
 * The protein desk beside this one ranks hot spots by asking a MODEL to read
 * the evidence (its stage 5, with a findings ledger, a citation discipline and
 * a hallucination door). This page is the deterministic alternative: the same
 * five measurement tracks, folded into two scores by declared weights, with the
 * extent taken from connected components in three dimensions. Nothing on this
 * page is ranked or worded by a model — there is no key here and none is
 * needed. **The fourth desk is untouched by this one**, so the two designs can
 * be read side by side on the same molecule, which is the whole reason this is
 * a new page rather than an edit.
 *
 * ── THE BOOT, in the order a server would do it ────────────────────────────
 *   1. THE STRUCTURE'S BYTES over http, through the same door the protein page
 *      uses (`src/prot/http.ts` · `loadStructureOverHttp`), which refuses an
 *      error page served with a 200 because a PDB entry begins with a HEADER
 *      record.
 *   2. WHAT IS ALREADY PUBLISHED about the entry's two sequences, from the
 *      files this repository committed — the Pfam match and the IEDB's answer.
 *      They are read by the protein desk's own gatherer, not a second copy.
 *   3. ONE GESTURE AT THE STRUCTURAL RUN, REFUSED — made before any act has
 *      landed, because at that cursor the column under that picture does not
 *      exist and the library says so by name. It lands nothing, and the
 *      sentence is kept and shown, because a visitor arrives after the acts and
 *      can never reach it themselves.
 *   4. THE SIX ACTS, as six commits: the three the protein desk already
 *      declares (contacts, surface, annotation), then the hydropathy lookup,
 *      then the two scores, then the patches. Each act reads the columns the
 *      ones before it committed.
 *   5. THE ROWS, read at the one moment no clause can exist — and RE-READ
 *      whenever the reader moves the cursor (`web/src/protRows.ts` ·
 *      `useResiduesAtCursor`, handed this desk's own door). The boot's answer is
 *      the seed, so the first paint costs no extra read.
 *
 * The order is the contract: the score has nothing to fold until the five
 * tracks have landed, and the patches have nothing to group until the score has.
 *
 * ── AND THE SCREEN IS THE FOURTH DESK'S ────────────────────────────────────
 * Every component on this page comes from `web/src/workbench/`, the protein
 * desk's own shell, through `web/src/hot/desk.tsx`. It used to be the library's
 * packaged `Desk`, and that was a defect: two desks built to be compared side by
 * side on the same entry must wear the same clothes, or a reader cannot tell
 * whether a difference on screen is the SCORING or the SCREEN.
 */
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { cellOrderToLayoutValue, createSessionView, sessionSource } from 'vizfootprint-ui';
import 'vizfootprint-ui/styles.css';
import 'storydeck/storydeck.css';
import { loadStructureOverHttp, readCommittedOverHttp } from '../../../src/prot/http.js';
import { annotationFromCommitted } from '../../../src/prot/annotationEvidence.js';
import { entryCredit, entryId } from '../../../src/prot/etl.js';
import { hotSurfaceProblems, openHotSurfaceAsync, type HotSurface } from '../../../src/hot/session.js';
import { WHAT_A_PROSE_STAGE_WOULD_BE } from '../../../src/hot/analyses.js';
import { HYDROPATHY_SOURCE } from '../../../src/hot/analyses.js';
import { HotDesk, HOT_ARRANGEMENT_SCOPE } from '../../src/hot/desk.js';
import { ARRANGEMENT_PROP } from '../../src/workbench/arrangement.js';
// LAYER 1, LOADED ONCE: the tokens every band, card and mark of this page is
// drawn from (`web/src/workbench/theme.css`) — THE SAME STYLESHEET the protein
// desk loads, because the two desks are one instrument with different dials.
import '../../src/workbench/theme.css';
import { Broken, Reading, WhatIsMissing, sentenceOf, siteBase } from '../boot.js';

/** What the boot produces: a live session with six commits on it, the data checks, and whatever went wrong. */
interface Booted {
  readonly surface: HotSurface;
  readonly checks: readonly string[];
  readonly problems: readonly string[];
}

async function boot(): Promise<Booted> {
  const base = siteBase();
  const artifact = await loadStructureOverHttp(base);
  const annotation = await annotationFromCommitted(entryId(artifact.text), readCommittedOverHttp(base));
  const surface = await openHotSurfaceAsync(artifact, undefined, annotation);
  return { surface, checks: await surface.dashboard.lintData(), problems: hotSurfaceProblems(surface) };
}

/**
 * THE DESK, IN THE WORKBENCH'S OWN CLOTHES — `web/src/hot/desk.tsx`, which is
 * built out of `web/src/workbench/`'s components and not out of the library's
 * packaged `Desk`.
 *
 * IT USED TO BE THE PACKAGED ONE, and that was the defect: the fourth desk on
 * the next link is the workbench, and two desks meant to be read side by side
 * on the same entry must wear the same clothes or a reader cannot tell whether
 * a difference on screen is the SCORING or the SCREEN.
 */
function StaticHotDesk({ booted }: { readonly booted: Booted }): JSX.Element {
  const { surface, checks } = booted;
  /**
   * ONE session view, and EVERY piece of this page reads it — the stepper, the
   * charts, the chips, the commit log, the gaps, the sheet and the rows at the
   * cursor. Memoised rather than built in the JSX: two views over one session
   * would be two cursors, and the stepper is a CONTROL for the one the pictures
   * are folded at.
   */
  const view = useMemo(() => createSessionView(sessionSource(surface.session), { as: 'user', defaultLayout: 'grid' }), [surface.session]);
  return (
    <HotDesk
      view={view}
      session={surface.session}
      tables={surface.tables}
      seed={surface.residues}
      data={{ patches: surface.run?.extent?.patches ?? [], refusalBeforeTheAct: surface.refusalBeforeTheAct }}
      run={surface.run}
      outcomes={surface.run?.outcomes ?? []}
      checks={checks}
      credit={entryCredit(surface.structure.text)}
      /*
        THE READER'S ARRANGEMENT OF THE DESK, LANDED — through the VIEW, never
        beside it, for the reason `web/site/prot/entry.tsx` carries in full: a
        dispatch beside the view the pictures are folded at is a SECOND CURSOR.
        The scope is this desk's own (`web/src/hot/desk.tsx` ·
        `HOT_ARRANGEMENT_SCOPE`); the prop is the workbench's, because it means
        the same thing on both desks.
      */
      onArrange={async (order, words) => {
        const done = await view.setLayoutNote({ scope: HOT_ARRANGEMENT_SCOPE, prop: ARRANGEMENT_PROP, value: cellOrderToLayoutValue([...order]), words });
        return done.ok ? null : done.sentence;
      }}
      record={<PageFoot booted={booted} />}
    />
  );
}

/**
 * THE PAGE'S OWN FOOT — what this build cannot do, what this desk in particular
 * does not ask anybody, and the sentence the library refused this page's first
 * gesture with.
 *
 * IT USED TO SIT ABOVE THE DESK, which made the page scroll. It goes where the
 * protein desk's own foot went — inside the record drawer at the bottom edge of
 * the instrument (`web/src/workbench/Chrome.tsx` · `RecordDrawer` argues the
 * shape). NOT ONE WORD OF IT CHANGED; what changed is that reaching it is one
 * press instead of one scroll, and its presence is named on the shut bar.
 */
function PageFoot({ booted }: { readonly booted: Booted }): JSX.Element {
  const { surface, problems } = booted;
  return (
    <div
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
      {/*
        IN A PARAGRAPH, and it has to be: `bare` answers a FRAGMENT of inline
        prose, and a fragment dropped straight into this grid makes every `<b>`
        in it a grid item of its own — the defect a real browser showed on the
        protein desk's own foot.
      */}
      <p style={{ margin: 0 }}>
        <WhatIsMissing
          bare
          extra={
            <>
              {' '}
              And three things about THIS desk in particular. <b>No model is asked anything here</b> — the score is arithmetic, so this page needs no key and is not a reduced version of anything; {WHAT_A_PROSE_STAGE_WOULD_BE} <b>The four measured tracks are not recomputed:</b> the interface contacts, the solvent-accessible area and what is already published about these sequences are landed by the acts the protein desk beside this one declares, reused by reference rather than copied. The fifth track is the one that was missing — the hydropathy of each residue type, from {HYDROPATHY_SOURCE}.
              {surface.refusalBeforeTheAct !== null && (
                <>
                  {' '}
                  And one thing that is missing only <i>until the act lands</i>. Before any stage had run, this page pressed the structural run, and the library refused it in these words, which are its own and not ours:{' '}
                  <code style={{ background: 'var(--pw-glass-button)', border: '1px solid var(--pw-rule-button)', borderRadius: 4, padding: '.1rem .3rem' }}>{surface.refusalBeforeTheAct}</code>{' '}
                  Then it landed the six acts, which is why the pictures below draw at all — and seeking the cursor back behind a commit refuses them again.
                </>
              )}
              {' '}
              And one thing that is missing from a PICTURE rather than from the build. <b>The scatter draws no x axis</b>, and that is a refusal rather than an oversight: the chart library labels a scatter&rsquo;s x ticks as whole numbers, so on a 0&hellip;1 score the five ticks at 0, 0.25, 0.5, 0.75 and 1 would read <code style={{ background: 'var(--pw-glass-button)', border: '1px solid var(--pw-rule-button)', borderRadius: 4, padding: '.1rem .3rem' }}>0 0 1 1 1</code> — three of the five naming a value that is not under them. This desk keeps the law its own small panes already keep — <i>an illegible label is not a label</i> — so the axis is left undrawn rather than wrong, and the y axis, which the same library prints unrounded, is drawn in full. <b>The cost, named:</b> an axis title is also that channel&rsquo;s encoding picker, so the scatter&rsquo;s <i>across</i> channel cannot be re-encoded from the picture while this stands; what it shows is in the picture&rsquo;s own full note. The library needs one line for it to come back — the same rounding its line and bar charts already use for their own ticks.
              {problems.length > 0 && (
                <>
                  {' '}
                  <b>This boot reported problems:</b> {problems.join(' · ')}
                </>
              )}
            </>
          }
        />
      </p>
    </div>
  );
}

function Page(): JSX.Element {
  const [state, setState] = useState<{ readonly status: 'reading' } | { readonly status: 'broken'; readonly sentence: string } | { readonly status: 'ready'; readonly booted: Booted }>({ status: 'reading' });

  useEffect(() => {
    let live = true;
    void boot()
      .then((booted) => live && setState({ status: 'ready', booted }))
      .catch((e: unknown) => live && setState({ status: 'broken', sentence: sentenceOf(e) }));
    return () => {
      live = false;
    };
  }, []);

  if (state.status === 'reading') return <Reading what="the committed PDB entry and what is already published about its two sequences" />;
  if (state.status === 'broken') return <Broken sentence={state.sentence} />;
  return <StaticHotDesk booted={state.booted} />;
}

const mount = document.getElementById('root');
if (mount === null) throw new Error('the page has no #root to mount into');
/**
 * THE GROUND, from the theme layer and from nowhere else —
 * `web/src/workbench/theme.css` declares `body.pw-body` (the design's grid and
 * its three radial glows, in both palettes) and this is the one line that puts
 * the class on. The protein desk's entry carries the identical line.
 */
document.body.classList.add('pw-body');
createRoot(mount).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
