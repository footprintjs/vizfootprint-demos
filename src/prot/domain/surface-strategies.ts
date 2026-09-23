import { PLUGIN_VERSION } from 'molstar/lib/mol-plugin/version.js';
import { headlessEntry } from '../molstar.js';
import { protSurface, validateSurfaceSampling, type SurfaceSampling } from '../surface.js';
import type { NormalizationReference, PreparedStructureInput, SurfaceStrategy } from './contracts.js';

export interface MolstarSurfaceStrategyOptions {
  readonly id?: string;
  readonly sampling?: SurfaceSampling;
}

/**
 * A configuration of the existing Shrake–Rupley calculation. Different sampling
 * densities are alternative configurations, not independent scientific methods.
 */
export function createMolstarSurfaceStrategy(options: MolstarSurfaceStrategyOptions = {}): SurfaceStrategy {
  const id = options.id ?? 'molstar-defaults';
  if (typeof id !== 'string' || id.trim().length === 0) throw new TypeError('Surface strategy id must be non-empty');
  validateSurfaceSampling(options.sampling === undefined ? {} : options.sampling);
  // A caller changing its options later cannot change what this strategy computes.
  const sampling = Object.freeze({ ...options.sampling });
  return Object.freeze({
    id,
    methodology: 'shrake-rupley',
    implementation: Object.freeze({ name: 'molstar', version: PLUGIN_VERSION }),
    async execute(input: PreparedStructureInput) {
      const entry = await headlessEntry(input.pdbText, input.entryId);
      const surface = await protSurface(entry, input.residueKeys, sampling);
      const { MaxAsa } = await import('molstar/lib/mol-model-props/computed/accessible-surface-area/shrake-rupley/common.js');
      const components = new Map(input.residues.map((residue) => [residue.residueKey, residue.compId]));
      const normalization = input.residueKeys.map((key): NormalizationReference | null => {
        const compId = components.get(key);
        if (compId === undefined || !Object.prototype.hasOwnProperty.call(MaxAsa, compId)) return null;
        return Object.freeze({
          compId,
          maxAsa: MaxAsa[compId]!,
          referenceId: 'doi:10.1371/journal.pone.0080635',
          referenceVersion: `molstar-${PLUGIN_VERSION}`,
        });
      });
      return { surface, normalization };
    },
  });
}
