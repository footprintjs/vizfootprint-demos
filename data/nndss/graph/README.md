# data/nndss/graph — the disease co-occurrence graph, derived and committed

A node-link shape folded from `../snapshot.csv`: two tables and one rule,
written by a script, never by hand. The dashboard declares them as the
`nodes` and `edges` tables and joins them with two relations
(`edges.source → nodes.disease`, `edges.target → nodes.disease`) — data on the
map that the overview echoes; no view draws them yet.

| file | what |
|---|---|
| `nodes.csv` | one row per disease: `disease` (the key), `cases_total` (cases summed over every present leaf cell), `jurisdictions_reporting` and `weeks_reporting` (distinct leaf areas / MMWR weeks with a cell of cases > 0) |
| `edges.csv` | one row per unordered pair of diseases that ever reported in the same jurisdiction-week: `source`, `target`, `weight`, `jurisdictions` |
| `PROVENANCE.json` | the snapshot's own provenance repeated plus a SHA-256 of its bytes, the kinds walked, the rule in one sentence, the ordering law, the columns, the counts, the generator's name — written by the script; **the counts live there**, never in this file |

## The rule

> Over the leaf reporting areas only (kind = state — CDC's region and total
> rows are its sums of these rows and are not walked): one edge per
> unordered pair of diseases that reported cases > 0 in the same
> jurisdiction-week at least once; `weight` = the number of such
> jurisdiction-weeks, `jurisdictions` = the distinct reporting areas among
> them; a pair with no such jurisdiction-week is no edge.

A **cell** is CDC's own row — one reporting area, one disease, one MMWR
week; a **jurisdiction-week** is one reporting area in one MMWR week, the
unit an edge's `weight` counts. A dash (a present zero) and every silence
(`N`, `U`, `NP`) report nothing, so they make no edge — a silence is never
a zero here either.

**The hierarchy law.** CDC files each state's count again under its census
division (`kind: region`) and again under `Total` and `U.S. Residents`
(`kind: total`). The `series` table may show a region's row because it
shows one kind at a time; a figure summed ACROSS kinds counts one
state-week event up to four times and is CDC's number for nothing. So the
fold walks the leaf kind only (`GRAPH_KINDS` in `src/nndss/graph.ts`,
echoed as `kinds` in `PROVENANCE.json`), and the rows it set aside are
counted there (`counts.cellsSetAside`), never dropped in silence. A cell
that repeats a (jurisdiction, week, disease) already seen is counted too
(`counts.cellsRepeated`) — the ETL promises one row per cell, and the
provenance says whether the input kept that promise.

Ordering is part of the rule: nodes in lexical disease order; on every edge
`source < target` (JavaScript string order); edges in `(source, target)`
order. The same snapshot always folds to the same rows in the same order.

## Regenerating

```
npm run graph:generate
```

`scripts/graph-generate.ts` reads the snapshot through the same ETL the
server runs (the library's file carrier, then `nndssTablesFromRows`), folds
the graph in one pass (`src/nndss/graph.ts` — the library's `foldOnce` with
`distinct` and two recorders of its shape), and writes the three files.
Run it after `npm run data:fetch`; the snapshot and the graph move together.

## The byte-stability promise

Nothing in the generator reads a clock. `PROVENANCE.json` carries the
snapshot's `retrievedAt` and a SHA-256 of its bytes (`derivedFrom.sha256`)
— facts about the input, the digest binding the graph to the exact
snapshot it was folded from — and no stamp of its own, so two runs over one
snapshot write byte-identical files (proved by running twice and diffing;
`tests/graph.test.ts` pins that the committed files are exactly what the
generator writes over the committed snapshot, calling the generator's own
provenance reader, `snapshotProvenance` in `src/nndss/snapshot.ts`, so the
two cannot drift apart). A diff in this folder therefore means the snapshot
changed or the rule did, never that the script ran again.
