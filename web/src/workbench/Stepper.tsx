/**
 * THE STAGE STEPPER — LAYER 2, and the design's marks over the code's states.
 *
 * ```
 *   ①————————②╌╌╌╌╌╌╌╌③————————④╌╌╌╌╌╌╌╌⑤╌╌╌╌╌╌╌╌⑥
 *   Structure Sequence  Structure Interact. Hot Spot  Functional
 *   Search    Analysis  Analysis  Mapping   Predict.  Annotation
 *             NOT                           NOT ON    NOT BUILT
 *             AVAILABLE                     THIS      YET
 *             HERE                          BUILD
 * ```
 *
 * It is presentational: it takes a {@link StepView} per column — plain data,
 * already folded — and draws it. It does not know what a commit is, does not
 * import the session and cannot reach one. What a press MEANS is the
 * composition's business (`web/src/protDesk.tsx` hands it a seek).
 *
 * ── THE MARKS, in the designer's own words from the board ──────────────────
 *   `not-run`       hollow, dashed, grey — "it promises nothing and offers no
 *                   click", so the name is text and not a control.
 *   `running`       the only state that moves: a 2px accent ring, a soft halo,
 *                   an animated arc and a progress hairline under the name.
 *   `landed`        solid accent, white number, a lifted shadow — and the name
 *                   is a REAL button whose press moves the whole screen.
 *   `refused`       as committed as landed, in rust instead of blue, with a
 *                   badge at the corner; the panel carries the sentence.
 *   `declared-not-here`
 *                   hatched, struck through with a diagonal — DECLARED and not
 *                   going to happen here, and never a spinner. ONE mark for the
 *                   whole family: a stage the world blocks, a stage this build
 *                   blocks and a stage WE have not built yet all wear it, and
 *                   what tells them apart is the word beneath (`./steps.ts`,
 *                   from `src/prot/plan.ts` · `BLOCKED_TAG`) and the paragraph
 *                   behind the panel's fold — the sentence, never the paint.
 *
 * ── WHAT IS LOAD-BEARING HERE ──────────────────────────────────────────────
 *   1. `aria-current="step"` on the column the cursor stands in, and the blue
 *      bar across its foot for the eye: *this is the stage you are looking at*.
 *      Whether the CURSOR moved is a different fact and a different line says
 *      it (the rows note in the chrome) — the bar must never be read as a seek
 *      that did not happen.
 *   2. ONE CONTROL PER COLUMN — the mark and the name inside a single
 *      `<button>` with a single accessible name (see {@link Column}) — and a
 *      NON-INTERACTIVE element for a column with nothing to answer, because a
 *      control that answered nothing is worse than no control.
 *
 * ── AND WHAT IS GONE ───────────────────────────────────────────────────────
 * The note under the marks and the per-stage expander. The author's ruling:
 * *no paragraphs between the stepper and the charts.* The note's COUNTS were
 * not prose and are not lost — they are in the facts strip, in Mono, where
 * counted facts on this page live (`./steps.ts` · `stepperTally`). The
 * expander's act rows moved to the record drawer, whole
 * (`web/src/protDesk.tsx` · `ActsOfTheRun`), which is also how
 * `tests/prot-cursor.smoke.test.ts` still reaches an act's own seek control.
 */
// NO REACT STATE AND NO CHILDREN: every column is one control over plain data,
// and what a press MEANS is the composition's business.


/** The marks, as the fold names them. FEWER than there are states: `unavailable` and `blocked` are one family and share one (`web/src/protStages.ts` · `StageState`). */
export type StageLook = 'not-run' | 'running' | 'landed' | 'refused' | 'declared-not-here';

/** How far past the run a connector reaches — the design fades the dash with the distance. */
export type LinkReach = 'run' | 'near' | 'far';

/** One column of the stepper, as plain data. Everything on it is folded by the business layer. */
export interface StepView {
  /** A stable key — the stage id. */
  readonly key: string;
  /** The number in the mark. */
  readonly number: number;
  /** The stage's declared name. */
  readonly name: string;
  /** The word under the name, in Mono uppercase — `refused`, `not available here`. `null` for the states the mark already tells. */
  readonly tag: string | null;
  readonly look: StageLook;
  /** The column the cursor is standing in. */
  readonly here: boolean;
  /**
   * The accessible name of THIS COLUMN'S CONTROL, or `null` when the column
   * has nothing to offer.
   *
   * Two different presses arrive through it and the NAME is what tells them
   * apart: a landed stage's press seeks the cursor to the commit its last act
   * landed; a stage that will not run here has no commit to seek to and its
   * press brings its CARD into the focus, where the reason is (`./steps.ts` ·
   * `seekLabelOf` / `showLabelOf`, and the composition decides which act a key
   * means). A stage that is merely un-run still gets `null`: a control that
   * answered nothing is worse than no control.
   */
  readonly pressLabel: string | null;
  /** The connector to the left and to the right, or `null` at the two ends. */
  readonly linkBefore: LinkReach | null;
  readonly linkAfter: LinkReach | null;
  /** The running state's own share, `0`–`1`. `null` in every other state, and only this one draws a hairline. */
  readonly progress: number | null;
}

