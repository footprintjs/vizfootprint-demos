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

## Data

Source: [NNDSS Weekly Data](https://data.cdc.gov/NNDSS/NNDSS-Weekly-Data/x9gk-5huc)
on data.cdc.gov (Office of Public Health Data, Surveillance, and Technology,
CDC). A work of the United States Government — public domain. The committed
snapshot is a slice (a handful of diseases, two MMWR years); its exact
query, retrieval time and row count are in `data/nndss/PROVENANCE.json`.
