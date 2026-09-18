/**
 * THE CARD A PICTURE SITS IN — LAYER 2. The frame is this desk's; the picture
 * inside it is always the library's.
 *
 * ── A CARD'S FACE IS THREE THINGS: A TITLE, A PICTURE, ONE LINE OF FIGURES ──
 * Nothing else, on any card — the focus slot and every tile, the table and the
 * viewer pane. Two sentences used to stand above the picture and both are now
 * behind `Full note`, whole:
 *
 *   `How to read: a scatter with phi on x, psi on y`
 *                     the LIBRARY'S own derived prose slot (`src/prot/def.ts`
 *                     declares `howToRead: { author: { kind: 'derived' } }`).
 *                     What it derives is a description of the ENCODING, which a
 *                     reader can already read off the two axis labels — so it
 *                     told them nothing they could not see. (A finding about
 *                     derived prose, reported: an encoding description is not a
 *                     reading instruction, and the slot asked for the second.)
 *   `STAGE 1  landed by the parse, before this record starts`
 *                     engine vocabulary. *A scientist reading a Ramachandran
 *                     plot does not care about stage 1 or commits* — the
 *                     author's point, and the whole argument for the move.
 *
 * **Neither is deleted, and neither is optional.** This component renders both
 * at the head of its own note, so a card cannot lose them by a caller
 * forgetting — and a card whose picture has no long caption still gets a
 * `Full note` control ({@link hasNote}) for exactly that reason.
 *
 * What is left BELOW the picture is the record, and it stays: the stage's own
 * numbers, its refusal, the one line that says the focus and the cursor
 * disagree, and the Mono footer of counts. It is the prose ABOVE the picture
 * that went, never the figures below it.
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
import { useState, type CSSProperties, type ReactNode } from 'react';
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

/**
 * THE HANDLE THAT MOVES A PANE — one prop bundle, shared by the focus card and
 * every rail tile so the gesture cannot be wired two ways.
 *
 * ── WHAT REACHES THE RECORD AND WHAT DOES NOT ──────────────────────────────
 * A SWAP is an act: a reader who rearranged their desk would expect to find it
 * again tomorrow, and it lands one commit that travels with the cursor. What is
 * MID-GESTURE — which pane is picked up, what the pointer is over — is a
 * REPORT: it is transient, it reaches no commit and nothing computes from it,
 * so it rides `held` / `target` as plain props and dies with the gesture.
 *
 * ── AND IT IS REACHABLE WITHOUT A POINTER ──────────────────────────────────
 * The handle is a BUTTON, so `Tab` reaches it and `Enter` or `Space` presses
 * it: press once to pick a pane up, press another pane's handle to swap the
 * two, press the held one again (or `Escape`) to put it back. This desk has
 * already shipped a drag handle that was ten pixels by zero while its keyboard
 * path worked perfectly (`./Chrome.tsx` · `RegionDivider`), and a
 * pointer-only arrangement is an arrangement some readers cannot make.
 * `onGrab` is the POINTER half laid over the same act — the composition
 * watches the pointer and lands exactly the same swap on release.
 */
export interface ArrangeHandle {
  /** What the handle is called RIGHT NOW: pick this pane up, put it back, or the swap pressing it would land. */
  readonly label: string;
  /** `true` while THIS pane is the one picked up — a report, never a commit. */
  readonly held: boolean;
  /** `true` while ANOTHER pane is held, so pressing here lands the swap. */
  readonly target: boolean;
  /** Pick up, drop, or put back — whichever this handle means right now. The one door the keyboard and the mouse share. */
  onPress(): void;
  /** A pointer went down on the handle: the composition takes the drag from here and lands the same act on release. */
  onGrab(at: { readonly x: number; readonly y: number }): void;
}

/**
 * ONE PANE'S HANDLE, drawn — the ⠿ a reader takes hold of.
 *
 * `prefers-reduced-motion` is honoured by having nothing to honour: the handle
 * lights, it never slides, and the panes themselves are swapped by the grid in
 * one paint rather than animated between slots. A movement a reader did not ask
 * for is the one thing an instrument cannot afford, and the cheapest way to
 * respect the setting is to draw no motion in the first place.
 */
