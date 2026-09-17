/**
 * THE CARD A PICTURE SITS IN — LAYER 2. The frame is this desk's; the picture
 * inside it is always the library's.
 *
 * ── THE ONE VISIBLE LINE, AND THE NOTE BEHIND THE DISCLOSURE ───────────────
 * A card shows its title and ONE quiet line — the `How to read:` sentence,
 * which on this desk is the LIBRARY'S OWN derived prose slot
 * (`src/prot/def.ts` declares `howToRead: { author: { kind: 'derived' } }` and
 * the library writes it at every read). Everything else the picture needs said
 * moves behind `Full note`.
 *
 * **Nothing is dropped.** The long note is the caption this desk always had,
 * and it is long because it is true: that 17 zeros mean the probe could not
 * reach those residues, that a kind absent from the list may be a kind nobody
 * asked for, that 15 contacts run through an alternate location. A reader who
 * never saw those would misread the chart, so they are one press away and never
 * deleted — `tests/prot-cards.test.tsx` opens the disclosure and asserts the
 * note's own words are in the DOM.
 *
 * ── WHAT THIS FILE MUST NEVER DO ───────────────────────────────────────────
 * Reach inside the chart. There is no descendant selector under the SVG here
 * and no hand-drawn mark: the picture is rendered by `vizfootprint-ui` from a
 * declared view, which is the whole claim of the project. Colour reaches it
 * through the library's own hooks — its `--vzf-*` tokens (`./theme.css`) and
 * the `colorOf` a chart accepts — and a thing the library cannot express is a
 * finding, not a licence to style its internals.
 */
import { useState, type ReactNode } from 'react';
import { Chevron, GlassButton } from './Chrome.js';

/** One legend chip: a swatch and the name it stands for. Handed in as a colour, never chosen here. */
export interface LegendChip {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

export interface ChartCardProps {
  /** The cell's address — stamped as `data-chart`, exactly as the packaged cockpit's own cell does. */
  readonly id: string;
  /** The picture's name: the heading, and the card's accessible name. */
  readonly label: string;
  /** The focused card is the hero: bigger radius, heavier glass, the deep shadow. */
  readonly focused: boolean;
  /** The ONE visible line — the library's own derived how-to-read sentence. `null` for a view that declares no encoding surface to derive one from. */
  readonly howToRead: string | null;
  /** The chips beside the header. Empty for a chart that draws its own legend — see the packet's findings. */
  readonly legend: readonly LegendChip[];
  /** The footer, in Mono: what was plotted on the left, which stage owns it on the right. */
  readonly footLeft: string | null;
  readonly footRight: string | null;
  /** The long note, behind the disclosure. `null` only for a picture with nothing more to say. */
  readonly note: ReactNode;
  /** What the disclosure is called, and what it is called for a screen reader. */
  readonly noteLabel: string;
  readonly noteAria: string;
  /** The ✕, and only when there is a clause to clear. */
  readonly clear: { readonly label: string; onPress(): void } | null;
  /** The height this card gives its picture, in CSS pixels — the frame measures it. */
  readonly height: number;
  readonly children: ReactNode;
}

/** The card. See the file header for the one visible line and the law about the note. */
export function ChartCard({ id, label, focused, howToRead, legend, footLeft, footRight, note, noteLabel, noteAria, clear, height, children }: ChartCardProps): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <article
      data-chart={id}
      data-focused={focused ? 'true' : undefined}
      aria-label={label}
      style={{
        border: `1px solid ${focused ? 'var(--pw-edge-hero)' : 'var(--pw-edge-card)'}`,
        borderRadius: focused ? 'var(--pw-r-hero)' : 'var(--pw-r-card)',
        background: focused ? 'var(--pw-glass-hero)' : 'var(--pw-glass-card)',
        backdropFilter: focused ? 'var(--pw-blur-hero)' : 'var(--pw-blur-card)',
        WebkitBackdropFilter: focused ? 'var(--pw-blur-hero)' : 'var(--pw-blur-card)',
        boxShadow: focused ? 'var(--pw-shadow-hero)' : 'var(--pw-shadow-card)',
        padding: focused ? '22px 24px 18px' : '16px 18px 14px',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: focused ? 14 : 8 }}>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: focused ? 16 : 13.5, fontWeight: 600, letterSpacing: '-0.005em', color: 'var(--pw-ink)' }}>{label}</h2>
          {/* THE ONE VISIBLE LINE. Absent rather than invented when the library
              derived none — a view that declares no encoding surface has no
              bindings to derive a how-to-read line from, and says nothing. */}
          {howToRead === null ? null : <p style={{ margin: '4px 0 0', fontSize: focused ? 13 : 12, color: 'var(--pw-mid-2)' }}>How to read: {howToRead}</p>}
        </div>
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {legend.map((chip) => (
            <span key={chip.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--pw-mid)' }}>
              <span aria-hidden style={{ width: 14, height: 2.5, background: chip.color }} />
              {chip.name}
            </span>
          ))}
          {clear === null ? null : (
            <GlassButton small label={clear.label} onPress={clear.onPress}>
              ✕ clear
            </GlassButton>
          )}
          {note === null ? null : (
            <GlassButton small open={open} expanded={open} label={noteAria} onPress={() => setOpen(!open)}>
              <Chevron open={open} />
              {noteLabel}
            </GlassButton>
          )}
        </div>
      </div>

      {/*
        A FLEX COLUMN, and it has to be: `.vzf-chart-frame` is styled
        `flex: 1; min-height: 0`, so it fills a flex parent and collapses to
        nothing inside a block one — and a frame of zero height measures zero,
        renders nothing and never grows, because what would have grown it is the
        chart it is not drawing.
      */}
      <div style={{ display: 'flex', flexDirection: 'column', height, minWidth: 0 }}>{children}</div>

      {footLeft === null && footRight === null ? null : (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 16,
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px solid var(--pw-rule)',
            fontFamily: 'var(--pw-font-mono)',
            fontSize: 11,
            color: 'var(--pw-mid-2)',
          }}
        >
          {footLeft === null ? null : <span>{footLeft}</span>}
          {footRight === null ? null : <span style={{ marginLeft: 'auto' }}>{footRight}</span>}
        </div>
      )}

      {/* THE NOTE, REACHABLE IN ONE PRESS and never deleted — the omit-never-deny law, drawn */}
      {note === null || !open ? null : (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--pw-rule)', fontSize: 12, lineHeight: 1.6, color: 'var(--pw-mid-2)' }}>{note}</div>
      )}
    </article>
  );
}

