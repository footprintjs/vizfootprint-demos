# `web/src/workbench/` — the protein desk's four layers

> Design this space as theme separate, components separate, business logic, data logic separate. Don't tangle these — make it reusable.

That is the author's ruling and it is the shape of this folder, not a preference. Four layers, each in its own files, each with one job — and a test that fails when one reaches into another (`tests/prot-layers.test.ts`).

| layer | files here | one job | may import |
|---|---|---|---|
| 1 · **theme** | `theme.css`, `tokens.ts` | every colour, radius, shadow, blur and font family, once | `tokens.ts`: `react`, nothing else |
| 2 · **components** | `Chrome.tsx`, `Stepper.tsx`, `StagePanel.tsx`, `ChartCard.tsx`, `Search.tsx` | **props in, markup out** | `react` + sibling components |
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
   // bands.ts — the facts strip
   { id: 'contacts', parts: [{ value: num(pairs.rows), after: 'non-covalent contacts,' }, { value: num(pairs.crossing), after: 'of them cross-chain' }] }
   ```

   A fact whose source has not landed is **absent** from the strip — never a zero and never a dash.

3. **No component reaches a chart's internals.** The pictures are `vizfootprint-ui`'s, themed through the library's own hooks: its `--vzf-*` custom properties (the one bridge rule in `theme.css`) and the `colorOf` a chart accepts. There is not one descendant selector under a `.vzf-*` class in this folder, and `tests/prot-theme.test.ts` asserts that.

4. **Nothing is dropped to make room.** The redesign moved every long caption behind a `Full note` disclosure — it did not shorten one. `tests/prot-cards.test.tsx` opens the disclosure and asserts the note's own sentences are in the DOM.

## One disclosure, everywhere something folds

`Chrome.tsx · Disclosure` is the ONLY fold shape on this desk. It draws a `<button aria-expanded>` plus `Chevron` and reveals its body below — never `<details>`, because a `<summary>` cannot carry the glass button's layout and the page used to fold three things three different ways.

| where | shape | what it holds |
|---|---|---|
| a chart card's `Full note` | the card's own `GlassButton` + `Chevron` | the long caption, whole |
| the stage panel's `More about where you are standing` | `shape="bare"` | the dashboard's declared summary, this desk's claim about itself, the commit the pictures are drawn at, and the measured reason a declared stage cannot run here |
| the four record panels, the recorder's account, the list of omissions | `shape="card"` | the library's own `CommitLog` / `GapsPanel` / `Sheet`, untouched |

**The panel shows three or four sentences and a `<dl>`, and nothing else.** That is the author's ruling — *less words shown, one panel, about the stage* — and the only things allowed past it are a REFUSAL (never behind a press) and ONE SHORT LINE naming the stage this build cannot run at all. That line is the measured reason's own first clause (`panel.ts · firstClause`, cut at a punctuation boundary, re-worded nowhere); the paragraph is in the fold. An announcement does not have to be a paragraph to be an announcement.

`tests/prot-panel.test.tsx` holds the panel under 150 visible words and presses the fold to read every folded sentence back. `tests/prot-tail.test.tsx` does the same for the foot of the page.

## A number is Mono, the words round it are Sans

`Chrome.tsx · Count`. One component, so no title spells it differently — the four record panels' counts and the facts strip agree by construction.

## The three library parts that lose a host's tokens, and the door back in

`SelectionChips`, `SavedSelections` and `Sheet` each render `class="vzf …"` on themselves. That re-declares the library's own defaults ON that element, and a declaration on an element beats one inherited from an ancestor — so the bridge in `theme.css` stops at their boundary. The way back in is the library's own `className` prop: the composition passes `className="pw-scope"`, the bridge rule matches `.vzf.pw-scope`, and the tokens reach inside. Never a selector into their markup. (Reported as a finding.)

The same bridge sets `--vzf-text-scale: 0.85`, the library's own density hook, because its root rule is `font-size: calc(15px * var(--vzf-text-scale))` and those three parts would otherwise render a third larger than everything around them.

## The 3D well's ground has two writers, and the canvas wins

`theme.css · --pw-viewer-bg` paints the well; `tokens.ts · VIEWER_BG` is the same value resolved in TypeScript and handed to Mol\* as a `Color` (`web/src/molstarViewer.ts`), which clears its canvas over the whole well. They cannot disagree — one value, and the theme test pins the TypeScript copy to the stylesheet. The well shows through only before WebGL has painted and in the case where it never does, where it is the ground the renderer's own refusal sentence is read on. The molecule's own colours are the paint's and are untouched.

## The one place two copies of a value exist, and the pin that keeps them one

The library's charts take a categorical colour through a **function** (`colorOf`), not through a stylesheet, so the two chain hues have to exist in TypeScript as well as in CSS. `tokens.ts` · `CHAIN_INK` carries the same bytes `theme.css` carries, for an environment with no stylesheet, and `tests/prot-theme.test.ts` **parses the stylesheet and fails when the two disagree**. The stylesheet is the owner; the copy is pinned, never trusted.
