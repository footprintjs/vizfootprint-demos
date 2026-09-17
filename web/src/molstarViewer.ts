/**
 * THE MOL* ADAPTER — the only module in this repository that speaks Mol*.
 *
 * It implements {@link StructureViewerPort}, which is our shape: load a
 * structure file, paint named residues, report a click, resize, dispose. The
 * renderer above it (`./molstarRenderer.ts`) decides WHAT colour every residue
 * is, from the rows and the fold; this file knows only how to ask Mol* for it.
 * Keeping the two apart is what lets the conformance kit test the protocol
 * without a GPU — and it is why every Mol* type stays inside this file.
 *
 * ── Why no Mol* UI ─────────────────────────────────────────────────────────
 * `PluginContext` + `initViewerAsync` is the viewer with NO controls: a canvas,
 * a camera and a scene. The plugin's own React UI is not imported, and not
 * because of bytes — a second UI beside the desk's would offer a reader panels
 * that change the picture with nothing on the trace. What a reader can still do
 * is orbit the camera, which changes no data and is why the renderer declares
 * `canPanZoom: false` rather than pretending to record it.
 *
 * ── Every call into Mol*, and what it is for ────────────────────────────────
 *   `builders.data.rawData`          the file's text, handed over as bytes
 *   `builders.structure.parseTrajectory(_, 'pdb')`
 *                                    parse it — the ONE place the format word
 *                                    is spoken
 *   `hierarchy.applyPreset(_, 'default')`
 *                                    Mol*'s own default representation: a
 *                                    cartoon per chain. This demo chooses no
 *                                    representation of its own, because which
 *                                    ribbon a viewer draws is the viewer's
 *                                    business and not a claim about the data.
 *   `setStructureOverpaint`          the paint: one call per bucket, over a
 *                                    loci built from the residue addresses
 *   `behaviors.interaction.click`    the pick
 *
 * Nothing here computes anything about the data: no distances, no interfaces,
 * no secondary structure. Mol* is asked for a picture and for a click, which is
 * the transform-ownership rule at the edge of somebody else's library.
 */
import { setStructureOverpaint } from 'molstar/lib/mol-plugin-state/helpers/structure-overpaint.js';
import { StructureElement, StructureProperties, type Structure } from 'molstar/lib/mol-model/structure.js';
import { PluginContext } from 'molstar/lib/mol-plugin/context.js';
import { DefaultPluginSpec } from 'molstar/lib/mol-plugin/spec.js';
import { MolScriptBuilder as Q } from 'molstar/lib/mol-script/language/builder.js';
import { Color } from 'molstar/lib/mol-util/color/index.js';
import type { Expression } from 'molstar/lib/mol-script/language/expression.js';
import type { PaintBucket, ResidueAddress, StructureViewerPort } from './molstarRenderer.js';

/** The format word, spoken once. */
const FORMAT = 'pdb' as const;

/**
 * A CSS COLOUR AS A MOL\* COLOUR — `#05080b` becomes `0x05080b`.
 *
 * `undefined` for anything that is not a six-digit hex, which means "say
 * nothing and let the engine keep its own default": a host that handed over a
 * colour nobody can parse should not silently get black.
 */
