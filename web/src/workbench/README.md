# `web/src/workbench/` — the protein desk's four layers

> Design this space as theme separate, components separate, business logic, data logic separate. Don't tangle these — make it reusable.

That is the author's ruling and it is the shape of this folder, not a preference. Four layers, each in its own files, each with one job — and a test that fails when one reaches into another (`tests/prot-layers.test.ts`).

| layer | files here | one job | may import |
|---|---|---|---|
| 1 · **theme** | `theme.css`, `tokens.ts` | every colour, radius, shadow, blur and font family, once | `tokens.ts`: `react`, nothing else |
| 2 · **components** | `Chrome.tsx`, `Stepper.tsx`, `ChartCard.tsx`, `Search.tsx` | **props in, markup out** | `react` + sibling components |
| 3 · **business logic** | `bands.ts`, `steps.ts`, `panel.ts`, `charts.ts`, `results.ts` (and `../protStages.ts`, which was already this) | the rules, as **pure functions**: input is the run, output is the props | the run's own declarations (`src/prot/`), sibling types |
| 4 · **data logic** | *not here* — `../protRows.ts`, `../protProjection.tsx`, `src/prot/session.ts` | the only code that touches the session | anything |

`../protDesk.tsx` is the one thin composition that wires 4 → 3 → 2, and the only file that knows all four exist. `../protLanding.tsx` is the same shape for screen one.

## Why the boundary is the deliverable

A component that takes only props is a component that can later move into `vizfootprint-ui` and serve every desk. A component that reaches into the session can never move — the reach is the thing that pins it to this page. This desk exists to find what the library must abstract for a third-party chart, so **where the line falls here IS the finding.**

## The four laws, with an example each

1. **No component holds a colour.** Every paint is a token:

   ```tsx
   // Stepper.tsx — the landed mark
   { background: 'var(--pw-accent)', color: 'var(--pw-on-accent)', boxShadow: 'var(--pw-mark-shadow)' }
   ```

   `tests/prot-layers.test.ts` reads every file in this folder (plus `protDesk.tsx`, `protLanding.tsx`, `protTrace.tsx`) and fails on `#rrggbb`, `rgb(`, `rgba(` or `hsl(`.

2. **No component counts.** A number on screen was folded by layer 3 off the run:

   ```ts
   // panel.ts — the stage's own numbers, read off the act's answer field by field
   { id: 'crossing', label: 'Crossing to another chain', value: num(pairs.crossing) }
   ```

   A fact whose source has not landed is **absent** — never a zero, never a dash, and (since the facts band went) never a second copy of a count another card already carries.

3. **No component reaches a chart's internals.** The pictures are `vizfootprint-ui`'s, themed through the library's own hooks: its `--vzf-*` custom properties (the one bridge rule in `theme.css`) and the `colorOf` a chart accepts. There is not one descendant selector under a `.vzf-*` class in this folder, and `tests/prot-theme.test.ts` asserts that.

4. **Nothing is dropped to make room.** The redesign moved every long caption behind a `Full note` disclosure — it did not shorten one. `tests/prot-cards.test.tsx` opens the disclosure and asserts the note's own sentences are in the DOM.

## THE INSTRUMENT FITS THE WINDOW, and that is a functional law rather than a visual one

> no paragraphs, nothing similar — I don't want a scrolling dashboard

The author's ruling, and the REASON behind it is the one that decides every layout question here: *focus means once a stage is chosen it gets bigger and the rest stay small, **so that a selection in one chart is visible in another** — otherwise there is no use.* These views are crossfiltered (`src/prot/def.ts` · `links.default: 'crossfilter'`), so a pick in one pane narrows the others — and a pane that is off-screen, or drawn without marks, cannot show that. **An effect nobody can see might as well not have happened.** So:

