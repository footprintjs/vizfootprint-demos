/**
 * THE TWO SCORES — the weights, the absence law, and the floor that is folded
 * rather than chosen.
 *
 * The load-bearing assertions here are the ones about ABSENCE, because that is
 * where a hot-spot score is usually wrong: a term nothing measured becomes a
 * zero, the zero becomes a low score, and the low score becomes a claim. Every
 * test below is about a term that said nothing.
 *
 * **No test in this file compares one blended number.** The two scores are two
 * questions and the whole design rests on their staying apart; a test that
 * added them would be the first place the collapse happened.
 */
import { describe, expect, it } from 'vitest';
import {
  CROSSING_SATURATION,
  INTERFACE_FLOOR,
  SEPARATION_FAR,
  SEPARATION_NEAR,
  W_BURIAL,
  W_CROSSING,
  W_DOMAIN,
  W_EPITOPE,
  W_HYDROPATHY,
  W_TIGHTNESS,
  basisOf,
  domainExtents,
  priorScore,
  structuralScore,
  type ResidueTracks,
} from '../src/hot/score.js';
import { KD_MAX, KD_MIN } from '../src/hot/hydropathy.js';

/** A residue with every track absent — the honest starting point, and the one a defaulting fold would score. */
const bare = (over: Partial<ResidueTracks> = {}): ResidueTracks => ({
  residue_key: 'A:1',
  chain: 'A',
  resnum: 1,
  interface_contacts: null,
  interface_separation: null,
  relative_sasa: null,
  hydropathy: null,
  epitope: null,
  pfam_domain: null,
  ...over,
});

const round = (v: number | null): number | null => (v === null ? null : Math.round(v * 1e6) / 1e6);

describe('the two budgets', () => {
  it('each sums to exactly 1, so a score is a fraction of its own budget and nothing else', () => {
    expect(round(W_CROSSING + W_TIGHTNESS + W_BURIAL + W_HYDROPATHY)).toBe(1);
    expect(round(W_EPITOPE + W_DOMAIN)).toBe(1);
  });

  it('splits the structural budget in two equal halves: at the interface, and the kind of residue it is', () => {
    expect(round(W_CROSSING + W_TIGHTNESS)).toBe(round(W_BURIAL + W_HYDROPATHY));
  });

  it('gives the count more than the distance, and the measurement more than the table lookup', () => {
    expect(W_CROSSING).toBeGreaterThan(W_TIGHTNESS);
    expect(W_BURIAL).toBeGreaterThan(W_HYDROPATHY);
    // the finer prior outweighs the coarser one
    expect(W_EPITOPE).toBeGreaterThan(W_DOMAIN);
  });
});

describe('absence propagates and never defaults', () => {
  it('a residue no structural track measured has NO score — null, not 0', () => {
    const scored = structuralScore(bare());
    expect(scored.score).toBeNull();
    expect(scored.basis).toBeNull();
  });

  it('a residue no prior track names has NO prior score — null, not 0', () => {
    expect(priorScore(bare(), new Map()).score).toBeNull();
  });

  it('an absent term contributes nothing and the weights are NOT renormalised', () => {
    // Same three present terms, at their maximum. With renormalisation this
    // would score 1; without it, it reaches exactly the budget those three own.
    const scored = structuralScore(bare({ interface_contacts: CROSSING_SATURATION, relative_sasa: 0, hydropathy: KD_MAX }));
    expect(round(scored.score)).toBe(round(W_CROSSING + W_BURIAL + W_HYDROPATHY));
    expect(scored.score).toBeLessThan(1);
  });

  it('so more evidence can only ever raise a score, never lower it — the property a renormalising fold breaks', () => {
    const withoutTightness = structuralScore(bare({ interface_contacts: 3, relative_sasa: 0.2, hydropathy: 1.8 }));
    const withTightness = structuralScore(bare({ interface_contacts: 3, relative_sasa: 0.2, hydropathy: 1.8, interface_separation: 3 }));
    expect(withTightness.score!).toBeGreaterThan(withoutTightness.score!);
  });

  it('the basis names every term it saw and every term it did not', () => {
    const scored = structuralScore(bare({ interface_contacts: 0, relative_sasa: 0.5, hydropathy: 1.8 }));
    expect(scored.basis).toBe('3 of 4 terms: interface_contacts, relative_sasa, hydropathy — absent: interface_separation');
    const whole = structuralScore(bare({ interface_contacts: 1, interface_separation: 3, relative_sasa: 0.5, hydropathy: 1.8 }));
    expect(whole.basis).toBe('4 of 4 terms: interface_contacts, interface_separation, relative_sasa, hydropathy');
    expect(whole.basis).not.toContain('absent');
  });

  it('a basis over no terms at all is null — there is no basis for a score that does not exist', () => {
    expect(basisOf([{ term: 'x', weight: 1, value: null, contribution: 0 }])).toBeNull();
  });
});

