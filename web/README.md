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

  Beside the dashboard's own button there is a second, quieter door: **Make
  your own**, into `web/make/` — the studio's wizard (`vizfootprint-studio/make`)
  over a file the reader brings. It is offered in **all three** states, and that
  is the point rather than an oversight: the dashboard's door depends on the
  server because the dashboard reads it, and the wizard depends on nothing at
  all. A page that hid it while the server was down would be withholding the one
  thing that still worked.

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

- **`make/`** — the wizard's page, and nothing else: `<Make />`, with no
  configuration, because `vizfootprint-studio/make` needs nothing from this
  demo. The entry has two roles and does not choose between them — a page
  carrying a payload block is a desk somebody PUBLISHED, so it opens that; a
  page carrying none is the wizard. That is what makes publishing work: the
  file the wizard hands over is a copy of the page it is running in.

  Which is why its real artifact is `npm run make:page` — one file, everything
  inlined. `web:build` builds the same entry as an ordinary multi-file page so
  the front door's link resolves in a built app, and publishing from THAT page
  is refused in a sentence naming the assets it found. That refusal is the
  honest answer, not a fault: a copy of a page whose code lives beside it would
  open blank.

```
npm run web:dev     # http://localhost:5291 (proxies /api to :5290); /make/index.html is the wizard
npm run web:build   # web/dist — the dashboard and the wizard, two pages
npm run make:page   # dist/make/index.html — the wizard as ONE file, the one it can publish from
```

## `site/` — the static build

Three pages that stand alone: `index.html` offers the two demos, and
`nndss/` and `grid/` are the two desks with no server behind them. They are
not `src/App.tsx` and `src/GridApp.tsx` with parts switched off — those hosts
are defined by their six and two endpoints, and a static host has none. They
are the smaller host a page with no process can honestly be, over the same
definition, the same session builder, the same rows payload and the same
charts.

### The law: one word changes, and it is the `via`

A served desk declares its tables `via: 'file'`; a static page declares the
same tables `via: 'http'` at the committed CSVs under the site's base. The
ETL, the definition, the layout acts and the cells are the same modules.

```ts
const { tables, graph } = await loadNndssOverHttp(siteBase());   // src/nndss/http.ts
const surface = await openNndssSurfaceAsync(tables, graph);      // the server's own builder
<Desk view={createSessionView(sessionSource(surface.session))} … />
```

### The law: the session is in the tab, so say so

A static desk opens with `WhatIsMissing` — the analyst, the durable log and
the refresh, each named with what a reader would have had. A page that quietly
dropped a feature would teach a reader it never existed.

```tsx
return (<><WhatIsMissing /><StaticNndssDesk booted={state.booted} /></>);
```

### The law: the base is a knob, and the data is copied, never inlined

`SITE_BASE` sets where the site is mounted (`/vizfootprint-demo/` by default,
the GitHub Pages path); `boot.tsx` resolves it against the page's location to
get the absolute URL the http carrier requires. The 17.5 MB of tables are copied
beside the pages by the build — the single-file story page inlines its data
and this one must not, which is the case the library's story-page ceiling
tells a host to reach for `via: 'http'` for.

```
npm run site:build                # /vizfootprint-demo/
SITE_BASE=/ npm run site:build    # /
```
