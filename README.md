# vizfootprint-demo — public data, provenance-first

[vizfootprint](../vizfootprint) on a real public dataset: the CDC's weekly
notifiable-disease tables (NNDSS), reproduced as a dashboard whose every
interaction is a commit, whose agent proposals are gated, and whose empty
cells keep their kind — with the interaction grammar on screen.

This repo is a **consumer**, not a showcase: it exists to exercise the
library's seams on data nobody here authored. What it proves, it proves
on CDC's own bytes.

## Why NNDSS

A weekly NNDSS cell that carries no number carries a flag instead, and
CDC's flags already say which silence it is — `N` not reportable in that
jurisdiction, `U` unavailable, `NP` withheld, `-` no cases (a real zero).
That is the absence vocabulary this library insists on, published weekly
by a federal agency. See [`src/nndss/absence.ts`](src/nndss/absence.ts).

## Layout

| folder | layer | one job |
|---|---|---|
| `data/nndss/` | 1 · data | the fetch script, the committed snapshot, and its provenance (source, date, rows, license) |
| `src/nndss/` | 1–5 | flags → absence, CSV → tables, the declared dashboard, the surface, the scripted proposals |
| `server/` | wire | `/api/*` — vizfootprint-ui's polled state contract |
| `web/` | 3, 4, 6 | the cockpit, the Grammar panel, the jump box |
| `tests/` | — | vitest |

## What you see

Six views on one screen, every one fed by the host under the session's
clauses (the host sums, the chart draws), and four report chips:

| view | what it shows | what a click does |
|---|---|---|
| **coverage** (bar) | cells by `report_state` — which silence is which | selects a report state |
| **diseases** (bar) | reported cases by disease, summed over the kept cells of ONE kind (states unless the kinds view says otherwise) | picks the disease that drives the trend, the week line and the table |
| **kinds** (bar) | cells by area kind — state, region, roll-up | names the kind every sum is over |
| **weeks** (line) | reported cases per MMWR week, summed over the same one kind | brush = a `filter` on `t` |
| **trend** (line) | the picked disease per region until a kind or an area is chosen, then per kept area — a missing point is a silence, never a zero | brush = a `filter` on `t` |
| **table** | the picked disease at the latest week, the cells as CDC printed them, with their flag | selects an area |

- **Grammar** — the verbs off the wire (the library's own list), each with the
  gesture that produces it here; per view: driver, what it emits, which
  channels it may rebind and what they are bound to now; the wiring word
  (`implicit-crossfilter`); the absence column and its words.
- **The silences** — this week's `not-configured` / `unavailable` /
  `withheld` / `unknown` cells by area, in our words for CDC's flags.
- **Agent proposals** — six charts an agent might propose; the session admits
  the ones that make a claim over real columns and refuses the rest with a
  typed reason (an absence column on a magnitude channel is one).
- **Commit log** — every act, with its cause, and `go to #` beside the
  time-travel bar: seek to any commit on the lineage by number (a cursor
  move, never a rewrite); a number on another path is refused in a sentence.

Every act lands as a commit; ⚑ names the position as a story beat; acting
while viewing the past forks a branch.

## Run it

```
npm install
npm run data:fetch      # only to refresh the snapshot — it is committed
npm run serve           # http://localhost:5290/api/state
npm run web:dev         # http://localhost:5291
npm test
```

`vizfootprint-ui` is a `file:` link to the sibling checkout; rebuild it
(`cd ../vizfootprint && npm run build:ui`) after any library change.

## Rules the ETL makes (and states)

- **Kind** comes from CDC's location columns, never the name and never the
  coordinate: `location1` names a place (a state, a territory, a city),
  `location2` alone names a census division (a region), a roll-up name
  (`U.S. Residents`, `Total`, …) makes a total. South Atlantic carries a
  coordinate in CDC's file (a point in South Dakota) and is still a region.
- **Series** points exist for every PRESENT cell of every kind, each naming
  its kind; a silence is a missing row. A region's count is CDC's own row,
  not a sum the host made.
- **MMWR weeks** become the Saturday that ends them (week 1 contains
  January 4th).

## Data

Source: [NNDSS Weekly Data](https://data.cdc.gov/NNDSS/NNDSS-Weekly-Data/x9gk-5huc)
on data.cdc.gov (Office of Public Health Data, Surveillance, and Technology,
CDC). A work of the United States Government — public domain. The committed
snapshot is a slice (a handful of diseases, two MMWR years); its exact
query, retrieval time and row count are in `data/nndss/PROVENANCE.json`.
