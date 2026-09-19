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
  /**
   * WHICH POINT IN THE RUN the pictures come from, in the page's own words.
   *
   * It is the only thing on screen that says so, and the stepper's whole
   * purpose is to move it — so it lives in the band that answers *what am I
   * looking at*, because this is the same question about time rather than about
   * the entry. A ReactNode because its LOUD forms (a refused read, a read in
   * flight) carry their own `role="status"` and their own colour, and a band
   * that flattened those to a string would be deciding that the quiet case is
   * the only one.
   */
  readonly at: ReactNode;
  /**
   * What the way back to the search is called — and BOTH halves are optional,
   * because a desk that opens on one entry has nowhere to go back to.
   *
   * The protein desk opens on a question and its header's last slot is the way
   * back to it. The measured desk beside it opens on the committed entry and
   * has no search at all, so a control there would be a button with no
   * destination — worse than an absent one. Absent ⇒ no button is drawn, and
   * the band is otherwise byte-identical (`tests/prot-*` pin the desk that
   * passes both).
   */
  readonly searchAgain?: string;
  onSearchAgain?(): void;
}

/** Band 1: the title, a hairline, the entry, and — right-aligned — the method and the way out. */
export function WorkbenchHeader({ title, entry, entryTitle, method, at, searchAgain, onSearchAgain }: WorkbenchHeaderProps): JSX.Element {
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
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
        {method === null ? null : <span style={{ fontSize: 12.5, color: 'var(--pw-mid-2)', whiteSpace: 'nowrap' }}>{method}</span>}
        <span aria-hidden style={{ flex: '0 0 1px', height: 22, background: 'var(--pw-rule-divider)' }} />
        <span style={{ minWidth: 0 }}>{at}</span>
        {/* NO DESTINATION, NO CONTROL — see {@link WorkbenchHeaderProps.searchAgain}. */}
        {searchAgain === undefined || onSearchAgain === undefined ? null : <GlassButton onPress={onSearchAgain}>{searchAgain}</GlassButton>}
      </span>
    </header>
  );
}

// ── the record, at the bottom edge and never below a scroll ──────────────────

export interface RecordDrawerProps {
  /** What the control is called for a screen reader. */
  readonly label: string;
  /** What is inside, named with its counts — visible while it is shut, which is the whole point. */
  readonly title: ReactNode;
  /** What a press reveals. It gets its own scroll; the PAGE never gets one. */
  readonly children: ReactNode;
}

/**
 * THE RECORD — a drawer at the bottom edge of the instrument.
 *
 * ── WHY A DRAWER AND NOT A REGION BELOW THE FOLD ───────────────────────────
 * *"I don't want a scrolling dashboard"* is the author's ruling, taken
 * literally: the page itself does not scroll to operate this desk. That leaves
 * the record material — every commit, every refusal, the data checks, the
 * residue table at the cursor, the recorder's whole account, the list of what
 * this page does without, the credit and the provenance — needing a home
 * INSIDE one viewport. So it lives behind this bar:
 *
 *   - its PRESENCE is visible without scrolling anything: the shut bar names
 *     what is inside it, with the counts, at the bottom edge of the window;
 *   - reaching it is one deliberate press — the same gesture, the same chevron,
 *     as every other fold on this desk;
 *   - opening it draws it OVER the charts rather than pushing them, so the
 *     instrument does not re-lay-out under a reader who only wanted to read a
 *     commit;
 *   - and the drawer scrolls, not the page. That is the distinction the ruling
 *     is about: a dashboard you have to scroll to USE, versus a record you
 *     chose to open.
 *
 * Nothing is deleted and nothing is behind two presses that was behind one: the
 * four record panels keep their own disclosures inside it, exactly as they were.
 */
