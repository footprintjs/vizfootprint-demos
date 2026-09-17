/**
 * THE ONE PANEL — LAYER 2, and the point of the redesign.
 *
 * > Less words. One panel about the stage the reader is on — not a paragraph
 * > under every chart.
 *
 * So: one band under the stepper, holding an eyebrow, three or four short
 * sentences about THIS stage — what it did, what it found, what it could not do
 * — and a narrow `<dl>` of four label/value rows beside them.
 *
 * Every sentence and every number arrives as a PROP. This component composes
 * nothing and counts nothing: `web/src/workbench/panel.ts` folds them off the
 * run's own outcomes, and the report for this packet names the field each one
 * comes from. A component that could write a sentence about a protein is a
 * component that will.
 *
 * ── THE FOOTNOTE IS NOT ABOUT THE CURSOR ───────────────────────────────────
 * {@link StagePanelProps.unavailable} is the stage (or stages) this desk
 * declares and cannot perform AT ALL, with the measured reason. That is a fact
 * about the DESK and not about where a reader is standing — such a stage lands
 * no commit, so no cursor can ever stand in it — which is why the panel carries
 * it as a footnote wherever the reader is rather than waiting for a position
 * that cannot happen.
 */
import type { ReactNode } from 'react';

/** One row of the panel's `<dl>`: the name of a number, and the number. */
export interface PanelFact {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

export interface StagePanelProps {
  /** The section's accessible name. */
  readonly label: string;
  /** `Stage 2 · How much of each residue the solvent can reach` — Mono, uppercase, in the accent. */
  readonly eyebrow: string;
  /** Three or four short sentences about this stage, in the words they came back in. */
  readonly sentences: readonly string[];
  /** The refusal, verbatim, when an act of this stage was refused. Drawn in rust, never folded into the prose. */
  readonly refusal: string | null;
  /** The four facts. Fewer is honest; none is honest and says so through {@link StagePanelProps.noFacts}. */
  readonly facts: readonly PanelFact[];
  /** What to say instead of an empty `<dl>`. */
  readonly noFacts?: string;
  /** Declared and impossible on this desk, with the measured reason. See the file header. */
  readonly unavailable: readonly { readonly id: string; readonly name: string; readonly why: string }[];
  /** Anything the composition wants under the sentences — the desk's own notices ride here. */
  readonly children?: ReactNode;
}

const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0' };

/** The panel. See the file header. */
export function StagePanel({ label, eyebrow, sentences, refusal, facts, noFacts, unavailable, children }: StagePanelProps): JSX.Element {
  return (
    <section
      aria-label={label}
      style={{
        background: 'var(--pw-glass-panel)',
        backdropFilter: 'var(--pw-blur-panel)',
        WebkitBackdropFilter: 'var(--pw-blur-panel)',
        borderBottom: '1px solid var(--pw-rule-faint)',
        boxShadow: 'var(--pw-inset-panel)',
        padding: '22px 24px 24px',
        display: 'flex',
        gap: 48,
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: '1 1 26rem', minWidth: 0, maxWidth: 820 }}>
        <div style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 11, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--pw-accent-bright)', marginBottom: 9 }}>{eyebrow}</div>
        {sentences.map((sentence) => (
          <p key={sentence.slice(0, 48)} style={{ margin: '0 0 8px', fontFamily: 'var(--pw-font-serif)', fontSize: 16.5, lineHeight: 1.58, color: 'var(--pw-prose)' }}>
            {sentence}
          </p>
        ))}
        {/* THE REFUSAL, VERBATIM and in its own colour — never blended into the prose above it */}
        {refusal === null ? null : (
          <p role="status" style={{ margin: '0 0 8px', fontFamily: 'var(--pw-font-serif)', fontSize: 16.5, lineHeight: 1.58, color: 'var(--pw-refuse-ink)' }}>
            {refusal}
          </p>
        )}
        {children}
        {unavailable.length === 0
          ? null
          : unavailable.map((stage) => (
              <p key={stage.id} style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.6, color: 'var(--pw-mid-2)' }}>
                <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--pw-soft-2)' }}>not available here</span>{' '}
                <b style={{ fontWeight: 600, color: 'var(--pw-mid)' }}>{stage.name}</b> — {stage.why}
              </p>
            ))}
      </div>
      <dl style={{ flex: '0 0 300px', margin: 0, fontSize: 12.5, color: 'var(--pw-mid)' }}>
        {facts.length === 0 && noFacts !== undefined ? <div style={ROW}>{noFacts}</div> : null}
        {facts.map((fact, index) => (
          <div key={fact.id} style={{ ...ROW, ...(index === facts.length - 1 ? {} : { borderBottom: '1px solid var(--pw-rule-dl)' }) }}>
            <dt>{fact.label}</dt>
            <dd style={{ margin: 0, fontFamily: 'var(--pw-font-mono)', color: 'var(--pw-ink)' }}>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