export function ArrangeGrip({ arrange }: { readonly arrange: ArrangeHandle }): JSX.Element {
  return (
    <button
      type="button"
      data-arrange={arrange.held ? 'held' : arrange.target ? 'target' : 'idle'}
      aria-label={arrange.label}
      aria-pressed={arrange.held}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        arrange.onGrab({ x: e.clientX, y: e.clientY });
      }}
      onClick={arrange.onPress}
      style={{
        font: 'inherit',
        fontFamily: 'var(--pw-font-mono)',
        fontSize: 11,
        lineHeight: 1,
        cursor: 'grab',
        touchAction: 'none',
        flex: '0 0 auto',
        /*
          A POINTER-SIZED TARGET THAT COSTS THE PICTURE NOTHING — and both
          halves of that were measured.

          24px is WCAG 2.2's pointer target, and this desk has already been
          caught shipping a drag handle that was ten pixels by zero. But a
          24px box in a tile's 13px header row grew the tile's own chrome by a
          pixel, and the strip's floor is folded from that chrome: at the
          divider's stop the picture came back 101px against a 102px mark
          floor, which is the honesty floor broken by a control. So the box is
          full size and the ROW is told to ignore its height — the overflow
          rides the tile's own padding, which is exactly the space a handle
          beside a heading should use.
        */
        width: 24,
        height: 24,
        margin: '-6px 0',
        alignSelf: 'center',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        borderRadius: 4,
        border: `1px solid ${arrange.held || arrange.target ? 'var(--pw-accent-open-edge)' : 'transparent'}`,
        background: arrange.held || arrange.target ? 'var(--pw-accent-open-bg)' : 'none',
        color: arrange.held || arrange.target ? 'var(--pw-accent)' : 'var(--pw-soft-2)',
      }}
    >
      <span aria-hidden>⠿</span>
    </button>
  );
}

export interface ChartCardProps {
  /** The cell's address — stamped as `data-chart`, exactly as the packaged cockpit's own cell does. */
  readonly id: string;
  /** The picture's name: the heading, and the card's accessible name. */
  readonly label: string;
  /** The focused card is the hero: bigger radius, heavier glass, the deep shadow. */
  readonly focused: boolean;
  /**
   * The library's own derived how-to-read sentence — behind `Full note` since
   * the faces were cleared, never on the face. `null` for a view that declares
   * no encoding surface to derive one from.
   */
  readonly howToRead: string | null;
  /** The chips beside the header. Empty for a chart that draws its own legend — see the packet's findings. */
  readonly legend: readonly LegendChip[];
  /**
   * The footer, in Mono: one line of figures, and a second clause at the right
   * edge for a host that has one.
   *
   * THE RIGHT SLOT NOW CARRIES WHAT ANOTHER PANE'S SELECTION DID TO THIS
   * PICTURE (`./charts.ts` · `narrowingSaid`, room `'focus'`) — a count, in the
   * same register, on the line the counts already spend, and `null` when
   * nothing is selected anywhere else. It used to carry the owning stage, and
   * that came off when the stepper's bar began following the focus — one owner
   * per question (`./charts.ts`, the note where `ownerLine` was).
   *
   * WHICH HALF CLIPS IS THE LAW, and it has not changed: the counts are the
   * only surviving copy of themselves on this desk, so the LEFT half never
   * shortens and the right one ellipsizes. What a narrowing clause loses that
   * way is the source's declared name, whose long form is a press away in the
   * card's own note.
   */
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
   * THE ONE LINE THAT SAYS THE FOCUS AND THE CURSOR DISAGREE, drawn below the
   * picture beside the figures and the refusal — the register a state
   * announcement belongs in on this desk.
   *
   * Folded by the business layer from the two facts themselves
   * (`./panel.ts` · `focusVsCursor`), never from which control was pressed, so
   * it is right however the desk got into that state. `null` when they agree,
   * and then no row is drawn at all.
   */
  readonly cursorElsewhere?: string | null;
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
  /**
   * THE HANDLE THAT MOVES THIS PANE ({@link ArrangeHandle}) — absent on a card
   * a host wires no arrangement for, and then no handle is drawn rather than a
   * dead one.
   */
  readonly arrange?: ArrangeHandle | null;
  readonly children: ReactNode;
}

