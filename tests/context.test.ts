import { describe, expect, it } from 'vitest';
import { onScreenNow } from '../server/doors.js';
import { buildNndssSurface } from '../src/nndss/surface.js';
import type { Cause } from 'vizfootprint/cause';

/**
 * WHAT THE ANALYST IS TOLD IS ON SCREEN.
 *
 * The block is headed "On screen now (from the record)", which is a claim
 * about a POSITION. It used to list the last six acts of the whole tree, so
 * after a seek or a fork the analyst read acts from a branch the dashboard was
 * not standing on — and could then cite one, which is exactly the off-branch
 * citation the library refuses at the describe door.
 *
 * Scoping it to the cursor's path fixes that and opens a second, quieter
 * failure: showing FEWER acts and saying nothing reads as "this dashboard has
 * a short history" when the truth is that it has a different one. So the trim
 * is disclosed — the two numbers, and only the numbers.
 */
const cause = (intent: string): Cause => ({ requestedBy: 'user', computedBy: 'user', intent });

/** Root pick, then two brushes off it — path A abandoned, the cursor left on B. */
async function twoPaths() {
  const { session } = buildNndssSurface();
  const root = await session.dispatch({ verb: 'select', viewId: 'diseases', field: 'disease', value: 'Pertussis', cause: cause('pick pertussis') });
  const a = await session.dispatch({ verb: 'select', viewId: 'map', field: 'jurisdiction', value: 'Texas', cause: cause('the texas end') });
  session.seek(root.ok && root.commit ? root.commit.id : '');
  const b = await session.dispatch({ verb: 'select', viewId: 'map', field: 'jurisdiction', value: 'Ohio', cause: cause('the ohio end') });
  return { session, aId: a.ok && a.commit ? a.commit.id : '', bId: b.ok && b.commit ? b.commit.id : '' };
}

describe('onScreenNow — the acts are the ones THIS position saw', () => {
  it('lists the cursor\'s path, never the abandoned branch', async () => {
    const { session, aId, bId } = await twoPaths();
    const block = await onScreenNow(session);
    expect(block).toContain(`#${bId}`); // the brush this position actually made
    expect(block).not.toContain(`#${aId}`); // the other path's brush is elsewhere, not earlier
  });

  it('discloses the trim: the two numbers, and not the other acts', async () => {
    const { session } = await twoPaths();
    const block = await onScreenNow(session);
    // 2 acts on the path (the root pick + this branch's brush), 1 more on the abandoned one
    expect(block).toContain('- 2 acts on this path; 1 more on other paths.');
    expect(block).not.toContain('the texas end'); // named would invite a citation the library refuses
  });

  it('says nothing when there is nothing to disclose — one path, no acts elsewhere', async () => {
    const { session } = buildNndssSurface();
    await session.dispatch({ verb: 'select', viewId: 'diseases', field: 'disease', value: 'Pertussis', cause: cause('pick pertussis') });
    const block = await onScreenNow(session);
    expect(block).toContain('- last acts: ');
    expect(block).not.toMatch(/on other paths/);
  });

  it('counts one act as "1 act", so the line reads as a sentence', async () => {
    const { session } = buildNndssSurface();
    const root = await session.dispatch({ verb: 'select', viewId: 'diseases', field: 'disease', value: 'Pertussis', cause: cause('pick pertussis') });
    await session.dispatch({ verb: 'select', viewId: 'map', field: 'jurisdiction', value: 'Texas', cause: cause('the texas end') });
    session.seek(root.ok && root.commit ? root.commit.id : '');
    expect(await onScreenNow(session)).toContain('- 1 act on this path; 1 more on other paths.');
  });
});
