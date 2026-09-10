# src/exo — the NASA Exoplanet Archive, shaped for vizfootprint

Layers 1–4 for the third demo: the committed slice in
[`data/exo/`](../../data/exo/README.md), three plain tables out, a dashboard
declared over them, and a live session that lands **five acts** before anything
is drawn. Nothing invented, and — the point of this demo — **nothing derived in
the data**.

| module | one job | runs in a browser? |
|---|---|---|
| `absence.ts` | the archive's value/limit-flag pair → four words, plus the one gap it cannot declare (`CARRIES_NOTE`) | yes |
| `names.ts` | the HTML anchor a reference ships inside → key, label, link; and the two typed-in gloss tables | yes |
| `etl.ts` | the parse: two CSVs → `measurements`, `planets`, `references` | yes |
| `slice.ts` | which rows and columns are committed, what that loses, and the provenance object | yes |
| `def.ts` | layers 2–4 as data: three tables with their silences, three relations, the views, the FIVE acts, the links, the house rules, the prose | yes |
| `session.ts` | one live session over the def: one refused gesture, then the five acts landed in dependency order | yes |
| `surface.ts` | the same session with the committed CSVs as its default | **no — node only** |
| `rows.ts` | the one payload a page draws from | yes |
| `http.ts` | the same two files `via: 'http'`, for a page with no disk | yes |
| `cards.ts` | the demo's one surface, as a card the readers fill in | yes |
| `snapshot.ts` | the disk: read the committed slice, read the fetch's record | **no — node only** |

`snapshot.ts` is separate for the reason `src/grid/snapshot.ts` gives: a module
that pulls a runtime into every importer is a module every importer pays for,
and the static page runs this ETL in the browser over CSVs it fetched.

## The three tables

- **`measurements`** — the default table, one row per **published measurement**:
  a planet as ONE paper reported it. 20,598 rows over 6,360 planets, so a planet
  has as many rows as papers that measured it (TrES-2 b has 26; 1,900 planets
  have exactly one). Each row carries the archive's own words for what it could
  and could not measure, and the raw reference anchor as the receipt.
- **`planets`** — one row per planet, the archive's own **composite**: one
  number per parameter, each with a `*_reflink` saying where that number came
  from. For 1,608 radii and 2,977 masses the answer is *the archive itself*.
- **`references`** — one row per reference either table points at, keyed by the
  archive's own key. 2,403 of them: 2,399 publications and 4 archive-internal
  sources.

## One key, chosen by the data

A reference arrives as an HTML anchor, and **the anchor is not a key**: over the
slice the archive spells 2,375 references with 2,685 distinct anchor strings —
`JOHNSON_ET_AL__2010` appears four ways. Keying on the anchor would count one
paper up to four times, and "how many publications measured this planet" is
exactly what view 2 asks. So the key is `ref`, the `refstr` the archive itself
publishes inside the anchor, and the raw anchor rides along as `pl_refname`.

## The five acts, and why they are acts

| act | what it does |
|---|---|
| `radiiPerPlanet` | an **aggregate**: one row per planet — how many radii, how many papers, the smallest and the largest — over the rows whose radius is a *measurement* (`where radius_state is "present"`, on the record) |
| `radiusSpread` | a **derive** on that minted table: `r_max − r_min` |
| `radiusDisagrees` | a **derive** on the same table: whether that width is above zero (a boolean, which arithmetic text cannot spell and a declared tree can) |
| `acceptedRadius` | a **bring-over**: the composite's accepted radius, carried across the declared relation onto every measurement row as `pl_name_pl_rade` |
| `radiusDelta` | a **derive** on `measurements`: this publication's radius minus the accepted one — the disagreement per publication, as a column the sheet shows and the export carries |

None of those five numbers is in the committed CSVs or in the ETL. `session.ts`
dispatches them in dependency order before the first request is served, so every
figure on screen has an act, a cause and a commit behind it. **A number that is
not on the trace is a number a replay cannot promise** — the same rule the grid
demo's two layout acts follow.

They are a CHAIN: the two derives read the table the aggregate mints, and the
delta reads the column the bring-over carries. A derive over a missing column
THROWS rather than refusing, so `landExoActs` stops at the first refusal and
reports it instead of turning one refusal into an uncaught error out of a boot.

