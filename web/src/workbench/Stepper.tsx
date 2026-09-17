/**
 * THE STAGE STEPPER — LAYER 2, and the design's five marks over the code's five
 * states.
 *
 * ```
 *   ①————————②╌╌╌╌╌╌╌╌③
 *   Contacts  Surface   Conservation
 *             running   not available here
 * ```
 *
 * It is presentational: it takes a {@link StepView} per column — plain data,
 * already folded — and draws it. It does not know what a commit is, does not
 * import the session and cannot reach one. What a press MEANS is the
 * composition's business (`web/src/protDesk.tsx` hands it a seek).
 *
 * ── THE FIVE MARKS, in the designer's own words from the board ──────────────
 *   `not-run`       hollow, dashed, grey — "it promises nothing and offers no
 *                   click", so the name is text and not a control.
 *   `running`       the only state that moves: a 2px accent ring, a soft halo,
 *                   an animated arc and a progress hairline under the name.
 *   `landed`        solid accent, white number, a lifted shadow — and the name
 *                   is a REAL button whose press moves the whole screen.
 *   `refused`       as committed as landed, in rust instead of blue, with a
 *                   badge at the corner; the panel carries the sentence.
 *   `unavailable`   hatched, struck through with a diagonal — declared before
 *                   the run started, and never a spinner.
 *
 * ── THREE THINGS HERE ARE LOAD-BEARING ─────────────────────────────────────
 *   1. `aria-current="step"` on the column the cursor stands in;
 *   2. a real `<button>` for a stage that can be seeked to, and a
 *      NON-INTERACTIVE element for every other state — a control that answered
 *      nothing is worse than no control;
 *   3. the per-stage EXPANDER, which is how the act rows are reached at all.
 *      `tests/prot-cursor.smoke.test.ts` opens whatever is closed and then
 *      finds one act's seek control by its accessible name; that is the one
 *      test proving the pictures follow the cursor, so the expander stays even
 *      though the design does not draw it.
 */
import { useState, type ReactNode } from 'react';

/** The five states, as the fold names them (`web/src/protStages.ts` · `StageState`). */
export type StageLook = 'not-run' | 'running' | 'landed' | 'refused' | 'unavailable';

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
  /** The accessible name of the seek control, or `null` when this stage has no commit to move to. */
  readonly seekLabel: string | null;
  /** The connector to the left and to the right, or `null` at the two ends. */
  readonly linkBefore: LinkReach | null;
  readonly linkAfter: LinkReach | null;
  /** The running state's own share, `0`–`1`. `null` in every other state, and only this one draws a hairline. */
  readonly progress: number | null;
  /** What the expander is called. */
  readonly expandLabel: string;
  /** What the expander opens — built by the composition, because it is made of the run's own rows. */
  readonly detail: ReactNode;
}

export interface StageStepperProps {
  readonly steps: readonly StepView[];
  /** The nav's accessible name. */
  readonly label: string;
  /** The sentence under the marks that says the plan is DECLARED — never a promise. */
  readonly note: ReactNode;
  /** What a refused seek said, printed beside the control that asked for it. `null` when nothing was refused. */
  readonly refusedSeek: string | null;
  onSeek(key: string): void;
}

const MARK = 28;

