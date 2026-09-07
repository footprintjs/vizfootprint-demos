/**
 * THE STATIC SITE'S BOOT — what both desks share when there is no server.
 *
 * On GitHub Pages nothing runs but the browser. So the page does what the
 * server does at start-up, in the same order and out of the same modules: read
 * the committed files, shape them through the ETL, build the dashboard, land
 * the layout acts, and hand the session to the desk. The difference is one
 * word in the declaration — `via: 'http'` instead of `via: 'file'` — and one
 * word in the desk's wiring: `sessionSource` instead of `pollingSource`.
 *
 * WHAT A READER LOSES, said out loud rather than degraded quietly: see
 * {@link WhatIsMissing}. A page that silently dropped a capability would teach
 * a reader that the capability never existed. The ANALYST is the one thing
 * that came back: it needs a model key, not a process, so the CDC page offers
 * to run it on a key the visitor supplies (`web/site/nndss/analyst.tsx`) and
 * says so through this line's `extra`.
 */
import type { ReactNode } from 'react';

/**
 * THE SITE'S BASE, as an absolute URL.
 *
 * GitHub Pages serves a project site under `/<repo>/`, a local check serves it
 * under `/`, and the same build has to work at both. Vite writes the base it
 * was built with into `import.meta.env.BASE_URL`; resolving it against the
 * page's own location turns it into the absolute URL the http carrier
 * requires — deliberately, since a relative locator means different bytes
 * depending on which page asked.
 */
export function siteBase(): URL {
  return new URL(import.meta.env.BASE_URL, window.location.href);
}

/** The three states of a boot that has to fetch its own data: reading, broken, ready. Only the first two are drawn here. */
export type BootState<T> = { readonly status: 'reading' } | { readonly status: 'broken'; readonly sentence: string } | { readonly status: 'ready'; readonly value: T };

/** A thrown thing as a sentence. The carrier's refusals already read as sentences; anything else is quoted rather than swallowed. */
export function sentenceOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const SHELL: React.CSSProperties = { font: '14px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif', color: '#1c2530', background: '#f7f8fa', minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', margin: 0 };
const CARD: React.CSSProperties = { maxWidth: '46rem', background: '#fff', border: '1px solid #dfe4ea', borderRadius: 10, padding: '1.5rem 1.75rem' };

/** While the tables are on the wire. It names the megabytes, because a page that looks stuck is worse than a page that says it is fetching 8 MB. */
export function Reading({ what }: { readonly what: string }): JSX.Element {
  return (
    <div style={SHELL}>
      <div style={CARD}>
        <h1 style={{ margin: '0 0 .5rem', fontSize: '1.05rem' }}>Reading {what}</h1>
        <p style={{ margin: 0, color: '#5a6572' }}>The page is fetching the committed files over http and running the same ETL the server runs. Nothing is cached yet, so the first load carries the whole snapshot.</p>
      </div>
    </div>
  );
}

/** A boot that could not finish. The carrier's own refusal sentence, verbatim — it already names the table, the via and the URL. */
export function Broken({ sentence }: { readonly sentence: string }): JSX.Element {
  return (
    <div style={SHELL}>
      <div style={{ ...CARD, borderColor: '#e6b4b4' }}>
        <h1 style={{ margin: '0 0 .5rem', fontSize: '1.05rem' }}>This desk could not read its data</h1>
        <p style={{ margin: '0 0 .75rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '.85rem', color: '#8a2b2b', whiteSpace: 'pre-wrap' }}>{sentence}</p>
        <p style={{ margin: 0, color: '#5a6572' }}>Nothing is drawn, because there is nothing to draw. A dashboard that rendered empty charts here would be claiming a dataset with no rows in it.</p>
      </div>
    </div>
  );
}

/**
 * THE HONESTY LINE — what this build cannot do, named.
 *
 * The desk on this page is the real one: every gesture is a commit, the log is
 * real, time travel is real. What is missing is everything that needed a
 * process on the other end, and each item says what a reader would have had.
 */
export function WhatIsMissing({ extra }: { readonly extra?: ReactNode }): JSX.Element {
  return (
    <div style={{ font: '13px/1.5 system-ui, sans-serif', color: '#4a5462', background: '#fffbe9', border: '1px solid #e8dfae', borderRadius: 8, padding: '.7rem .9rem', margin: '.5rem 0 0' }}>
      <b>This is the static build.</b> There is no server behind it, so: the <b>commit log lives in this tab</b> and is gone when you reload, where the served desk keeps one session per process; and the <b>Sources tab cannot refresh</b> — the files are what the repository committed, and re-reading them would answer the same bytes. Everything else — every selection, every act, undo, named paths, bookmarks, compare, the Sheet — is the same library doing the same work, here in the browser.
      {extra}
    </div>
  );
}
