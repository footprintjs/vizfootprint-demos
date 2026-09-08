# population — the denominator

`population.csv` — 52 rows, one per place: the 50 states, the District of Columbia and Puerto Rico, with the U.S. Census Bureau's Vintage 2024 estimate as of July 1, 2024.

```
jurisdiction,population,vintage
"Texas",31853800,2024
```

Regenerate with `node data/population/fetch.mjs`. The CSV and `PROVENANCE.json` move together and are never edited by hand.

## Why it is here

A count is not a rate. "Texas reported 900 cases" and "Wyoming reported 40" are the same sentence about two very different places, and a dashboard that draws the counts on one colour scale is drawing population. `cases / population * 100000` is the column that fixes it — and until this file existed there was nothing to divide by.

## The names are Census's own, unedited

That is what makes the join a join. NNDSS files `Texas`; so does this file. Nothing here maps, trims or title-cases a name, because a name that was edited on the way in is a join nobody can check.

## What has no row here, and therefore no rate

NNDSS files more than states. None of these gets a population, and none of them gets a rate:

| what NNDSS files | example | why not |
|---|---|---|
| census divisions | `New England`, `Pacific` | the estimates file carries the nation, four regions and the states — not NNDSS's nine divisions |
| roll-ups | `Total`, `U.S. Residents`, `Non-U.S. Residents`, `U.S. Territories` | not places |
| territories | `Guam`, `American Samoa`, `U.S. Virgin Islands`, `Commonwealth of Northern Mariana Islands` | not in this estimates file (Puerto Rico is) |
| a city | `New York City` | NNDSS files it beside New York State; a state-level file has no row for it |

This is the honest answer rather than a gap: the bring-over act **counts** the rows it could not follow (`{ total, counted, skipped }` on its own commit), so how much of the table a rate really covers is on the trace and not in somebody's head.

## One row per place, and the library now insists

The relation `cells.jurisdiction → population.jurisdiction` points at an identity, so `jurisdiction` must name exactly one row here. If a regenerated file ever carried a place twice, the act is refused at the door, before the commit, quoting the value that repeats — rather than silently taking whichever row came first. (See `bringOver` in the library's `src/analysis/README.md`.)
