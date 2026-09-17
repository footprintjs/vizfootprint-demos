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

## The one place two copies of a value exist, and the pin that keeps them one

The library's charts take a categorical colour through a **function** (`colorOf`), not through a stylesheet, so the two chain hues have to exist in TypeScript as well as in CSS. `tokens.ts` · `CHAIN_INK` carries the same bytes `theme.css` carries, for an environment with no stylesheet, and `tests/prot-theme.test.ts` **parses the stylesheet and fails when the two disagree**. The stylesheet is the owner; the copy is pinned, never trusted.
