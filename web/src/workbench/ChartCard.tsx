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

/** One of a stage's own numbers: the name of a figure, and the figure. Folded by the business layer off the acts' own answers, never counted here. */
export interface CardFact {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

/**
 * WHAT THE STAGE THAT LANDED THIS PICTURE DID — the block that used to be a
 * prose band under the stepper.
 *
 * The author's ruling removed that band (*"no paragraphs, nothing similar — I
 * don't want a scrolling dashboard"*) and its content came HERE, to the thing
 * it is about. Only the FOCUSED card carries it; a rail tile is a picture and a
 * name.
 *
 * `mark` is on the visible line in Mono (`stage 3`) so that a picture a reader
 * PROMOTED out of the rail can never be read as that stage's own — the line
 * names which stage is speaking, whatever picture it is sitting on.
 */
export interface CardStage {
  /** `stage 3` — the Mono prefix on the quiet line. */
  readonly mark: string;
  /** The one quiet line: what this stage put on the desk. */
  readonly line: string;
  /**
   * Its own numbers, in Mono under the picture. EMPTY means no row at all: an
   * absence is absent, and *this stage has landed no counts to read* took a
   * whole row under a drawing to say nothing.
   */
  readonly facts: readonly CardFact[];
  /** The act's refusal, verbatim — visible, never behind a press. */
  readonly refusal: string | null;
}

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
  /** What the stage that landed this picture did — {@link CardStage}. `null` on every card that is not the focus. */
  readonly stage?: CardStage | null;
  /**
   * The height this card gives its picture.
   *
   * A NUMBER is CSS pixels, which is what a card in a scrolling band wants.
   * `'fill'` is the instrument's form: the card takes the whole height its
   * parent row gives it and the picture takes whatever the card's own chrome
   * leaves — `flex: 1 1 0` with `min-height: 0`, the definite height
   * `vizfootprint-ui` · `primitives/ChartFrame.tsx` needs before its
   * ResizeObserver can hand a size to the chart. The card must then be inside a
   * parent with a definite height of its own, which is the one thing a caller
   * has to get right (`web/src/protDesk.tsx` · the zone-1 grid).
   */
  readonly height: number | 'fill';
  readonly children: ReactNode;
}

/** The card. See the file header for the one visible line and the law about the note. */
export function ChartCard({ id, label, focused, howToRead, legend, footLeft, footRight, note, noteLabel, noteAria, clear, stage = null, height, children }: ChartCardProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const fills = height === 'fill';
  return (
    <article
      data-chart={id}
      data-focused={focused ? 'true' : undefined}
      aria-label={label}
      style={{
        ...(fills ? { height: '100%', minHeight: 0, overflow: 'hidden' } : {}),
        border: `1px solid ${focused ? 'var(--pw-edge-hero)' : 'var(--pw-edge-card)'}`,
        borderRadius: focused ? 'var(--pw-r-hero)' : 'var(--pw-r-card)',
        background: focused ? 'var(--pw-glass-hero)' : 'var(--pw-glass-card)',
        backdropFilter: focused ? 'var(--pw-blur-hero)' : 'var(--pw-blur-card)',
        WebkitBackdropFilter: focused ? 'var(--pw-blur-hero)' : 'var(--pw-blur-card)',
        boxShadow: focused ? 'var(--pw-shadow-hero)' : 'var(--pw-shadow-card)',
        /* THE FOCUS IS AN INSTRUMENT'S SLOT NOW, not a card in a scrolling
           band: every pixel of padding is a pixel off the picture, and the
           picture is the point. Measured at 1280×800, the card's own chrome was
           201px of a 412px slot before this line. */
        padding: focused ? '12px 16px 10px' : '16px 18px 14px',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: focused ? 7 : 8 }}>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: focused ? 16 : 13.5, fontWeight: 600, letterSpacing: '-0.005em', color: 'var(--pw-ink)' }}>{label}</h2>
          {/* THE ONE VISIBLE LINE. Absent rather than invented when the library
              derived none — a view that declares no encoding surface has no
              bindings to derive a how-to-read line from, and says nothing. */}
          {howToRead === null ? null : <p style={{ margin: '4px 0 0', fontSize: focused ? 13 : 12, color: 'var(--pw-mid-2)' }}>How to read: {howToRead}</p>}
          {/* THE STAGE'S ONE QUIET LINE, beside the library's own derived one —
              the band's first field, in the place the band was about */}
          {stage === null ? null : (
            <p style={{ margin: '3px 0 0', fontSize: focused ? 13 : 12, color: 'var(--pw-mid-2)' }}>
              <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--pw-accent-bright)', marginRight: 5 }}>{stage.mark}</span>
              {stage.line}
            </p>
          )}
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
      <div style={fills ? { display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0, minWidth: 0 } : { display: 'flex', flexDirection: 'column', height, minWidth: 0 }}>{children}</div>

      {/* THE STAGE'S OWN NUMBERS, in Mono under the picture: the band's `<dl>`,
          beside the other figures about this same picture rather than in a
          300px column of its own with white space under it. And its REFUSAL,
          visible — a refusal is never behind a press. */}
      {stage === null ? null : (
        <>
          {stage.facts.length === 0 ? null : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginTop: 7, paddingTop: 6, borderTop: '1px solid var(--pw-rule)', fontSize: 11.5, color: 'var(--pw-mid-2)' }}>
              {stage.facts.map((fact) => (
                <span key={fact.id} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
                  {fact.label}
                  <b style={{ fontFamily: 'var(--pw-font-mono)', fontWeight: 500, color: 'var(--pw-ink)' }}>{fact.value}</b>
                </span>
              ))}
            </div>
          )}
          {stage.refusal === null ? null : (
            <p role="status" style={{ margin: '7px 0 0', fontSize: 12, lineHeight: 1.45, color: 'var(--pw-refuse-ink)' }}>
              {stage.refusal}
            </p>
          )}
        </>
      )}

      {/*
        THE FOOTER: COUNTS ON THE LEFT, THE OWNING STAGE ON THE RIGHT, both
        Mono, ONE LINE, never wrapping.
        The counts are load-bearing and are the ONLY surviving copy of
        themselves: the counted-facts band was deleted on the grounds that each
        card carries its own, so a card that dropped them would lose them off
        the page entirely — two cuts each justified by the other place, which is
        the silent omission this desk is built against
        (`tests/prot-viewport.smoke.test.ts` counts them on the rendered page).
        So if this line ever wraps, the ATTRIBUTION is what shortens — never the
        numbers.
      */}
      {footLeft === null && footRight === null ? null : (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 16,
            marginTop: 7,
            paddingTop: 6,
            borderTop: '1px solid var(--pw-rule)',
            fontFamily: 'var(--pw-font-mono)',
            fontSize: 11,
            color: 'var(--pw-mid-2)',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {footLeft === null ? null : <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{footLeft}</span>}
          {footRight === null ? null : <span style={{ marginLeft: 'auto', flex: '0 0 auto' }}>{footRight}</span>}
        </div>
      )}

      {/*
        THE NOTE, REACHABLE IN ONE PRESS and never deleted — the omit-never-deny
        law, drawn.

        In a card that FILLS a definite box it gets its own scroll and the
        picture above yields the height it needs (`flex: 0 1 auto` beside the
        frame's `flex: 1 1 0`). A note clipped by the card it opened inside
        would be a note this desk deleted with `overflow: hidden`, which is the
        one thing the law forbids.
      */}
      {note === null || !open ? null : (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--pw-rule)', fontSize: 12, lineHeight: 1.6, color: 'var(--pw-mid-2)', ...(fills ? { flex: '0 1 auto', minHeight: 0, overflowY: 'auto' as const } : {}) }}>{note}</div>
      )}
    </article>
  );
}

