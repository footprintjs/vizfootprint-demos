/**
 * WHERE THE COMMITTED FILES LIVE — one list, three readers.
 *
 * The paths are repo-relative and they are also site-relative, because the
 * static build copies `data/` into the built site unchanged. That is the whole
 * trick: `data/nndss/snapshot.csv` names the same bytes whether a server reads
 * it off disk or a page fetches it under the site's base.
 *
 * This module imports NOTHING. It is loaded by the browser loaders
 * (`src/nndss/http.ts`, `src/grid/http.ts`) AND by the static build's Vite
 * config, which decides what to copy — and a config that had to evaluate the
 * library to learn a file name would be a build that fails for a reason
 * nothing to do with the build.
 */

/** The CDC demo's files, by the table each one becomes. */
export const NNDSS_FILES = {
  snapshot: 'data/nndss/snapshot.csv',
  nodes: 'data/nndss/graph/nodes.csv',
  edges: 'data/nndss/graph/edges.csv',
  // The denominator: one row per place, Census Vintage 2024 (as of July 1,
  // 2024). The rate's BRING-OVER act reads it across the declared relation and
  // lands the column on `cells`; the derive act then divides by what that act
  // left there, and never touches this table (the library has no `lookup` op —
  // `vizfootprint`'s `src/derive/README.md`, law 12). `snapshot.csv` three
  // lines up ships MMWR 2025-2026 cases, so the two files are YEAR-COUPLED and
  // are refetched together.
  population: 'data/population/population.csv',
  geo: 'data/geo/us-states.geo.json',
} as const;

/** The grid demo's files. */
export const GRID_FILES = {
  balance: 'data/grid/balance.csv',
  interchange: 'data/grid/interchange.csv',
} as const;

/**
 * The exoplanet demo's files, by the table each one becomes. `ps.csv` is one row
 * per PUBLISHED MEASUREMENT and `pscomppars.csv` one row per PLANET — the same
 * facts twice, which is what that demo is about.
 */
export const EXO_FILES = {
  measurements: 'data/exo/ps.csv',
  planets: 'data/exo/pscomppars.csv',
} as const;

/**
 * The protein demo's one file — and the one entry in this module that is not a
 * TABLE.
 *
 * `1ay7.pdb` is a bulk ARTIFACT: the 3D view draws the file itself, and the
 * residues table is what `src/prot/etl.ts` reads out of it. The library's
 * source port carries `rows | csv | json` and this is none of them, so nothing
 * declares it — the page fetches it plainly (`src/prot/http.ts` says what that
 * costs) and the static build copies it like any other asset.
 */
export const PROT_FILES = {
  structure: 'data/prot/1ay7.pdb',
} as const;

/**
 * WHERE THE CITED ALIGNMENTS LIVE — the conservation stage's committed
 * evidence, and the ONE place its file-naming convention is spelled.
 *
 * The conservation stage cites somebody else's curated alignment and computes
 * only where our residues sit in it (`src/prot/placement.ts`). Five files carry
 * what that needs for the committed example, so the desk's second stage lands
 * with the network unplugged exactly as the first one does:
 *
 *   `<ENTRY>-entities.json`   the archive's own polymer-entity record — the
 *                             entity sequence, the UniProt accession, the
 *                             aligned regions and the author↔entity residue
 *                             mapping (hops 3 and 4).
 *   `<ACCESSION>-pfam.json`   which Pfam family that accession is in, and over
 *                             which residues of it.
 *   `<PFAM>-seed.sto`         the family's curated SEED alignment, in
 *                             Stockholm — the work this desk cites.
 *
 * THE NAMES CARRY NO VERSION, deliberately: a family's version lives in the
 * alignment's own `#=GF AC` header and is READ from it (`src/prot/stockholm.ts`
 * says why a typed version is a version that can drift from the bytes it
 * names). So `PF00545-seed.sto` is the file and `PF00545.26` is what the page
 * cites.
 *
 * {@link conservationFileOf} mints these names and
 * {@link PROT_CONSERVATION_FILES} is the static list the build copies — one
 * convention, two readers, and `tests/prot-conservation.test.ts` asserts the
 * minted names are the committed ones.
 */
export const PROT_CONSERVATION_DIR = 'data/prot/conservation/';

/** The three names, minted — the convention above, as functions, so no reader spells one. */
export const conservationFileOf = {
  entities: (entry: string): string => `${PROT_CONSERVATION_DIR}${entry.toUpperCase()}-entities.json`,
  matches: (accession: string): string => `${PROT_CONSERVATION_DIR}${accession.toUpperCase()}-pfam.json`,
  alignment: (family: string): string => `${PROT_CONSERVATION_DIR}${family.toUpperCase()}-seed.sto`,
} as const;

/** What the committed example's conservation stage reads — every one of them minted by {@link conservationFileOf}. */
export const PROT_CONSERVATION_FILES: readonly string[] = [
  conservationFileOf.entities('1AY7'),
  conservationFileOf.matches('P05798'),
  conservationFileOf.matches('P11540'),
  conservationFileOf.alignment('PF00545'),
  conservationFileOf.alignment('PF01337'),
];

/**
 * What a static build must carry, beyond the tables themselves.
 *
 * The provenance records ride along because a dashboard that says where its
 * numbers came from should be able to hand over the record, and
 * `LICENSE-us-atlas` rides along because the ISC licence requires its notice
 * to travel with the file it covers — publishing the boundaries without it
 * would break the one condition that made publishing them lawful.
 */
export const SITE_PROVENANCE_FILES = ['data/nndss/PROVENANCE.json', 'data/nndss/graph/PROVENANCE.json', 'data/population/PROVENANCE.json', 'data/geo/PROVENANCE.json', 'data/geo/LICENSE-us-atlas', 'data/grid/PROVENANCE.json', 'data/exo/PROVENANCE.json', 'data/exo/FETCH.json', 'data/prot/PROVENANCE.json', 'data/prot/conservation/PROVENANCE.json'] as const;

/** Everything the built site needs under `data/` — the tables and the papers that must travel with them. */
export const SITE_DATA_FILES: readonly string[] = [...Object.values(NNDSS_FILES), ...Object.values(GRID_FILES), ...Object.values(EXO_FILES), ...Object.values(PROT_FILES), ...PROT_CONSERVATION_FILES, ...SITE_PROVENANCE_FILES];
