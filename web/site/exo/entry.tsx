/**
 * THE EXOPLANET DESK, STATIC — the third demo, with no server behind it.
 *
 * There is no served twin of this page: the demo was built for the static site
 * from the start, so this file is the only host it has. Everything that matters
 * is still shared with the other two demos' shape — `exoDef` (one definition),
 * `openExoSurfaceAsync` (one session builder, which LANDS THE FIVE ACTS),
 * `exoRows` (one payload), `useExoCells` (one set of charts).
 *
 * The boot, in the order a server would do it:
 *   1. the two committed CSVs — 9.8 MB — over http, through the library's
 *      source port, so every commit can stamp a version somebody vouched for
 *   2. the ETL, unchanged — it was always pure
 *   3. ONE CLICK ON THE HISTOGRAM, refused — made before anything has landed,
 *      because at that cursor the table under that picture does not exist and
 *      the library says so, naming the act that mints it. It lands nothing and
 *      the sentence is kept ({@link Booted.refusal}); the honesty line below
 *      shows it, because a visitor arrives after the acts and can never reach
 *      it themselves.
 *   4. the dashboard's FIVE acts landed as commits: the aggregate that mints the
 *      histogram's table, its two derived columns, the bring-over that carries
 *      the accepted radius onto every measurement, and the delta that says how
 *      far each publication sits from it
 *   5. a session view over an IN-PROCESS session (`sessionSource`), not a poll
 *
 * The order is the contract: the histogram has no table until the aggregate
 * lands, and the payload is read at the one moment no clause can exist.
 */
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createSessionView, sessionSheetData, sessionSource } from 'vizfootprint-ui';
import 'vizfootprint-ui/styles.css';
import 'storydeck/storydeck.css';
import { Desk } from 'vizfootprint-studio/desk';
import { loadExoOverHttp } from '../../../src/exo/http.js';
import { exoRows } from '../../../src/exo/rows.js';
import type { ExoSurface } from '../../../src/exo/session.js';
import { DEFAULT_REVIEW, parseReviewHash, replayReview, serializeReviewHash, type ReviewRecipe } from '../../../src/exo/reviewReplay.js';
import { evidenceForPlanet } from '../../../src/exo/evidence.js';
import { ExoReview } from '../../src/exoReview.js';
import { EXO_STORY_FIGURE, colorOfState, useExoCells, useExoSilences, type ExoDeskData } from '../../src/exoCells.js';
import type { Row } from '../../src/derive.js';
import { Broken, Reading, WhatIsMissing, sentenceOf, siteBase } from '../boot.js';

/** What the boot produces: a live session with five commits on it, the rows it will draw, the data checks, and the one refusal it collected on the way. */
interface Booted {
  readonly surface: ExoSurface;
  readonly review: ReviewRecipe;
  readonly rows: Record<string, unknown>;
  readonly checks: readonly string[];
  /** The library's own sentence for the pre-act click on the histogram — `null` if it was somehow accepted. */
  readonly refusal: string | null;
}

async function boot(): Promise<Booted> {
  const parsed = parseReviewHash(window.location.hash);
  if (!parsed.ok) throw new Error(parsed.sentence);
  const { tables } = await loadExoOverHttp(siteBase());
  return rebuild(tables, parsed.review ?? DEFAULT_REVIEW);
}

async function rebuild(tables: ExoSurface['tables'], review: ReviewRecipe): Promise<Booted> {
  const result = await replayReview(tables, review);
  if (!result.ok) throw new Error(result.sentence);
  const { surface } = result;
  return { surface, review: result.review, rows: exoRows(surface), checks: await surface.dashboard.lintData(), refusal: surface.mintedTableRefusal };
}

/** The payload's rows, read at the one crossing this page makes — the CDC page's `entry.tsx` says why a cast is the honest shape here. */
const rowsOf = (payload: Record<string, unknown>, key: string): readonly Row[] => (payload[key] ?? []) as readonly Row[];

