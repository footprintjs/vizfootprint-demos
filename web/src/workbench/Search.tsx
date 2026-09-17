/**
 * SCREEN ONE — LAYER 2. The search, in its three states, as clothes and nothing
 * more.
 *
 * The behaviour does not live here and does not change: which door a reader's
 * words go through is `src/prot/archive.ts` · `looksLikeEntryId`, and the
 * asking is `web/src/protLanding.tsx`. This file draws
 *
 *   `SearchHero`     the empty state — a centred 600px column, the serif title,
 *                    one glass field, one accent button, the named example;
 *   `SearchHeader`   the band the other two states wear, with the form in it;
 *   `ResultList`     one row per entry the archive answered with;
 *   `NoMatch`        the serif apology, then the two real facts about how ids
 *                    and word searches work, then the example.
 *
 * ── THE DESIGN'S GREY ROWS ARE NOT A COMPONENT ─────────────────────────────
 * The results board draws two grey `[ID] / [ENTRY TITLE]` rows and then says,
 * in its own footer, that they are placeholders. That is the designer marking
 * what is not real — not a state to build. A row here is an entry the archive
 * answered with, or there is no row.
 */
import type { ReactNode } from 'react';

// ── the form, shared by all three states ─────────────────────────────────────

export interface SearchFormProps {
  readonly value: string;
  readonly placeholder: string;
  /** The field's accessible name — it carries no visible label, by design. */
  readonly fieldLabel: string;
  readonly submitLabel: string;
  /** `true` is the header's 40px form; `false` the hero's 50px one. */
  readonly compact: boolean;
  onChange(value: string): void;
  onSubmit(): void;
}

/** One glass field and one accent button. */
export function SearchForm({ value, placeholder, fieldLabel, submitLabel, compact, onChange, onSubmit }: SearchFormProps): JSX.Element {
  const height = compact ? 40 : 50;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      style={{ display: 'flex', gap: compact ? 8 : 10, flex: compact ? '1 1 auto' : undefined, maxWidth: compact ? 620 : undefined, margin: compact ? 0 : '34px 0 0' }}
    >
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={fieldLabel}
        placeholder={placeholder}
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          height,
          boxSizing: 'border-box',
          padding: compact ? '0 14px' : '0 16px',
          font: 'inherit',
          fontSize: compact ? 14 : 15,
          color: 'var(--pw-ink)',
          background: 'var(--pw-glass-button)',
          backdropFilter: 'var(--pw-blur-button)',
          WebkitBackdropFilter: 'var(--pw-blur-button)',
          border: '1px solid var(--pw-rule-button)',
          borderRadius: 'var(--pw-r-input)',
        }}
      />
      <button
        type="submit"
        style={{
          flex: '0 0 auto',
          height,
          padding: compact ? '0 18px' : '0 24px',
          font: 'inherit',
          fontSize: compact ? 14 : 15,
          fontWeight: 500,
          color: 'var(--pw-on-accent)',
          background: 'var(--pw-accent)',
          border: '1px solid var(--pw-accent)',
          borderRadius: 'var(--pw-r-input)',
          boxShadow: 'var(--pw-submit-shadow)',
          cursor: 'pointer',
        }}
      >
        {submitLabel}
      </button>
    </form>
  );
}

// ── the two shells ───────────────────────────────────────────────────────────

/** The empty state: everything centred in a 600px column. */
export function SearchHero({ title, children }: { readonly title: string; readonly children: ReactNode }): JSX.Element {
  return (
    <div style={{ minHeight: '100vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.25rem 4rem' }}>
      <div style={{ width: '100%', maxWidth: 600 }}>
        <h1 style={{ margin: 0, textAlign: 'center', fontFamily: 'var(--pw-font-serif)', fontSize: 38, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.15, color: 'var(--pw-ink)' }}>{title}</h1>
        {children}
      </div>
    </div>
  );
}

/** The band the asked states wear: the desk's name, then the form. */
export function SearchHeader({ title, children }: { readonly title: string; readonly children: ReactNode }): JSX.Element {
  return (
    <header
      style={{
        padding: '18px 24px',
        background: 'var(--pw-glass-header)',
        backdropFilter: 'var(--pw-blur-header)',
        WebkitBackdropFilter: 'var(--pw-blur-header)',
        borderBottom: '1px solid var(--pw-rule)',
        boxShadow: 'var(--pw-inset-header)',
        display: 'flex',
        alignItems: 'center',
        gap: 28,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontFamily: 'var(--pw-font-serif)', fontSize: 16, color: 'var(--pw-ink)' }}>{title}</span>
      {children}
    </header>
  );
}