/** The ring, the ink and the fill of one mark — the whole visual difference between the five states, in one table. */
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
  unavailable: { background: 'var(--pw-glass-mark-hatch)', backgroundImage: 'var(--pw-mark-hatch)', color: 'var(--pw-mid-2)', border: '1.5px solid var(--pw-mark-edge-solid)', weight: 400 },
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
        backdropFilter: step.look === 'unavailable' ? 'var(--pw-blur-hatch)' : 'var(--pw-blur-mark)',
        WebkitBackdropFilter: step.look === 'unavailable' ? 'var(--pw-blur-hatch)' : 'var(--pw-blur-mark)',
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
      {step.look === 'unavailable' ? (
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

/** The name under a mark: a real button when the stage can be seeked to, plain text when it cannot. */
function Name({ step, onSeek }: { readonly step: StepView; onSeek(): void }): JSX.Element {
  const ink = step.look === 'unavailable' || step.look === 'not-run' ? 'var(--pw-soft-2)' : 'var(--pw-ink)';
  // `fontFamily: inherit` and NOT the `font` shorthand: a shorthand resets
  // every longhand after it, so the weight this state is drawn at would depend
  // on the order the declarations happen to serialise in.
  const shared: React.CSSProperties = { fontFamily: 'inherit', fontSize: 13, fontWeight: step.here ? 600 : 500, color: ink, display: 'block' };
  if (step.seekLabel === null) return <span style={{ ...shared, fontWeight: step.here ? 600 : 400 }}>{step.name}</span>;
  return (
    <button
      type="button"
      onClick={onSeek}
      aria-label={step.seekLabel}
      {...(step.here ? { 'aria-current': 'step' as const } : {})}
      style={{
        ...shared,
        background: 'none',
        border: 0,
        padding: 0,
        margin: '0 auto',
        cursor: 'pointer',
        textAlign: 'center',
        textDecoration: 'underline',
        textDecorationColor: 'var(--pw-underline)',
        textUnderlineOffset: 3,
      }}
    >
      {step.name}
    </button>
  );
}

/** The stepper. See the file header for the five marks and the three load-bearing details. */
export function StageStepper({ steps, label, note, refusedSeek, onSeek }: StageStepperProps): JSX.Element {
  /** Which stage a reader has opened — one at a time, because its acts are what the mark above it is made of. */
  const [open, setOpen] = useState<string | null>(null);
  const shown = steps.find((s) => s.key === open) ?? null;
  return (
    <nav
      aria-label={label}
      style={{
        padding: '20px 24px 0',
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
            style={{ position: 'relative', paddingBottom: 14, minWidth: 0 }}
          >
            {step.linkBefore === null ? null : <span aria-hidden style={{ position: 'absolute', left: 0, right: '50%', top: 13, height: 1.5, marginRight: 20, ...LINK[step.linkBefore] }} />}
            {step.linkAfter === null ? null : <span aria-hidden style={{ position: 'absolute', left: '50%', right: 0, top: 13, height: 1.5, marginLeft: 20, ...LINK[step.linkAfter] }} />}
            <span style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <Mark step={step} />
            </span>
            <div style={{ marginTop: 10, textAlign: 'center' }}>
              <Name step={step} onSeek={() => onSeek(step.key)} />
              {step.tag === null ? null : (
                <span
                  style={{
                    display: 'block',
                    marginTop: 3,
                    fontFamily: 'var(--pw-font-mono)',
                    fontSize: 10,
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
                <span aria-hidden style={{ display: 'block', margin: '8px auto 0', width: 56, height: 3, borderRadius: 'var(--pw-r-track)', background: 'var(--pw-track)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', width: `${String(Math.round(Math.min(Math.max(step.progress, 0), 1) * 100))}%`, height: 3, background: 'var(--pw-accent)' }} />
                </span>
              )}
              {/* THE EXPANDER — quiet, and load-bearing (see the file header) */}
              <button
                type="button"
                onClick={() => setOpen(open === step.key ? null : step.key)}
                aria-expanded={open === step.key}
                aria-label={step.expandLabel}
                style={{ font: 'inherit', fontFamily: 'var(--pw-font-mono)', fontSize: 10, background: 'none', border: 0, color: 'var(--pw-soft)', cursor: 'pointer', padding: '4px 6px', marginTop: 2 }}
              >
                {open === step.key ? '▾' : '▸'}
              </button>
            </div>
            {/* WHERE THE CURSOR IS, for the eye as well as for a screen reader */}
            {step.here ? <span aria-hidden style={{ position: 'absolute', left: 22, right: 22, bottom: 0, height: 3, background: 'var(--pw-accent)' }} /> : null}
          </li>
        ))}
      </ol>
      <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.55, color: 'var(--pw-mid-2)' }}>{note}</p>
      {shown === null ? null : (
        <div style={{ borderTop: '1px solid var(--pw-rule-faint)', margin: '10px 0 0', padding: '10px 0 14px' }}>{shown.detail}</div>
      )}
      {refusedSeek === null ? null : (
        <p role="status" style={{ margin: '4px 0 12px', fontSize: 12, color: 'var(--pw-refuse-ink)' }}>
          the session refused that seek, in its own words: {refusedSeek}
        </p>
      )}
    </nav>
  );
}
