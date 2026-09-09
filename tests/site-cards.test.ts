/**
 * THE SITE'S CARDS — read, never typed, and one card per SURFACE.
 *
 * Three promises, over the real builds and the real captured walk:
 *
 * 1. The CDC desk and the CDC story page DIFFER exactly where the design says:
 *    the network view, the two layers and the graph analyses are on the desk
 *    and not on the story page; the story page alone carries a walk, and that
 *    walk never touched a network. Every other declared chip is on both.
 * 2. Every chip on every card is traceable to a reader or to the one hand
 *    table — `defFeatures`, `logFeatures`, or `NNDSS_GESTURES`. The site
 *    module adds addresses and nothing else; its cards are the demo modules'
 *    cards, chip for chip.
 * 3. The file the page fetches survives the wire (a JSON round trip keeps every
 *    chip), is the one `data/` file the build WRITES rather than copies, and the
 *    filter over it narrows to surfaces and refuses in a sentence.
 *
 * `tests/cards.test.ts` pins the CDC demo's own two cards; this suite pins what
 * the SITE does with them beside the grid's.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { chipsOf, choicesOf, narrowRefusal, narrowTo } from 'vizfootprint-studio/cards';
import type { DemoSurface, FeatureChip } from 'vizfootprint-studio/cards';
import { SITE_DATA_FILES } from '../src/data/files.js';
import { gridSurfaces } from '../src/grid/cards.js';
import { NNDSS_GESTURES, nndssSurfaces } from '../src/nndss/cards.js';
import { SITE_HREFS, loadSiteCardsInput, siteCards, siteSurfaces } from '../src/site/cards.js';
import { SITE_CARDS_FILE, readSiteCards, type SiteCards } from '../src/site/cardsFile.js';

const BUILT_AT = '2026-09-08T00:00:00.000Z';

let cards: SiteCards;
/** The same cards after the wire: written as JSON and read back through the page's own reader. */
let shipped: SiteCards;
/** What the two demo modules hand over on their own — the site's cards must be these, chip for chip. */
let handedOver: readonly DemoSurface[];
let cdcDesk: DemoSurface;
let cdcStory: DemoSurface;
let gridDesk: DemoSurface;

beforeAll(() => {
  const input = loadSiteCardsInputOnce();
  cards = siteCards(input, () => BUILT_AT);
  shipped = readSiteCards(JSON.parse(JSON.stringify(cards)));
  handedOver = [...nndssSurfaces(input.nndss), ...gridSurfaces(input.grid)];
  [cdcDesk, cdcStory, gridDesk] = cards.surfaces as readonly [DemoSurface, DemoSurface, DemoSurface];
}, 120_000);

const idsOf = (surface: DemoSurface): readonly string[] => chipsOf(surface).map((chip) => chip.id);
/** The chips of `a` that `b` does not carry. */
const onlyOn = (a: DemoSurface, b: DemoSurface): readonly string[] => {
  const theirs = new Set(idsOf(b));
  return idsOf(a).filter((id) => !theirs.has(id));
};

describe('the surfaces the site publishes', () => {
  it('is three cards — two CDC surfaces and one grid desk — never one card per demo', () => {
    expect(cards.surfaces.map((s) => `${s.demo} / ${s.surface}`)).toEqual(['CDC NNDSS weekly / desk', 'CDC NNDSS weekly / story page', 'US grid, hour by hour / desk']);
    expect(cdcDesk.demo).toBe(cdcStory.demo);
    expect(cdcDesk.declares.revision).not.toBe(cdcStory.declares.revision);
    expect(gridDesk.declares.revision).not.toBe(cdcDesk.declares.revision);
  });

  it('links the two desks where this site puts them, and the story page nowhere — it is not published here', () => {
    expect(cdcDesk.href).toBe('./nndss/');
    expect(gridDesk.href).toBe('./grid/');
    expect(cdcStory.href).toBeUndefined();
    // the link table is the ONLY thing the site adds, and it names surfaces by the pair a card is named by
    expect(SITE_HREFS[cdcDesk.demo]?.[cdcDesk.surface]).toBe(cdcDesk.href);
    expect(SITE_HREFS[cdcStory.demo]?.[cdcStory.surface]).toBeUndefined();
  });

  it('stamps when the readers ran, and nothing else about the build', () => {
    expect(cards.builtAt).toBe(BUILT_AT);
    expect(Object.keys(cards)).toEqual(['builtAt', 'surfaces']);
  });
});

