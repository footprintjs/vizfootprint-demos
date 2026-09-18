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
| the focus | 906×322 | draws, with its axes — 2.8 : 1, where the design drew it at 3.4 : 1. It was 906×278 until the card's face was cleared, which handed 44px straight to the picture |
| conservation run (strip) | 465×104 | draws 162 marks, **no axis chrome** — 162 and not 185, because 23 residues have no column in their family's alignment and the line stops rather than dipping to zero |
| cross-chain bars (strip) | 465×104 | draws 185 bars, **no axis chrome** |
| backbone angles (column) | 282×125 | draws 181 dots over a **56px band**, no axis chrome. At 1440 it is 175px and draws its axes: same rule, two answers |
| the contact table | 282×125 | its own rows, its own scroll |
| the 3D view | 282×73 | **says it instead.** Measured at 282×114 its canvas was 282×67 and the well was EMPTY: it is the one pane whose content is a canvas and not marks, it cannot show a crossfilter by density, and a camera cannot be fitted to that aspect. So the pane says the viewer draws in the focus and a press puts it there (906×282 with the camera fitted) |
| the two blocked steps | one card, 2 rows | nothing to filter |

**The strip holds THREE wide tiles now and not two**, because the conservation stage landed a run of its own (`src/prot/analyses.ts`): each wide pane went from 940px to 465px and kept its height, its marks and its band, which `tests/prot-viewport.smoke.test.ts` measures at both budgets. Nothing about the layout was re-chosen for it — `charts.ts · shapeOfView` reads the def's own `chartKind` and a `line` wants width, so the pane went where the rule already said it would.

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
| the **focus row**'s height | 289 | `AXIS_ROOM` (170) plus the focused card's own chrome (119). The focus is the one pane that KEEPS its axis labels, and the labels are also the encoding pickers — a focus that dropped them would take this page's only re-encode control off the screen |

**The mark floor is one clamp above the library's own.** `vizfootprint-ui · framePlotBox` clamps: a frame shorter than its own margin draws an empty box, so `pad.t + pad.b` is where the LIBRARY says there is no plot left, and the disaster recorded above was five pixels past it (a 67px frame under `VizLine`'s 62px margin — 185 dots reported, a 5px band, nothing visible). So the floor asks the marks to get **half the pane's own margin back as plot**: `(pad.t + pad.b) × 1.5`, which at `framePad(['line','bar','point'])` (20 above, 48 below) is **102px of pane for 34px of band**. It refuses the pane that was broken, accepts both panes this page measures as honest (the strip's 104px frame drawing 185 bars, the column's 125px drawing 181 dots over a 56px band), and sits BELOW `AXIS_ROOM` — which is the same question asked about the LABELS. Between the two a pane draws its marks and drops its labels, which is what ships.

`framePad` is the library's own function, so **the floor moves if the library's chart margin ever does**, and `tests/prot-dividers.test.tsx` pins the value it returns: a change there fails a test rather than quietly moving a floor.

**A stop is a reason, not an error.** The page says so in its own voice, beside the divider, only while it is parked there (`charts.ts · stopSentence`): *"That is as far as it goes. The panes on the right are at the width where a scatter still reads as a shape, and narrower they would stop being able to show a selection — which is what this layout is for."*

**And the measurement is checked where it counts.** `tests/prot-dividers.smoke.test.ts` pushes each divider all the way to each stop in a real browser at 1280×800 and asserts the marks, their BAND, and that the page height is still exactly the viewport — then makes **a pick in a tile with the divider at its stop and watches the focus's marks come down.** A layout test alone would not have caught the loss of the thing the floor exists to protect.

### The gesture, and why it is a control

A real `role="separator"` (`Chrome.tsx · RegionDivider`), focusable, with `aria-orientation` and `aria-valuenow`/`min`/`max` about the FOCUS side, and an accessible name that says which two regions it divides. **Pointer** events with the pointer CAPTURED, so a trackpad and a touch screen both work and a fast drag that leaves the 10px track does not lose the gesture; `touch-action: none` so a touch drag is not read as a scroll. The **arrow keys** move it by the divider's own width (ten of them with `Shift`), `Home` and `End` go to its two stops, and `Enter` — or a double-click — puts it back where the page had it. A mouse-only resize is not a control, and a resize with no way back is a trap. The visible rule is 2px and the **target is the whole track**. There is **no transition on any of it, in any case**: a divider that eases is a divider that lags, so `prefers-reduced-motion` has nothing to turn off here. The line is `--pw-rule-divider` at rest and `--pw-accent` while it is hovered, focused or held — the same pair every other control on this desk uses, and not a literal anywhere.

