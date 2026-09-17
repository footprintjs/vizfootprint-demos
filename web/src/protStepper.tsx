/**
 * THE STAGE STEPPER — the numbered plan across the top of the page, and the one
 * control that moves the whole desk.
 *
 * ```
 *   ①————————②————————③
 *   contacts  surface  conservation
 *   landed    landed   not available here
 * ```
 *
 * ── IT IS THE CURSOR, not a diagram of one ─────────────────────────────────
 * Clicking a stage seeks the session's read-only cursor to the commit that
 * stage's last act landed, the page re-reads its rows at that cursor
 * (`./protRows.ts`) and every picture on the desk goes with it — including the
 * two that lose their column and print the library's own refusal instead. A
 * stepper that only highlighted a box would be decoration; this one is the
 * gesture, and `tests/prot-cursor.smoke.test.ts` asserts it in a real browser.
 *
 * ── FIVE STATES, and each one is a sentence a reader can act on ────────────
 * The fold is `./protStages.ts` · `stepperStages`; this file only draws it. What
 * each state looks like:
 *
 *   `not run`       a dashed circle, muted, NOT a button — "declared, and not
 *                   dispatched on this session"; there is nothing to go back to.
 *   `running`       a solid circle with its count of acts back, not yet a
 *                   button: the cursor arrives with the last act.
 *   `landed`        a BUTTON. Its subtitle names what it put on the desk, and
 *                   clicking it moves the cursor there.
 *   `refused`       red, carrying the act's own refusal sentence verbatim. Still
 *                   a button when some act of it landed a commit, because a
 *                   partly refused stage still has a place on the log.
 *   `not available` grey, struck through, never a button, with the measured
 *                   reason underneath. Said rather than left pending forever.
 *
 * ── A NOTE ON THE ACCESSIBLE NAMES ─────────────────────────────────────────
 * None of them carries a QUOTED stage label. A name is read aloud, and it is
 * also how a test names one control out of many — and a name with `"` in it
 * cannot be spelled inside a CSS attribute selector at all, so the number does
 * the disambiguating instead ("move the desk to stage 2, …").
 *
 * ── ONE LIST, NOT TWO ──────────────────────────────────────────────────────
 * A stage EXPANDS to its acts — the rows that used to be a panel of their own
 * (`./protTrace.tsx` · `ActRow`, whose chrome was deleted rather than shipped
 * beside this). So the trace and the stepper are the same record at two grains,
 * and a reader never has to work out which is which.
 */
import { useState } from 'react';
import type { ProtRun } from '../../src/prot/orchestrator.js';
import { ActRow, RunNarrative, type SeekDoor } from './protTrace.js';
import type { StageState, StepperStage } from './protStages.js';

export interface ProtStepperProps {
  /** The plan, folded over the run — `./protStages.ts` · `stepperStages`. */
  readonly stages: readonly StepperStage[];
  /** The finished run, or `null` while its stages are still dispatching (an act row reads its counts off it). */
  readonly run: ProtRun | null;
  /** The stage the cursor is standing in — `./protStages.ts` · `stageAtCursor`. */
  readonly here: StepperStage | null;
  /**
   * The seek door, or `null` when there is no cursor to move yet.
   *
   * `null` is the run's own state: the session view arrives with the desk, so
   * until then a circle is NOT a button and the stepper says so in a sentence —
   * rather than offering a control that would answer a refusal to every click.
   */
  readonly onSeek: SeekDoor | null;
}

/** What each state looks like: the ring, the ink and the fill of its circle. */
const LOOK: Readonly<Record<StageState, { readonly ring: string; readonly ink: string; readonly fill: string; readonly dashed?: boolean }>> = {
  'not-run': { ring: '#c9d2dc', ink: '#8a95a3', fill: '#fff', dashed: true },
  running: { ring: '#3d7fbf', ink: '#fff', fill: '#3d7fbf' },
  landed: { ring: '#2f7d5a', ink: '#fff', fill: '#2f7d5a' },
  refused: { ring: '#a33a3a', ink: '#fff', fill: '#a33a3a' },
  unavailable: { ring: '#c9d2dc', ink: '#8a95a3', fill: '#eef1f4' },
};

