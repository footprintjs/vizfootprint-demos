/**
 * THE FRONT DOOR — the page you land on, before the dashboard mounts.
 *
 * It reads `GET /api/summary` once and prints what the server counted: the
 * cells, the diseases, the weeks, the jurisdictions, the views the dashboard
 * declares, the absence vocabulary, and when the snapshot was read. Not one of
 * those is written down here. This demo's whole subject is a dashboard that
 * says what it knows and what it could not honour; a front door quoting
 * figures from memory would be the one place in it that pretends.
 *
 * The three states — and which of them may offer a way in — are decided by
 * `frontDoor()` in `front.ts`, which is a plain function over the reading so
 * that `tests/front.test.ts` can hold it to all three. Everything below is
 * drawing.
 *
 * `App` is not mounted until the click, so the dashboard's own reads (the
 * rows, the map shapes, the state poll) do not start behind this page.
 */
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { SUMMARY_DOOR, frontDoor, type Reading } from './front.js';

/** The page's own name, from `index.html` — the heading before the server has told us the dashboard's. */
const PAGE_TITLE = 'NNDSS weekly — vizfootprint on CDC data';

const INK = '#17212b';
const RULE = '#d8dee4';
const MUTED = '#5f6f83';
const PAPER = '#ffffff';

const page: CSSProperties = {
  minHeight: '100%',
  boxSizing: 'border-box',
  padding: '48px 20px 40px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  color: INK,
};
const column: CSSProperties = { width: '100%', maxWidth: 780 };
const eyebrow: CSSProperties = {
  margin: 0,
  fontSize: 11.5,
  letterSpacing: '.09em',
  textTransform: 'uppercase',
  color: MUTED,
  fontWeight: 600,
};
const heading: CSSProperties = { margin: '10px 0 0', fontSize: 30, lineHeight: 1.15, fontWeight: 650, letterSpacing: '-.01em' };
const lead: CSSProperties = { margin: '14px 0 0', fontSize: 16.5, lineHeight: 1.5 };
const body: CSSProperties = { margin: '14px 0 0', fontSize: 14.5, lineHeight: 1.6, color: '#2b3a4a' };
const card: CSSProperties = { marginTop: 28, background: PAPER, border: `1px solid ${RULE}`, borderRadius: 10, padding: '18px 20px' };
const small: CSSProperties = { fontSize: 12.5, lineHeight: 1.6, color: MUTED };
const mono: CSSProperties = { fontFamily: 'ui-monospace, Menlo, monospace' };

