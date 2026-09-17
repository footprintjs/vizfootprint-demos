/**
 * THE WORKBENCH'S CHROME — LAYER 2, presentational only: props in, markup out.
 *
 * The header band and the facts strip, exactly as the design draws them. Not
 * one of these components imports the session, a hook that reads it, `fetch`,
 * or anything from `src/prot/`; none of them knows what a commit is. Given the
 * same props each renders the same thing, in a test, with no session anywhere —
 * which is what `tests/prot-layers.test.ts` asserts by reading the imports of
 * every module in this folder.
 *
 * Every colour, radius, shadow and font family is a `--pw-*` token
 * (`./theme.css`). There is not a literal in this file, and the theme test
 * fails if one appears.
 */
import { useState, type ReactNode } from 'react';

// ── the shared glass button, which three bands each want ─────────────────────

export interface GlassButtonProps {
  readonly children: ReactNode;
  /** `true` draws the design's OPEN state — the tinted fill and the accent edge. */
  readonly open?: boolean;
  readonly label?: string;
  readonly expanded?: boolean;
  readonly small?: boolean;
  onPress(): void;
}

/** The design's glass control: a quiet pill in the accent, tinted when what it opened is open. */
export function GlassButton({ children, open = false, label, expanded, small = false, onPress }: GlassButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onPress}
      {...(label === undefined ? {} : { 'aria-label': label })}
      {...(expanded === undefined ? {} : { 'aria-expanded': expanded })}
      style={{
        font: 'inherit',
        fontSize: small ? 12 : 12.5,
        lineHeight: 1,
        color: 'var(--pw-accent)',
        background: open ? 'var(--pw-accent-open-bg)' : 'var(--pw-glass-button)',
        backdropFilter: 'var(--pw-blur-button)',
        WebkitBackdropFilter: 'var(--pw-blur-button)',
        border: `1px solid ${open ? 'var(--pw-accent-open-edge)' : 'var(--pw-rule-button)'}`,
        borderRadius: 'var(--pw-r-button)',
        padding: small ? '6px 10px' : '7px 11px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {children}
    </button>
  );
}

/** The chevron the design puts on a disclosure. Its own component so no two disclosures can drift. */
export function Chevron({ open }: { readonly open: boolean }): JSX.Element {
  return (
    <svg viewBox="0 0 12 12" width={10} height={10} aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s ease' }}>
      <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A NUMBER INSIDE A SENTENCE — Mono, at full ink.
 *
 * The design's rule across the whole desk is that a figure is Mono and the
 * words around it are Sans, and a disclosure's title is the one place the two
 * meet. One component, so no title spells it a different way.
 */
export function Count({ children }: { readonly children: ReactNode }): JSX.Element {
  return <span style={{ fontFamily: 'var(--pw-font-mono)', color: 'var(--pw-ink)' }}>{children}</span>;
}

// ── the one disclosure shape, used everywhere something folds away ───────────

export interface DisclosureProps {
  /** The visible title. Sans; a count in it should be spelled by the caller in Mono. */
  readonly title: ReactNode;
  /** The accessible name of the control — a title that carries markup cannot be read off the DOM. */
  readonly label: string;
  /**
   * `card` draws the glass card the tail's panels wear; `bare` is the button
   * and the revealed block alone, for a fold INSIDE something that is already
   * a card (the stage panel's).
   */
  readonly shape: 'card' | 'bare';
  readonly children: ReactNode;
}

/**
 * ONE DISCLOSURE, AND ONE SHAPE FOR ALL OF THEM.
 *
 * Every fold on this desk is this component: the panel's own fold, the four
 * record panels at the foot of the page, the recorder's account and the list of
 * what this page does without. The card's `Full note` is the same affordance
 * ({@link GlassButton} plus {@link Chevron}), so a reader learns the gesture
 * once — which is the whole reason the packet was allowed to fold anything
 * away at all.
 *
 * It holds a `<button aria-expanded>` and reveals its body BELOW it. Not
 * `<details>`: a `<summary>` cannot carry the glass button's own layout, and
 * the four panels this replaces each drew their own chrome a different way.
 */
export function Disclosure({ title, label, shape, children }: DisclosureProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const card = shape === 'card';
  return (
    <section
      style={
        card
          ? {
              border: '1px solid var(--pw-edge-card)',
              borderRadius: 'var(--pw-r-card)',
              background: 'var(--pw-glass-card)',
              backdropFilter: 'var(--pw-blur-card)',
              WebkitBackdropFilter: 'var(--pw-blur-card)',
              boxShadow: 'var(--pw-shadow-card)',
              padding: '12px 16px',
              minWidth: 0,
            }
          : { minWidth: 0 }
      }
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={label}
        style={{
          font: 'inherit',
          fontFamily: 'var(--pw-font-sans)',
          fontSize: 12.5,
          fontWeight: card ? 600 : 400,
          color: card ? 'var(--pw-ink)' : 'var(--pw-accent)',
          background: 'none',
          border: 0,
          padding: 0,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <span style={{ minWidth: 0 }}>{title}</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', color: 'var(--pw-accent)' }}>
          <Chevron open={open} />
        </span>
      </button>
      {!open ? null : (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--pw-rule)', fontSize: 12, lineHeight: 1.6, color: 'var(--pw-mid-2)', minWidth: 0 }}>{children}</div>
      )}
    </section>
  );
}

// ── the designed home for what is selected ───────────────────────────────────

export interface SelectionBarProps {
  /** The Mono eyebrow that names the row — what these controls are about. */
  readonly eyebrow: string;
  readonly children: ReactNode;
}

/**
 * WHAT IS SELECTED, IN A ROOM OF ITS OWN.
 *
 * The library's own two pieces — the live chips and the saved pictures — used
 * to sit loose between the panel and the charts, at two different sizes, on no
 * token and in no card. They say something true and they stay; what they get
 * here is a home: one quiet glass row, a Mono eyebrow naming it, and the
 * library's parts inside at this desk's own density.
 *
 * The density is the LIBRARY'S OWN HOOK and not a selector into its markup:
 * both of those parts re-root `.vzf` on themselves, which re-declares the
 * library's defaults there and discards a host's inherited token overrides — so
 * the composition hands each one `className="pw-scope"` and the bridge rule in
 * `./theme.css` reaches them again (a finding, reported).
 */
export function SelectionBar({ eyebrow, children }: SelectionBarProps): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 14,
        flexWrap: 'wrap',
        padding: '10px 14px',
        background: 'var(--pw-glass-facts)',
        backdropFilter: 'var(--pw-blur-facts)',
        WebkitBackdropFilter: 'var(--pw-blur-facts)',
        border: '1px solid var(--pw-edge-card)',
        borderRadius: 'var(--pw-r-card)',
        minWidth: 0,
      }}
    >
      <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--pw-soft)', flex: '0 0 auto' }}>{eyebrow}</span>
      <span aria-hidden style={{ flex: '0 0 1px', alignSelf: 'stretch', background: 'var(--pw-rule-divider)' }} />
      {children}
    </div>
  );
}