export interface StageStepperProps {
  readonly steps: readonly StepView[];
  /** The nav's accessible name. */
  readonly label: string;
  /** What a refused seek said, printed beside the control that asked for it. `null` when nothing was refused. */
  readonly refusedSeek: string | null;
  onSeek(key: string): void;
}

const MARK = 28;

/** The ring, the ink and the fill of one mark — the whole visual difference between the marks, in one table. */
const LOOK: Readonly<
  Record<
    StageLook,
    {
      readonly background: string;
      readonly backgroundImage?: string;
      readonly color: string;
      readonly border: string;
      readonly shadow?: string;
      readonly weight: number;
    }
  >
> = {
  'not-run': { background: 'var(--pw-glass-mark)', color: 'var(--pw-soft)', border: '1.5px dashed var(--pw-mark-edge)', weight: 400 },
  running: { background: 'var(--pw-glass-mark-live)', color: 'var(--pw-accent)', border: '2px solid var(--pw-accent)', shadow: '0 0 0 4px var(--pw-accent-ring-soft)', weight: 500 },
  landed: { background: 'var(--pw-accent)', color: 'var(--pw-on-accent)', border: '0 none transparent', shadow: 'var(--pw-mark-shadow)', weight: 500 },
  refused: { background: 'var(--pw-refuse)', color: 'var(--pw-on-accent)', border: '0 none transparent', shadow: 'var(--pw-refuse-shadow)', weight: 500 },
  'declared-not-here': { background: 'var(--pw-glass-mark-hatch)', backgroundImage: 'var(--pw-mark-hatch)', color: 'var(--pw-mid-2)', border: '1.5px solid var(--pw-mark-edge-solid)', weight: 400 },
};

/** Which paint a connector wears: solid accent where the run has been, and a dash that fades with the distance past it. */
const LINK: Readonly<Record<LinkReach, { readonly background?: string; readonly backgroundImage?: string }>> = {
  run: { background: 'var(--pw-accent-line)' },
  near: { backgroundImage: 'var(--pw-dash-near)' },
  far: { backgroundImage: 'var(--pw-dash-far)' },
};

