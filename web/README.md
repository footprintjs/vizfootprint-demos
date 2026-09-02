# web — the cockpit (layers 3, 4, 6)

The browser side of the demo: `vizfootprint-ui`'s cockpit over the
`/api/*` doors, plus two things the library does not ship yet and this
demo needed:

- **`GrammarPanel.tsx`** — the interaction grammar rendered from the
  declaration: verbs off the wire with the gesture that produces each here,
  per-view driver / emits / channels → bound now / drives, the wiring word,
  the absence column. The same data the agent reads through `whats_here`.
- **`JumpBox.tsx`** — "go to #34" when the timeline has ninety commits: a
  seek by number, validated against the active lineage.
- **`AnalystPanel.tsx`** — the agent as a principal: a chat whose every
  reply is read against the commit log. `frameStep` turns each tool call
  into verb · what · outcome from the call itself, never from the prose.

`App.tsx` feeds every chart host-side under the session's clauses — the host
sums over ONE kind of area (the kinds view's pick, else states) so a case is
never counted three times, and the trend shows regions until a kind or an
area is chosen. All of that is said in the captions, not hidden.

```
npm run web:dev     # http://localhost:5291 (proxies /api to :5290)
npm run web:build   # web/dist, served by `npm run serve`
```