describe('the CDC desk and the CDC story page differ exactly where the design says', () => {
  it('desk-only DECLARED chips are the network and the rate, and what hangs off them: the view, its layers, the neighbourhood selection and link, the relations, the four acts, the keyed tables', () => {
    const declaredOnDeskOnly = onlyOn(cdcDesk, cdcStory).filter((id) => id.startsWith('declares:'));
    expect([...declaredOnDeskOnly].sort()).toEqual(
      ['declares:chart:network', 'declares:selection:neighbourhood', 'declares:link:neighbourhood', 'declares:relation:many-to-one', 'declares:builtin:layout', 'declares:builtin:bringOver', 'declares:builtin:derive', 'declares:holds:layers', 'declares:holds:row key'].sort(),
    );
    // the same difference, read straight off the reader rather than off the chips
    expect(cdcDesk.declares.views.find((v) => v.viewId === 'net')?.layers).toHaveLength(2);
    expect(cdcStory.declares.views.some((v) => v.viewId === 'net')).toBe(false);
    // the graph's layout and bring-over, and the rate's bring-over and derive
    expect(cdcDesk.declares.analyses.map((a) => a.builtin).filter((b) => b !== undefined).sort()).toEqual(['bringOver', 'bringOver', 'derive', 'layout']);
    expect(cdcStory.declares.analyses.some((a) => a.builtin !== undefined)).toBe(false);
  });

  it('the hand table sits on the desk alone — which gestures a cockpit wires is the desk’s answer', () => {
    const byHandOnDeskOnly = onlyOn(cdcDesk, cdcStory).filter((id) => id.startsWith('by hand:'));
    expect(byHandOnDeskOnly).toEqual(NNDSS_GESTURES.map((note) => `by hand:${note.gesture === null ? 'unwired' : 'gesture'}:${note.verb}`));
    expect(idsOf(cdcStory).some((id) => id.startsWith('by hand:'))).toBe(false);
  });

  it('story-only chips are ALL walked — the story page declares nothing the desk does not', () => {
    const storyOnly = onlyOn(cdcStory, cdcDesk);
    expect(storyOnly.every((id) => id.startsWith('walked:'))).toBe(true);
    expect([...storyOnly].sort()).toEqual(['walked:verb:select', 'walked:verb:filter', 'walked:verb:analyze', 'walked:verb:reencode', 'walked:verb:describe', 'walked:selection:interval', 'walked:selection:point', 'walked:trace:branched'].sort());
  });

  it('the walk never touched a network, and the two desks have no walk at all — said, not invented', () => {
    expect(cdcStory.walked?.commits).toBe(32);
    expect(cdcStory.walked?.selectionKinds).toEqual(['interval', 'point']);
    expect(idsOf(cdcStory)).not.toContain('walked:selection:neighbourhood');
    expect(cdcDesk.walked).toBeUndefined();
    expect(gridDesk.walked).toBeUndefined();
  });
});

describe('every chip is traceable to a reader or to the hand table — none typed', () => {
  /** Whether a declared holding is backed by the reader field the studio reads it off. */
  const HOLDS_FROM: Readonly<Record<string, (s: DemoSurface) => boolean>> = {
    layers: (s) => s.declares.views.some((v) => v.layers !== undefined),
    grain: (s) => s.declares.views.some((v) => v.grain !== undefined),
    prose: (s) => s.declares.proseSubjects.length > 0,
    absence: (s) => s.declares.tables.some((t) => t.absence !== undefined),
    'row key': (s) => s.declares.tables.some((t) => t.key !== undefined),
    'encoding rules': (s) => s.declares.encodingRules.rules > 0,
    'stated fold': (s) => s.declares.links.statesFold,
    'false-discovery control': (s) => s.declares.fdr !== null,
  };

  /** Every string the definition reader produced for this surface, wherever it sits. */
  const leavesOf = (value: unknown, into: Set<string> = new Set()): Set<string> => {
    if (typeof value === 'string') into.add(value);
    else if (Array.isArray(value)) for (const v of value) leavesOf(v, into);
    else if (typeof value === 'object' && value !== null) for (const v of Object.values(value)) leavesOf(v, into);
    return into;
  };

  const traceable = (surface: DemoSurface, chip: FeatureChip): boolean => {
    if (chip.ground === 'declares') return chip.facet === 'holds' ? HOLDS_FROM[chip.label]?.(surface) === true : leavesOf(surface.declares).has(chip.label);
    if (chip.ground === 'walked') {
      const walked = surface.walked;
      if (walked === undefined) return false;
      if (chip.facet === 'verb') return walked.verbs[chip.label as keyof typeof walked.verbs] === 'landed';
      if (chip.facet === 'selection') return (walked.selectionKinds as readonly string[]).includes(chip.label);
      return chip.label === 'branched' ? walked.branched : walked.agentCorrelated > 0;
    }
    return NNDSS_GESTURES.some((note) => note.verb === chip.label && (note.gesture === null) === (chip.facet === 'unwired'));
  };

  it('holds on every card the site ships', () => {
    for (const surface of shipped.surfaces) {
      const chips = chipsOf(surface);
      expect(chips.length).toBeGreaterThan(0);
      const untraceable = chips.filter((chip) => !traceable(surface, chip)).map((chip) => chip.id);
      expect(untraceable, `${surface.demo} / ${surface.surface}`).toEqual([]);
      // and every chip names the surface it came from — a chip is read far from its card
      for (const chip of chips) expect([chip.demo, chip.surface]).toEqual([surface.demo, surface.surface]);
    }
  });

  it('the site module added addresses and nothing else — its cards are the demo modules’ cards, chip for chip', () => {
    expect(cards.surfaces).toHaveLength(handedOver.length);
    cards.surfaces.forEach((surface, i) => {
      const theirs = handedOver[i]!;
      expect(chipsOf(surface)).toEqual(chipsOf(theirs));
      expect(surface.declares).toEqual(theirs.declares);
      expect(surface.walked).toEqual(theirs.walked);
      expect(surface.byHand).toEqual(theirs.byHand);
      // the same is true over the input alone, with no disk between
      expect(chipsOf(siteSurfaces(loadSiteCardsInputOnce())[i]!)).toEqual(chipsOf(theirs));
    });
  });

  it('the grid desk carries no hand table and no walk — nobody wrote one, nobody captured one', () => {
    expect(gridDesk.byHand).toBeUndefined();
    expect(idsOf(gridDesk).every((id) => id.startsWith('declares:'))).toBe(true);
  });
});

