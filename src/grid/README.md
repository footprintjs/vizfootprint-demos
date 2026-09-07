# src/grid — EIA's hourly grid, shaped for vizfootprint

Layers 1–4 for the second demo: the committed slice in
[`data/grid/`](../../data/grid/README.md) in, four plain tables out, a
dashboard declared over them, and a live session on top. Nothing invented.
Seven small modules, and the split between them is load-bearing.

| module | one job | runs in a browser? |
|---|---|---|
| `absence.ts` | EIA's quality vocabulary → six words, and the one judgement the mapping makes (`ABSENCE_RULE`) | yes |
| `names.ts` | authority and region codes → long names — the **one** field typed in rather than read, so it is allowed to be incomplete and says so | yes |
| `etl.ts` | the parse: EIA's shape → `authorities`, `interchange`, `hourly`, `links` | yes |
| `slice.ts` | which rows and columns are committed, what that loses, and the provenance object | yes |
| `def.ts` | layers 2–4 as data: the four tables with their roles and their silences, the two relations, the views, the two analyses, the links between views, the house rules, the prose | yes |
| `surface.ts` | one live session over the def, with the two layout acts landed and the graph read where no clause can exist | yes |
| `snapshot.ts` | the disk: stream the 149 MB download into the slice, read the slice back | **no — node only** |

`snapshot.ts` is separate for the reason `src/nndss/snapshot.ts` gives: a module
that pulls a runtime into every importer is a module every importer pays for,
and the single-file story page runs the ETL in a browser over a CSV it carries.
One `node:fs` import at the top of `etl.ts` would fail that build.

## The four tables

- **`authorities`** — the NODES. One row per balancing authority: code, name,
  region, `kind` (`reporting` files hourly rows; `external` never does — the
  eight Canadian and Mexican interties), the window it actually covers
  (`first_hour`, `last_hour`, `hours`), whether it has demand to file at all
  (`demand_state`), and how many neighbours it has.
- **`interchange`** — the EDGES at their finest grain. One row per
  (from, to, hour): `mw` (positive = a flow **out of** `from_authority`) and
  its `report_state`.
- **`hourly`** — one row per (authority, hour). Each of demand, net generation
  and total interchange appears three times over: the number EIA **published**
  (`demand`), the number the authority **filed** (`demand_reported` — kept even
  when EIA replaced it, because the two disagreeing is the story), and the word
  for the difference (`demand_state`). Plus `interchange_gap`: EIA's published
  interchange minus EIA's own sum of the flows, which is often not zero.
- **`links`** — DERIVED, one row per directed pair. The static edge set a
  node-link view needs, so no view has to fold 150,000 rows to learn who is
  connected to whom. It is also where "this link is declared in every hour and
  never carries a number" lives (`report_state: 'unavailable'`).

The node's key column is spelled **`authority`** — EIA's own code. Everything
that points at a node names that column and no other: both relations
(`links.from_authority → authorities.authority`,
`links.to_authority → authorities.authority`), the layout's `key`, and the
network's `key` channel.

## The dashboard, and the two acts that put it on a frame

`def.ts` declares the four tables, the two relations, four views (the network
frame with its two layers, the hourly demand line, a bar over the per-authority
table, and the sheet) and two analyses **as data**:

| analysis | what it does |
|---|---|
| `gridLayout` | a seeded stress layout over `authorities`, reading the ties off `links` — writes `x` / `y` |
| `gridEndpoints` | brings those two columns ACROSS the relations onto `links`, as `from_authority_x` … `to_authority_y` |

`surface.ts` dispatches both before the first request is served, so they land as
two ordinary `analyze` commits at the top of the log. **A position that is not
on the trace is a position a replay cannot promise**: a reader who asks where a
circle came from gets two commits and a seed, and a replay of the log rebuilds
every coordinate (`tests/grid-network.test.ts`). The seed is `GRID_LAYOUT_SEED`
— a number written down, never a clock, because the same seed over the same
rows gives byte-identical positions.

## Which picture this graph is

70 authorities, 157 undirected pairs, about five neighbours each: **sparse**.
The library's reading rule (`graphReadingFor`, two studies named in its own
reason) prefers the node-link for a graph this shape, and prefers the MATRIX for
the CDC demo's disease graph, which is complete. Neither verdict is written
anywhere in this repo — `web/src/gridCells.tsx` counts the marks on screen,
asks the rule about both graphs, and renders what comes back.

## Time

`t` is the ISO-8601 UTC hour **ending** the hour, EIA's own convention: a row
stamped `2025-05-19T01:00Z` covers 00:00–01:00 UTC. `hour_index` is whole hours
from `HOUR_ZERO` (`2025-01-01T00:00Z`, the start of the six-month period, so a
slice and the whole file index alike) — the numeric axis an analysis regresses
over. `t_local` is the authority's own wall clock **with no zone marker**,
because that is what it is: 6 p.m. in Florida and 6 p.m. in Oregon are
different instants and the same daily peak.

## Two passes, and why

`figureOf` cannot word an empty cell on its own. An authority that never files
demand is `not-configured`; one that missed an hour is `unavailable`; only a
walk over every row can tell them apart. So `gridTablesFromRows` reads the
hourly rows twice — once to learn what each authority ever filed, once to word
it — and `ABSENCE_RULE` states that the split is an inference rather than EIA's
own word. That sentence is copied into `data/grid/PROVENANCE.json`, so the
judgement travels with the data.

## One parse, not two dialects

The slice is a **pure cut** of EIA's CSVs — same header text, same cell text —
so `gridTables(balanceCsv, interchangeCsv)` reads the committed three weeks and
the full six-month bulk file with the same code. `stampMs` accepts EIA's
`MM/DD/YYYY h:mm:ss AM` and ISO alike, which is the only place the two could
ever have drifted. Reading the whole six months is verified and needs a large
heap (`NODE_OPTIONS=--max-old-space-size=12288`): the ETL materialises every
row as an object, which 30,746 rows do not notice and 1.3 million do.

## Where the numbers are

Nowhere in this folder. `data/grid/PROVENANCE.json` carries them, written by
`scripts/grid-generate.ts` from what the ETL actually reports over the files it
just wrote — so the provenance is not the cut's opinion of the slice, it is
what the slice parses to.
