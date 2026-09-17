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
import type { ReactNode } from 'react';

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

/** The chevron the design puts on a disclosure. Its own component so the two disclosures cannot drift. */
export function Chevron({ open }: { readonly open: boolean }): JSX.Element {
  return (
    <svg viewBox="0 0 12 12" width={10} height={10} aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s ease' }}>
      <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
