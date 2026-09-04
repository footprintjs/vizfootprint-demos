# web — the cockpit (layers 3, 4, 6)

The browser side of the demo: `vizfootprint-ui`'s cockpit over the
`/api/*` doors, plus the things the library does not ship yet and this
demo needed:

- **`Home.tsx` + `front.ts`** — the front door: the page you land on, and the
  rule that decides whether it may offer a way in. It reads `GET /api/summary`
  once and prints the server's own counts (90,300 cells · 15 diseases · 86
  weeks · 70 jurisdictions · 9 declared views, on today's snapshot) — not one
  of those numbers is written into the page. **The door opens in exactly one of
  its three states.** Still reading: no way in, and it says what it is waiting
  for. Ready: the figures, and one button. Nothing answering: it says so, names
  where the server should be, and still offers nothing, because a button into
  an empty room is the same lie the rest of this demo exists to refuse. The
  rule is a pure function in `front.ts` for the reason `derive.ts` is one —
  `tests/front.test.ts` holds it to all three states.

- **`GrammarPanel.tsx`** — the interaction grammar rendered from the
  declaration: verbs off the wire with the gesture that produces each here,
  per-view driver / emits / channels → bound now / drives, the wiring word,
  the absence column. The same data the agent reads through `whats_here`.
- **`JumpBox.tsx`** — "go to #34" when the timeline has ninety commits: a
  seek by number, validated against the active lineage.
- **`AnalystPanel.tsx`** — the agent as a principal: a chat whose every
  reply is read against the commit log. `frameStep` turns each tool call
  into verb · what · outcome from the call itself, never from the prose.

**A disclosure that reaches the wire and no reader is not a disclosure.** Two
of them are rendered here, both as one quiet line and nothing more. Under a
reply: the citations the door could not verify (`parseReply`'s `note`). Under
an act: the commits a `why` answer NAMED and could not honour — the library's
`CrossTierSlice.dropped`, read by `droppedOf` and put into words by
`whyDroppedNote` (`derive.ts`, law 5). Dropping those commits is the library's
law and stays; being silent about them was the defect, and it is the
saved-selection scar one layer along — a door the library served and no
interface called.

Two rules govern both lines, and they are why they read the way they do. The
reasons are **told apart**: *on another branch* means the log really holds that
commit and these words stand at a moment that never saw it; *this log does not
hold it* means the answer could not find it at all — a reader who confuses them
looks in the wrong place. And the line **offers nothing**: no repair, and no
link to the commit it names. The library refuses that citation on purpose, so
an interface that linked it would hand back exactly what the answer declined to
vouch for.

`App.tsx` feeds every chart host-side under the session's clauses — the host
sums over ONE kind of area (the kinds view's pick, else states) so a case is
never counted three times, and the trend shows regions until a kind or an
area is chosen. All of that is said in the captions, not hidden.

`main.tsx` renders the front door and mounts `App` on the click — one boolean,
no router, and deliberately not before the click, so the dashboard's own reads
(the rows, the map shapes, the state poll) do not run behind the landing page.

```
npm run web:dev     # http://localhost:5291 (proxies /api to :5290)
npm run web:build   # web/dist, served by `npm run serve`
```