| the law | how it is kept | what breaks it |
|---|---|---|
| the PAGE never scrolls | `protDesk.tsx` root: `height: 100dvh`, four grid rows, the instrument pinned to the LAST one (`gridRow: '-2 / -1'`) | `min-height: 100dvh` — an indefinite height sizes an `fr` row to its CONTENT, which cost 208px of empty space in a 749px gap |
| the instrument claims ALL the remaining height | `minmax(0, 1fr)` for the focus row, `minmax(0, 0.34fr)` for the bottom strip, `min-height: 0` on every shrinkable child | an `auto` track, or a child that refuses to shrink: both leave the remainder unclaimed |
| no fixed pixel height anywhere in it | `fr` and `clamp` only; `ChartFrame` re-measures itself on every reflow | a `height: 340` — the number that made five cards a 2,622px page |
| the right column stops shrinking before it stops working | `clamp(16rem, 22vw, 22.5rem)` — 256px floor, 360px ceiling (where the design drew it) | a percentage with no floor |
| the right column's rows are NOT equal | drawings get `minmax(0, 1fr)` each, the text cards `auto` | five equal rows, which gave two charts 120px and three sentences more than they need |

**The shape is an L, and the reason is aspect ratio** — the design's own artboards, not anybody's taste: the surface run was drawn at 3.4 : 1 and the cross-chain bars at 3.9 : 1, the Ramachandran at 1 : 1. So what wants WIDTH waits along the bottom and what wants a SQUARE (or rows, which want height) waits down the side. Which is which is read off the def's declared `chartKind` (`charts.ts · shapeOfView`) and never from a list of where each chart goes.

`tests/prot-viewport.smoke.test.ts` measures all of it in a real browser at 1440×900 and 1280×800 — the page height, the dead space, every pane's size and marks, a window drag between the two — and `tests/prot-crossfilter.smoke.test.ts` drives the claim it is bought for: a pick in a tile, every other pane changing, the clause cleared, the marks back.

## EVERY PANE THAT BINDS DATA DRAWS ITS MARKS — including the small ones

A tile was words only for one round, on the honest ground that a library chart at 150px has illegible axis labels and 185 marks that merge into texture. **The crossfilter overturned it:** a pane with no marks cannot show a selection, and *185 marks dropping to 12* is perfectly legible at tile size because it is a change in DENSITY, not a value read off an axis.

**The honesty floor, applied per pane from the height it really gets** (`protCells.tsx · AXIS_ROOM`, 170px):

| pane | at 1280×800 | what it does |
|---|---|---|
| the focus | 906×278 | draws, with its axes — 3.3 : 1, where the design drew it at 3.4 : 1 |
| cross-chain bars (strip) | 940×104 | draws 185 bars, **no axis chrome** |
| backbone angles (column) | 282×125 | draws 181 dots over a **56px band**, no axis chrome. At 1440 it is 175px and draws its axes: same rule, two answers |
| the contact table | 282×125 | its own rows, its own scroll |
| the 3D view | 282×73 | **says it instead.** Measured at 282×114 its canvas was 282×67 and the well was EMPTY: it is the one pane whose content is a canvas and not marks, it cannot show a crossfilter by density, and a camera cannot be fitted to that aspect. So the pane says the viewer draws in the focus and a press puts it there (906×282 with the camera fitted) |
| the three blocked steps | one card, 3 rows | nothing to filter |

**`axes?: boolean \| 'y'` is the library's own reduced-rendering hook** — built so a merged frame can draw one guide for a stack, reused here so a small pane keeps its marks and drops its labels. What it cannot move is `PAD`, a module constant (`{ l: 52, r: 18, t: 18, b: 44 }`): 62px of any box is margin whatever is in it, which is why a 67px pane once reported 185 dots and drew them in a 5px band. **Reported, and invisible, reads as broken rather than as small** — that is the failure this floor exists to prevent, and the browser test measures the mark BAND and not only the count.

The cost, named: a tile's axis labels are also the encoding pickers, so re-encoding is a focus-slot gesture. An illegible picker was never a control.