/** The word under the name that names the STATE itself — the same five words the file header uses. */
const WORD: Readonly<Record<StageState, string>> = {
  'not-run': 'not run',
  running: 'running',
  landed: 'landed',
  refused: 'refused',
  unavailable: 'not available on this desk',
};

const LINE = '#c9d2dc';

/** One circle and its two lines of words. A stage that can be seeked to is a button; every other state is not. */
function Step({
  stage,
  here,
  expanded,
  onOpen,
  onSeek,
  say,
}: {
  readonly stage: StepperStage;
  readonly here: boolean;
  readonly expanded: boolean;
  onOpen(): void;
  readonly onSeek: SeekDoor | null;
  /** Where the seek's answer goes — the session's refusal sentence, or `null` when the cursor moved. */
  readonly say: (sentence: string | null) => void;
}): JSX.Element {
  const look = LOOK[stage.state];
  const seekable = onSeek !== null && stage.commit !== null;
  const circle = (
    <span
      aria-hidden
      style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        display: 'inline-grid',
        placeItems: 'center',
        font: '600 12px/1 system-ui, -apple-system, "Segoe UI", sans-serif',
        background: look.fill,
        color: look.ink,
        border: `${look.dashed === true ? '1px dashed' : '2px solid'} ${look.ring}`,
        boxShadow: here ? `0 0 0 3px #dce9f6` : undefined,
      }}
    >
      {stage.number}
    </span>
  );
  const words = (
    <span style={{ display: 'grid', gap: 1, textAlign: 'left' }}>
      <span style={{ font: '600 12.5px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif', color: stage.state === 'unavailable' ? '#8a95a3' : '#20303f', textDecoration: stage.state === 'unavailable' ? 'line-through' : undefined }}>
        {stage.label}
      </span>
      {/* THE ONE-LINE SUBTITLE: the state's own word, then what happened */}
      <span style={{ font: '11.5px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif', color: stage.state === 'refused' ? '#8a2b2b' : '#5a6572' }}>
        {WORD[stage.state]} — {stage.subtitle}
      </span>
      {/*
        AND THE REASON, WHERE THERE IS ONE — a refusal's own sentence, or why
        this desk cannot perform the stage at all. It is INLINE rather than
        behind the expander: both are the whole content of their state, and a
        reason a reader has to click for is a reason the screen did not give.
      */}
      {stage.detail === null ? null : (
        <span style={{ font: '11px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif', color: stage.state === 'refused' ? '#8a2b2b' : '#8a95a3' }}>{stage.detail}</span>
      )}
    </span>
  );
  const body = (
    // TOP-ALIGNED, so the circle stays level with the line that connects it to
    // the next one however many lines of reason sit under its name
    <span style={{ display: 'inline-flex', gap: '.45rem', alignItems: 'flex-start' }}>
      {circle}
      {words}
    </span>
  );
  return (
    <li
      // WHERE THE CURSOR IS, for a screen reader as well as for the eye
      {...(here ? { 'aria-current': 'step' as const } : {})}
      style={{ flex: '1 1 14rem', minWidth: '13rem', position: 'relative', padding: '0 .3rem' }}
    >
      {/* THE LINE THAT CONNECTS THEM, behind the circles and never in front of a word */}
      <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 13, height: 1, background: LINE, zIndex: 0 }} />
      <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', gap: '.35rem', alignItems: 'flex-start', background: '#f7f8fa' }}>
        {seekable ? (
          <button
            type="button"
            // THE ANSWER IS PRINTED, whichever way it comes back: a refused seek
            // is the session's own sentence and a door that rejected is quoted.
            // Dropping either would leave a reader with a circle they clicked and
            // a desk that did not move, and no word about why.
            onClick={() => void onSeek(stage.commit!).then(say, (error: unknown) => say(`that seek threw: ${error instanceof Error ? error.message : String(error)}`))}
            aria-label={`move the desk to stage ${String(stage.number)}, ${stage.label} — seek the cursor to the commit its last act landed`}
            style={{ font: 'inherit', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex' }}
          >
            {body}
          </button>
        ) : (
          body
        )}
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'hide' : 'show'} the acts of stage ${String(stage.number)}, ${stage.label}`}
          style={{ font: '11px/1 system-ui, sans-serif', background: 'none', border: 'none', color: '#5a6572', cursor: 'pointer', padding: '6px 2px' }}
        >
          {expanded ? '▾' : '▸'}
        </button>
      </span>
    </li>
  );
}

/**
 * THE STEPPER.
 *
 * ```tsx
 * const stages = stepperStages(outcomes, run);
 * <ProtStepper stages={stages} run={run} here={stageAtCursor(stages, state.activePathIds, state.cursor)} onSeek={(id) => view.seek(id).then((r) => (r.ok ? null : r.sentence))} />
 * ```
 */
export function ProtStepper({ stages, run, here, onSeek }: ProtStepperProps): JSX.Element {
  /** Which stage a reader has opened — one at a time, because its acts are what the circle above is made of. */
  const [open, setOpen] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const shown = stages.find((s) => s.stage === open) ?? null;
  const landed = stages.filter((s) => s.state === 'landed').length;
  const refused = stages.filter((s) => s.state === 'refused').length;
  const unavailable = stages.filter((s) => s.state === 'unavailable').length;

  return (
    <nav aria-label="the stages this desk declares, in the order they land" style={{ font: '12px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif', color: '#3c4856', margin: '.6rem 0 0' }}>
      <ol style={{ listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '.5rem 0', padding: 0, margin: 0 }}>
        {stages.map((stage) => (
          <Step
            key={stage.stage}
            stage={stage}
            here={here?.stage === stage.stage}
            expanded={open === stage.stage}
            onOpen={() => setOpen(open === stage.stage ? null : stage.stage)}
            onSeek={onSeek}
            say={setSaid}
          />
        ))}
      </ol>
      <p style={{ margin: '.4rem 0 0', color: '#5a6572' }}>
        {/* THE PLAN IS A DECLARED FACT, and this line says that out loud so the
            circles are never read as a promise */}
        {stages.length.toLocaleString('en-US')} stages are DECLARED on this desk; {landed.toLocaleString('en-US')} landed, {refused.toLocaleString('en-US')} had an act refused and {unavailable.toLocaleString('en-US')}{' '}
        {unavailable === 1 ? 'is' : 'are'} not available here at all. A circle claims nothing about a stage that has not run.{' '}
        {onSeek === null
          ? 'The cursor these stages move arrives with the desk, when the last act has landed — so nothing here is clickable yet.'
          : 'Click a landed stage to move the whole desk to it: the rows are re-read at that commit and every picture follows, including the ones that lose their column and say so.'}
      </p>
      {shown === null ? null : (
        <section aria-label={`the acts of stage ${String(shown.number)}, ${shown.label}`} style={{ border: `1px solid #dfe4ea`, borderRadius: 8, background: '#fff', padding: '.5rem .65rem', margin: '.5rem 0 0' }}>
          <p style={{ margin: '0 0 .2rem', color: '#5a6572' }}>
            {shown.acts.length === 0
              ? shown.state === 'unavailable'
                ? // THE MEASURED REASON, verbatim — the whole point of the fifth state
                  shown.detail
                : 'no act of this stage was dispatched, so there is no row here — a row that is missing is an act that did not happen, and a greyed box would be a promise'
              : `${shown.acts.length.toLocaleString('en-US')} of the ${shown.declared.toLocaleString('en-US')} acts this stage declares came back, in the order it dispatched them. Each row seeks to its own commit.`}
          </p>
          {shown.acts.length === 0 ? null : (
            <ol aria-label="the acts this stage dispatched, in dispatch order" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {shown.acts.map((outcome, index) => (
                <ActRow
                  key={`${outcome.stage}/${outcome.act}/${String(index)}`}
                  outcome={outcome}
                  run={run}
                  say={setSaid}
                  onSeek={onSeek ?? (() => Promise.resolve('the run is still going, so there is no cursor to move yet — the desk arrives with the last act'))}
                />
              ))}
            </ol>
          )}
        </section>
      )}
      {said === null ? null : (
        <p role="status" style={{ margin: '.4rem 0 0', color: '#8a2b2b' }}>
          the session refused that seek, in its own words: {said}
        </p>
      )}
      <RunNarrative run={run} />
    </nav>
  );
}