// ── the rail: a picture and a name, and one press brings it everything else ──

export interface ChartTileProps {
  /** The cell's address — stamped as `data-chart`, the same way the card stamps it, because a test names a chart by it wherever it is drawn. */
  readonly id: string;
  /** The picture's name: the tile's heading and part of its accessible name. */
  readonly label: string;
  /** What it counts at this cursor — or, when there is nothing to draw, the library's own sentence saying so. `null` when it has neither. */
  readonly said: string | null;
  /** The control that brings it into the focus — what it is called, and what a press does. */
  readonly promote: { readonly label: string; onPress(): void };
  /** `true` lays the tile out for the bottom strip; a block for the right column otherwise. */
  readonly wide?: boolean;
  /** The picture. `null` for a step that has none — the three that will not run here — and then {@link ChartTileProps.said} is the whole body. */
  readonly children?: ReactNode;
}

/**
 * ONE TILE — A NAME, A COUNT, AND ITS MARKS.
 *
 * ── WHY A TILE DRAWS ITS CHART, which is the interesting decision ──────────
 * It did not, for one round: eight tiles at about 150px each is a size where a
 * library chart's axis labels are illegible and 185 marks merge into a texture,
 * and drawing something unreadable and calling it a chart is the same lie as a
 * fake axis on a stage that never ran.
 *
 * What overturned that is the REASON focus mode exists. This dashboard's views
 * are crossfiltered (`src/prot/def.ts` · `links.default: 'crossfilter'`): a
 * pick in one chart narrows the others. A tile that shows no marks cannot show
 * that — and an effect nobody can see might as well not have happened. So the
 * arrangement is *one big, the rest small, all on screen at once*, and the
 * small ones MUST draw: 185 marks dropping to 12 is perfectly legible at tile
 * size, because it is a change in DENSITY and not a value read off an axis.
 *
 * The honesty floor does not bend with it — no axis labels the tile cannot fit,
 * no fake axes, nothing dressed as a reading it is not. What a tile claims is
 * exactly what it shows: this many marks, this shape, and its own count in
 * words beside its name.
 *
 * ── AND WHY THE CONTROL IS THE HEADER AND NOT THE WHOLE TILE ───────────────
 * The picture inside is the library's and is LIVE — a pick in it is a real
 * commit on the record, which is the whole point of drawing it. So the tile
 * cannot be one big button: a button may not contain the library's own axis
 * controls, and a press anywhere would swallow the gesture that makes the tile
 * worth drawing. The header row is the promote control, with the accessible
 * name; the picture below it belongs to the reader.
 */
