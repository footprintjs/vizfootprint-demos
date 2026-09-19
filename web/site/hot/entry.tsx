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
 *   5. THE ROWS, read once, at the one moment no clause can exist.
 *
 * The order is the contract: the score has nothing to fold until the five
 * tracks have landed, and the patches have nothing to group until the score has.
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createSessionView, sessionSheetData, sessionSource } from 'vizfootprint-ui';
import 'vizfootprint-ui/styles.css';
import 'storydeck/storydeck.css';
import { Desk } from 'vizfootprint-studio/desk';
import { loadStructureOverHttp, readCommittedOverHttp } from '../../../src/prot/http.js';
import { annotationFromCommitted } from '../../../src/prot/annotationEvidence.js';
import { entryId } from '../../../src/prot/etl.js';
import { hotSurfaceProblems, openHotSurfaceAsync, type HotSurface } from '../../../src/hot/session.js';
import { RESIDUES_TABLE } from '../../../src/hot/def.js';
import { WHAT_A_PROSE_STAGE_WOULD_BE } from '../../../src/hot/analyses.js';
import { HYDROPATHY_SOURCE } from '../../../src/hot/analyses.js';
import { useHotCells, type HotDeskData } from '../../src/hot/cells.js';
import type { Row } from '../../src/derive.js';
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

function HotDesk({ booted }: { readonly booted: Booted }): JSX.Element {
  const { surface, checks } = booted;
  const data: HotDeskData = {
    residues: surface.residues.rows as readonly Row[],
    patches: surface.run?.extent?.patches ?? [],
    refusalBeforeTheAct: surface.refusalBeforeTheAct,
  };
  return (
    <Desk
      view={createSessionView(sessionSource(surface.session), { as: 'user', defaultLayout: 'grid' })}
      charts={(desk) => useHotCells(desk, data)}
      data={{ table: RESIDUES_TABLE, sheet: () => sessionSheetData(surface.session, { table: RESIDUES_TABLE }), checks }}
    />
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
  const { surface, problems } = state.booted;
  return (
    <>
      <WhatIsMissing
        extra={
          <>
            {' '}
            And three things about THIS desk in particular. <b>No model is asked anything here</b> — the score is arithmetic, so this page needs no key and is not a reduced version of anything; {WHAT_A_PROSE_STAGE_WOULD_BE} <b>The four measured tracks are not recomputed:</b> the interface contacts, the solvent-accessible area and what is already published about these sequences are landed by the acts the protein desk beside this one declares, reused by reference rather than copied. The fifth track is the one that was missing — the hydropathy of each residue type, from {HYDROPATHY_SOURCE}.
            {surface.refusalBeforeTheAct !== null && (
              <>
                {' '}
                And one thing that is missing only <i>until the act lands</i>. Before any stage had run, this page pressed the structural run, and the library refused it in these words, which are its own and not ours:{' '}
                <code style={{ background: '#fff', border: '1px solid #e8dfae', borderRadius: 4, padding: '.1rem .3rem' }}>{surface.refusalBeforeTheAct}</code>{' '}
                Then it landed the six acts, which is why the pictures below draw at all — and seeking the cursor back behind a commit refuses them again.
              </>
            )}
            {problems.length > 0 && (
              <>
                {' '}
                <b>This boot reported problems:</b> {problems.join(' · ')}
              </>
            )}
          </>
        }
      />
      <HotDesk booted={state.booted} />
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
