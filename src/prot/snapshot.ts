/**
 * THE COMMITTED ENTRY, off disk — the node half of the protein desk.
 *
 * `./etl.ts`, `./def.ts` and `./session.ts` are pure: text in, rows and a
 * session out, and they run in a browser. Reading a file does not. So every
 * door that touches the disk lives here, for the reason every other demo in
 * this repository gives: a module that pulls a runtime into every importer is
 * a module every importer pays for.
 *
 * ONE DIFFERENCE from the three loaders beside it, and it is the whole finding
 * of this packet: those read their tables through the library's SOURCE PORT
 * (`openSource({ format: 'csv', via: 'file', at }, table, [fileSource])`), so
 * the carrier answers with a version it can vouch for. A structure file is not
 * `rows`, `csv` or `json`, so there is no carrier to read it with — this is a
 * bare `readFileSync`, and the digest that would have been a version is
 * recorded in `data/prot/PROVENANCE.json` by the fetch script instead.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { structureArtifact, type StructureArtifact } from './session.js';

/** Where the committed entry lives. */
export const ENTRY_DIR = new URL('../../data/prot/', import.meta.url);
export const ENTRY_PDB = new URL('1ay7.pdb', ENTRY_DIR);
/** What the fetch recorded about the download: the entry's own header records, its terms, its digest. */
export const ENTRY_PROVENANCE = new URL('PROVENANCE.json', ENTRY_DIR);

/** The entry's text, off disk. */
export function loadStructureText(at: URL = ENTRY_PDB): string {
  return readFileSync(at, 'utf8');
}

/** The entry as an artifact the surface can take — the node default of what the page fetches. */
export function loadStructure(at: URL = ENTRY_PDB): StructureArtifact {
  return structureArtifact(at.href, loadStructureText(at));
}

/** SHA-256 of a file's bytes — how a test pins the committed entry to the download that wrote it. */
export function digestOf(at: URL = ENTRY_PDB): string {
  return createHash('sha256').update(readFileSync(at)).digest('hex');
}

/** The fetch's record, read from the file it wrote — never retyped. */
export function entryProvenance(at: URL = ENTRY_PROVENANCE): Record<string, unknown> {
  return JSON.parse(readFileSync(at, 'utf8')) as Record<string, unknown>;
}

/** Where the cited family alignments live, and what the fetch recorded about them. */
export const CONSERVATION_DIR = new URL('conservation/', ENTRY_DIR);
export const CONSERVATION_PROVENANCE = new URL('PROVENANCE.json', CONSERVATION_DIR);

/**
 * THE COMMITTED FILES, OFF DISK — the node adapter for
 * `./conservationEvidence.ts` · `ReadCommitted`.
 *
 * The paths that port takes are repo-relative AND site-relative
 * (`src/data/files.ts` says why), so the node door resolves one against the
 * repository root and the browser door against the site's base. One shape, two
 * adapters, and neither module knows about the other's runtime.
 */
export const REPO_ROOT = new URL('../../', import.meta.url);

/** One committed file's text, by the path `src/data/files.ts` names it with. */
export function readCommittedFile(file: string): Promise<string> {
  return Promise.resolve(readFileSync(new URL(file, REPO_ROOT), 'utf8'));
}

/** What the conservation fetch recorded — read from the file it wrote, never retyped. */
export function conservationProvenance(at: URL = CONSERVATION_PROVENANCE): Record<string, unknown> {
  return JSON.parse(readFileSync(at, 'utf8')) as Record<string, unknown>;
}

/** Where what is already known lives, and what the fetch recorded about it. */
export const ANNOTATION_DIR = new URL('annotation/', ENTRY_DIR);
export const ANNOTATION_PROVENANCE = new URL('PROVENANCE.json', ANNOTATION_DIR);

/** What the annotation fetch recorded — read from the file it wrote, never retyped. */
export function annotationProvenance(at: URL = ANNOTATION_PROVENANCE): Record<string, unknown> {
  return JSON.parse(readFileSync(at, 'utf8')) as Record<string, unknown>;
}