**And one wobble, measured rather than assumed:** the right column's panes land anywhere between about 120px and 175px at 1280, because the blocked card's three clauses wrap differently as the webfont arrives — which straddles the 170px threshold. When a pane shrinks across it the chart is briefly still the one drawn for the taller box (`ChartFrame` re-measures on a ResizeObserver callback), so the browser test WAITS for the invariant to settle and fails loudly if it never does. The steady state is the rule; the frame or two after a font load is the library's documented re-measure.

**A tile's header is the control, not the whole tile.** The picture inside is live: a button may not contain the library's own axis controls, and a press anywhere would swallow the gesture that makes the tile worth drawing.

## AND THE READER MOVES THE BOUNDARY — two dividers, with floors derived from the honesty floor above

The author asked for a **corner resize on the focus widget, aspect-ratio locked**. Two things about that were changed on the way in, and the reasons are here rather than in a commit message because the choice has to stay legible.

**Not a corner scale — two dividers.** The useful gesture is not *make this box bigger*, it is *give the focus more room and the satellites less*. A corner drag scales one pane and leaves the grid to cope, which on a layout that is `height: 100dvh` and never scrolls means either dead space or overflow — the exact two failures the section above is a record of. Moving the **boundary** redistributes the grid's own fractions, so the two always sum to one and the region stays exactly full. One divider between the focus and the right column, one between the focus and the bottom strip.

**Not aspect-ratio locked.** The ratios differ by three to four times across what lands in the slot — the surface run wants 3.4 : 1, the Ramachandran 1 : 1, off the design's own artboards (`charts.ts · shapeOfView` carries the table). One locked ratio is wrong for most of them, and locking to the *current* chart would change the slot's shape on every stage press, which is the disorienting thing this page already decided against (`tests/prot-viewport.smoke.test.ts` pins the focus card's height across a promotion). The slot stays a free rectangle and each chart draws honestly into what it gets, which the library's frame already does.

### THE LAW: a drag may not break what the layout promises

A drag that shrinks the satellites past the point where they can draw their marks destroys the only thing this layout is for, and does it **silently**. So every divider has a floor — and **not one of the four is a number anybody picked for the gesture.** Each is folded out of a number the library or this page already measured (`charts.ts · dividerFloors`):

| the stop | px | folded from |
|---|---|---|
| the satellite **column**'s width | 256 | the page's own `clamp(16rem, …)` — *the width at which a scatter still reads as a shape* — and never below the mark floor's width arm (105) |
| the **focus column**'s width | 360 | that same clamp's CEILING, `22.5rem`: the widest a satellite tile can ever be, because **a focus the size of a tile is not a focus** |
| the satellite **strip**'s height | 148 | the mark floor (102) plus a tile's own chrome (46) |
| the **focus row**'s height | 333 | `AXIS_ROOM` (170) plus the focused card's own chrome (163). The focus is the one pane that KEEPS its axis labels, and the labels are also the encoding pickers — a focus that dropped them would take this page's only re-encode control off the screen |

**The mark floor is one clamp above the library's own.** `vizfootprint-ui · framePlotBox` clamps: a frame shorter than its own margin draws an empty box, so `pad.t + pad.b` is where the LIBRARY says there is no plot left, and the disaster recorded above was five pixels past it (a 67px frame under `VizLine`'s 62px margin — 185 dots reported, a 5px band, nothing visible). So the floor asks the marks to get **half the pane's own margin back as plot**: `(pad.t + pad.b) × 1.5`, which at `framePad(['line','bar','point'])` (20 above, 48 below) is **102px of pane for 34px of band**. It refuses the pane that was broken, accepts both panes this page measures as honest (the strip's 104px frame drawing 185 bars, the column's 125px drawing 181 dots over a 56px band), and sits BELOW `AXIS_ROOM` — which is the same question asked about the LABELS. Between the two a pane draws its marks and drops its labels, which is what ships.

`framePad` is the library's own function, so **the floor moves if the library's chart margin ever does**, and `tests/prot-dividers.test.tsx` pins the value it returns: a change there fails a test rather than quietly moving a floor.

