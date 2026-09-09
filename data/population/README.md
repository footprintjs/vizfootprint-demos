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

## What gets no rate, and why

NNDSS files more than states. **Nineteen** of its seventy reporting areas get no
denominator and therefore no rate:

| what NNDSS files | example | why not |
|---|---|---|
| census divisions | `New England`, `Pacific` | the estimates file carries the nation, four regions and the states — not NNDSS's nine divisions |
| roll-ups | `Total`, `U.S. Residents`, `Non-U.S. Residents`, `U.S. Territories` | not places |
| territories | `Guam`, `American Samoa`, `U.S. Virgin Islands`, `Commonwealth of Northern Mariana Islands` | not in this estimates file (Puerto Rico is) |
| a city | `New York City` | NNDSS files it beside New York State; a state-level file has no row for it |
| **New York** | `New York` | the file DOES carry it — and the row counts the wrong people. See below. |

### The one row this file carries that the join refuses

`population.csv` has 52 rows; the table the desk joins on has **51**. CDC files
New York City as its own reporting area, so the `New York` cells are the state
**minus** the city — the committed snapshot proves it without anyone's outside
knowledge, because `Middle Atlantic` only closes when the city is added:

```
Middle Atlantic  =  New Jersey + New York + New York City + Pennsylvania
```

The Census `New York` estimate counts the whole state, New York City's residents
included. A matching **name** is not matching **coverage**: dividing upstate-only
cases by statewide people understates New York by roughly 40%, on every disease
and every week, with nothing on the trace to say so. So `populationRowsFrom`
(`src/nndss/population.ts`) never offers the name to the join, and New York reads
as the same honest silence New York City already reads as. Give it a rate again
by writing two honest rows — a `New York City` estimate and a `New York` one that
excludes the city — in `fetch.mjs`, not by re-admitting this one.

This is the honest answer rather than a gap: the bring-over act **counts** the rows it could not follow (`{ total, counted, skipped }` on its own commit), so how much of the table a rate really covers is on the trace and not in somebody's head.

## One row per place, and the library now insists

The relation `cells.jurisdiction → population.jurisdiction` points at an identity, so `jurisdiction` must name exactly one row here. If a regenerated file ever carried a place twice, the act is refused at the door, before the commit, quoting the value that repeats — rather than silently taking whichever row came first. (See `bringOver` in the library's `src/analysis/README.md`.)