function StaticExoDesk({ booted }: { readonly booted: Booted }): JSX.Element {
  const { surface, rows, checks } = booted;
  const data: ExoDeskData = {
    measurements: rowsOf(rows, 'measurements'),
    planets: rowsOf(rows, 'planets'),
    references: rowsOf(rows, 'references'),
    derived: rowsOf(rows, 'derived'),
    derivedRefused: rows['derivedRefused'] as string | null,
    absence: rows['absence'] as ExoDeskData['absence'],
  };
  const silences = useExoSilences(data);
  return (
    <Desk
      view={createSessionView(sessionSource(surface.session), { as: 'user', defaultLayout: 'grid' })}
      charts={(desk) => useExoCells(desk, data)}
      silences={{
        groups: silences,
        colorOf: colorOfState,
        heading: (
          <>
            Every published measurement in the slice, regardless of the selection. The archive says these things with two columns — a value and a limit flag — and these are our words for them: <b>limit</b> — the paper could only BOUND the parameter, so the number is an upper or lower limit and never a measurement (it is kept, because a bound is a number); <b>not-measured</b> — this publication published no such parameter at all; <b>unknown</b> — never invented, the word that refuses to guess, and no row of this slice needs it. <b>Msini</b> is deliberately not called a limit on physics alone: a radial-velocity mass is a lower bound in physics, but the archive almost never flags it as one of its own (2,418 of 2,423 such rows) — so neither do we, except the handful of rows where the archive's own flag says otherwise, which still word as <b>limit</b> here, exactly as published.
          </>
        ),
      }}
      data={{ table: 'measurements', sheet: () => sessionSheetData(surface.session, { table: 'measurements' }), checks }}
      story={{ declared: (rows['declared'] as { readonly dashboard?: { readonly title: string; readonly caption: string } } | undefined)?.dashboard, author: 'the desk', figure: EXO_STORY_FIGURE, emptyNote: 'No bookmarks named on this lineage yet — name a bookmark in the time strip and it becomes a section here.' }}
    />
  );
}

/** The optional desk gets its own session; its gestures cannot alter the review receipt. */
function AdvancedExoDesk({ booted }: { readonly booted: Booted }): JSX.Element {
  const [opened, setOpened] = useState<Booted | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void rebuild(booted.surface.tables, booted.review)
      .then((value) => { if (live) setOpened(value); })
      .catch((reason: unknown) => { if (live) setError(sentenceOf(reason)); });
    return () => { live = false; };
  }, [booted.surface]);
  if (error) return <p role="alert">The exploration desk could not open: {error}</p>;
  if (opened === null) return <p>Opening a separate exploration session…</p>;
  return <><p style={{ fontSize: 12 }}>This desk has a separate session. Its gestures do not change the focused review or its share link.</p><StaticExoDesk booted={opened} /></>;
}