**A stop is a reason, not an error.** The page says so in its own voice, beside the divider, only while it is parked there (`charts.ts · stopSentence`): *"That is as far as it goes. The panes on the right are at the width where a scatter still reads as a shape, and narrower they would stop being able to show a selection — which is what this layout is for."*

**And the measurement is checked where it counts.** `tests/prot-dividers.smoke.test.ts` pushes each divider all the way to each stop in a real browser at 1280×800 and asserts the marks, their BAND, and that the page height is still exactly the viewport — then makes **a pick in a tile with the divider at its stop and watches the focus's marks come down.** A layout test alone would not have caught the loss of the thing the floor exists to protect.

### The gesture, and why it is a control

A real `role="separator"` (`Chrome.tsx · RegionDivider`), focusable, with `aria-orientation` and `aria-valuenow`/`min`/`max` about the FOCUS side, and an accessible name that says which two regions it divides. **Pointer** events with the pointer CAPTURED, so a trackpad and a touch screen both work and a fast drag that leaves the 10px track does not lose the gesture; `touch-action: none` so a touch drag is not read as a scroll. The **arrow keys** move it by the divider's own width (ten of them with `Shift`), `Home` and `End` go to its two stops, and `Enter` — or a double-click — puts it back where the page had it. A mouse-only resize is not a control, and a resize with no way back is a trap. The visible rule is 2px and the **target is the whole track**. There is **no transition on any of it, in any case**: a divider that eases is a divider that lags, so `prefers-reduced-motion` has nothing to turn off here. The line is `--pw-rule-divider` at rest and `--pw-accent` while it is hovered, focused or held — the same pair every other control on this desk uses, and not a literal anywhere.

### Where the state lives, and what it is not

**A drag is a layout preference, not an analytical act.** It lands no commit, appears nowhere on the log, and nothing in the session's account of itself mentions it — the browser test asserts the record bar's own counts are identical before and after three gestures. So it is remembered in **`localStorage`, in this browser only** (`charts.ts · SPLIT_STORAGE_KEY`), wrapped in try/catch on both read and write: a private window, cleared site data or a preview costs the memory and nothing else. It is named in `protDesk.tsx · NotHere`, where every other omission is.

Two fractions are stored, each the SATELLITE side's share of its own axis, and **they are clamped on read as well as on write** — `parseSplit` refuses a share outside `(0, 1)` without needing a region, and `clampShare` is asked on *every render* against the CURRENT window, so a fraction written at 1,920px cannot reproduce the broken layout when it is read into a 700px one. A window too small to give both sides their floor falls back to the page's own arrangement and **keeps the reader's preference**, which comes back when the window grows.

`null` means *where the page put it*, and the default track is the page's own expression (`columnTracks(null)` IS `clamp(16rem, 22vw, 22.5rem)`, spelled from `COLUMN_CLAMP`, the one owner of those numbers). A default expressed as a fraction would have been a second, drifting copy of `22vw` — and this way the page at rest is unchanged to the pixel: the divider's 10px track is the ten pixels the grid's `gap` used to be, and `tests/prot-viewport.smoke.test.ts` measures the same 906×278 focus, the same 940×104 strip and the same 282×125 column pane it always did.

### The layers held, and one thing to know about where the code sits

The divider component is presentational — props in, markup out; it reports the POINTER'S OWN COORDINATE rather than a fraction, because a component that computed one would have to know the region it divides and would stop being able to move into `vizfootprint-ui`. The clamping rule is a pure function of numbers, tested without a DOM. The tokens are the theme's. `protDesk.tsx` wires them.

The one thing that is not obvious: those pieces landed in **`charts.ts` and `Chrome.tsx` rather than in files of their own.** `tests/prot-layers.test.ts` asserts the folder's MANIFEST by name, so that a module added here cannot slip past the four rules by being classified as something nobody checks — and a sixth rule module would have meant editing that suite, which this packet was asked to leave alone. The functions belong to the job `charts.ts` already has (`splitByFocus`, `shapeOfView`, `byPlanStep`: **where each picture goes**), so they sit beside it. Both new pieces are judged by the four rules exactly as everything else in the folder is.