function molColor(css: string | undefined): Color | undefined {
  if (css === undefined || !/^#[0-9a-fA-F]{6}$/.test(css)) return undefined;
  return Color(Number.parseInt(css.slice(1), 16));
}

/** What a host may say about the box it is mounting this viewer into. */
export interface MolstarViewerOptions {
  /**
   * THE GROUND, as a CSS colour — the ONE thing about the picture this desk
   * decides, and it decides it because it owns the box.
   *
   * Absent ⇒ Mol\*'s own default. See {@link molstarViewer} for which of the
   * two writers of that colour wins.
   */
  readonly background?: string;
}

/**
 * Start a viewer inside `el` and answer the port.
 *
 * Throws when this browser will not give Mol* a WebGL context — which the
 * renderer catches and says out loud, because a 3D view that silently draws
 * nothing is the worst of the three outcomes.
 *
 * ── THE GROUND NOW HAS TWO WRITERS, AND THE CANVAS WINS ────────────────────
 * The desk frames this viewer in a dark well of its own
 * (`web/src/workbench/ChartCard.tsx` · `ViewerBox`, painted
 * `var(--pw-viewer-bg)`), and Mol* clears its canvas over the whole of it. So
 * two things write that colour and the CANVAS is what a reader sees; the well
 * shows through only before WebGL has painted and in the one case where it
 * never does — a viewer that could not start, where the well is the ground the
 * renderer's own refusal sentence is read on.
 *
 * They cannot disagree, because they are the same value: the well takes it from
 * the token in CSS and this function takes it from the SAME token resolved in
 * TypeScript (`web/src/workbench/tokens.ts` · `PW.viewerBg`, its literal copy
 * pinned to the stylesheet by `tests/prot-theme.test.ts`). The molecule's own
 * colours are untouched — this is the page not letting two grounds fight inside
 * one box, not the page overriding somebody else's picture.
 */
export async function molstarViewer(el: HTMLElement, options: MolstarViewerOptions = {}): Promise<StructureViewerPort> {
  const doc = el.ownerDocument;
  const container = doc.createElement('div');
  container.style.cssText = 'position:absolute;inset:0';
  const canvas = doc.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%';
  container.append(canvas);
  el.append(container);

  const spec = DefaultPluginSpec();
  const ground = molColor(options.background);
  const plugin = new PluginContext(
    ground === undefined ? spec : { ...spec, canvas3d: { ...spec.canvas3d, renderer: { ...spec.canvas3d?.renderer, backgroundColor: ground } } },
  );
  await plugin.init();
  if (!(await plugin.initViewerAsync(canvas, container))) {
    plugin.dispose();
    container.remove();
    throw new Error('this browser gave Mol* no WebGL context');
  }

  return {
    async load(text: string): Promise<void> {
      const data = await plugin.builders.data.rawData({ data: text, label: FORMAT });
      const trajectory = await plugin.builders.structure.parseTrajectory(data, FORMAT);
      await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default');
    },
    async paint(buckets: readonly PaintBucket[]): Promise<void> {
      const components = plugin.managers.structure.hierarchy.current.structures.flatMap((s) => s.components);
      if (components.length === 0) return; // nothing is loaded yet: a paint with no structure is not an error
      for (const bucket of buckets) {
        if (bucket.residues.length === 0) continue; // an empty bucket is not a colour to apply
        await setStructureOverpaint(plugin, components, Color(bucket.color), async (structure) => lociFor(structure, bucket.residues));
      }
    },
    onPick(listener: (residue: ResidueAddress | null) => void): void {
      plugin.behaviors.interaction.click.subscribe((event) => {
        listener(residueAt(event.current.loci));
      });
    },
    resize(): void {
      plugin.handleResize();
    },
    dispose(): void {
      plugin.dispose();
      container.remove();
    },
  };
}

/**
 * The residue a click landed on, in the file's OWN labels (`auth_asym_id` and
 * `auth_seq_id`) — the two fields `src/prot/etl.ts` mints the join key from, so
 * a pick and a row cannot mean different residues.
 *
 * `null` for anything that is not an element pick (the background, a label, an
 * empty scene), which the renderer turns into the contract's cleared point.
 */
function residueAt(loci: unknown): ResidueAddress | null {
  if (!StructureElement.Loci.is(loci)) return null;
  const location = StructureElement.Loci.getFirstLocation(loci);
  if (location === undefined) return null;
  return { chain: StructureProperties.chain.auth_asym_id(location), resnum: StructureProperties.residue.auth_seq_id(location) };
}

/**
 * The loci for a set of residue addresses — one atom-group query per CHAIN,
 * merged.
 *
 * Per chain and not one query over two sets, deliberately: chain A and chain B
 * both number their residues from 1 here, so a single query over {A,B} × {1…}
 * would select the cross product and light up residues nobody picked.
 */
function lociFor(structure: Structure, residues: readonly ResidueAddress[]): StructureElement.Loci {
  const byChain = new Map<string, number[]>();
  for (const r of residues) byChain.set(r.chain, [...(byChain.get(r.chain) ?? []), r.resnum]);
  const groups: Expression[] = [...byChain.entries()].map(([chain, numbers]) =>
    Q.struct.generator.atomGroups({
      'chain-test': Q.core.rel.eq([Q.ammp('auth_asym_id'), chain]),
      'residue-test': Q.core.set.has([Q.set(...numbers), Q.ammp('auth_seq_id')]),
      'group-by': Q.struct.atomProperty.macromolecular.residueKey(),
    }),
  );
  return StructureElement.Loci.fromExpression(structure, Q.struct.combinator.merge(groups));
}