/** The card. See the file header for the one visible line and the law about the note. */
export function ChartCard({ id, label, focused, howToRead, legend, footLeft, footRight, note, noteLabel, noteAria, clear, stage = null, cursorElsewhere = null, height, arrange = null, children }: ChartCardProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const fills = height === 'fill';
  /*
    IS THERE ANYTHING TO DISCLOSE? The two sentences that came off the face are
    disclosed even on a card whose picture has no long caption of its own, so a
    card with `note === null` still gets its `Full note` control. Without this
    the move off the face would have been a DELETION for such a card, which is
    the one thing the law forbids.
  */
  const hasNote = note !== null || howToRead !== null || stage !== null;
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
          {/*
            A CARD'S FACE IS A TITLE, A PICTURE AND ONE LINE OF FIGURES —
            nothing else, and the author's reason is the one this desk runs on.
            Two sentences used to sit here and both are now behind `Full note`
            (see the file header): the library's derived `How to read:` line,
            which describes the ENCODING a reader can already read off the axis
            labels, and the stage's own quiet line, which is engine vocabulary —
            *a scientist reading a Ramachandran plot does not care about stage 1
            or commits.* Neither is deleted; the note below renders both.
          */}
          {/*
            AND WHEN IT IS THE FOCUSED ONE, IT SAYS SO — the author's first
            request, and the desk derived the fact and drew nothing about it.

            The paint alone did not carry it: heavier glass and a deeper shadow
            are the difference between a hero and a tile at a GLANCE, and a
            reader who has just pressed a stepper column is asking *which pane
            answered*. So the word rides beside the name, in the mono register
            this desk keeps for a fact about a pane, in the accent the stepper's
            own current-step bar uses — one vocabulary for *you are here*.
            It is PROPS-ONLY, like everything else in this file, so it can move
            into the library's own cockpit the day that cockpit wants it.
          */}
          <h2 style={{ margin: 0, fontSize: focused ? 16 : 13.5, fontWeight: 600, letterSpacing: '-0.005em', color: 'var(--pw-ink)', display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
            {!focused ? null : (
              <span data-focus-mark="true" style={{ flex: '0 0 auto', fontFamily: 'var(--pw-font-mono)', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--pw-accent)' }}>
                in focus
              </span>
            )}
          </h2>
        </div>
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {legend.map((chip) => (
            <span key={chip.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--pw-mid)' }}>
              <span aria-hidden style={{ width: 14, height: 2.5, background: chip.color }} />
              {chip.name}
            </span>
          ))}
          {arrange === null ? null : <ArrangeGrip arrange={arrange} />}
          {clear === null ? null : (
            <GlassButton small label={clear.label} onPress={clear.onPress}>
              ✕ clear
            </GlassButton>
          )}
          {!hasNote ? null : (
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
        AND WHEN THE FOCUS AND THE CURSOR PART COMPANY, THE PAGE SAYS SO — a
        state announcement, not prose about the protein, so it sits BELOW the
        picture with the figures and the refusal rather than above it with the
        title. Its words are folded from the two facts disagreeing
        (`./panel.ts` · `focusVsCursor`) and never from which control was
        pressed, so a resize, a reload, a promoted tile and a seek from the
        record drawer all reach it. `null` when they agree, and then there is no
        row at all: an absence is absent.
      */}
      {cursorElsewhere === null ? null : (
        <p role="status" style={{ margin: '7px 0 0', fontSize: focused ? 12 : 11, lineHeight: 1.45, color: 'var(--pw-mid-2)' }}>
          {cursorElsewhere}
        </p>
      )}

      {/*
        THE FOOTER: COUNTS ON THE LEFT, WHAT ANOTHER PANE'S SELECTION DID TO
        THIS PICTURE ON THE RIGHT, both Mono, ONE LINE, never wrapping.
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
          {footLeft === null ? null : <span style={{ minWidth: 0, flex: '0 0 auto' }}>{footLeft}</span>}
          {footRight === null ? null : (
            <span data-narrowed="true" style={{ marginLeft: 'auto', minWidth: 0, flex: '0 1 auto', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {footRight}
            </span>
          )}
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
      {!hasNote || !open ? null : (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--pw-rule)', fontSize: 12, lineHeight: 1.6, color: 'var(--pw-mid-2)', ...(fills ? { flex: '0 1 auto', minHeight: 0, overflowY: 'auto' as const } : {}) }}>
          {/*
            THE TWO SENTENCES THAT CAME OFF THE FACE, FIRST — in the order they
            stood in, so nothing about them changed except where they are read.
            They are rendered HERE rather than by the composition so that EVERY
            card keeps them without a caller having to remember: the focus slot,
            every tile that uses this card, the table and the viewer pane.
          */}
          {howToRead === null ? null : <p style={{ margin: '0 0 6px' }}>How to read: {howToRead}</p>}
          {stage === null ? null : (
            <p style={{ margin: '0 0 6px' }}>
              <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--pw-accent-bright)', marginRight: 5 }}>{stage.mark}</span>
              {stage.line}
            </p>
          )}
          {note}
        </div>
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
  /**
   * WHAT TO SAY WHEN THE MARKS IN HERE CANNOT BE PRESSED BY HAND — folded by
   * the business layer (`./charts.ts` · `reachClause`), `null` when they can.
   *
   * It is drawn ON THE FIGURES' OWN LINE, after them, and that is deliberate
   * rather than tidy: this tile ships about two pixels above the floor at which
   * its bars stop being a band (`./charts.ts` · `markFloor`), so a line of its
   * own would have taken the picture under it. A span on a baseline the tile
   * already spends costs the drawing nothing.
   *
   * It is a FACT about the gesture, never an instruction about the data, and
   * the long form is in the card's own note where every long note here lives.
   */
  readonly reach?: string | null;
  /**
   * WHAT A SELECTION MADE IN ANOTHER PANE DID TO THIS ONE — the short form,
   * folded by the business layer (`./charts.ts` · `narrowingSaid`, room
   * `'tile'`), `null` when nothing is selected anywhere else.
   *
   * It rides the FIGURES' OWN LINE, right after the counts, because it IS a
   * count and because this tile ships about two pixels above the floor at which
   * its marks stop being a band — a line of its own would take the picture
   * under it. The counts keep the space they need; this clause and the reach
   * clause are what clip.
   *
   * A connection a reader cannot see is the same as no connection, which is why
   * a clause that cut NOTHING says so here rather than staying silent.
   */
  readonly narrowed?: string | null;
  /** `true` lays the tile out for the bottom strip; a block for the right column otherwise. */
  readonly wide?: boolean;
  /**
   * THE HANDLE THAT MOVES THIS PANE ({@link ArrangeHandle}) — absent on a tile
   * a host wires no arrangement for, and then no handle is drawn rather than a
   * dead one.
   *
   * It sits at the END of the header row, after the promote control, because
   * the two are different verbs about the same pane: `⤢` brings it INTO the
   * focus (which the cursor owns) and `⠿` exchanges it with another pane
   * (which the reader owns and the record keeps). Two controls, two owners, and
   * the accessible names say which is which.
   */
  readonly arrange?: ArrangeHandle | null;
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
export function ChartTile({ id, label, said, promote, reach = null, narrowed = null, wide = false, arrange = null, children }: ChartTileProps): JSX.Element {
  return (
    <article
      data-chart={id}
      data-tile="true"
      data-arrange-target={arrange !== null && arrange.target ? 'true' : undefined}
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
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, width: '100%', minWidth: 0, flex: '0 0 auto' }}>
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
          // `flex: 1 1 0` RATHER THAN `width: 100%`, and the difference was a
          // real defect: the header is a flex ROW now (the promote control and
          // the arrangement handle are two different verbs and a button may not
          // contain a button), so a child asking for the full width pushed the
          // handle past the tile — and the column, which is `overflow: hidden`
          // and therefore still scrollable, scrolled 12px to reveal the handle
          // the moment a reader focused it. Every pane in that column then read
          // 12px to the left of where it had been, which is the swap law broken
          // by a scroll nobody asked for.
          flex: '1 1 0',
          minWidth: 0,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--pw-ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span aria-hidden style={{ marginLeft: 'auto', fontFamily: 'var(--pw-font-mono)', fontSize: 9.5, color: 'var(--pw-accent)', flex: '0 0 auto' }}>
          ⤢
        </span>
      </button>
      {/* THE SECOND VERB: not *bring this here* but *exchange this with that*.
          It is outside the promote button because a button may not contain a
          button, and because the two acts have different owners — see
          {@link ChartTileProps.arrange}. */}
      {arrange === null ? null : <ArrangeGrip arrange={arrange} />}
      </div>
      {/* THE COUNT, in Mono — the only surviving copy of these numbers now that
          the counted-facts band is gone, and never a sentence. */}
      {said === null && reach === null && narrowed === null ? null : (
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontFamily: children === undefined ? 'var(--pw-font-sans)' : 'var(--pw-font-mono)', fontSize: children === undefined ? 10.5 : 9.5, lineHeight: 1.35, color: 'var(--pw-mid-2)', flex: '0 0 auto', minWidth: 0 }}>
          {said === null ? null : <span style={children === undefined ? { minWidth: 0 } : { minWidth: 0, flex: '0 0 auto', whiteSpace: 'nowrap' }}>{said}</span>}
          {/*
            WHAT ANOTHER PANE'S SELECTION DID TO THIS ONE — first of the two
            clauses, and the one that keeps its room longest: it is the fact the
            whole crossfilter is FOR, and the reach clause below it is about a
            gesture rather than about the data. Same register as the counts it
            follows, one line, never wrapping.
          */}
          {narrowed === null ? null : (
            <span data-narrowed="true" style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 9, color: 'var(--pw-mid-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{narrowed}</span>
          )}
          {/*
            THE GESTURE FACT, ON THE FIGURES' OWN LINE so the picture keeps
            every pixel it has — this tile ships about two pixels above the
            floor at which its bars stop being a band (`./charts.ts` ·
            `markFloor`), and a line of its own would have taken it under.

            THE FIGURES FIRST AND THE CLAUSE SECOND, with the ellipsis on the
            clause: the counts are the only surviving copy of themselves on this
            desk, and the clause is recoverable from the note. Same law as the
            card's footer — if it does not fit, the words shorten and never the
            numbers.
          */}
          {reach === null ? null : (
            <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 9, color: 'var(--pw-soft-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reach}</span>
          )}
        </span>
      )}
      {children === undefined ? null : <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0, minWidth: 0, marginTop: 3 }}>{children}</div>}
    </article>
  );
}

