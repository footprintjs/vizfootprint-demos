/**
 * THE TRACE'S ROWS — one per act the run dispatched, each one a way back to the
 * commit it landed, and the recorder's own account underneath them.
 *
 * ── THIS FILE USED TO BE A PANEL, AND IS NOW THE DETAIL OF ONE LIST ─────────
 * It shipped as `ProtTrace`: its own collapsible section under the desk, with
 * its own header, its own counts and its own expander. The stepper across the
 * top of the page is the same record read one level out — the stages — so the
 * two were two lists of one thing, and a reader had to work out that a row in
 * the panel was an act of a circle above it. So the panel's chrome is GONE
 * rather than shipped beside the stepper, and what is left is the part that was
 * worth keeping: the row ({@link ActRow}), what a row says it landed
 * ({@link landedLine}) and the recorder's sentences ({@link RunNarrative}).
 * `./protStepper.tsx` composes all three.
 *
 * ── THE ONE RULE, unchanged ─────────────────────────────────────────────────
 * **A ROW READS THE RUN, NEVER THE DEF.** Rows come off the acts the stages
 * really dispatched (`src/prot/orchestrator.ts` · `ActOutcome`), so a missing row
 * is an act that did not happen. The STAGE above it may be declared and unrun —
 * a plan is a declared fact and `./protStages.ts` says how far that bends — but
 * an act is not: there is no such thing as a greyed act box here.
 *
 * ── WHAT A ROW IS ──────────────────────────────────────────────────────────
 * The stage, the act, and then one of two things:
 *
 *   - what it LANDED: the columns it wrote into the data space, or — for the
 *     act whose answer is a table nobody's clause can reach — that table's own
 *     counts ({@link landedLine}), read off the act's answer and recomputed
 *     nowhere;
 *   - the REFUSAL SENTENCE, verbatim. A refused act is a first-class row, not
 *     an absence: `landAct` already wrote the sentence and this file does not
 *     re-word it.
 *
 * A row whose commit is `null` is NOT clickable, and says why in its own words
 * rather than looking clickable and doing nothing.
 *
 * ── CLICKING A ROW IS THE POINT ─────────────────────────────────────────────
 * It seeks the session's read-only cursor to that commit — and because the
 * page's rows are re-read at the cursor (`./protRows.ts`), every picture on the
 * desk follows it. The seek itself belongs to the session view
 * (`vizfootprint-ui` · `SessionView.seek`), which answers `{ ok }` or a sentence
 * of its own; the host hands that answer back through `onSeek` and the row's
 * owner prints it. A refused seek is a sentence a reader sees, like every other
 * refusal on this desk.
 *
 * ── AND ONE THING THAT IS NOT HERE ──────────────────────────────────────────
 * A DURATION per act. Nothing in this desk's pipeline records elapsed time, and
 * a number this file measured for itself would put profiling where provenance
 * goes — the row would be the only thing on screen claiming a fact no commit
 * carries.
 */
import { PAIRS_ACT } from '../../src/prot/analyses.js';
import type { ActOutcome, ProtRun } from '../../src/prot/orchestrator.js';

/** Seek the cursor to a commit. Answers the SESSION's refusal sentence, or `null` when the cursor moved. */
export type SeekDoor = (commitId: string) => Promise<string | null>;

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

/**
 * THE ROW'S LOOK, from the workbench's own tokens
 * (`web/src/workbench/theme.css`) — one owner for every colour on this page, so
 * an act row inside the stepper's disclosure wears the same glass as the card
 * above it and turns over with the palette.
 */
const ROW: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  fontSize: 12,
  lineHeight: 1.5,
  padding: '.4rem .55rem',
  borderRadius: 'var(--pw-r-button)',
  border: '1px solid var(--pw-rule-button)',
  background: 'var(--pw-glass-button)',
  color: 'var(--pw-ink)',
};
const STAGE: React.CSSProperties = { fontWeight: 600 };
const COMMIT: React.CSSProperties = { fontFamily: 'var(--pw-font-mono)', color: 'var(--pw-mid-2)' };

export interface ActRowProps {
  readonly outcome: ActOutcome;
  /** The finished run, or `null` while its stages are still dispatching — `landedLine` needs it to read an act's own counts. */
  readonly run: ProtRun | null;
  readonly onSeek: SeekDoor;
  /** Where the seek's answer goes: the session's refusal sentence, or `null` when the cursor moved. */
  readonly say: (sentence: string | null) => void;
}

/** One act's row: a button when there is a commit to seek to, a plain note when there is not. */
export function ActRow({ outcome, run, onSeek, say }: ActRowProps): JSX.Element {
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
        <div style={{ ...ROW, background: 'var(--pw-accent-open-bg)', borderColor: 'var(--pw-refuse-badge-edge)' }}>
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
 * WHAT THE RUN LOOKED LIKE FROM INSIDE — the footprintjs recorder's own
 * sentences, in order and not re-worded.
 *
 * Its own disclosure rather than the stepper's, because it is about the WHOLE
 * run and not about any one stage: the recorder narrates the chart's traversal,
 * and a copy of it under each circle would be the same account said three times.
 * Nothing at all when the recorder said nothing.
 */
export function RunNarrative({ run }: { readonly run: ProtRun | null }): JSX.Element | null {
  if (run === null || run.narrative.length === 0) return null;
  return (
    <details style={{ marginTop: '.5rem' }}>
      <summary style={{ cursor: 'pointer' }}>What the run looked like from inside — the recorder&rsquo;s own {count(run.narrative.length)} sentences, in order and not re-worded here</summary>
      <ol style={{ margin: '.3rem 0 0', paddingLeft: '1.2rem', color: 'var(--pw-mid-2)' }}>
        {run.narrative.map((sentence, index) => (
          <li key={`${String(index)}:${sentence.slice(0, 24)}`}>{sentence}</li>
        ))}
      </ol>
    </details>
  );
}
