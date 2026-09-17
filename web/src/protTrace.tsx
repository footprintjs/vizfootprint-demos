/**
 * THE TRACE, AS A CONTROL — one row per act the run dispatched, in order, each
 * one a way back to the commit it landed.
 *
 * ── THE ONE RULE ────────────────────────────────────────────────────────────
 * **This panel reads the RUN, never the def.** It would be easy to draw the two
 * declared stages and their three acts as greyed boxes and fill them in as they
 * land — and it would be a promise rather than a record: a box for an act
 * nobody dispatched claims the desk is going to do something, which is a claim
 * no log can support. A missing row is the truth. So the rows come off
 * {@link ProtTraceProps.outcomes} — `src/prot/orchestrator.ts` · `ActOutcome`,
 * one per act the stages really dispatched — and a run that dispatched nothing
 * has no rows and says so in a sentence.
 *
 * ── WHAT A ROW IS ──────────────────────────────────────────────────────────
 * The stage, the act, and then one of two things:
 *
 *   - what it LANDED: the columns it wrote into the data space, or — for the
 *     act whose answer is a table nobody's clause can reach — that table's own
 *     counts ({@link landedLine}), read off the act's answer and recomputed
 *     nowhere;
 *   - the REFUSAL SENTENCE, verbatim. A refused act is a first-class row, not
 *     an absence: `landAct` already wrote the sentence and this panel does not
 *     re-word it.
 *
 * A row whose commit is `null` is NOT clickable, and says why in its own words
 * rather than looking clickable and doing nothing.
 *
 * ── CLICKING A ROW IS THE POINT ─────────────────────────────────────────────
 * It seeks the session's read-only cursor to that commit — so the flowchart is
 * a control for the record rather than a diagram of the design. The seek itself
 * belongs to the session view (`vizfootprint-ui` · `SessionView.seek`), which
 * answers `{ ok }` or a sentence of its own; the host hands that answer back
 * through {@link ProtTraceProps.onSeek} and this panel prints it. A refused
 * seek is a sentence a reader sees, like every other refusal on this desk.
 *
 * ── AND ONE THING THAT IS NOT HERE ──────────────────────────────────────────
 * A DURATION per act. Nothing in this desk's pipeline records elapsed time, and
 * a number this panel measured for itself would put profiling where provenance
 * goes — the panel would be the only thing on screen claiming a fact no commit
 * carries.
 */
import { useState } from 'react';
import { PAIRS_ACT } from '../../src/prot/analyses.js';
import type { ActOutcome, ProtRun } from '../../src/prot/orchestrator.js';

export interface ProtTraceProps {
  /**
   * The finished run, or `null` while its stages are still dispatching. It is
   * what tells the panel whether to open itself: expanded while the run is in
   * flight (a reader watches it fill), collapsed once it is done.
   */
  readonly run: ProtRun | null;
  /** The acts that have come back so far, in dispatch order — the run's own once it has finished. */
  readonly outcomes: readonly ActOutcome[];
  /** Seek the cursor to a commit. Answers the SESSION's refusal sentence, or `null` when the cursor moved. */
  onSeek(commitId: string): Promise<string | null>;
}

const count = (n: number): string => n.toLocaleString('en-US');

/**
 * WHAT ONE ACT LANDED, in the act's own numbers.
 *
 * Two shapes, because this desk's acts have two channels (`src/prot/analyses.ts`):
 * an act that writes COLUMNS names them, and the act that cuts a TABLE has no
 * column to name — its rows are not in the data space at all — so it is
 * described by the counts on its own answer. Neither is recomputed here.
 */
export function landedLine(outcome: ActOutcome, run: ProtRun | null): string {
  if (outcome.materialized.length > 0) {
    return `landed ${count(outcome.materialized.length)} ${outcome.materialized.length === 1 ? 'column' : 'columns'} on the residues table: ${outcome.materialized.join(', ')}`;
  }
  const pairs = outcome.act === PAIRS_ACT ? run?.pairs : undefined;
  if (pairs !== undefined && pairs !== null) {
    return `cut ${count(pairs.counts.rows)} contact rows, ${count(pairs.counts.crossing)} of them between different chains (${pairs.counts.byKind.map((k) => `${count(k.contacts)} ${k.kind}`).join(', ')}) — the act's own answer, which no clause in the data space reaches`;
  }
  // an act that landed with nothing named YET: the run has not come back, so
  // its answer's counts are not readable here. Said plainly rather than guessed
  return run === null ? 'landed a commit; what it answered is read when the run comes back' : 'landed a commit and wrote no column into the data space';
}

const ROW: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', font: '12px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif', padding: '.4rem .55rem', borderRadius: 6, border: '1px solid #e2e7ec', background: '#fff', color: '#20303f' };
const STAGE: React.CSSProperties = { fontWeight: 600 };
const COMMIT: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#5a6572' };