### Named, not fixed: the focus card's own chrome grows when the card is narrow

`CARD_CHROME` (163px) is measured at the width the page ships — a 441px card holding a 906×278 picture at 1280×800, a 516px card holding 1031×353 at 1440×900, identically. It is **not** constant across widths: at the focus column's own floor (360px) the card's title, the library's derived how-to-read line, the `Full note` control and the Mono footer wrap, and they take **257px**. So with BOTH boundaries pushed to their stops at once the focus card is 360×333 and its own picture is 326×**76** — under the mark floor a satellite would be held to.

Measured and printed rather than hidden (`tests/prot-dividers.smoke.test.ts` · *holds BOTH boundaries at once*), and left as it is, because:

* the law this packet is about is the SATELLITES', and it holds at both stops together — every pane that drew still draws its marks over the band the floor promises, and **a pick in a tile still takes the focus's marks down** with the region squeezed from two sides. The test asserts all of it;
* the focus's own stop promises that it is **not smaller than a tile**, and at 360×333 it is not;
* and the floor **must** be folded from a constant rather than from the real chrome, which is the interesting half. The library does hand the number over — `ChartFrame`'s child is `(size) => ReactNode`, so the composition could capture the picture's box on every measure and subtract. What it could not then do is USE it as a floor: the card's chrome depends on the very box the floor constrains, so a floor derived from it is a control loop — squeeze the row, the chrome wraps and grows, the floor rises, the clamp pushes the row back, the chrome unwraps. **A floor must be folded from something the floor does not move**, and the card's own chrome is not that.

**The library finding, then, is about the CARD and not about the measurement:** a card whose chrome REFLOWS with its width cannot carry a floor expressed on its picture. The way out is the rule this desk already applies to the footer — *if it wraps, the attribution shortens, never the numbers* — extended to the derived how-to-read line: a card whose chrome is constant in height at every width can be given a floor, and one whose chrome grows by 94px between 906px and 360px cannot.

Raising the row's floor to the narrow chrome unconditionally was the other alternative, and it is rejected with its number: it would make the focus row's floor 427px, which at 1280×800 leaves the strip a range of 148–164px — taking the row divider's usefulness away at every width to fix one corner.

### One measurement worth knowing

**The bottom strip ships about two pixels above its own floor.** At 1280×800 the strip band is 150px and its floor is 148px, so the horizontal divider can give the strip a great deal more room (up to 258px, where the focus reaches its own stop) and essentially none less. That is not a flaw in the divider — it is what *the reclaimed height goes to the tiles* already spent. The row divider is, in practice, a one-way control at this budget, and a reader who drags it down meets the stop sentence almost at once.

## A STEP THAT WILL NOT RUN GETS A CARD, and the reason is inside it

> for not-available, show the widget and tell inside it a text to tell why it's not there

So the reason is read at the size and in the position of the thing it is about. **In the right column the three of them share ONE card of three rows** (`ChartCard.tsx · BlockedGroup`): as three separate cards they spent 177px of a 583px column on three sentences — more than the two real charts got between them — and the reclaimed height went to the drawings. Each row keeps its tag, its name and its reason's first clause verbatim, and each row is its own control opening its own card. Stages 5 and 6 declare no views at all, so their card has **no chart and no frame pretending to be one** — an empty axis would be the lie this desk exists to avoid. The card carries the kind of blocked, the reason's own first clause (`panel.ts · firstClause`) and the declared sentence; the whole paragraph is behind the same `Full note` press every other card has.

## NO PROSE UNDER A DRAWING, in any card, focused or tiled

