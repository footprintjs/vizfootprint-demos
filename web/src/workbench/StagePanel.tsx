/**
 * THE ONE PANEL — LAYER 2, and the point of the redesign.
 *
 * > Less words shown. One panel, about the stage — not every instance that
 * > lands.
 *
 * So what is VISIBLE is exactly what the design draws and nothing else: an
 * eyebrow, three or four short sentences about this stage, and a narrow `<dl>`
 * of four label/value rows beside them. Plus two things the design has no slot
 * for and this desk may not drop: a REFUSAL, which is never behind a press, and
 * ONE SHORT LINE naming the declared stage this build cannot run at all.
 *
 * Everything else a reader may want about where they are standing — the
 * dashboard's own declared prose, which commit the pictures are drawn at, the
 * desk's claim about itself, and the MEASURED paragraph behind that one short
 * line — is behind {@link StagePanelProps.fold}, the same `Disclosure` the
 * cards use for `Full note`. One affordance, learned once.
 *
 * **Folded is not lost.** That is the author's constraint and the whole licence
 * for this component to fold anything: `tests/prot-panel.test.tsx` presses the
 * fold and asserts the words are in the DOM, exactly as the card tests do.
 *
 * ── EVERY WORD ARRIVES AS A PROP ───────────────────────────────────────────
 * This component composes nothing and counts nothing:
 * `web/src/workbench/panel.ts` folds the sentences and the four facts off the
 * run's own outcomes. A component that could write a sentence about a protein
 * is a component that will.
 */
import type { ReactNode } from 'react';
import { Disclosure } from './Chrome.js';

/** One row of the panel's `<dl>`: the name of a number, and the number. */
export interface PanelFact {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

/** A declared stage this build cannot perform at all — the short line, with the long reason folded away. */
export interface UnavailableLine {
  readonly id: string;
  readonly name: string;
  /** A handful of words: the first clause of the measured reason, verbatim. The rest is in the fold. */
  readonly short: string;
}

export interface StagePanelProps {
  /** The section's accessible name. */
  readonly label: string;
  /** `Stage 2 · How much of each residue the solvent can reach` — Mono, uppercase, in the accent. */
  readonly eyebrow: string;
  /** Three or four short sentences about this stage, in the words they came back in. */
  readonly sentences: readonly string[];
  /** The refusal, verbatim, when an act of this stage was refused. Drawn in rust, never folded away. */
  readonly refusal: string | null;
  /** The four facts. Fewer is honest; none is honest and says so through {@link StagePanelProps.noFacts}. */
  readonly facts: readonly PanelFact[];
  /** What to say instead of an empty `<dl>`. */
  readonly noFacts?: string;
  /**
   * Declared and impossible on this build, in a handful of words.
   *
   * It is announced WHEREVER THE READER IS STANDING, because unavailability is
   * a property of the desk and not of a cursor position — such a stage lands no
   * commit, so no cursor can ever stand in it. What changed in the follow-up
   * round is only its LENGTH: an announcement does not have to be a paragraph
   * to be an announcement, and the paragraph is one press away.
   */
  readonly unavailable: readonly UnavailableLine[];
  /** What the fold holds, and what the control that opens it is called. `null` when there is nothing to fold. */
  readonly fold: { readonly label: string; readonly aria: string; readonly children: ReactNode } | null;
  /** Anything that must stay VISIBLE under the sentences — a refused act of the reader's own rides here. */
  readonly children?: ReactNode;
}

const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0' };

/** The panel. See the file header for what is visible and what folds. */
export function StagePanel({ label, eyebrow, sentences, refusal, facts, noFacts, unavailable, fold, children }: StagePanelProps): JSX.Element {
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
        {/* THE REFUSAL, VERBATIM and in its own colour — never blended into the prose above it, and never behind a press */}
        {refusal === null ? null : (
          <p role="status" style={{ margin: '0 0 8px', fontFamily: 'var(--pw-font-serif)', fontSize: 16.5, lineHeight: 1.58, color: 'var(--pw-refuse-ink)' }}>
            {refusal}
          </p>
        )}
        {children}
        {/* ONE SHORT LINE per declared stage this build cannot run — the long reason is in the fold */}
        {unavailable.map((stage) => (
          <p key={stage.id} style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.6, color: 'var(--pw-mid-2)' }}>
            <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--pw-soft-2)' }}>not available here</span>{' '}
            <b style={{ fontWeight: 600, color: 'var(--pw-mid)' }}>{stage.name}</b> — {stage.short}
          </p>
        ))}
        {fold === null ? null : (
          <div style={{ marginTop: 12 }}>
            <Disclosure title={fold.label} label={fold.aria} shape="bare">
              {fold.children}
            </Disclosure>
          </div>
        )}
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
