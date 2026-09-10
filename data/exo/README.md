# data/exo — the committed slice of the exoplanet archive, and where it came from

Two CSVs, straight from the NASA Exoplanet Archive's TAP service, and the two
records that travel with them:

| file | what it is | rows |
|---|---|---|
| `ps.csv` | one row per **published measurement** — a planet as one paper reported it | 20,598 |
| `pscomppars.csv` | one row per **planet** — the archive's own composite, one number per parameter | 6,360 |
| `FETCH.json` | what the download was: the two queries verbatim, the credit, the byte counts and digests | — |
| `PROVENANCE.json` | the same facts plus the counts the slice **parses to** (written by `npm run exo:generate`) | — |

The same planet appears in both files. `pscomppars.csv` says a planet's radius
is 1.12 Earth radii; `ps.csv` says which papers measured it, and what each of
them got. **That is the whole demo: the same fact, published twice.**

## Source, credit and licence

- Source: the **NASA Exoplanet Archive**, queried over its Table Access
  Protocol service at `https://exoplanetarchive.ipac.caltech.edu/TAP/sync`.
- **No explicit licence is published for these tables.** The archive states an
  acknowledgement as the condition of use, and this repository carries it;
  nothing here claims a licence the archive has not granted.
- The acknowledgement, copied verbatim from the archive's
  [Acknowledging the NASA Exoplanet Archive in Publications](https://exoplanetarchive.ipac.caltech.edu/docs/acknowledge.html)
  page:

  > This research has made use of the NASA Exoplanet Archive, which is operated
  > by the California Institute of Technology, under contract with the National
  > Aeronautics and Space Administration under the Exoplanet Exploration
  > Program.

  The same page asks that work using data from a specific literature reference
  acknowledge that reference directly, and that the archive be cited as
  Christiansen et al. (2025), its published overview paper (which replaces
  Akeson et al. 2013).
- The persistent identifiers, copied from the archive's
  [Citing the NASA Exoplanet Archive With Digital Object Identifiers (DOI)](https://exoplanetarchive.ipac.caltech.edu/docs/doi.html)
  page:

  | table | resource name on that page | DOI |
  |---|---|---|
  | `ps` | Planetary Systems Table | `10.26133/NEA12` |
  | `pscomppars` | Planetary Systems Composite Parameters Table | `10.26133/NEA13` |

  Neither DOI is composed here. No DOI is invented: the archive's own page is
  the only source for both, and a table with no DOI on it would carry none.
- **This snapshot is a slice for a demo.** It is not a mirror of the archive,
  it is not maintained, and it will fall behind the day the archive publishes a
  new solution. Anyone who needs the archive should query the archive.

## The slice

The cut **is** the query. TAP answers with exactly the rows and columns asked
for, so what landed on disk is already the committed slice — nothing was cut,
sorted or rewritten afterwards, and every committed line is a line the archive
sent. Both queries are in `FETCH.json` verbatim, and `PROVENANCE.json` repeats
them.

One judgement, and it is stated because it is a judgement: `ps` holds 40,144
rows and only **20,598 are published literature solutions**. The other 19,546
are project *candidate* rows — six Kepler KOI pipeline lists, TESS project
candidates, and papers' own candidate solutions — and the query drops them with
`where soltype = 'Published Confirmed'`. Two reasons: "how many publications
measured this planet" is a number a pipeline's repeated re-fit of one star would
inflate, and `pscomppars` is confirmed-only, so keeping candidates would leave
the two files describing different sets of planets. `soltype` is **kept as a
column** so the cut is checkable with `grep` rather than with trust — every
committed row says the same word.

The queries also `order by` (`ps` by `pl_name, pl_pubdate, pl_refname`;
`pscomppars` by `pl_name`). TAP promises no row order, and two things depend on
this one: a re-fetch of unchanged data writes identical bytes, and the ETL's
minted `measurement_id` (`<pl_name>#<index within the planet>`) stays stable.

What the slice **loses**: no candidate planets and no candidate solutions, so
nothing here can say how a candidate becomes confirmed; no stellar properties,
so a planet cannot be read against its host; no uncertainties on the composite;
and none of the atmospheric, imaging or microlensing tables. Nothing structural
is lost for the question this demo asks — all 6,360 confirmed planets, all
20,598 published solutions for them, every reference either file points at, and
every limit and not-measured cell are inside it.

## The absence vocabulary

The archive says three different things with two columns: a value column
(`pl_rade`, `pl_bmasse`) and a **limit flag** beside it (`pl_radelim`,
`pl_bmasselim`).

| value | flag | what the archive is saying | our word |
|---|---|---|---|
| 7.1 | 0 | a paper measured it, and this is the number | `present` |
| 7.1 | ±1 | the paper could only **bound** it — upper (+1) or lower (−1) | `limit` |
| — | — | this publication published no such parameter | `not-measured` |
| — | ±1 | a bound with no number — never seen in the slice, never guessed | `unknown` |

A `limit` **carries a number**, so it is declared in `AbsenceDecl.carries` — it
is not a silence, and dropping its number would throw away the only quantity
that paper established. Counted over the slice: 11,062 published radii are
measurements and 7 are limits; 7,202 published masses are measurements and 398
are limits.

Two things are deliberately **not** in that vocabulary. `Msini` — a
radial-velocity mass, the true mass times the sine of an inclination nobody
measured — is a lower bound in physics, and the archive does not flag it as a
limit; calling it one here would be this repository overruling the archive about
its own data, so it rides as an ordinary column (`mass_kind`) and the prose says
what it means. And there is no `withheld`: the archive never knows a number and
chooses not to print it.

## What you can ask of it

- Does the accepted number agree with the published ones? `pscomppars` has one
  radius per planet; `ps` has every radius any paper published for it.
- **Where did the accepted number come from?** 1,608 of the composite's 6,360
  radii and 2,977 of its masses point at the *archive* rather than at a paper —
  4,501 of those cells say `Calculated Value`, and 2,974 of the masses come from
  a mass–radius *relation*, which is a model. The composite is an assembly, not
  a publication, and it says so in its own `*_reflink` columns.
- How much of the literature is behind one planet? 1,900 planets have exactly
  one published solution; TrES-2 b has 26. 74 planets have no row the archive
  marks as their default.
- Who published it? 2,403 references, of which 2,399 are literature and 4 are
  the archive itself.

## Refetching and regenerating

```sh
npm run data:exo              # the two queries → ps.csv, pscomppars.csv, FETCH.json
npm run data:exo -- --force   # download again even when the files are on disk
npm run exo:generate          # read them back through the ETL → PROVENANCE.json
```

`fetch.mjs` checks **every column against the live `TAP_SCHEMA`** before either
query runs, and refuses by name any column the archive does not have — that is
how this demo learned that `pscomppars` has no `pl_refname` (its provenance is
per-parameter, in `*_reflink`) and that `ps` has no `*_reflink` at all. A
retrieval time belongs to a download: a run that finds a file already on disk
keeps that file's previous stamp, so re-running the fetch never rewrites the
provenance without a row moving.

`raw/` is git-ignored and empty here. It is where an operator who wants the
whole table — every column, candidates included, 100 MB+ — puts it; this
repository does not commit that. Widen the column lists in `fetch.mjs` (or drop
its `where`) and the same ETL reads whatever comes back.