function Page(): JSX.Element {
  const [state, setState] = useState<{ readonly status: 'reading' } | { readonly status: 'broken'; readonly sentence: string } | { readonly status: 'ready'; readonly booted: Booted }>({ status: 'reading' });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [deskOpen, setDeskOpen] = useState(false);
  const revision = useRef(0);

  useEffect(() => {
    let live = true;
    // Old fetches must not replace the review named by a newer URL.
    const changed = (): void => {
      const request = ++revision.current;
      setState({ status: 'reading' });
      setBusy(false);
      setStatus('');
      setShareUrl('');
      void boot()
        .then((booted) => { if (live && request === revision.current) setState({ status: 'ready', booted }); })
        .catch((error: unknown) => { if (live && request === revision.current) setState({ status: 'broken', sentence: sentenceOf(error) }); });
    };
    changed();
    window.addEventListener('hashchange', changed);
    return () => { live = false; revision.current++; window.removeEventListener('hashchange', changed); };
  }, []);

  if (state.status === 'reading') return <Reading what="the archive's committed slice (9.8 MB across two files)" />;
  if (state.status === 'broken') return <><Broken sentence={state.sentence} /><p style={{ textAlign: 'center' }}><a href={window.location.pathname}>Open the default saved review</a></p></>;
  const current = state.booted;
  const changeReview = (review: ReviewRecipe): void => {
    const url = new URL(window.location.href);
    url.hash = serializeReviewHash(review);
    window.history.replaceState(null, '', url.href);
    setShareUrl('');
    setStatus('');
    if (review.planet === current.review.planet) {
      setState({ status: 'ready', booted: { ...current, review } });
      return;
    }
    void replay(review);
  };
  const replay = async (review: ReviewRecipe = current.review): Promise<void> => {
    const request = ++revision.current;
    setBusy(true);
    setStatus('Rebuilding from the saved archive tables…');
    try {
      const booted = await rebuild(current.surface.tables, review);
      if (request !== revision.current) return;
      setState({ status: 'ready', booted });
      setStatus(`Replay complete: 5 declared analyses recorded, then ${review.planet} selected. Parameter and publication choices restored.`);
      setDeskOpen(false);
    } catch (error) {
      if (request === revision.current) setStatus(`Replay refused: ${sentenceOf(error)}`);
    } finally {
      if (request === revision.current) setBusy(false);
    }
  };
  const share = async (): Promise<void> => {
    const url = new URL(window.location.href);
    url.hash = serializeReviewHash(current.review);
    setShareUrl(url.href);
    window.history.replaceState(null, '', url.href);
    try {
      await navigator.clipboard.writeText(url.href);
      setStatus('Review link copied. It restores this planet, parameter and A/B publications against the same saved slice.');
    } catch {
      setStatus('Review link ready below. Copy it from the link or your address bar.');
    }
  };
  const download = (): void => {
    const evidence = evidenceForPlanet(current.review.planet, current.surface.tables.measurements, current.surface.tables.planets, current.surface.tables.references, current.review.parameter);
    const receipt = {
      schema: 'vizfootprint-exoplanet-review-v1',
      review: current.review,
      sourceRecord: new URL('data/exo/FETCH.json', siteBase()).href,
      publications: current.review.measurementIds.map((id) => evidence.rows.find((row) => row.id === id)).filter((row) => row !== undefined),
      composite: evidence.composite,
      compositeSourceRow: evidence.planet,
      execution: current.surface.session.log.records,
      checks: current.checks,
      limitations: ['A focused review recipe, not an export of the full desk.', 'Composite uncertainties are not included in this snapshot.', 'Reproduction is not scientific validation; intervals do not imply a significance test.'],
    };
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `exoplanet-review-${current.review.planet.replace(/[^a-z0-9-]/gi, '_')}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Review evidence downloaded: source rows, reported uncertainties, composite source, fingerprints and execution record.');
  };
  return (
    <>
      <ExoReview key={current.review.planet} surface={current.surface} review={current.review} busy={busy} status={status} onChange={changeReview} onReplay={() => { void replay(); }} onShare={() => { void share(); }} onDownload={download} />
      {shareUrl && <p style={{ maxWidth: 1116, margin: '0 auto 20px', padding: '0 16px', overflowWrap: 'anywhere', fontSize: 12 }}><a href={shareUrl}>Open this saved evidence review</a></p>}
      <details className="exo-advanced" open={deskOpen} onToggle={(event) => setDeskOpen(event.currentTarget.open)}>
      <summary>Open the full exploration desk: charts, sheet and session history</summary>
      {deskOpen && <>
      <WhatIsMissing
        extra={
          <>
            {' '}
            Also absent here: a <b>find door</b> for the sheet. A search reaches the rows the page already holds and no further — with the whole slice in the browser that is every row, but a served deployment over the full archive would need one.
            {state.booted.refusal !== null && (
              <>
                {' '}
                And one thing that is missing only <i>until you ask for it</i>. The histogram draws a table no file holds: an act cuts it at run time. So this page clicked a bar before that act had landed, and the library refused — in these words, which are its own and not ours:{' '}
                <code style={{ background: '#fff', border: '1px solid #e8dfae', borderRadius: 4, padding: '.1rem .3rem' }}>{state.booted.refusal}</code>{' '}
                Then it landed the act, which is why the bars below can be clicked at all. The refusal is in this session&rsquo;s gap ledger, filed under <b>needs-act</b> — the repair is to perform the act, not to re-read the definition — and it comes back if you seek back past that commit.
              </>
            )}
          </>
        }
      />
      <p style={{ font: '12px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif', color: '#5a6572', margin: '.4rem 0 0' }}>
        This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program — the Planetary Systems Table (<code>10.26133/NEA12</code>) and the Planetary Systems Composite Parameters Table (<code>10.26133/NEA13</code>). The archive publishes no licence for these tables; this is the acknowledgement it asks for instead.
      </p>
      <AdvancedExoDesk booted={state.booted} />
      </>}
      </details>
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