The prose band under the stepper is **gone** — 342 words, then 136, then none — and not one of its sentences was deleted. `panel.ts`'s file header carries the field-by-field map of where each went, and `tests/prot-panel.test.tsx` is the proof. A card's footer is now **counts on the left, the owning stage on the right, both Mono, one line, never wrapping** — and if it wraps, the ATTRIBUTION shortens, never the numbers.

**The counts are load-bearing and are the only surviving copy of themselves.** The counted-facts band was deleted because each card already carried its own; a card that dropped them too would lose them off the page entirely — two cuts each justified by the other place, which is the silent omission this desk is built against. The browser test counts them on the rendered page.

## One disclosure, everywhere something folds

`Chrome.tsx · Disclosure` is the ONLY fold shape on this desk. It draws a `<button aria-expanded>` plus `Chevron` and reveals its body below — never `<details>`, because a `<summary>` cannot carry the glass button's layout and the page used to fold three things three different ways.

| where | shape | what it holds |
|---|---|---|
| a chart card's `Full note` | the card's own `GlassButton` + `Chevron` | the long caption, whole — and, on the focused card, the stage's own lead, its account and the recorder's sentences |
| a step-that-will-not-run card's `Full note` | the same | the whole declared reason, and what the step would answer |
| the record drawer's bar | `Chrome.tsx · RecordDrawer` | everything below: the acts of every stage, the four record panels, the recorder's account, the dashboard's own words, the omissions, and the page's own credit and provenance |
| the panels inside it | `shape="card"` | the library's own `CommitLog` / `GapsPanel` / `Sheet`, untouched |

**The record is a drawer and not a region below a fold**, because the page may not scroll to be operated. Its presence is visible without scrolling anything (the shut bar names what is inside it, with counts), reaching it is one press, it opens OVER the charts so the instrument does not re-lay-out under a reader, and **the drawer scrolls, not the page**. It is written FIRST in the markup and drawn LAST: `tests/prot-cursor.smoke.test.ts` opens `[aria-expanded="false"]` blindly to reach an act's seek control, so the first thing it meets has to be this bar and not a `Full note` the open panel would cover.

`tests/prot-tail.test.tsx` presses the bar and reads every folded sentence back.

## A number is Mono, the words round it are Sans

`Chrome.tsx · Count`. One component, so no title spells it differently — the record panels' counts and the drawer's own bar agree by construction.

## The three library parts that lose a host's tokens, and the door back in

`SelectionChips`, `SavedSelections` and `Sheet` each render `class="vzf …"` on themselves. That re-declares the library's own defaults ON that element, and a declaration on an element beats one inherited from an ancestor — so the bridge in `theme.css` stops at their boundary. The way back in is the library's own `className` prop: the composition passes `className="pw-scope"`, the bridge rule matches `.vzf.pw-scope`, and the tokens reach inside. Never a selector into their markup. (Reported as a finding.)

The same bridge sets `--vzf-text-scale: 0.85`, the library's own density hook, because its root rule is `font-size: calc(15px * var(--vzf-text-scale))` and those three parts would otherwise render a third larger than everything around them.

## The 3D well's ground has two writers, and the canvas wins

`theme.css · --pw-viewer-bg` paints the well; `tokens.ts · VIEWER_BG` is the same value resolved in TypeScript and handed to Mol\* as a `Color` (`web/src/molstarViewer.ts`), which clears its canvas over the whole well. They cannot disagree — one value, and the theme test pins the TypeScript copy to the stylesheet. The well shows through only before WebGL has painted and in the case where it never does, where it is the ground the renderer's own refusal sentence is read on. The molecule's own colours are the paint's and are untouched.

## The one place two copies of a value exist, and the pin that keeps them one

The library's charts take a categorical colour through a **function** (`colorOf`), not through a stylesheet, so the two chain hues have to exist in TypeScript as well as in CSS. `tokens.ts` · `CHAIN_INK` carries the same bytes `theme.css` carries, for an environment with no stylesheet, and `tests/prot-theme.test.ts` **parses the stylesheet and fails when the two disagree**. The stylesheet is the owner; the copy is pinned, never trusted.