describe('the file the page fetches', () => {
  it('survives the wire — the JSON round trip keeps every chip on every card', () => {
    expect(shipped.surfaces.map(chipsOf)).toEqual(cards.surfaces.map(chipsOf));
    expect(shipped.builtAt).toBe(BUILT_AT);
  });

  it('is the one data/ file the build WRITES — never a checkout file the build copies', () => {
    expect(SITE_CARDS_FILE.startsWith('data/')).toBe(true);
    expect(SITE_DATA_FILES).not.toContain(SITE_CARDS_FILE);
  });

  it('resolves under a base exactly as the tables do', () => {
    const base = new URL('/vizfootprint-demos/', 'https://footprintjs.github.io');
    expect(new URL(SITE_CARDS_FILE, base).href).toBe('https://footprintjs.github.io/vizfootprint-demos/data/cards.json');
    expect(new URL(SITE_CARDS_FILE, new URL('/', 'http://localhost:5402')).href).toBe('http://localhost:5402/data/cards.json');
  });

  it('refuses a payload that is not the cards, in a sentence that says what came instead', () => {
    expect(() => readSiteCards('<!doctype html>')).toThrow(/the cards file is not an object — got a string/);
    expect(() => readSiteCards({ surfaces: [] })).toThrow(/names no builtAt/);
    expect(() => readSiteCards({ builtAt: BUILT_AT })).toThrow(/has no surfaces list/);
    expect(() => readSiteCards({ builtAt: BUILT_AT, surfaces: [{ demo: 'x', surface: 'desk' }] })).toThrow(/surface 0 \(x \/ desk\) has no declares/);
    expect(() => readSiteCards({ builtAt: BUILT_AT, surfaces: [{ demo: 'x', surface: 'desk', declares: { revision: 'r' } }] })).toThrow(/has no tables list/);
  });
});

describe('the filter over the shipped cards', () => {
  it('narrows to SURFACES: both desks draw a network, the story page does not', () => {
    expect(narrowTo(shipped.surfaces, 'declares:chart:network').map((s) => `${s.demo} / ${s.surface}`)).toEqual(['CDC NNDSS weekly / desk', 'US grid, hour by hour / desk']);
    expect(narrowTo(shipped.surfaces, 'declares:selection:neighbourhood')).toHaveLength(2);
    expect(narrowTo(shipped.surfaces, 'walked:verb:describe').map((s) => s.surface)).toEqual(['story page']);
    expect(narrowTo(shipped.surfaces, 'by hand:unwired:annotate').map((s) => `${s.demo} / ${s.surface}`)).toEqual(['CDC NNDSS weekly / desk']);
    expect(narrowTo(shipped.surfaces, null)).toHaveLength(3);
  });

  it('offers only choices that land somewhere, and refuses the rest in a sentence', () => {
    const choices = choicesOf(shipped.surfaces);
    expect(choices.length).toBeGreaterThan(0);
    for (const choice of choices) expect(narrowTo(shipped.surfaces, choice.id).length).toBe(choice.surfaces);
    expect(narrowRefusal(shipped.surfaces, 'declares:chart:sunburst')).toBe(`no surface here carries "declares:chart:sunburst" — ${String(choices.length)} features are on offer across 3 surfaces`);
    expect(narrowRefusal(shipped.surfaces, 'declares:chart:network')).toBeNull();
  });
});

// ── one load of the input for the whole file ─────────────────────────────────

let inputOnce: ReturnType<typeof loadSiteCardsInput> | undefined;
function loadSiteCardsInputOnce(): ReturnType<typeof loadSiteCardsInput> {
  inputOnce ??= loadSiteCardsInput();
  return inputOnce;
}