describe('each term is normalised between ends that are argued, not picked', () => {
  it('hydropathy runs between the published scale’s own extremes', () => {
    expect(round(structuralScore(bare({ hydropathy: KD_MIN })).score)).toBe(0);
    expect(round(structuralScore(bare({ hydropathy: KD_MAX })).score)).toBe(W_HYDROPATHY);
  });

  it('burial is the complement of what the solvent can still reach, and a ratio past 1 is clamped', () => {
    expect(round(structuralScore(bare({ relative_sasa: 0 })).score)).toBe(W_BURIAL);
    expect(round(structuralScore(bare({ relative_sasa: 1 })).score)).toBe(0);
    expect(round(structuralScore(bare({ relative_sasa: 1.4 })).score)).toBe(0);
  });

  it('the crossing count saturates rather than running away', () => {
    const at = structuralScore(bare({ interface_contacts: CROSSING_SATURATION })).score;
    const past = structuralScore(bare({ interface_contacts: CROSSING_SATURATION * 3 })).score;
    expect(round(at)).toBe(W_CROSSING);
    expect(round(past)).toBe(round(at));
  });

  it('the tightness ramp runs from the near end to the far end, and clamps outside it', () => {
    expect(round(structuralScore(bare({ interface_separation: SEPARATION_NEAR })).score)).toBe(W_TIGHTNESS);
    expect(round(structuralScore(bare({ interface_separation: SEPARATION_FAR })).score)).toBe(0);
    expect(round(structuralScore(bare({ interface_separation: 1 })).score)).toBe(W_TIGHTNESS);
    expect(round(structuralScore(bare({ interface_separation: 12 })).score)).toBe(0);
  });
});

describe('the prior is a different question, and says so', () => {
  it('an epitope the source names is the whole of that term — the fixtures carry no strength to read', () => {
    expect(round(priorScore(bare({ epitope: 'IEDB-1' }), new Map()).score)).toBe(W_EPITOPE);
  });

  it('a domain’s extent is read off THIS entry’s own numbering, never a reference sequence', () => {
    const rows = [bare({ residue_key: 'A:10', resnum: 10, pfam_domain: 'PF00545' }), bare({ residue_key: 'A:40', resnum: 40, pfam_domain: 'PF00545' })];
    const extents = domainExtents(rows);
    expect([...extents.values()]).toEqual([{ chain: 'A', accession: 'PF00545', lo: 10, hi: 40 }]);
  });

  it('the same accession on two chains is two extents, because a domain is a match on one chain', () => {
    const rows = [bare({ chain: 'A', resnum: 5, pfam_domain: 'PF1' }), bare({ chain: 'B', resnum: 60, pfam_domain: 'PF1' })];
    expect(domainExtents(rows).size).toBe(2);
  });

  it('a residue ON the boundary takes none of the domain term, and one deep inside takes all of it', () => {
    const rows = [bare({ resnum: 1, pfam_domain: 'PF1' }), bare({ resnum: 100, pfam_domain: 'PF1' })];
    const extents = domainExtents(rows);
    expect(round(priorScore(bare({ resnum: 1, pfam_domain: 'PF1' }), extents).score)).toBe(0);
    expect(round(priorScore(bare({ resnum: 50, pfam_domain: 'PF1' }), extents).score)).toBe(W_DOMAIN);
  });

  it('and a prior with only the domain term can never reach the top of its scale', () => {
    const rows = [bare({ resnum: 1, pfam_domain: 'PF1' }), bare({ resnum: 100, pfam_domain: 'PF1' })];
    const best = priorScore(bare({ resnum: 50, pfam_domain: 'PF1' }), domainExtents(rows));
    expect(best.score!).toBeLessThan(1);
    expect(best.basis).toContain('absent: epitope');
  });
});

describe('the floor the extent thresholds on is FOLDED from the weights', () => {
  it('is exactly the most a residue can score with no interface evidence at all', () => {
    expect(INTERFACE_FLOOR).toBe(W_BURIAL + W_HYDROPATHY);
    const noInterface = structuralScore(bare({ interface_contacts: 0, relative_sasa: 0, hydropathy: KD_MAX }));
    expect(round(noInterface.score)).toBe(round(INTERFACE_FLOOR));
    expect(noInterface.score!).not.toBeGreaterThan(INTERFACE_FLOOR);
  });

  it('so "above the floor" and "an interface track said something" are ONE statement', () => {
    const perfectCore = structuralScore(bare({ interface_contacts: 0, relative_sasa: 0, hydropathy: KD_MAX })).score!;
    const oneContact = structuralScore(bare({ interface_contacts: 1, relative_sasa: 0, hydropathy: KD_MAX })).score!;
    expect(perfectCore).not.toBeGreaterThan(INTERFACE_FLOOR);
    expect(oneContact).toBeGreaterThan(INTERFACE_FLOOR);
  });
});

describe('the two scores stay two', () => {
  it('neither fold can see the other’s terms', () => {
    const tracks = bare({ interface_contacts: 6, interface_separation: 2.5, relative_sasa: 0, hydropathy: KD_MAX, epitope: 'IEDB-1' });
    // the strongest possible prior does not move the structural score …
    expect(structuralScore(tracks).score).toBe(structuralScore({ ...tracks, epitope: null }).score);
    // … and the strongest possible structure does not move the prior
    expect(priorScore(tracks, new Map()).score).toBe(priorScore(bare({ epitope: 'IEDB-1' }), new Map()).score);
  });

  it('the terms of one are never in the basis of the other', () => {
    const tracks = bare({ interface_contacts: 1, relative_sasa: 0.5, hydropathy: 1.8, epitope: 'IEDB-1' });
    expect(structuralScore(tracks).basis).not.toContain('epitope');
    expect(priorScore(tracks, new Map()).basis).not.toContain('relative_sasa');
  });
});
