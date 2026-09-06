/**
 * THE DESK THE PAGE CARRIES — the same charts, in two lenses.
 *
 * A story page is something a person was SENT: no server, no `/api/rows`, no
 * analyst, no proposals. What a reader needs is the charts the story is about
 * and a way to try their own question on them.
 *
 * This file used to be its own dashboard — five `CockpitChart` cells, the
 * palette, the defaults and the captions, all re-declared beside the cockpit's
 * seven. That was two spellings of one desk, and the second one had already
 * drifted (different captions, an undeclared coverage vocabulary, a hard-coded
 * `report_state`). Now there is one: `../src/cells.js` declares the cells,
 * `vizfootprint-studio/desk` draws them, and this file is the thirty lines that
 * say WHICH lens.
 *
 *   figure  — the pinned charts under the story, four of the seven
 *   cockpit  — the desk a reader's own acts land on, after a beat's door
 */
import type { ReactNode } from 'react';
import type { GeoFeatureCollection } from 'vizfootprint-ui';
import { Desk, DeskFigure, type DeskProjection } from 'vizfootprint-studio/desk';
import type { StoryLens } from 'vizfootprint-ui/story/page';
import { STORY_FIGURE, useNndssCells, type NndssDeskData } from '../src/cells.js';
import { ABSENCE_FIELD, ABSENCE_STATES } from '../../src/nndss/absence.js';
import type { NndssTables } from '../../src/nndss/etl.js';

export interface StoryDeskProps {
  readonly lens: StoryLens;
  readonly tables: NndssTables;
  readonly geo: GeoFeatureCollection | null;
  /** `figure` — the pinned charts under the story; `cockpit` — the desk a reader acts on. */
  readonly as: 'figure' | 'cockpit';
}

export function StoryDesk({ lens, tables, geo, as }: StoryDeskProps): ReactNode {
  // the same shape `App.tsx` builds off `/api/rows` — so the cells cannot tell
  // which surface they are on
  const data: NndssDeskData = {
    cells: tables.cells,
    series: tables.series,
    diseases: tables.diseases,
    weeks: tables.weeks,
    absence: { field: ABSENCE_FIELD, states: [...ABSENCE_STATES] },
    grain: tables.grain,
    geo,
  };
  const charts = (desk: DeskProjection) => useNndssCells(desk, data);
  // The session is the PAGE's — it built it out of the payload and owns its
  // lifetime — so both lenses take the live view, never a factory.
  return as === 'figure' ? <DeskFigure view={lens.view} charts={charts} show={STORY_FIGURE} /> : <Desk view={lens.view} charts={charts} />;
}