/** The dashboard's public front door — one click, and `App` mounts. */
export function Home({ onEnter }: { readonly onEnter: () => void }): JSX.Element {
  const [reading, setReading] = useState<Reading>({ status: 'reading' });

  useEffect(() => {
    const stop = new AbortController();
    void (async () => {
      try {
        const res = await fetch(SUMMARY_DOOR, { signal: stop.signal });
        if (!res.ok) {
          // a status IS an answer: the server is there and did not serve this door — a different fault from silence
          setReading({ status: 'unreachable', because: `${SUMMARY_DOOR} answered ${String(res.status)} ${res.statusText}`.trim(), answered: true });
          return;
        }
        // a 200 that is not JSON is an answer too — never a page of zeroes
        let payload: unknown;
        try {
          payload = await res.json();
        } catch {
          setReading({ status: 'unreachable', because: `${SUMMARY_DOOR} answered 200, but not with JSON`, answered: true });
          return;
        }
        setReading({ status: 'answered', body: payload });
      } catch (error) {
        if (stop.signal.aborted) return;
        setReading({ status: 'unreachable', because: `nothing answered ${SUMMARY_DOOR} — ${error instanceof Error ? error.message : String(error)}` });
      }
    })();
    return () => stop.abort();
  }, []);

  const door = frontDoor(reading);

  return (
    <main style={page}>
      <div style={column}>
        <p style={eyebrow}>CDC · National Notifiable Diseases Surveillance System</p>
        <h1 style={heading}>{door.state === 'ready' ? door.title : PAGE_TITLE}</h1>

        {door.state === 'ready' ? <p style={lead}>{door.caption}</p> : null}

        <p style={body}>
          The CDC publishes a table of notifiable diseases every week: how many cases each jurisdiction reported, and — where
          it reported none — which kind of silence that was. This is that table, driven through{' '}
          <b>vizfootprint</b>: a dashboard on which every act is a commit with its cause, and which can say afterwards how it
          got to what it is showing.
        </p>
        <p style={body}>
          Nothing here is a screenshot. Click a bar and the click lands on a log you can read, walk back through, branch from
          and name. An agent sits on the same dashboard and moves it with the same verbs — never with a number of its own.
          Cells with no count keep their kind rather than becoming zeroes, and a question the dashboard cannot honour is
          refused in a sentence instead of answered approximately.
        </p>

        {door.state === 'reading' ? (
          <div style={card} role="status" aria-live="polite">
            <p style={{ ...small, margin: 0 }}>Reading the desk — {door.waitingFor}.</p>
            <p style={{ ...small, margin: '8px 0 0' }}>
              The way in appears once the server has answered; until then there is nothing here to open.
            </p>
          </div>
        ) : null}

        {door.state === 'unreachable' ? (
          <div style={{ ...card, borderColor: '#e0c3c3', background: '#fdf7f7' }} role="alert">
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: '#a83a3a' }}>{door.heading}</p>
            <p style={{ ...small, margin: '8px 0 0', color: '#2b3a4a' }}>{door.because}.</p>
            <p style={{ ...small, margin: '8px 0 0' }}>{door.advice}</p>
            <p style={{ ...small, margin: '8px 0 0' }}>
              There is no way in from here: the dashboard reads the same server, so a button would only take you to an empty
              room.
            </p>
          </div>
        ) : null}

        {door.state === 'ready' ? (
          <>
            <div style={card}>
              <dl
                style={{
                  margin: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))',
                  gap: '18px 18px',
                }}
              >
                {door.figures.map((f) => (
                  <div key={f.from}>
                    <dt style={{ fontSize: 24, fontWeight: 650, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em' }}>{f.shown}</dt>
                    <dd style={{ ...small, margin: '3px 0 0' }}>{f.label}</dd>
                  </div>
                ))}
              </dl>
              {door.vocabulary.length > 0 ? (
                <p style={{ ...small, margin: '18px 0 0', paddingTop: 14, borderTop: `1px solid ${RULE}` }}>
                  Every cell carries one of these, and keeps it:{' '}
                  <span style={mono}>{door.vocabulary.join(' · ')}</span>.
                </p>
              ) : null}
            </div>

            <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
              <button
                type="button"
                onClick={onEnter}
                style={{
                  font: 'inherit',
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#fff',
                  background: INK,
                  border: `1px solid ${INK}`,
                  borderRadius: 8,
                  padding: '11px 20px',
                  cursor: 'pointer',
                }}
              >
                {door.enter.label} →
              </button>
              <span style={small}>{door.figures[0]?.shown ?? ''} cells, live in the browser — it takes a moment to load.</span>
            </div>

            <p style={{ ...small, marginTop: 22 }}>
              Inside, beside the charts and the table: the <b>Grammar</b> (the verbs, and what each gesture emits), the{' '}
              <b>silences</b>, the agent's <b>proposals</b>, the <b>commit log</b> with its time-travel bar, <b>Data</b> — the
              Sources tab and the Sheet, in one workbook — and the <b>Story</b> the named beats write.
            </p>

            <footer style={{ ...small, marginTop: 30, paddingTop: 16, borderTop: `1px solid ${RULE}` }}>
              <p style={{ margin: 0 }}>
                Source: NNDSS Weekly Data, data.cdc.gov (Office of Public Health Data, Surveillance, and Technology, CDC) — a
                work of the United States Government, public domain. The committed snapshot is a slice of it.
                {door.snapshotRead === null ? null : <> Read {door.snapshotRead}.</>}
              </p>
              <p style={{ margin: '6px 0 0' }}>
                Every figure above was counted by the server from the loaded tables and read from{' '}
                <span style={mono}>{SUMMARY_DOOR}</span>; none is written into this page.
                {door.analyst === null ? null : <> Right now, {door.analyst}.</>}
              </p>
            </footer>
          </>
        ) : null}
      </div>
    </main>
  );
}