### Where the state lives, and what it is not

**A drag is a layout preference, not an analytical act.** It lands no commit, appears nowhere on the log, and nothing in the session's account of itself mentions it — the browser test asserts the record bar's own counts are identical before and after three gestures. So it is remembered in **`localStorage`, in this browser only** (`charts.ts · SPLIT_STORAGE_KEY`), wrapped in try/catch on both read and write: a private window, cleared site data or a preview costs the memory and nothing else. It is named in `protDesk.tsx · NotHere`, where every other omission is.

Two fractions are stored, each the SATELLITE side's share of its own axis, and **they are clamped on read as well as on write** — `parseSplit` refuses a share outside `(0, 1)` without needing a region, and `clampShare` is asked on *every render* against the CURRENT window, so a fraction written at 1,920px cannot reproduce the broken layout when it is read into a 700px one. A window too small to give both sides their floor falls back to the page's own arrangement and **keeps the reader's preference**, which comes back when the window grows.

`null` means *where the page put it*, and the default track is the page's own expression (`columnTracks(null)` IS `clamp(16rem, 22vw, 22.5rem)`, spelled from `COLUMN_CLAMP`, the one owner of those numbers). A default expressed as a fraction would have been a second, drifting copy of `22vw` — and this way the page at rest is unchanged to the pixel: the divider's 10px track is the ten pixels the grid's `gap` used to be, and `tests/prot-viewport.smoke.test.ts` measures the same 940×104 strip and the same 282×125 column pane it always did. (The FOCUS pane is 906×322 rather than 906×278 now, and that is the card's face being cleared rather than the divider: the two sentences that came off it were 44px of chrome, and the picture took every pixel.)

### The layers held, and one thing to know about where the code sits

The divider component is presentational — props in, markup out; it reports the POINTER'S OWN COORDINATE rather than a fraction, because a component that computed one would have to know the region it divides and would stop being able to move into `vizfootprint-ui`. The clamping rule is a pure function of numbers, tested without a DOM. The tokens are the theme's. `protDesk.tsx` wires them.

The one thing that is not obvious: those pieces landed in **`charts.ts` and `Chrome.tsx` rather than in files of their own.** `tests/prot-layers.test.ts` asserts the folder's MANIFEST by name, so that a module added here cannot slip past the four rules by being classified as something nobody checks — and a sixth rule module would have meant editing that suite, which this packet was asked to leave alone. The functions belong to the job `charts.ts` already has (`splitByFocus`, `shapeOfView`, `byPlanStep`: **where each picture goes**), so they sit beside it. Both new pieces are judged by the four rules exactly as everything else in the folder is.

### Named, not fixed: the focus card's own chrome grows when the card is narrow

