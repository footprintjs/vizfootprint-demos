import { entryId, protTables, residueKey } from '../etl.js';
import type { PreparedStructureInput, StructureInput } from './contracts.js';

/** Hash the text actually passed to both readers, without newline normalization. */
export async function structureSha256(pdbText: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(pdbText));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function prepareStructureInput(input: StructureInput): Promise<PreparedStructureInput> {
  if (input === null || typeof input !== 'object' || typeof input.pdbText !== 'string' || input.pdbText.trim() === '') {
    throw new Error('A nonempty PDB structure text is required');
  }
  const pdbText = input.pdbText;
  const expected = input.expectedSha256;
  if (expected !== undefined && (typeof expected !== 'string' || !/^[a-f0-9]{64}$/i.test(expected))) {
    throw new Error('expectedSha256 must be a 64-character SHA-256 hex digest');
  }
  if (input.residueKeys !== undefined && !Array.isArray(input.residueKeys)) throw new Error('residueKeys must be an array');
  const requested = input.residueKeys === undefined ? undefined : [...input.residueKeys];

  // The current identity contract cannot distinguish insertion codes or models.
  // Refuse those ambiguous inputs at this opt-in boundary instead of fabricating identities.
  let models = 0;
  let segment = 0;
  const identities = new Map<string, { segment: number; compId: string }>();
  for (const line of pdbText.split('\n')) {
    if (line.startsWith('MODEL ')) {
      models += 1;
      if (models > 1) throw new Error('Multiple PDB models are not supported by the current residue_key contract');
    }
    if (line.slice(0, 6).trim() === 'TER') segment += 1;
    if (!line.startsWith('ATOM  ') && !line.startsWith('HETATM')) continue;
    if (line.startsWith('ATOM  ') && line.slice(26, 27).trim() !== '') {
      throw new Error('Insertion-coded polymer residues are not supported by the current residue_key contract');
    }
    const fields = [line.slice(22, 26), line.slice(30, 38), line.slice(38, 46), line.slice(46, 54)];
    if (fields.some((value) => value.trim() === '' || !Number.isFinite(Number(value))) || !Number.isInteger(Number(fields[0]))) {
      throw new Error('PDB atom records require a residue number and finite coordinates');
    }
    if (line.startsWith('ATOM  ')) {
      const key = residueKey(line.slice(21, 22).trim(), Number(fields[0]));
      const compId = line.slice(17, 20).trim();
      const previous = identities.get(key);
      if (compId === '' || (previous !== undefined && (previous.segment !== segment || previous.compId !== compId))) {
        throw new Error(`Ambiguous residue identity: ${key} spans chain segments or component names`);
      }
      identities.set(key, { segment, compId });
    }
  }
  const table = protTables(pdbText);
  if (table.residues.length === 0) throw new Error('The PDB text contains no supported polymer residues');
  const byKey = new Map(table.residues.map((row) => [row.residue_key, row]));
  const residueKeys = requested ?? table.residues.map((row) => row.residue_key);
  if (residueKeys.length === 0) throw new Error('At least one residue must be selected');
  if (new Set(residueKeys).size !== residueKeys.length) throw new Error('Duplicate residue keys are not allowed');
  const residues = residueKeys.map((key) => {
    const row = byKey.get(key);
    if (row === undefined) throw new Error(`Unknown residue key: ${String(key)}`);
    return Object.freeze({ residueKey: key, compId: row.resname });
  });
  const sha256 = await structureSha256(pdbText);
  if (expected !== undefined && sha256 !== expected.toLowerCase()) throw new Error('Structure SHA-256 does not match expectedSha256');
  return Object.freeze({ pdbText, entryId: entryId(pdbText), sha256, residueKeys: Object.freeze(residueKeys), residues: Object.freeze(residues) });
}