## The absence vocabulary, and the one thing it cannot declare

The archive says three things with two columns — a value and a limit flag:

| value | flag | our word |
|---|---|---|
| 7.1 | 0 | `present` |
| 7.1 | ±1 | `limit` — an upper or lower **bound**, which carries its number |
| — | — | `not-measured` |
| — | ±1 | `unknown` — never seen in the slice, never guessed |

`limit` is the interesting one: a bound is not a measurement AND not a silence.
The library has a word for exactly that — `AbsenceDecl.carries` — and **this def
cannot declare it**, because `AbsenceDecl` is per TABLE and speaks for the ROW,
while these rows carry three parameters with three separate silences. So both
state columns are declared absence words *per column* (`role: 'absence'`, which
keeps a state off every magnitude channel) and every act that must not read a
bound says so in its own record. The gap is written down in `absence.ts` ·
`CARRIES_NOTE`, not worked around in silence: **there is no per-column absence
declaration**, and a table like this one needs three.

## The scatter is a log–log figure, and there is no window any more

Mass against radius is the diagram this field publishes, and it has been log–log
since it had four points on it: masses in this slice run 0.02 to 9,535 Earth
masses and radii 0.3 to 87, so a linear frame is one picture of Jupiter and a
smudge where every rocky planet is. Until the library had a scale transform this
def declared a hand-typed **window** (mass to 1,000, radius to 30) and the cell
filtered by it and counted the giants it cut off. Both are gone. `def.ts` ·
`SCATTER_FRAME` declares `transform: 'log'` on the view's frame — a transform is
not a resolution, so the frame is legal on a one-layer view and this is where an
axis's nature belongs — the session projects that declaration verbatim, and
`web/src/exoCells.tsx` · `transformOf` reads it off the projection. **No curve is
chosen in a cell.**

What a declaration cannot decide is the cells: a logarithm has no answer for 0 or
a negative number, and which planets those are is data. So the library folds the
domain over the positive values and **counts what it could not place** — exclude
and count, never silently drop. The chart prints that count inside the picture
the marks are missing from; the caption says it again in words, counted with the
library's own `placeable` predicate so the two can never disagree.

## The histogram over a table no file holds — refused, then clickable

The histogram draws `radii_per_planet`, which the `radiiPerPlanet` aggregate
**mints at run time**. It used to declare `canProbe: false`: a chart a reader
could see and could never click, with the *definition* as the reason. Now a
layer may name a table an act mints — the definition that declares the act has
already declared the table's name and its whole column list — and the library
answers the real question per cursor instead:

```
needs-act   view "spread~buckets" draws "radii_per_planet",
            which the act "radiiPerPlanet" mints — it has not landed on this path
```

`needs-act`, not `guard-failed`, because the repair is to perform the act rather
than to re-read the definition. The page's own boot makes that gesture before it
lands anything (`session.ts` · `probeTheMintedTable`), keeps the sentence and
shows it in the honesty line, then lands the acts — a visitor arrives after the
acts and could otherwise only be *told* about a refusal.

**And every default edge out of it is declared off.** The link layer's first law
is that nothing is implicit: the default crossfilter rule is materialized into
real edges, so the moment this view gained a voice the graph gained ten filter
edges out of it — each one handing a `radii` clause to a table that has no such
column (`table "measurements" has no column "radii"`, which is what the sheet's
own window answers if you let it). The aggregate's minted relation does not help:
a relation is a permission to read across, not a join a clause is routed through.
So `def.ts` · `spreadSilences` declares `response: 'none'` on all ten, because a
declared `none` is a fact the matrix shows and an absent edge is only a silence.

## What the histogram cannot show, and why the caption counts it

`radiiPerPlanet` reads only the rows whose radius is a measurement, so a planet
no paper published a radius for has **no row in the minted table** — 4,773
planets have one, and the other 1,587 are in no bar at all. `web/src/exoCells.tsx`
counts that gap and prints it, rather than letting a reader take the leftmost bar
for "the planets nobody measured".

## Where the numbers are

Nowhere in this folder. `data/exo/PROVENANCE.json` carries them, written by
`scripts/exo-generate.ts` from what this ETL reports over the files it just read
— so the provenance is not the cut's opinion of the slice, it is what the slice
parses to.