export function ChartTile({ id, label, said, promote, wide = false, children }: ChartTileProps): JSX.Element {
  return (
    <article
      data-chart={id}
      data-tile="true"
      aria-label={label}
      style={{
        border: '1px solid var(--pw-edge-card)',
        borderRadius: 'var(--pw-r-card)',
        background: 'var(--pw-glass-card)',
        backdropFilter: 'var(--pw-blur-card)',
        WebkitBackdropFilter: 'var(--pw-blur-card)',
        padding: '5px 8px 7px',
        display: 'flex',
        flexDirection: 'column',
        // NOT ONE FIXED HEIGHT: a tile is whatever its pane gives it, and the
        // library's frame re-measures itself when that changes.
        ...(children === undefined ? {} : { flex: '1 1 0' }),
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <button
        type="button"
        onClick={promote.onPress}
        aria-label={promote.label}
        style={{
          font: 'inherit',
          fontFamily: 'var(--pw-font-sans)',
          textAlign: 'left',
          cursor: 'pointer',
          background: 'none',
          border: 0,
          padding: 0,
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          width: '100%',
          minWidth: 0,
          flex: '0 0 auto',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--pw-ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span aria-hidden style={{ marginLeft: 'auto', fontFamily: 'var(--pw-font-mono)', fontSize: 9.5, color: 'var(--pw-accent)', flex: '0 0 auto' }}>
          ⤢
        </span>
      </button>
      {/* THE COUNT, in Mono — the only surviving copy of these numbers now that
          the counted-facts band is gone, and never a sentence. */}
      {said === null ? null : (
        <span style={{ fontFamily: children === undefined ? 'var(--pw-font-sans)' : 'var(--pw-font-mono)', fontSize: children === undefined ? 10.5 : 9.5, lineHeight: 1.35, color: 'var(--pw-mid-2)', flex: '0 0 auto', minWidth: 0, ...(children === undefined ? {} : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }) }}>{said}</span>
      )}
      {children === undefined ? null : <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0, minWidth: 0, marginTop: 3 }}>{children}</div>}
    </article>
  );
}

// ── the three steps that will not run, in one compact card ──────────────────

export interface BlockedRow {
  readonly id: string;
  /** The short declared name. */
  readonly name: string;
  /** `not available here`, `not on this build`, `not built yet`. */
  readonly tag: string;
  /** The reason's own first clause, verbatim. */
  readonly short: string;
  /** What the control on this row is called, and what a press does — its own card, at full size. */
  readonly promote: { readonly label: string; onPress(): void };
}

export interface BlockedGroupProps {
  /** The section's accessible name. */
  readonly label: string;
  readonly rows: readonly BlockedRow[];
}

/**
 * THE THREE STEPS THAT WILL NOT RUN HERE, AS ONE CARD OF THREE ROWS.
 *
 * ── WHY THEY WERE COLLAPSED, measured ──────────────────────────────────────
 * They were three separate cards down the right column, 59px each: 177px of a
 * 583px column at 1280×800 — more than the two real charts got between them,
 * for three sentences. So they became one card, and the reclaimed height went
 * to the drawings, which is where a pane that shows a crossfilter needs it.
 *
 * **Nothing is lost**: each row keeps its own tag, its own name and its
 * reason's own first clause, verbatim, and its press still opens its own card
 * where the whole measured paragraph is one further press away. What went is
 * the card chrome around each sentence, not the sentence.
 *
 * Each ROW is the control, so there are three names and three answers — one
 * per step — rather than one control that would have to pick a step for the
 * reader.
 */
export function BlockedGroup({ label, rows }: BlockedGroupProps): JSX.Element {
  return (
    <section
      aria-label={label}
      style={{
        border: '1px solid var(--pw-edge-card)',
        borderRadius: 'var(--pw-r-card)',
        background: 'var(--pw-glass-card)',
        backdropFilter: 'var(--pw-blur-card)',
        WebkitBackdropFilter: 'var(--pw-blur-card)',
        padding: '5px 8px 6px',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        flex: '0 0 auto',
        minWidth: 0,
      }}
    >
      <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--pw-soft)' }}>declared · will not run here</span>
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          data-chart={`stage:${row.id}`}
          data-tile="true"
          onClick={row.promote.onPress}
          aria-label={row.promote.label}
          style={{
            font: 'inherit',
            fontFamily: 'var(--pw-font-sans)',
            textAlign: 'left',
            cursor: 'pointer',
            background: 'none',
            border: 0,
            borderTop: '1px solid var(--pw-rule-faint)',
            padding: '3px 0 0',
            display: 'block',
            width: '100%',
            minWidth: 0,
            fontSize: 10,
            lineHeight: 1.35,
            color: 'var(--pw-mid-2)',
          }}
        >
          <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--pw-soft-2)', marginRight: 4 }}>{row.tag}</span>
          <b style={{ fontWeight: 600, color: 'var(--pw-mid)' }}>{row.name}</b> — {row.short}
        </button>
      ))}
    </section>
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