/** The 800px column the asked states put their answer in. */
export function SearchColumn({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <div style={{ padding: '32px 24px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 800 }}>{children}</div>
    </div>
  );
}

// ── the rows ─────────────────────────────────────────────────────────────────

/** One entry as the archive described it, split into the design's two lines. Assembled by the business layer, never here. */
export interface ResultRowView {
  readonly entry: string;
  /** The deposited title, in the depositors' own words. `null` when the archive's record carries none. */
  readonly title: string | null;
  /** The rest of the archive's own line — method, chains, models, atoms — as it came. */
  readonly meta: string | null;
  /** Why this desk will not open it. `null` when it will, and then the row is a control. */
  readonly refusal: string | null;
}

export interface ResultListProps {
  readonly rows: readonly ResultRowView[];
  readonly label: string;
  /** The line above the rows: what was asked, and how many the archive reports. */
  readonly heading: ReactNode;
  readonly count: string;
  onOpen(entry: string): void;
}

const ROW: React.CSSProperties = { display: 'flex', gap: 20, padding: '16px 0', width: '100%', textAlign: 'left', boxSizing: 'border-box' };

/** One row per entry the archive answered with. A row this desk will not open is not a control, and says why. */
export function ResultList({ rows, label, heading, count, onOpen }: ResultListProps): JSX.Element {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--pw-mid-2)' }}>{heading}</h2>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--pw-font-mono)', fontSize: 12, color: 'var(--pw-soft)' }}>{count}</span>
      </div>
      <ol aria-label={label} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map((row, index) => {
          const body = (
            <>
              <span style={{ flex: '0 0 74px', fontFamily: 'var(--pw-font-mono)', fontSize: 15, fontWeight: 500, color: row.refusal === null ? 'var(--pw-accent)' : 'var(--pw-soft)' }}>{row.entry}</span>
              <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                {row.title === null ? null : <span style={{ display: 'block', fontSize: 14.5, color: 'var(--pw-ink)' }}>{row.title}</span>}
                {row.meta === null ? null : <span style={{ display: 'block', marginTop: 5, fontSize: 12.5, color: 'var(--pw-mid-2)' }}>{row.meta}</span>}
                {row.refusal === null ? null : <span style={{ display: 'block', marginTop: 5, fontSize: 12.5, color: 'var(--pw-refuse-ink)' }}>{row.refusal}</span>}
              </span>
            </>
          );
          const edge: React.CSSProperties = { borderTop: `1px solid ${index === 0 ? 'var(--pw-rule-head)' : 'var(--pw-rule)'}` };
          return (
            <li key={row.entry}>
              {row.refusal === null ? (
                <button type="button" onClick={() => onOpen(row.entry)} style={{ ...ROW, ...edge, font: 'inherit', background: 'none', cursor: 'pointer', color: 'inherit' }}>
                  {body}
                </button>
              ) : (
                <div style={{ ...ROW, ...edge }}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** Nothing matched: the serif apology, the real facts, the example. */
export function NoMatch({ heading, children }: { readonly heading: string; readonly children: ReactNode }): JSX.Element {
  return (
    <div style={{ paddingTop: 26 }}>
      <h2 style={{ margin: 0, fontFamily: 'var(--pw-font-serif)', fontSize: 21, fontWeight: 400, color: 'var(--pw-ink)' }}>{heading}</h2>
      {children}
    </div>
  );
}

/** The quiet prose the search screens sit in — one component so the three states cannot drift. */
export function SearchProse({ children, center = false }: { readonly children: ReactNode; readonly center?: boolean }): JSX.Element {
  return <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--pw-mid)', maxWidth: center ? undefined : '62ch', textAlign: center ? 'center' : undefined }}>{children}</p>;
}

/** A word that acts — the example link, the way back. Underlined in the accent, never a button that looks like a box. */
export function TextLink({ children, label, onPress }: { readonly children: ReactNode; readonly label?: string; onPress(): void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onPress}
      {...(label === undefined ? {} : { 'aria-label': label })}
      style={{ font: 'inherit', background: 'none', border: 0, padding: 0, color: 'var(--pw-accent)', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}
    >
      {children}
    </button>
  );
}