/** One numbered mark, with whatever its state adds to it. */
function Mark({ step }: { readonly step: StepView }): JSX.Element {
  const look = LOOK[step.look];
  return (
    <span
      aria-hidden
      style={{
        position: 'relative',
        boxSizing: 'border-box',
        display: 'inline-flex',
        width: MARK,
        height: MARK,
        borderRadius: '50%',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--pw-font-mono)',
        fontSize: 12.5,
        fontWeight: look.weight,
        background: look.background,
        ...(look.backgroundImage === undefined ? {} : { backgroundImage: look.backgroundImage }),
        color: look.color,
        border: look.border,
        boxShadow: step.here ? 'var(--pw-mark-shadow-here)' : look.shadow,
        backdropFilter: step.look === 'declared-not-here' ? 'var(--pw-blur-hatch)' : 'var(--pw-blur-mark)',
        WebkitBackdropFilter: step.look === 'declared-not-here' ? 'var(--pw-blur-hatch)' : 'var(--pw-blur-mark)',
      }}
    >
      {step.number}
      {/* RUNNING — the one thing on this desk that moves. A reader who asked for
          less motion gets the arc without the spin (`./theme.css`). */}
      {step.look === 'running' ? (
        <svg className="pw-spin" viewBox="0 0 36 36" width={36} height={36} aria-hidden="true" style={{ position: 'absolute', left: -6, top: -6 }}>
          <circle cx={18} cy={18} r={16} fill="none" stroke="var(--pw-accent)" strokeWidth={2} strokeLinecap="round" strokeDasharray="26 74" />
        </svg>
      ) : null}
      {/* UNAVAILABLE — struck through, so it can never be read as still working */}
      {step.look === 'declared-not-here' ? (
        <svg viewBox="0 0 28 28" width={MARK} height={MARK} aria-hidden="true" style={{ position: 'absolute', left: -1.5, top: -1.5 }}>
          <line x1={5.5} y1={22.5} x2={22.5} y2={5.5} stroke="var(--pw-strike)" strokeWidth={1.5} />
        </svg>
      ) : null}
      {/* REFUSED — the badge at the corner, because rust alone is a hue and a hue alone is never a state */}
      {step.look === 'refused' ? (
        <span
          style={{
            position: 'absolute',
            right: -4,
            bottom: -4,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'var(--pw-refuse-badge-bg)',
            border: '1px solid var(--pw-refuse-badge-edge)',
            color: 'var(--pw-refuse)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--pw-font-sans)',
            fontSize: 10,
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          !
        </span>
      ) : null}
    </span>
  );
}

/**
 * ONE COLUMN, ONE CONTROL — the circle AND the name, pressed together.
 *
 * The author asked to press the NUMBER, and the answer is not a second button:
 * two controls in one cell compete for the same gesture, give a reader two
 * focus stops for one thing and force a choice about which one carries the
 * name. So the mark, the name and the word beneath are the inside of a single
 * `<button>` with a single accessible name — the one it already had, unchanged,
 * because a name a test finds a control by is a contract.
 *
 * A column with nothing to answer is a `<div>` with the same contents. That is
 * the law this stepper has kept since it became a cursor: a control that
 * answered nothing is worse than no control.
 */
function Column({ step, onPress }: { readonly step: StepView; onPress(): void }): JSX.Element {
  const ink = step.look === 'declared-not-here' || step.look === 'not-run' ? 'var(--pw-soft-2)' : 'var(--pw-ink)';
  const inside = (
    <>
      <span style={{ display: 'flex', justifyContent: 'center' }}>
        <Mark step={step} />
      </span>
      {/* `fontFamily: inherit` and NOT the `font` shorthand: a shorthand resets
          every longhand after it, so the weight this state is drawn at would
          depend on the order the declarations happen to serialise in. */}
      <span style={{ display: 'block', marginTop: 6, fontFamily: 'inherit', fontSize: 12.5, fontWeight: step.here ? 600 : 400, lineHeight: 1.25, color: ink }}>{step.name}</span>
      {step.tag === null ? null : (
        <span
          style={{
            display: 'block',
            marginTop: 2,
            fontFamily: 'var(--pw-font-mono)',
            fontSize: 9.5,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: step.look === 'refused' ? 'var(--pw-refuse-ink)' : 'var(--pw-soft-2)',
          }}
        >
          {step.tag}
        </span>
      )}
      {/* THE ONLY STATE THAT MOVES gets the only hairline */}
      {step.progress === null ? null : (
        <span aria-hidden style={{ display: 'block', margin: '6px auto 0', width: 56, height: 3, borderRadius: 'var(--pw-r-track)', background: 'var(--pw-track)', overflow: 'hidden' }}>
          <span style={{ display: 'block', width: `${String(Math.round(Math.min(Math.max(step.progress, 0), 1) * 100))}%`, height: 3, background: 'var(--pw-accent)' }} />
        </span>
      )}
    </>
  );
  const shape: React.CSSProperties = { position: 'relative', display: 'block', width: '100%', textAlign: 'center', minWidth: 0 };
  if (step.pressLabel === null) return <div style={shape}>{inside}</div>;
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={step.pressLabel}
      {...(step.here ? { 'aria-current': 'step' as const } : {})}
      style={{ ...shape, font: 'inherit', fontFamily: 'var(--pw-font-sans)', background: 'none', border: 0, padding: 0, margin: 0, cursor: 'pointer' }}
    >
      {inside}
    </button>
  );
}

/** The stepper. See the file header for the marks and what is load-bearing. */
export function StageStepper({ steps, label, refusedSeek, onSeek }: StageStepperProps): JSX.Element {
  return (
    <nav
      aria-label={label}
      style={{
        padding: '10px 24px 8px',
        background: 'var(--pw-glass-nav)',
        backdropFilter: 'var(--pw-blur-nav)',
        WebkitBackdropFilter: 'var(--pw-blur-nav)',
        borderBottom: '1px solid var(--pw-rule-faint)',
      }}
    >
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: `repeat(${String(Math.max(steps.length, 1))}, minmax(0, 1fr))` }}>
        {steps.map((step) => (
          <li
            key={step.key}
            {...(step.here ? { 'aria-current': 'step' as const } : {})}
            style={{ position: 'relative', paddingBottom: 6, minWidth: 0 }}
          >
            {step.linkBefore === null ? null : <span aria-hidden style={{ position: 'absolute', left: 0, right: '50%', top: 13, height: 1.5, marginRight: 20, ...LINK[step.linkBefore] }} />}
            {step.linkAfter === null ? null : <span aria-hidden style={{ position: 'absolute', left: '50%', right: 0, top: 13, height: 1.5, marginLeft: 20, ...LINK[step.linkAfter] }} />}
            <Column step={step} onPress={() => onSeek(step.key)} />
            {/* WHERE THE CURSOR IS, for the eye as well as for a screen reader */}
            {step.here ? <span aria-hidden style={{ position: 'absolute', left: 22, right: 22, bottom: 0, height: 3, background: 'var(--pw-accent)' }} /> : null}
          </li>
        ))}
      </ol>
      {refusedSeek === null ? null : (
        <p role="status" style={{ margin: '2px 0 4px', fontSize: 11.5, color: 'var(--pw-refuse-ink)' }}>
          the session refused that seek, in its own words: {refusedSeek}
        </p>
      )}
    </nav>
  );
}
