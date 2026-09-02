# data/nndss — the committed slice, and where it came from

| file | what |
|---|---|
| `fetch.mjs` | downloads the slice from data.cdc.gov (dataset `x9gk-5huc`, SODA API) and writes the two files below; the query is in the script, the labels are exact NNDSS labels |
| `snapshot.csv` | the slice: 11 diseases × every reporting area × MMWR 2025–2026 (one row per area × week × disease; count columns each with their flag column; `lon`/`lat` from CDC's geocode when a row has one) |
| `PROVENANCE.json` | source, dataset id, the exact query, retrieval time, row count, licence — written by the script, never by hand |

The snapshot is **provisional** data: CDC revises weekly counts, so a
re-fetch will differ. That is why the provenance carries the retrieval
time, and why nothing here is edited by hand — `npm run data:fetch`
regenerates both files together.

Columns as CDC names them (`data/nndss/PROVENANCE.json` → `query.fields`):
`m1` current week, `m2` previous-52-week max, `m3` cumulative YTD this
year, `m4` cumulative YTD last year — each with a `*_flag`. The flags are
the reason this dataset was chosen; `src/nndss/absence.ts` says what each
one means.

Licence: a work of the United States Government — public domain.