// ── the header ───────────────────────────────────────────────────────────────

export interface WorkbenchHeaderProps {
  /** The desk's own declared title. */
  readonly title: string;
  /** The entry id, as the file's HEADER record gives it. */
  readonly entry: string;
  /** The deposited title, in the depositors' own words. Ellipsised rather than wrapped. */
  readonly entryTitle: string;
  /** The method line — already assembled by the business layer out of the entry's records. `null` when the records carry none of it. */
  readonly method: string | null;
  /** What the way back to the search is called. */
  readonly searchAgain: string;
  onSearchAgain(): void;
}

/** Band 1: the title, a hairline, the entry, and — right-aligned — the method and the way out. */
export function WorkbenchHeader({ title, entry, entryTitle, method, searchAgain, onSearchAgain }: WorkbenchHeaderProps): JSX.Element {
  return (
    <header
      style={{
        boxSizing: 'border-box',
        minHeight: 60,
        padding: '10px 24px',
        background: 'var(--pw-glass-header)',
        backdropFilter: 'var(--pw-blur-header)',
        WebkitBackdropFilter: 'var(--pw-blur-header)',
        borderBottom: '1px solid var(--pw-rule)',
        boxShadow: 'var(--pw-inset-header)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <h1 style={{ margin: 0, fontFamily: 'var(--pw-font-serif)', fontSize: 19, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--pw-ink)' }}>{title}</h1>
      <span aria-hidden style={{ flex: '0 0 1px', height: 22, background: 'var(--pw-rule-divider)' }} />
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
        <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 15, fontWeight: 500, letterSpacing: '0.02em', color: 'var(--pw-ink)' }}>{entry}</span>
        <span style={{ fontSize: 13.5, color: 'var(--pw-mid)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entryTitle}</span>
      </span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 18 }}>
        {method === null ? null : <span style={{ fontSize: 12.5, color: 'var(--pw-mid-2)', whiteSpace: 'nowrap' }}>{method}</span>}
        <GlassButton onPress={onSearchAgain}>{searchAgain}</GlassButton>
      </span>
    </header>
  );
}

// ── the facts strip ──────────────────────────────────────────────────────────

/** One fact: its numbers, and the words around them. Assembled by the business layer off the run — never by this file. */
export interface FactItem {
  /** A stable key, so the strip does not key on prose. */
  readonly id: string;
  /** The numbers and the words around them, in order — `value` is Mono at full ink, `before`/`after` are labels at mid. */
  readonly parts: readonly { readonly before?: string; readonly value: string; readonly after?: string }[];
}

export interface FactsStripProps {
  readonly items: readonly FactItem[];
  /** What the strip is called for a screen reader. */
  readonly label: string;
  /** Said instead, when the run has landed nothing to count. */
  readonly nothing?: string;
}

/** Band 2: the entry's own counts, separated by hairlines, numbers in Mono at full ink. */
export function FactsStrip({ items, label, nothing }: FactsStripProps): JSX.Element {
  return (
    <div
      aria-label={label}
      style={{
        boxSizing: 'border-box',
        minHeight: 40,
        padding: '8px 24px',
        background: 'var(--pw-glass-facts)',
        backdropFilter: 'var(--pw-blur-facts)',
        WebkitBackdropFilter: 'var(--pw-blur-facts)',
        borderBottom: '1px solid var(--pw-rule-faint)',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        flexWrap: 'wrap',
        fontSize: 12.5,
        color: 'var(--pw-mid)',
      }}
    >
      {items.length === 0 && nothing !== undefined ? <span>{nothing}</span> : null}
      {items.map((item, index) => (
        <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 18 }}>
          {index === 0 ? null : <span aria-hidden style={{ flex: '0 0 1px', height: 14, background: 'var(--pw-rule-divider)' }} />}
          <span>
            {item.parts.map((part, at) => (
              <span key={`${item.id}:${String(at)}`}>
                {part.before === undefined ? null : part.before}
                <span style={{ fontFamily: 'var(--pw-font-mono)', color: 'var(--pw-ink)' }}>{part.value}</span>
                {part.after === undefined ? null : ` ${part.after}`}
              </span>
            ))}
          </span>
        </span>
      ))}
    </div>
  );
}