`CARD_CHROME` (**119px**, and 163px before the card's face was cleared) is measured at the width the page ships — a 441px card holding a 906×322 picture at 1280×800, a 516px card holding 1031×397 at 1440×900, identically. **The floor followed it without anybody re-choosing a number**, from 333 to 289, which is the discipline working: the floor is folded from the constant, so clearing the face moved the stop too.

It is still **not** constant across widths: at the focus column's own floor (360px) the card's title, the `Full note` control and the Mono footer wrap, and they take **172px** (it was 257px with two more sentences on the face). So with BOTH boundaries pushed to their stops at once the focus card is 360×289 and its own picture is 326×**117**.

**And that corner is no longer the broken one it was.** The same measurement used to read 326×**76** — *under* the mark floor a satellite is held to — and 117px clears the 102px floor with room to spare. The face being cleared fixed it; it was never fixed by moving a floor.

Measured and printed rather than hidden (`tests/prot-dividers.smoke.test.ts` · *holds BOTH boundaries at once*), and left as it is, because:

* the law this packet is about is the SATELLITES', and it holds at both stops together — every pane that drew still draws its marks over the band the floor promises, and **a pick in a tile still takes the focus's marks down** with the region squeezed from two sides. The test asserts all of it;
* the focus's own stop promises that it is **not smaller than a tile**, and at 360×289 it is not;
* and the floor **must** be folded from a constant rather than from the real chrome, which is the interesting half. The library does hand the number over — `ChartFrame`'s child is `(size) => ReactNode`, so the composition could capture the picture's box on every measure and subtract. What it could not then do is USE it as a floor: the card's chrome depends on the very box the floor constrains, so a floor derived from it is a control loop — squeeze the row, the chrome wraps and grows, the floor rises, the clamp pushes the row back, the chrome unwraps. **A floor must be folded from something the floor does not move**, and the card's own chrome is not that.

**The library finding, then, is about the CARD and not about the measurement:** a card whose chrome REFLOWS with its width cannot carry a floor expressed on its picture. A card whose chrome is constant in height at every width can be given a floor, and one whose chrome grows by 53px between 906px and 360px cannot. The face being cleared cut that growth from 94px to 53px and took the corner above the mark floor, which is the same answer arrived at from the other side: **the way to make a floor hold is to stop the chrome moving, not to raise the floor.**

Raising the row's floor to the narrow chrome unconditionally was the other alternative, and it stays rejected with its number: it would make the focus row's floor 342px, taking room off the row divider at every width to fix one corner that is no longer broken.

### One measurement worth knowing

**The bottom strip ships about two pixels above its own floor.** At 1280×800 the strip band is 150px and its floor is 148px, so the horizontal divider can give the strip a great deal more room (up to **302px**, where the focus reaches its own stop — it was 258px before the card's face was cleared dropped the focus row's floor by 44px) and essentially none less. That is not a flaw in the divider — it is what *the reclaimed height goes to the tiles* already spent. The row divider is, in practice, a one-way control at this budget, and a reader who drags it down meets the stop sentence almost at once.

## A STEP THAT WILL NOT RUN GETS A CARD, and the reason is inside it

> for not-available, show the widget and tell inside it a text to tell why it's not there

So the reason is read at the size and in the position of the thing it is about. **In the right column the three of them share ONE card of three rows** (`ChartCard.tsx · BlockedGroup`): as three separate cards they spent 177px of a 583px column on three sentences — more than the two real charts got between them — and the reclaimed height went to the drawings. Each row keeps its tag, its name and its reason's first clause verbatim, and each row is its own control opening its own card. Stages 5 and 6 declare no views at all, so their card has **no chart and no frame pretending to be one** — an empty axis would be the lie this desk exists to avoid. The card carries the kind of blocked, the reason's own first clause (`panel.ts · firstClause`) and the declared sentence; the whole paragraph is behind the same `Full note` press every other card has.

## THE BAR MEANS FOCUS. `aria-current` MEANS FOCUS. THE CURSOR IS A DIFFERENT FACT.

Measured in a real browser at 1280×800: pressing **Hot Spot Prediction** moved the focused pane to `stage:hotspots` and left `aria-current` and the 3px accent bar under stage 3. The press worked, the screen changed, and the page held two ideas of *where you are* that disagreed — because the mark followed the CURSOR, and a blocked stage deliberately does not move it.

**The stepper is this page's navigation, and a control that does not visibly respond to being pressed is broken however correct its internals.** So the ruling, and it is three rules rather than one:

| the fact | who says it | where |
|---|---|---|
| **which stage you are looking at** | the stepper's 3px bar and `aria-current="step"`, for all six kinds — landed, the step that landed at the root, and all three kinds of blocked | `Stepper.tsx` · `StepView.focused`, fed by `steps.ts` · `stepViews` from `protDesk.tsx` · `focusedStage` |
| **where the cursor is standing** | the header's commit line, unchanged and visible through every press | `protDesk.tsx` — the header's `at` slot, off `protRows.ts` · `ResiduesNow.cursor` |
| **that those two have parted company** | one line on the FOCUSED card, below the picture with the figures and the refusal | `panel.ts` · `focusVsCursor` → `ChartCard.tsx` · `cursorElsewhere` |

```
You are looking at stage 5, Hot Spot Prediction — the cursor is standing in
stage 3, Structure Analysis, and every picture here is drawn where the cursor is.
```

**The third line is DERIVED from the two facts and knows nothing about a button.** That is the whole of its correctness: it is right after a window resize, after a reload, after a rail tile is promoted, and after a seek from the record drawer — four routes into one state. `tests/prot-focus.smoke.test.ts` proves it by reaching the disagreeing state through the drawer, with no press on the stepper at all, and finding the same sentence. When the two agree there is no row: an absence is absent.

**And `focusedStage` is derived too** — a blocked step's own card when one is promoted into the slot, otherwise the stage that owns the picture that is. Never a memory of which control was last pressed.

## A CARD'S FACE IS A TITLE, A PICTURE AND ONE LINE OF FIGURES

Two sentences used to stand above every picture and both are gone from the face — *not deleted*, moved behind the card's own `Full note`, which `ChartCard.tsx` now renders itself so no caller can forget:

```
How to read: a scatter with phi on x, psi on y     ← the LIBRARY's derived prose
STAGE 1  landed by the parse, before this record starts    ← engine vocabulary
```

The author's argument, and it is right: **a scientist reading a Ramachandran plot does not care about stage 1 or commits**, and a *how to read* line that describes the ENCODING tells a reader nothing the two axis labels do not. (That second half is a finding about derived prose, reported: the library is deriving the wrong kind of sentence for that slot.)

What stays below the picture is the RECORD, and it stays: the stage's own numbers, its refusal, the focus-and-cursor line, and the Mono footer of counts. **It is the prose above the picture that went, never the figures below it.** A card whose picture has no long caption still gets a `Full note` control (`ChartCard.tsx` · `hasNote`) — otherwise the move off the face would be a deletion for that card.

### And the stage attribution came off the footer with them — ONE OWNER PER QUESTION

`ownerLine` folded `Stage 3 · Structure Analysis` into the right of every footer, and it is gone (the note where it was, in `charts.ts`, says so). The question is *which stage produced the picture I am looking at*, and **once the bar follows the focus the stepper answers it** — for every chart, because pressing any tile promotes it and moves the bar. The fact stopped being printed eight times and became one press away.

**The dependency is the whole risk and the order was not optional:** defect 1 first, verified in a browser for all six kinds, and only then the attribution off. Until the bar followed the focus the footer was the ONLY place a reader learned which stage a picture came from, and cutting it first would have put the fact nowhere — the same failure as two cuts each justified by the other place. Before cutting it, every fact in it was traced: the stage is on the stepper and at the lead of the card's note, and step 1's `no act, no commit` is in that note's account, in its quiet line and in the accessible name of its own stepper control (`steps.ts` · `focusLabelOf`). What a reader loses AT A GLANCE — a small pane labelling its own stage while another stage is focused — is named in `protDesk.tsx` · `NotHere`.

### …and that right-hand slot now carries the thing the whole desk is for

The footer's right half was empty from the moment the attribution left it, and it is where **what another pane's selection did to this picture** is read. It is a count, it is the same Mono register, and it costs a layout with no spare vertical space nothing at all. Which half clips has not changed and is still the law: the LEFT half never shortens, because the counts are the only surviving copy of themselves; the right one ellipsizes, and what it loses that way is the source's declared name, which is a press away in the note.

## A PICTURE NARROWED BY A CLAUSE FROM ELSEWHERE SAYS SO — NAMES WHERE IT CAME FROM, AND COUNTS WHAT IT LOST

> *"All the charts have to be connected — that's very critical. Still now I don't see [the] connection."*

The author's most-repeated complaint of the project, said four times — and they were right about what they SAW while the machinery underneath was working the whole time. Measured: a pick on one bar takes the focused chart from **185 marks to 1 in 22 ms** and dims **180 of 181** in the backbone-angle pane, with nothing scrolled. The crossfilter works. What no pane ever did was **say that it had been narrowed by something the reader did somewhere else** — and **a connection nobody can see is the same as no connection.** Invisible is indistinguishable from absent.

So every picture on this desk now says it, in one line, in the register the footers already use, readable with no gesture. **Four states, and the second one is the load-bearing one:**

| state | the sentence in the focus slot | in a tile |
|---|---|---|
| **narrowed** — the clause reached it and cut it | `1 of 181 dots in force — narrowed by Backbone angles, residue by residue` | `1 of 181 dots in force — narrowed from another pane` |
| **nothing-cut** — it reached it and cut NOTHING | `181 of 181 dots in force — the selection in How much of each residue the solvent can reach filtered nothing here` | `181 of 181 dots in force — filtered nothing here` |
| **cannot be judged here** — the clause cannot be judged on these rows at all | `3 of 3 rows still drawn — the selection in Contacts across the interface, residue by residue cannot be judged here: these rows carry no "residue_key"` | `3 of 3 rows still drawn — the selection elsewhere cannot be judged here` |
| **nothing selected** | no line at all | no line at all |

**State 2 is the one that was silent, and silence there is the bug.** A pane that says nothing while a clause is in force reads as a pane that is not connected — which is the complaint, exactly. So a clause that filtered nothing says so, in the library's own words (`vizfootprint-ui` · `narrowedSaid`: *filtered nothing here*), quoted rather than re-worded, so one fact reads one way wherever it is read.

**The pane the clause came FROM stays silent**, and that is not an omission: it is the source, it already shows its own selection, and the library's fold already addresses it (`RenderSelection.selfClauseId`). The source is the ONE pane with no line while a clause is live, and the browser test asserts exactly that.

### Every part of every sentence is read off a field — and the counts are the marks the picture really drew

| the part | where it is read |
|---|---|
| the marks in force | counted by the CELL, with the library's own predicate, off the very rows it handed its chart (`protCells.tsx` · the `structureInForce` / `dotsInForce` block) |
| which predicate | whichever one that chart folds by: `keepPredicate` for the 3D paint and the run, `brightPredicate` for the scatter (it dims rather than drops), and for the bars the rows they are summed from |
| the total at rest | the same fold with nothing applied (`barsAtRest`, `runAtRest`) |
| the source's name | `SessionViewState.views[].label` through `DeskProjection.label` — the DECLARED name, never an address and never invented |
| whether it could be judged here | the library's law, asked the library's way: does any row this pane holds CARRY the clause's column (`selection.ts` · `judgeable`) — and the SESSION's own word wins where it has one (`SelectionClauseView.narrowed`, off the overview's `narrowedFor`) |
| why it could not | the session's `narrowed.reason`, else a DECLINED default edge's own sentence (`links.declined`, the map's `unreachableWords`), else the column the clause names |
| whether anything is selected at all | `SessionViewState.selections` — the desk-wide fact, because a pane's own fold cannot tell *nothing is selected* from *a clause could not reach here*, and those are two different sentences |

The fold is `protCells.tsx` · `narrowingOf` (the facts) and `charts.ts` · `narrowingSaid` (the words), and the split is the folder's own rule: **the cell is what knows how many marks it drew**, the rules layer says it in the page's voice. `tests/prot-connection.test.tsx` asserts all four states over a REAL session with every number folded from the committed entry's own rows, and `tests/prot-crossfilter.smoke.test.ts` does the half that matters most — in a real browser at 1280×800, it picks a bar and asserts **the number in each pane's sentence equals the marks that pane actually drew** (bright dots in the scatter, drawn marks in the run), then clears and asserts every line goes. That is what stops the page claiming a narrowing its picture does not show.

### The cross-chain bars now narrow, and that is a library finding as much as a fix

`VizBar` takes a `selection` and uses it for ONE thing: outlining the category its OWN clause picked. **It has no dim arm** — unlike `VizScatter`, which dims under everyone's brush but its own. So this pane sat unmoved through every pick in the desk's life, while the def declared the views crossfiltered and the page said so in a caption. The library's own law says whose job that is — the HOST owns all aggregation (a renderer declaring a transform is refused at bind) — so the host sums the rows in force, with `keepPredicate`, self clause excluded (`protCells.tsx` · `barRows`). A press on a bar still never collapses its own chart.

**The finding:** a categorical chart with no selection-driven dim leaves a host two choices — re-aggregate, or show nothing — and *nothing* is what a library that offers no dim arm gets from a host that has not thought about it. It also makes an existing claim in this folder true rather than aspirational: `reachClause`'s note says *a crossfilter that cuts 185 marks to 12 makes the pitch 71px and the clause returns null*, which could not happen while the bars never narrowed.

### And the 3D view is honest about it too — which is where the second finding is

It is the one pane whose content is a canvas: it **recolours** under a clause (`molstarRenderer.ts` · `paintOf` paints `dropped` by `keepPredicate`) rather than dimming or dropping marks, and at rail size a recolour is invisible — part of why the connection could not be seen at all. In the rail this pane is words already, so **the words carry the same narrowing sentence**; promoted, it recolours as before and its footer carries the long form.

**The finding, and this is its second consumer: a picture cannot be asked what it drew.** `BoundRenderer.update` answers `{ ok: true }` (or a typed gap) and nothing else, so a host cannot ask how many residues were repainted — the renderer writes a count into its own `role="status"` line and the host cannot read it back. The fold here is honest because it is the same predicate on the same rows, not because the renderer confirmed anything. A `RenderReport` on the way back out — marks drawn, marks dimmed, rows the renderer could not place — is the shape that would close it, and it would serve every host that wants to say what a third-party picture did.

### AND ONE MORE THING THAT MAY LIVE ON THE FACE: WHICH METHOD PRODUCED THE NUMBERS

> a reader must not be able to mistake a consensus-placed score for an HMM-placed one

The face law is *a title, a picture and one line of figures*, and everything else moved behind `Full note`. **One kind of fact earned a place back on that line: the METHOD, for a number whose value depends on a choice between two of them.**

| the card | what it says | why it is on the face |
|---|---|---|
| the conservation run | `162 of 185 residues scored · PF00545.26 + PF01337.25 · consensus-placed — the weaker method` | the score is a fact about somebody else's curated alignment, and WHERE OUR RESIDUES SIT IN IT was computed here by the worse of two methods (`src/prot/placement.ts`: pairwise alignment to a consensus, because the better one needs HMMER and a static page has nothing to run it on). The two disagree at the edges of a domain, so a reader comparing this with a published per-residue figure is comparing two different placements |
| the other four | counts only | they MEASURE something off the entry's own coordinates. There is one way to count a contact and one way to roll a probe, so there is no choice for a reader to be unaware of |

**The rule, stated so a later card can be judged by it:** a number whose value depends on which of several METHODS ran carries the method on the face, beside the counts, after them and before the narrowing sentence. A number that is a measurement carries no such clause, because an absence is absent.

**It is not a caption — it is one owner, read in three places.** `src/prot/placement.ts` · `PlacementStrategy.said` is the words and `.weaker` is the boolean a consumer branches on; `protCells.tsx` (the cell's `foot`), `panel.ts · placementSaid` (the stage's own quiet line and the lead of its note) and the act's own `honesty.notes` all read that one record. `tests/prot-conservation.test.ts` pins the clause byte for byte and `tests/prot-cells.test.tsx` pins the face.

**And the arm that is not implemented refuses BY NAME** rather than being a comment: `placeAgainstHmm()` is a real function returning the sentence a reader would see, so the next packet's whole job is replacing its body. It is named in `protDesk.tsx · NotHere` with every other omission.

### Where the line does NOT go

Not above the picture, not in a band, not in a panel, and not as a tooltip or a badge. The face law stands: **a title, a picture, one line of figures**, and the narrowing sentence is part of that one line — the footer's right half on a card, the figures' own line on a tile, after the counts. The instrument fits the window exactly and everything between the stepper and the charts is deliberately empty; a fifth band would have cost the pictures the height this packet is trying to make legible.

**One thing it deliberately does not do: announce itself.** The sentence is plain text in a line a reader is already reading, not a live region — eight panes all announcing at once on every pick would be a storm, and the library's own `SelectionChips` row already says what is selected where. Named here rather than left to be discovered.

## A MARK A READER IS MEANT TO PRESS NEEDS A POINTER-SIZED TARGET

The interaction grammar was declared, tested and unreachable. Measured: the cross-chain bar tile draws **185 bars**, the strip gives them a **922px** pane, `framePad` takes 70 of it, so a band is **4.6px** and a bar is **3.5px** — and `locator.click()` refused, reporting the target as not stable. Worse, and the sharper half: **167 of those 185 residues touch no other chain**, so their count is a real ZERO, and an SVG rect of zero height has no area to press at all.

**What the library offers a host here is nothing.** Looked for by name in `vizfootprint-ui`: a hit area wider than the mark, a minimum mark width, a nearest-mark pick. `VizBar`'s clickable element IS the bar (`x = band*0.12`, `width = band*0.76`, `height =` the value); its `bandAt` pointer-to-band map is private to the drag-run and a run may only BEGIN on a bar; no prop on any chart widens a target. Reported as a finding.

**And this page may not fix it by drawing.** A bar whose width lies about its category is worse than a bar that is hard to hit, and a zero given area would be a count of nothing claiming something. So the page does the only honest thing left: **it says so, in the tile, in the tile's own voice.**

```ts
// charts.ts · reachClause — folded against the INSTRUMENT'S width, which is an
// upper bound on any pane inside it: a sentence means no pane on this page could
// give these marks a target, which is why it does not promise the focus
'185 marks in this width — too thin to press; Tab picks one'
```

| the rule | how it is kept |
|---|---|
| the floor is not a number anybody picked | `POINTER_TARGET` = 24, WCAG 2.2 SC 2.5.8 *Target Size (Minimum)* |
| the plot is not a number anybody picked | `markPitch` subtracts `framePad`'s own left and right — the library's margin, the same one the divider floors are folded from |
| the clause **corrects itself** | it is derived per render: a crossfilter that cuts 185 marks to 12 makes the pitch 71px and the clause returns `null`, with nothing to clean up |
| it promises nothing false | *press it to pick in the focus* would be a lie — at 185 marks the focus slot is 4.5px a band too. It names the keyboard, which the library already gives every bar (`role="button"`, `tabIndex`, its own accessible name) |
| it costs the picture nothing | it rides the tile's own line of FIGURES, after them, because this tile ships about two pixels above its mark floor. Numbers first, and the clause is what clips |
| the long form is never lost | the arithmetic, both reasons and the two other remedies (narrow the rows from another chart; re-encode the category to `chain`) are in the picture's own note, whole |

`tests/prot-focus.smoke.test.ts` presses a bar **with a real pointer at the mark's own coordinates** and asserts the selection landed and the residue is named — the assertion the suite could not make — and prints the measurement the clause is folded from while it does it.

## A DECLARATION THE RECORD CARRIES — AND THE ONE PROP STILL BESIDE IT

The backbone-angle plot got the two things that make it a Ramachandran plot rather than a cloud of dots in a box, and **they are not the same kind of thing**, which is the point worth keeping:

* **the crosshair is DECLARED, and now READ OFF THE FOLD.** `src/prot/def.ts` · `PROT_ENCODINGS` gives the rama entry `frame: { x: { zeroGuide: true }, y: { zeroGuide: true } }` — the axis arm of the shape, so no `mode` (the def door refuses it by name on a layerless view). `charts.ts` · `zeroGuideOf` takes **the reader's own frame** (`SessionViewState.views[].frame`) and hands it over as `ChartDomain.zeroGuide`. The record carries the ask and the record is what the picture answers to.
* **the box is still a PROP.** `protCells.tsx` · `TORSION_RANGE` is `[-180, 180]`, because φ and ψ span that BY DEFINITION and a residue at 107° drawn hard against the right edge reads as the edge of torsion space. **A prop is on no commit**, and the shortfall is announced in `protDesk.tsx` · `NotHere` the way the structure file's missing version is.

### The tripwire fired, and this is what it was for

For three releases the crosshair **could not** be read off the fold: the session served the declaration verbatim (measured, on its own `overview()`) and the reader-side mapper dropped it — `vizfootprint-ui` · `sessionView.ts` · `mapFrame` kept a channel only when it carried `mode: 'shared' | 'independent'`, and a layerless axis entry may not carry `mode` at all. So the frame arrived `{}`, this page read the def it owns, and `tests/prot-def.test.ts` pinned an assertion **on that emptiness** with a note saying it would fail the day the mapper was fixed.

**It failed, exactly as written, and the fix is the fold.** The mapper now keeps a mode-less entry that carries an axis key of its own; the assertion pins what the reader really receives, byte for byte against what the session served; `zeroGuideOf` takes a frame instead of a view id and looks nothing up; and the page reads the declaration from the RECORD rather than from a file it happens to share with the session. **A tripwire is worth more than a comment** — this is the whole argument for writing one: the workaround came out on the day it became a workaround, and nobody had to remember.

### And the numeric range can be declared now — deliberately NOT taken in this packet

The library has grown `ChannelResolution.bounds?: [number, number]` (law 14) on the shared and layerless arms, *"a fact about the quantity, not about the rows"*, with the Ramachandran named as the figure that asked for it. That is exactly `TORSION_RANGE`'s shortfall and it should replace the prop — `bounds: [-180, 180]` beside each `zeroGuide`, the `domain` read off the fold, the caption's *there is still no way to declare it* sentence rewritten, and the omission dropped from `NotHere`.

**It is not taken here, for one measured reason:** that key lives in the library's UNCOMMITTED working tree while a packet is still gating it, and **a def key the door does not know is refused at build** — declaring it against work that has not landed risks a page that does not render at all, on a desk somebody is watching. It is one packet, it touches five files and four suites, and it wants the library's commit first.

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

## A NUMBER A MODEL GAVE IS IN A REGISTER OF ITS OWN, AND IT CARRIES ITS CITATIONS

Stage 5 is the one number on this desk that nothing measured. A model was shown the facts stages 1 to 4 established and asked which residues it would call hot spots; what came back is **a recommendation, not a measurement**, and the page may never let it read as one.

It lands in the SLOT its blocked card used to occupy (`ChartCard.tsx · Recommendation`, folded by `panel.ts · hotspotCard` / `railCards`), because that shape was already right: *a step with no chart says what it has to say at the size and in the position of the thing it is about.* What changes is not the shape, it is three things inside it — and none of them is a colour nobody declared:

| the rule | how it is kept | what breaks it |
|---|---|---|
| the card says which register it is in | the tag in its corner is `a recommendation, not a measurement`, and it arrives as a **prop** from the one module that owns those words (`src/prot/hotspots.ts · HOTSPOT_TAG`) | a literal in the component; a tag that says `landed` like a measured stage's |
| **every row shows the fact ids it cited** | `RecommendationRow.cites` is not optional, and a ranking that cited nothing never reaches a screen — it was refused (`src/prot/hotspots.ts · REFUSE_CITES_NOTHING`) | a row drawn without its ids; a count of citations instead of the ids |
| a sentence somebody wrote reads as one | the reason is in `--pw-font-serif` (this page's prose face) and the ids in `--pw-font-mono` (its number face), so the two cannot be scanned as one kind of thing | putting the reason in Mono beside the counts |
| a refusal is shown, never counted | `refused` is rendered as its own list, verbatim, with the name the model gave | `3 refused` with the sentences behind a fold nobody opens |
| a disagreement is shown, resolved by nobody | `disagreements` is its own list beside the ranking, and **the ranking stays** | dropping the ranking because the judge disagreed; averaging two sources into one verdict |

**The hallucination door is the load-bearing one.** A residue the model names that this run's residue table has no row for is refused *by name, with the name it gave*:

```
the model named "Z:999" and this run's residue table has no row for it — a prediction
about a residue that is not in the evidence is refused by name, and nothing of that
ranking was landed
```

`tests/prot-hotspot-card.test.tsx` renders that sentence out of the card, and `tests/prot-hotspots.test.ts` produces it from a real run on the `mock` provider.

### The stage's columns land on `residues` like every other stage's, and that is the whole point

`hotspot_rank`, `hotspot_cites` and `hotspot_reason` go on the same table, under the same key, through the same columns channel the contacts, the surface and the conservation stages use (`src/prot/hotspots.ts · hotspotsAnalysis`). So the picks are **in the data space**, the Sheet shows them, and the card's one control puts them into the desk's live selection with a single dispatch at a view the def already declares — `interface`, whose category channel binds `residue_key`. A pick lands, the 3D view recolours, the scatter dims and the two runs narrow, **through the machinery that was already there**. No new chart kind, no new link, and the residues are the ones on the answer rather than marked from a literal.

`hotspot_cites` in the data is the `conservation_basis` precedent, and the argument is the same one: *a rank whose fact ids were only ever on a card would be a number a reader could quote with nothing behind it.*

### And the card has three states, because a reader must learn which happened

| state | what the card shows |
|---|---|
| **a ranking** | the rows, their citations, one line of figures, every refusal, every disagreement |
| **ran and answered nothing** | the stage's own sentence — unreachable, timed out, refused, malformed, cited nothing, every ranking refused — verbatim, in place of the rows (`src/prot/hotspots.ts · HotspotFailure`) |
| **nothing to ask** | the door's sentence about having **no key**, which is deliberately NOT the published build's reason: a server is standing here and has nothing to ask (`server/prot-doors.ts · chooseHotspotDriver`) |

### The published desk is untouched, and that is asserted rather than intended

`ProtDesk`'s `hotspots` prop is ABSENT on the static page, `railCards(null)` hands back `BLOCKED_CARDS` itself, and stage 5's mark still says *not on this build* with its whole measured reason behind its `Full note`. A static page cannot hold the key that would call a model — **that is the architecture and not a shortfall** — and `tests/prot-hotspot-card.test.tsx` and `tests/prot-plan.test.ts` are what stop a later edit making the Pages build claim otherwise. The served page (`web/src/protServed.tsx`, local only) is where the prop is filled.