// ── the dark box the 3D viewer lives in ──────────────────────────────────────

export interface ViewerBoxProps {
  /** The chips in the corner of the well — one per chain, in the chart's own colours. */
  readonly chips: readonly LegendChip[];
  readonly children: ReactNode;
}

/**
 * THIS DESK'S FRAME AROUND SOMEBODY ELSE'S VIEWER — the dark well, the corner
 * brackets and the chain chips. What mounts inside it is Mol*, unchanged and
 * reached only through the library's renderer contract.
 *
 * ── IT FILLS ITS POSITIONED PARENT, and that is a contract ────────────────
 * `position: absolute; inset: 0`, because the box it goes in is the library's
 * measured frame (`.vzf-chart-frame`, which is `position: relative` with a
 * definite height) and that is exactly how a chart fills it. A well laid out
 * with `flex` instead collapsed to nothing the first time this shipped: the
 * frame is not a flex container, so an `auto` height resolved to the height of
 * children that were themselves absolute — a dark line where the molecule
 * should have been. A REAL BROWSER is what caught it.
 */
export function ViewerBox({ chips, children }: ViewerBoxProps): JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--pw-viewer-bg)',
        border: '1px solid var(--pw-viewer-edge)',
        borderRadius: 'var(--pw-r-viewer)',
        boxShadow: 'var(--pw-viewer-inset)',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
        <path
          d="M4 4h10M4 4v10M96 4H86M96 4v10M4 96h10M4 96V86M96 96H86M96 96V86"
          fill="none"
          stroke="var(--pw-viewer-bracket)"
          strokeWidth={0.7}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/*
        THE CHAIN CHIPS, AT THE TOP OF THE WELL and not at the bottom where the
        design draws them. The bottom of this well is the RENDERER's own
        `role="status"` line — the sentence that names every paint bucket,
        including the absence colour, and the only account of a WebGL canvas a
        screen reader gets (`web/src/molstarRenderer.ts` · `saidOf`). Chips over
        it would cover the words. So they move up rather than the sentence
        moving out.
      */}
      {chips.length === 0 ? null : (
        <div style={{ position: 'absolute', left: 10, top: 10, display: 'flex', gap: 8, zIndex: 1, pointerEvents: 'none' }}>
          {chips.map((chip) => (
            <span
              key={chip.id}
              style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 10, color: 'var(--pw-viewer-chip-ink)', background: 'var(--pw-viewer-chip-bg)', borderRadius: 'var(--pw-r-chip)', padding: '3px 6px', borderLeft: `2px solid ${chip.color}` }}
            >
              {chip.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