export function RecordDrawer({ label, title, children }: RecordDrawerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5, display: 'flex', flexDirection: 'column', maxHeight: '100%', minHeight: 0 }}>
      {!open ? null : (
        <div
          style={{
            flex: '0 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            maxHeight: '74vh',
            padding: '14px 24px 16px',
            background: 'var(--pw-glass-panel)',
            backdropFilter: 'var(--pw-blur-panel)',
            WebkitBackdropFilter: 'var(--pw-blur-panel)',
            borderTop: '1px solid var(--pw-rule-divider)',
            boxShadow: 'var(--pw-shadow-hero)',
            fontSize: 12,
            lineHeight: 1.6,
            color: 'var(--pw-mid-2)',
          }}
        >
          {children}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={label}
        style={{
          font: 'inherit',
          fontFamily: 'var(--pw-font-sans)',
          fontSize: 11.5,
          color: 'var(--pw-mid)',
          background: 'var(--pw-glass-header)',
          backdropFilter: 'var(--pw-blur-header)',
          WebkitBackdropFilter: 'var(--pw-blur-header)',
          border: 0,
          borderTop: '1px solid var(--pw-rule-divider)',
          padding: '7px 24px',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textAlign: 'left',
          cursor: 'pointer',
          flex: '0 0 auto',
        }}
      >
        <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 9.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--pw-soft)' }}>the record</span>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', color: 'var(--pw-accent)' }}>
          <Chevron open={!open} />
        </span>
      </button>
    </div>
  );
}

// ── the boundary a reader moves, as a control ────────────────────────────────

/**
 * WHAT A GESTURE ON A DIVIDER MEANS — the component reports the gesture and
 * knows nothing of what it costs.
 *
 * `move` carries the pointer's own client coordinate along the divider's axis,
 * because a component that takes only props cannot know where the region it
 * divides begins. `nudge` is px TOWARDS THE FOCUS GROWING, positive, so the
 * boundary moves the way the key points. `edge` is a stop, `default` is the way
 * back to where the page had it. Turning any of them into a fraction is the
 * rules layer's job (`./charts.ts` · `shareAtPointer`, `shareAfterStep`,
 * `shareAtEdge`) and a floor is applied in exactly one place there
 * (`clampShare`).
 */
export type DividerAction =
  | { readonly kind: 'move'; readonly pointer: number }
  | { readonly kind: 'nudge'; readonly px: number }
  | { readonly kind: 'edge'; readonly to: 'min' | 'max' }
  | { readonly kind: 'default' };

export interface RegionDividerProps {
  /** `'vertical'` for the line that stands between two COLUMNS; `'horizontal'` for the one that lies between two ROWS. */
  readonly orientation: 'vertical' | 'horizontal';
  /** WHICH TWO REGIONS IT DIVIDES — the accessible name, and nothing about how it is worked. */
  readonly label: string;
  /** HOW IT IS WORKED — the tooltip, which is the half a mouse reader would otherwise never meet. */
  readonly hint: string;
  /** The FOCUS side's share of the region, in whole percents, with its two stops. */
  readonly now: number;
  readonly min: number;
  readonly max: number;
  /** Pixels one arrow press moves it. Ten of them with `Shift`, so the whole range is reachable without holding a key down. */
  readonly step: number;
  /** THE SENTENCE READ AT A STOP, or `null` at rest — a reason and never an error (`./charts.ts` · `stopSentence`). */
  readonly stop: string | null;
  onAct(action: DividerAction): void;
}

/**
 * A DIVIDER BETWEEN TWO REGIONS OF THE INSTRUMENT — a real `role="separator"`,
 * and a control rather than a mouse affordance.
 *
 * ── WHAT MAKES IT A CONTROL AND NOT A DRAG HANDLE ──────────────────────────
 *   · it is FOCUSABLE and carries `aria-orientation`, `aria-valuenow`,
 *     `aria-valuemin` and `aria-valuemax`, so a screen reader is told where the
 *     boundary stands and how far it may go;
 *   · the ARROW KEYS move it, `Home` and `End` go to its two stops, and `Enter`
 *     puts it back where the page had it. A mouse-only resize is not a control,
 *     and a resize with no way back is a trap;
 *   · POINTER events, not mouse events, so a trackpad and a touch screen both
 *     work — with the pointer CAPTURED on the handle, so a fast drag that
 *     leaves the 10px track does not lose the gesture, and `touch-action:
 *     none` so a touch drag is not read as a scroll;
 *   · the visible line is 2px and the TARGET is the whole track. A 2px hit area
 *     is not a hit area;
 *   · and there is no transition on ANY of it, in any case. A divider that
 *     eases is a divider that lags, which is worse than one that does not
 *     animate — so `prefers-reduced-motion` has nothing to turn off here.
 *
 * Every paint is a `--pw-*` token: the line is the desk's own rule colour at
 * rest and the accent while it is hovered, focused or held, which is the same
 * pair every other control on this page uses.
 */
