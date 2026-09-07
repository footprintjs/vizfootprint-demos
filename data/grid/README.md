# data/grid — the committed slice of the US power grid, and where it came from

Three weeks of the United States electric grid, hour by hour: who used power,
who made it, and who sent it to whom. It is a **sparse, directed,
time-varying network** — 62 balancing authorities, each trading with a handful
of neighbours, 303 directed links in all — which is the shape a node-link
diagram is actually good at.

| file | what |
|---|---|
| `fetch.mjs` | downloads EIA's two six-month bulk CSVs (149 MB) into `raw/` and writes `raw/PROVENANCE.json` — the URLs, the byte counts, a SHA-256 of each, and the retrieval time. `raw/` is git-ignored: too large to commit |
| `balance.csv` | 30,746 rows — one per (balancing authority, hour): demand, net generation, total interchange, each as reported, as imputed and as published |
| `interchange.csv` | 149,848 rows — one per (from authority, to authority, hour): the directed flow in megawatts. These are the **edges** |
| `PROVENANCE.json` | source, licence, the two downloads with their digests, the slice rule, the columns kept and dropped **with the reason**, what the slice loses, the row counts, and the absence vocabulary — written by the generator, never by hand; **the counts live there**, never in this file |

## Source and licence

Hourly Electric Grid Monitor, six-month bulk files — **U.S. Energy Information
Administration**.
<https://www.eia.gov/electricity/gridmonitor/dashboard/electric_overview/US48/US48>

The data is a work of the United States Government: **public domain**
(17 U.S.C. § 105). EIA asks for an acknowledgement, which this repo gives in
exactly the form EIA asks for:

> Source: U.S. Energy Information Administration (September 2026)

EIA's logo and seal are **trademarks** and are not reproduced anywhere in this
repo — the sentence above is the only credit used. Terms:
<https://www.eia.gov/about/copyrights_reuse.php>

## The slice

**Monday 2025-05-19 00:00 UTC through Sunday 2025-06-08 23:00 UTC** — 504
hours, three whole Monday-to-Sunday weeks. Every one of the 70 authorities,
every one of the 303 directed links, and every class of silence is inside it.

It is a **pure cut**: EIA's header text and EIA's cell text, copied unchanged,
with fewer rows and fewer columns. Any line here can be found verbatim in the
bulk file it came from, so "is this honest?" is a question you can answer with
`grep` rather than trust.

**Why a window, and not a subset of authorities.** Dropping authorities would
have made the committed network a network this data does not describe — every
dropped node turns its neighbours' flows into edges leading nowhere, and the
sparse directed shape is the whole reason this dataset was chosen. Dropping
time damages nothing structural.

**Why this window.** It straddles **2025-06-01**, the day New Harquahala files
its last hour and Sikeston files its first. Those two are the deepest silence
this data has — an authority that is *not in the file at all*, as against one
whose cell is merely empty — and a slice that removed them would be a slice
that removed the point. Thirteen days sit before the changeover and eight
after, so each reads as a change and not as an edge of the window.

**What a reader loses.** Three weeks instead of six months: no winter peak, no
summer peak, no seasonal shape, and no answer to "is this hour unusual for the
year?" — the window is late-spring shoulder season throughout. Also outside it:
the March 9 daylight-saving hour, 1,916 of the 2,775 empty interchange cells,
and the imputation events elsewhere in the period. And **48 generation-mix
columns are dropped** (see `PROVENANCE.json` → `slice.dropped`): an empty fuel
cell does not distinguish "this authority has no wind at all" from "this
authority did not report its wind this hour", and EIA publishes nothing in
these files that separates the two — so keeping them would force this demo to
guess at exactly the distinction it exists to refuse.

## What you can ask of it

- **Who trades with whom, and how much** — 303 directed links, hour by hour.
  Roughly 4.9 out-edges per authority: sparse enough to draw.
- **Which way the power flows, and when it turns around** — the sign of
  `Interchange (MW)` flips within a day on many links.
- **How the network changes shape over three weeks** — Sikeston's four links
  appear on June 1; Harquahala's disappear the same day.
- **Where the grid leaves the country** — 11 directed links end at one of eight
  Canadian or Mexican operators that never report anything themselves.
- **Whether an authority's own books balance** — EIA publishes both
  `Total Interchange (MW)` and its own `Sum(Valid DIBAs) (MW)`. They disagree
  in **3,090 of the 30,638 published hours** (about 10%), by up to 7,472 MW.