export interface PaneHomeProps {
  /** The pane whose home this is — stamped as `data-home`, never `data-chart`: the picture itself is drawn in the focus and a test must find exactly one of it. */
  readonly id: string;
  readonly label: string;
  /** What the marker says — `arrangement.ts` · `homeSaid`, so the words have one owner. */
  readonly said: string;
  /** The handle, so a reader can arrange where this pane will SETTLE while it is still lifted. */
  readonly arrange?: ArrangeHandle | null;
}

/**
 * A PANE'S HOME WHILE THE PANE IS LIFTED INTO THE FOCUS.
 *
 * ── WHY THE BOX IS HELD OPEN AT ALL ────────────────────────────────────────
 * This is the whole price of *a focus change swaps, it does not reflow*. Every
 * pane on this desk has one home and never leaves it, so the desk needs one box
 * more than it has pictures — and the box belonging to whatever is currently
 * focused has no picture to draw. Collapsing it would put every pane after it
 * back on the move, which is the defect this arrangement exists to remove.
 *
 * So it says what it is, in the register the 3D viewer's own rail tile already
 * speaks (*the 3D viewer draws in the focus…*), and it stays a DROP TARGET:
 * arranging where a pane will settle is exactly as much an act while it is
 * lifted as while it is not.
 *
 * No motion of any kind is drawn here, which is how `prefers-reduced-motion` is
 * honoured — there is nothing to reduce. A pane that slid between slots would
 * be movement a reader did not ask for, on an instrument that has to stay still.
 */