/** One act's row: a button when there is a commit to seek to, a plain note when there is not. */
function TraceRow({ outcome, run, onSeek, say }: { readonly outcome: ActOutcome; readonly run: ProtRun | null; readonly onSeek: ProtTraceProps['onSeek']; readonly say: (sentence: string | null) => void }): JSX.Element {
  const what = outcome.refusal ?? landedLine(outcome, run);
  const body = (
    <>
      <span style={STAGE}>
        {outcome.stage} · {outcome.act}
      </span>{' '}
      — {what}
    </>
  );
  if (outcome.commit === null) {
    return (
      <li style={{ margin: '.25rem 0' }}>
        <div style={{ ...ROW, background: '#fdf7f7', borderColor: '#e6c9c9' }}>
          {body} <span style={COMMIT}>· no commit, so there is nothing to seek to: this act landed none</span>
        </div>
      </li>
    );
  }
  const commit = outcome.commit;
  return (
    <li style={{ margin: '.25rem 0' }}>
      <button
        type="button"
        style={{ ...ROW, cursor: 'pointer' }}
        // a seek that THREW is a sentence too: the host's `seek` reaches a
        // session view, and a door that rejects must not leave a reader with a
        // row they clicked and no answer
        onClick={() => void onSeek(commit).then(say, (error: unknown) => say(`that seek threw: ${error instanceof Error ? error.message : String(error)}`))}
        aria-label={`seek the cursor to the commit act "${outcome.act}" landed`}
      >
        {body} <span style={COMMIT}>· seek to {commit}</span>
      </button>
    </li>
  );
}

/**
 * THE PANEL.
 *
 * ```tsx
 * <ProtTrace run={surface.run} outcomes={surface.run?.outcomes ?? live} onSeek={(id) => view.seek(id).then((r) => (r.ok ? null : r.sentence))} />
 * ```
 *
 * Collapsed by default once the run is done and expanded while it runs — and a
 * reader who opens or closes it OWNS it from then on (`chosen`), because a
 * panel that slammed shut under somebody reading it would be the screen
 * disagreeing with the reader.
 */
export function ProtTrace({ run, outcomes, onSeek }: ProtTraceProps): JSX.Element {
  const [chosen, setChosen] = useState<boolean | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const running = run === null;
  const open = chosen ?? running;
  const refused = outcomes.filter((o) => o.refusal !== null).length;
  const landed = outcomes.filter((o) => o.commit !== null).length;

  return (
    <section aria-label="the acts this run dispatched, in order" style={{ font: '12px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif', color: '#3c4856', border: '1px solid #dfe4ea', borderRadius: 8, background: '#f8fafc', padding: '.6rem .75rem', margin: '.6rem 0 0' }}>
      <button
        type="button"
        onClick={() => setChosen(!open)}
        aria-expanded={open}
        style={{ font: 'inherit', fontWeight: 600, color: '#20303f', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', gap: '.4rem', alignItems: 'baseline' }}
      >
        <span aria-hidden>{open ? '▾' : '▸'}</span>
        <span>
          {running ? 'The run, as it happens' : 'The run, act by act'} — {count(outcomes.length)} {outcomes.length === 1 ? 'act' : 'acts'} dispatched, {count(landed)} landed a commit, {count(refused)}{' '}
          {refused === 1 ? 'was refused' : 'were refused'}
          {running ? ' so far' : ''}
        </span>
      </button>
      {!open ? null : (
        <>
          <p style={{ margin: '.4rem 0 .2rem', color: '#5a6572' }}>
            One row per act the two stages really dispatched, in the order they dispatched them — not the stages the definition declares: a row that is missing is an act that did not happen, and a greyed box
            would be a promise.{' '}
            {running
              ? 'The cursor these rows seek to arrives with the desk, when the last act has landed — so a row clicked now answers that instead of moving anything.'
              : 'Click a row to move the read-only cursor to the commit that act landed.'}
          </p>
          {outcomes.length === 0 ? (
            <p role="status" style={{ margin: '.3rem 0 0' }}>
              {running ? 'nothing has come back yet — the first act is in flight' : 'no stage has run on this session, so no act has been dispatched and there is nothing on this trace'}
            </p>
          ) : (
            <ol aria-label="the acts this run dispatched, in dispatch order" style={{ listStyle: 'none', padding: 0, margin: '.3rem 0 0' }}>
              {outcomes.map((outcome, index) => (
                <TraceRow key={`${outcome.stage}/${outcome.act}/${String(index)}`} outcome={outcome} run={run} onSeek={onSeek} say={setSaid} />
              ))}
            </ol>
          )}
          {said === null ? null : (
            <p role="status" style={{ margin: '.4rem 0 0', color: '#8a2b2b' }}>
              the session refused that seek, in its own words: {said}
            </p>
          )}
          {run === null || run.narrative.length === 0 ? null : (
            <details style={{ marginTop: '.5rem' }}>
              <summary style={{ cursor: 'pointer' }}>What the run looked like from inside — the recorder&rsquo;s own {count(run.narrative.length)} sentences, in order and not re-worded here</summary>
              <ol style={{ margin: '.3rem 0 0', paddingLeft: '1.2rem', color: '#5a6572' }}>
                {run.narrative.map((sentence, index) => (
                  <li key={`${String(index)}:${sentence.slice(0, 24)}`}>{sentence}</li>
                ))}
              </ol>
            </details>
          )}
        </>
      )}
    </section>
  );
}