export function RegionDivider({ orientation, label, hint, now, min, max, step, stop, onAct }: RegionDividerProps): JSX.Element {
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [ring, setRing] = useState(false);
  const vertical = orientation === 'vertical';
  const lit = dragging || hovered || ring;
  // THE LINE IS PAINTED BY THE TRACK ITSELF, as a gradient, so the separator
  // element has no children: a 2px rule centred in a 10px target, 3px while it
  // is live so the reader can see what they have hold of.
  const half = lit ? 1.5 : 1;
  const ink = lit ? 'var(--pw-accent)' : 'var(--pw-rule-divider)';
  const line = `linear-gradient(to ${vertical ? 'right' : 'bottom'}, transparent ${String(5 - half)}px, ${ink} ${String(5 - half)}px, ${ink} ${String(5 + half)}px, transparent ${String(5 + half)}px)`;
  return (
    // `width`/`height` 100% is LOAD-BEARING and was a bug for one round: the
    // only child below is absolutely positioned, so this box's own content
    // height is zero — the grid item stretches, this did not, and the separator
    // was a 10×0 target that no pointer could ever land on. The keyboard worked
    // throughout, which is exactly the kind of half-working control a test that
    // only drove the keyboard would have passed.
    <div style={{ position: 'relative', width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}>
      <div
        role="separator"
        tabIndex={0}
        aria-label={label}
        title={hint}
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
        aria-valuenow={now}
        aria-valuemin={min}
        aria-valuemax={max}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.focus();
          setDragging(true);
        }}
        onPointerMove={(e) => {
          if (!dragging) return;
          onAct({ kind: 'move', pointer: vertical ? e.clientX : e.clientY });
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
          setDragging(false);
        }}
        onPointerCancel={() => setDragging(false)}
        onDoubleClick={() => onAct({ kind: 'default' })}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        // `:focus-visible` asked of the element itself, because a keyboard
        // reader needs the ring and a reader who just grabbed the handle with a
        // mouse does not.
        onFocus={(e) => setRing(e.currentTarget.matches(':focus-visible'))}
        onBlur={() => setRing(false)}
        onKeyDown={(e) => {
          const px = step * (e.shiftKey ? 10 : 1);
          const grow = vertical ? 'ArrowRight' : 'ArrowDown';
          const shrink = vertical ? 'ArrowLeft' : 'ArrowUp';
          if (e.key === grow || e.key === shrink) {
            e.preventDefault();
            onAct({ kind: 'nudge', px: e.key === grow ? px : -px });
            return;
          }
          if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            onAct({ kind: 'edge', to: e.key === 'Home' ? 'min' : 'max' });
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            onAct({ kind: 'default' });
          }
        }}
        style={{
          position: 'absolute',
          inset: 0,
          background: line,
          cursor: vertical ? 'col-resize' : 'row-resize',
          touchAction: 'none',
          transition: 'none',
          ...(ring ? { outline: '2px solid var(--pw-accent)', outlineOffset: -1 } : { outline: 'none' }),
        }}
      />
      {/*
        THE REASON A STOP GIVES, and it is ABSOLUTELY POSITIONED on purpose: the
        page is exactly the window and never scrolls, so a line that took layout
        space would move the pictures it is about. It reads beside the divider
        it belongs to — left of a vertical one, above a horizontal one — and is
        absent at rest.
      */}
      {stop === null ? null : (
        <div
          role="status"
          // ITS OWN MARK, because the page has another `role="status"`: the
          // line that says which commit the pictures are drawn at. A test that
          // read the first status on the page would read that one.
          data-divider-stop="true"
          style={{
            position: 'absolute',
            ...(vertical ? { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8 } : { left: '50%', bottom: '100%', transform: 'translateX(-50%)', marginBottom: 8 }),
            zIndex: 4,
            width: 'max-content',
            maxWidth: '30ch',
            padding: '7px 10px',
            fontFamily: 'var(--pw-font-sans)',
            fontSize: 11,
            lineHeight: 1.45,
            color: 'var(--pw-mid)',
            background: 'var(--pw-glass-panel)',
            backdropFilter: 'var(--pw-blur-panel)',
            WebkitBackdropFilter: 'var(--pw-blur-panel)',
            border: '1px solid var(--pw-rule-divider)',
            borderRadius: 'var(--pw-r-card)',
            boxShadow: 'var(--pw-shadow-hero)',
            pointerEvents: 'none',
          }}
        >
          {stop}
        </div>
      )}
    </div>
  );
}