export function PaneHome({ id, label, said, arrange = null }: PaneHomeProps): JSX.Element {
  return (
    <article
      data-home={id}
      data-arrange-target={arrange !== null && arrange.target ? 'true' : undefined}
      aria-label={said}
      style={{
        border: '1px dashed var(--pw-rule-divider)',
        borderRadius: 'var(--pw-r-card)',
        background: 'none',
        padding: '5px 8px 7px',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--pw-soft)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span aria-hidden style={{ marginLeft: 'auto', fontFamily: 'var(--pw-font-mono)', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--pw-accent)', flex: '0 0 auto' }}>
          in focus
        </span>
        {arrange === null ? null : <ArrangeGrip arrange={arrange} />}
      </div>
      <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 9.5, lineHeight: 1.35, color: 'var(--pw-soft-2)', minWidth: 0 }}>{said}</span>
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

// ── what a model said, in the register this page keeps for that ─────────────

/**
 * ONE RANKED RESIDUE — props, and the shape is declared HERE rather than
 * imported, the {@link CardFact} precedent: a component that takes only props
 * is a component that can later move into `vizfootprint-ui`, and one that
 * imported the protein desk's own answer type could never move at all
 * (`./README.md`, law 2). The rules layer's own `HotspotPick` is structurally
 * this, which is what keeps the two from drifting without an import.
 */
export interface RecommendationRow {
  readonly residue: string;
  readonly rank: number;
  readonly reason: string;
  /** The fact ids this row's reason rests on. NEVER empty: a row with none is refused before it reaches a screen. */
  readonly cites: readonly string[];
}

/** One second-source verdict, as props. */
export interface RecommendationVerdict {
  readonly of: string;
  readonly judge: string;
  readonly model: string | null;
  readonly confidence: number;
  readonly by: string;
  readonly failed?: string;
}

export interface RecommendationProps {
  /** The words in the corner — `a recommendation, not a measurement`. Never a literal in here. */
  readonly tag: string;
  /** One line of figures: how many ranked, how many facts served, how many refused. */
  readonly figures: string;
  readonly rows: readonly RecommendationRow[];
  /** Every refusal, verbatim and by name. Shown, never counted away. */
  readonly refused: readonly string[];
  /** What the judge is and whether it is the weaker of the two, in the door's own words. */
  readonly judge: string;
  readonly verdicts: readonly RecommendationVerdict[];
  /** Where the judge and the model disagreed — shown, resolved by nobody. */
  readonly disagreements: readonly string[];
  /** The sentence, when the stage ran and there is no ranking. */
  readonly said: string | null;
  /**
   * WHICH KIND of *no ranking* this is, in the stage's own declared word —
   * shown BESIDE the sentence, never instead of it.
   *
   * It is what makes the stepper's REFUSED mark and this card legibly the same
   * fact: the mark says refused, and the card says `refused · timeout` with
   * the whole sentence under it. `null` for a ranking and for a stage in
   * flight.
   */
  readonly kind?: string | null;
  /**
   * ASK AGAIN — present only where a re-ask could honestly answer differently
   * (`src/prot/hotspots.ts` · `RETRYABLE` decides; this component never does).
   *
   * `busy` is the ask already in flight: the control is not pressable a second
   * time mid-ask, and it says so rather than looking idle.
   */
  readonly retry?: { readonly label: string; readonly busy: boolean; onPress(): void };
  /** How many times the stage has been asked in this run — shown only once it is more than once. */
  readonly asked?: number;
  /**
   * WHICH CURSOR THIS ANSWER IS ABOUT — the one line on this card that is not
   * about the protein.
   *
   * Every other picture on this desk is drawn at the cursor; this answer was
   * asked once, at the end of the run, because that is what the stage reads.
   * So the card DECLARES its own basis rather than letting a reader take it for
   * a picture of wherever they are standing.
   */
  readonly where: string | null;
  /** Set when the reader has stepped BEHIND the commit the ranking landed as — the rows then carry no rank at all. */
  readonly behind?: string | null;
  readonly focused: boolean;
  /** The control that puts the model's own picks into the desk's live selection. Absent where the page wires none. */
  readonly select?: { readonly label: string; onPress(): void };
  /**
   * The control that BINDS a declared colour channel to the column the ranking
   * landed — and unbinds it again.
   *
   * It is a second slot rather than a second meaning for {@link select}
   * because the two are different acts on different records: one lands a
   * CLAUSE (the picks as a selection) and the other lands an ENCODING (a
   * channel pointing at a column). A reader can want either without the other,
   * and the labels say which.
   *
   * This component draws a button and nothing more; what the press MEANS is
   * the composition's business, exactly as it is for every other control here.
   */
  readonly paint?: { readonly label: string; onPress(): void };
}

/**
 * WHAT A MODEL SAID — and the whole job of this component is that it cannot be
 * mistaken for the measured numbers around it.
 *
 * Three things do that, and none of them is a colour nobody declared:
 *
 *   - the TAG in the corner is `a recommendation, not a measurement`, and it
 *     arrives as a prop from the one module that owns those words;
 *   - the reason is in the SERIF face this page uses for prose and the cited
 *     ids are in the MONO face it uses for numbers, so the sentence reads as a
 *     sentence somebody wrote and the ids read as a reference;
 *   - **every row shows its citations.** A row cannot be drawn without them —
 *     a ranking that cited nothing never reaches this component, because it
 *     was refused — so there is no state in which this card shows a rank with
 *     nothing behind it.
 *
 * The REFUSALS and the DISAGREEMENTS are rendered, not summarised: a refusal
 * counted and hidden is the silent omission this desk is built against, and a
 * disagreement is a fact of the record that nothing here resolves.
 */
export function Recommendation({ tag, figures, rows, refused, judge, verdicts, disagreements, said, kind = null, retry, asked = 1, where, behind = null, focused, select, paint }: RecommendationProps): JSX.Element {
  const MONO: CSSProperties = { fontFamily: 'var(--pw-font-mono)', fontSize: focused ? 10 : 9, letterSpacing: '0.03em', color: 'var(--pw-soft-2)' };
  if (rows.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, flex: '1 1 0', minHeight: 0, padding: '6px 0' }}>
        <span style={{ ...MONO, textTransform: 'uppercase' }}>{tag}</span>
        {/* THE REASON, IN THE CARD — the declared word in the rust the stepper's
            refused mark is drawn in, and the stage's own SENTENCE under it,
            verbatim. Before this the mark said REFUSED and the card said
            nothing a reader could act on. */}
        {kind === null ? null : (
          <span style={{ ...MONO, textTransform: 'uppercase', color: 'var(--pw-refuse-ink)' }}>
            refused &middot; {kind}
          </span>
        )}
        <p role="status" style={{ margin: 0, fontFamily: 'var(--pw-font-serif)', fontSize: focused ? 15 : 12, lineHeight: 1.45, color: 'var(--pw-prose)' }}>
          {said ?? 'the stage has not answered yet'}
        </p>
        {asked < 2 ? null : <span style={{ ...MONO }}>asked {asked} times in this run</span>}
        {retry === undefined ? null : (
          <button
            type="button"
            onClick={retry.onPress}
            disabled={retry.busy}
            aria-busy={retry.busy}
            style={{
              font: 'inherit',
              fontFamily: 'var(--pw-font-sans)',
              fontSize: focused ? 11 : 10,
              alignSelf: 'flex-start',
              cursor: retry.busy ? 'progress' : 'pointer',
              color: retry.busy ? 'var(--pw-soft-2)' : 'var(--pw-accent)',
              background: 'none',
              border: 0,
              padding: 0,
              textAlign: 'left',
            }}
          >
            {retry.label}
          </button>
        )}
        {verdicts.length === 0 ? null : <p style={{ margin: 0, fontSize: focused ? 11.5 : 10, lineHeight: 1.4, color: 'var(--pw-mid-2)' }}>{judge}</p>}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 0', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
      <span style={{ ...MONO, textTransform: 'uppercase' }}>{tag}</span>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0, overflow: 'auto' }}>
        {rows.map((row) => (
          <li key={row.residue} style={{ borderTop: '1px solid var(--pw-rule-faint)', paddingTop: 3, minWidth: 0 }}>
            <span style={{ ...MONO, color: 'var(--pw-mid)', marginRight: 5 }}>{row.rank}</span>
            <b style={{ fontFamily: 'var(--pw-font-mono)', fontSize: focused ? 11 : 10, fontWeight: 600, color: 'var(--pw-mid)' }}>{row.residue}</b>
            {focused ? <span style={{ fontFamily: 'var(--pw-font-serif)', fontSize: 13, lineHeight: 1.4, color: 'var(--pw-prose)' }}> — {row.reason}</span> : null}
            {/* THE CITATIONS, on every row, in the face this page uses for a reference */}
            <span style={{ ...MONO, marginLeft: 5 }}>cites {row.cites.join(' ')}</span>
          </li>
        ))}
      </ol>
      <span style={{ ...MONO, color: 'var(--pw-soft)' }}>{figures}{asked < 2 ? '' : ` \u00b7 asked ${String(asked)} times in this run`}</span>
      {/* WHICH CURSOR THE ANSWER IS ABOUT, and — when they have parted company
          — that the rows underneath carry no rank. Both plain text in a line a
          reader is already reading, never a live region: the desk announces
          nothing (`./README.md`). */}
      {where === null ? null : <span style={{ ...MONO, color: 'var(--pw-soft)' }}>{where}</span>}
      {behind === null ? null : (
        <span role="status" style={{ fontSize: focused ? 11.5 : 10, lineHeight: 1.4, color: 'var(--pw-refuse-ink)' }}>
          {behind}
        </span>
      )}
      {/* THE TWO CONTROLS, each its own act: one lands a clause, the other an
          encoding. Same shape, same ink, two names. */}
      {[select, paint].map((control, at) =>
        control === undefined ? null : (
          <button
            key={at}
            type="button"
            onClick={control.onPress}
            style={{ font: 'inherit', fontFamily: 'var(--pw-font-sans)', fontSize: focused ? 11 : 10, alignSelf: 'flex-start', cursor: 'pointer', color: 'var(--pw-accent)', background: 'none', border: 0, padding: 0, textAlign: 'left' }}
          >
            {control.label}
          </button>
        ),
      )}
      {refused.length === 0 ? null : (
        <ul aria-label="what the model said that was refused, and why" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {refused.map((sentence) => (
            <li key={sentence} style={{ fontSize: focused ? 11 : 9.5, lineHeight: 1.35, color: 'var(--pw-refuse-ink)' }}>
              {focused ? sentence : sentence.split(' — ')[0]}
            </li>
          ))}
        </ul>
      )}
      {disagreements.length === 0 ? null : (
        <ul aria-label="where the standing judge and the model disagreed" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {disagreements.map((sentence) => (
            <li key={sentence} style={{ fontSize: focused ? 11 : 9.5, lineHeight: 1.35, color: 'var(--pw-mid-2)' }}>
              {focused ? sentence : sentence.split(' — ')[0]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface BlockedGroupProps {
  /** The section's accessible name. */
  readonly label: string;
  readonly rows: readonly BlockedRow[];
  /**
   * The words over the rows. Defaults to what this card has always said —
   * passed only where it would be WRONG, which is a build where one of these
   * steps really ran (`../protDesk.tsx`): a header claiming *will not run
   * here* over a row that just did would be the card contradicting the log.
   */
  readonly heading?: string;
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
export function BlockedGroup({ label, rows, heading = 'declared \u00b7 will not run here' }: BlockedGroupProps): JSX.Element {
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
      <span style={{ fontFamily: 'var(--pw-font-mono)', fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--pw-soft)' }}>{heading}</span>
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