- **What the daily demand curve looks like in local time** — `t_local` is a
  wall clock, so 6 p.m. in Florida and 6 p.m. in Oregon line up as the same
  peak rather than the same instant.

## The absence vocabulary

EIA-930 has no flag characters. It says the same things with **columns**: every
figure appears three times — as reported, as imputed, as adjusted — and which
of the three are filled is the whole message. `src/grid/absence.ts` maps that
onto six words, and `src/grid/etl.ts` puts one on every figure.

| word | what it means | where you see it |
|---|---|---|
| `present` | the authority filed the number and EIA published it | 26,659 demand cells; 148,989 flow cells |
| `estimated` | the authority filed nothing; **EIA** supplied the number and published that | 50 demand, 66 generation cells |
| `replaced` | the authority filed a number, EIA judged it wrong, imputed another and published **that** — both are kept, because the two disagreeing is the story | 3 demand cells (Louisville filed 10,247 MW, EIA published 4,776) |
| `not-configured` | the authority has no such figure to file. Nine of the 62 are generation-only and file **no demand at all** | 4,034 demand cells |
| `unavailable` | the authority normally files this and this hour is missing, unimputed | 41 generation, 107 interchange, 859 flow cells |
| `unknown` | never invented — the fallback that refuses to guess | 0 |

Two silences are too deep for a cell to carry, so they are words on the
**authority** instead:

- **`external`** — eight Canadian and Mexican operators (Alberta, BC Hydro,
  CENACE, Hydro-Québec, Ontario's IESO, Manitoba Hydro, New Brunswick,
  SaskPower) are named as neighbours on 11 links and file **nothing, ever**.
  They are absent by design, not silent.
- **the `first_hour` / `last_hour` / `hours` columns** — Sikeston's window
  starts at 2025-06-01T06:00Z, Harquahala's ends at 2025-06-01T07:00Z. An
  authority that arrives or leaves says so in numbers, not by leaving a hole
  you have to notice.

Three things this vocabulary is careful about:

1. **A measured zero is not a silence.** 5,971 flow cells carry an exact `0` —
   a link that was measured and carried nothing. 859 carry an empty cell — a
   link nobody reported. Merging them would erase the distinction this library
   exists for.
2. **`not-configured` vs `unavailable` is an inference, and says so.** EIA does
   not publish which authorities have no demand to file. The ETL infers it —
   an authority that filed the figure in *no* hour is `not-configured` — and
   `PROVENANCE.json` → `absence.rule` states that out loud rather than passing
   it off as EIA's own word.
3. **`unavailable` never fires on demand, and that is real.** Across the whole
   six-month file there is not one demand cell that is blank, unimputed, and
   from an authority that files demand elsewhere — every demand hole EIA either
   filled or belongs to an authority that has no demand. The word stays in the
   vocabulary because generation, interchange and the flows all use it.

There is no `withheld` here. CDC has one because it knows a count and chooses
not to print it; EIA never does that in these files, and adding the word would
promise a distinction the data cannot make.

## Refetching and regenerating

```
npm run data:grid                    # 149 MB into data/grid/raw/ (skips what is already whole)
npm run data:grid -- --force         # download again regardless
npm run grid:generate                # cut the slice + write PROVENANCE.json
```

The generator reads no clock. `PROVENANCE.json` carries the **fetcher's**
retrieval time and a SHA-256 of each downloaded file — facts about the input,
the digests binding this slice to the exact bytes it was cut from — and no
stamp of its own, so **two runs over one download write byte-identical files**.
A diff in this folder therefore means the download changed or the rule did,
never that the script ran again.

**The bulk files are re-published.** EIA rewrites these six-month CSVs; the
copies behind this slice carry `Last-Modified: Mon, 07 Sep 2026 14:37 GMT`.
A later fetch may differ, which is why the digests are in the provenance and
why nothing here is ever edited by hand.

For the large-scale demo, skip the cut: `npm run data:grid`, then point
the same ETL at `raw/` — `gridTables(balanceCsv, interchangeCsv)` reads EIA's
own shape directly, because the slice never changed it. Verified: the whole six
months parse to 264,934 hourly rows, 1,285,614 flows, the same 70 authorities
and the same 303 links over 4,346 hours. It needs a large heap
(`NODE_OPTIONS=--max-old-space-size=12288`) — the ETL builds every row as an
object, which the three-week slice does not notice and 1.3 million rows do.
