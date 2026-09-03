/**
 * The saved-picture door: `{ action: 'save' | 'rename' | 'apply' }` routed to
 * the session's OWN doors, with the session's answer handed back verbatim.
 *
 * None of the three is a dispatch verb, and the door exists because of that:
 * naming a picture lands NO commit, and applying one lands SEVERAL under one
 * cause. Sending either through `/api/dispatch` would put the act on the trace
 * under another act's name — and the cockpit used to do worse, saving a picture
 * as an `annotate` on a commit id, which the library never saw at all.
 */
import { describe, expect, it } from 'vitest';
import { savedAction } from '../server/doors.js';
import type { Desk } from '../server/doors.js';

/** A session that only remembers what it was asked — enough to prove the door passes the question and the answer through. */
function fakeDesk() {
  const asked: unknown[] = [];
  const session = {
    saveSelection: (name: string, source: unknown, as: string) => {
      asked.push({ op: 'save', name, source, as });
      return { ok: true, saved: { id: 'p1', name } };
    },
    renameSaved: (from: string, to: string, as: string) => {
      asked.push({ op: 'rename', from, to, as });
      return { ok: false, rejected: `"${to}" is already saved — rename or forget it first` };
    },
    applySaved: (name: string, cause: Record<string, unknown>, opts: Record<string, unknown>) => {
      asked.push({ op: 'apply', name, cause, opts });
      return Promise.resolve({ ok: true, name, correlationId: 'k1', applied: [{ id: 'c1' }], cleared: [], refused: [] });
    },
  };
  return { asked, desk: { surface: { session } } as unknown as Desk };
}

describe('POST /api/saved', () => {
  it('names a picture through the store door — as the person, with the source the cockpit sent', async () => {
    const { asked, desk } = fakeDesk();
    expect(await savedAction(desk, { action: 'save', name: 'coastal', source: { live: 'all' } })).toEqual({ ok: true, saved: { id: 'p1', name: 'coastal' } });
    expect(asked).toEqual([{ op: 'save', name: 'coastal', source: { live: 'all' }, as: 'user' }]);
  });

  it('a save with no source is refused here, in words — the library is never handed a shape it cannot read', async () => {
    const { asked, desk } = fakeDesk();
    expect(await savedAction(desk, { action: 'save', name: 'coastal' })).toEqual({ ok: false, rejected: 'saving a picture needs a source: { live: "all" }, { viewId } or { conditions }' });
    expect(await savedAction(desk, { action: 'save', name: 'coastal', source: ['not', 'an', 'object'] })).toMatchObject({ ok: false });
    expect(asked).toEqual([]);
  });

  it('hands a rename\'s REFUSAL back exactly as the session said it', async () => {
    const { asked, desk } = fakeDesk();
    expect(await savedAction(desk, { action: 'rename', from: 'coastal', to: 'taken' })).toEqual({ ok: false, rejected: '"taken" is already saved — rename or forget it first' });
    expect(asked).toEqual([{ op: 'rename', from: 'coastal', to: 'taken', as: 'user' }]);
  });

  it('applies with the mode asked for (replace by default) and NO intent of its own — the session names the act', async () => {
    const { asked, desk } = fakeDesk();
    expect(await savedAction(desk, { action: 'apply', name: 'coastal', mode: 'layer' })).toMatchObject({ ok: true, applied: [{ id: 'c1' }] });
    await savedAction(desk, { action: 'apply', name: 'coastal' });
    expect(asked).toEqual([
      { op: 'apply', name: 'coastal', cause: { requestedBy: 'user', computedBy: 'user' }, opts: { mode: 'layer', as: 'user' } },
      { op: 'apply', name: 'coastal', cause: { requestedBy: 'user', computedBy: 'user' }, opts: { mode: 'replace', as: 'user' } },
    ]);
  });

  it('an action the door does not know is refused by name, never guessed at', async () => {
    const { asked, desk } = fakeDesk();
    expect(await savedAction(desk, { action: 'forget', name: 'coastal' })).toEqual({ ok: false, rejected: 'no saved-selection action "forget" — save, rename or apply' });
    expect(asked).toEqual([]);
  });
});
