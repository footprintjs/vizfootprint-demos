/**
 * ADD A COLUMN, THROUGH THE DOOR — the cockpit's "add a column" reaches this
 * server as an ordinary `analyze` dispatch that brings its own declaration.
 *
 * The door's whole job is to check the SHAPE and hand the rest over: a formula
 * record is data, so it crosses the wire unchanged, and what it says is the
 * library's to judge. These pin exactly that split — the door adds nothing, and
 * every sentence a person reads comes back from vizfootprint.
 */
import { describe, expect, it } from 'vitest';
import { userAction } from '../server/doors.js';
import { buildDashboard } from 'vizfootprint/def';
import type { DashboardDef } from 'vizfootprint/def';
import type { DispatchAction } from 'vizfootprint/session';

describe('POST /api/dispatch — the analyze verb carrying a declaration', () => {
  it('carries the formula record and the table it names, verbatim', () => {
    const action = userAction({
      verb: 'analyze',
      analysisId: 'rate',
      def: { builtin: 'formula', expression: 'cases / 1000', name: 'rate', table: 'cells' },
      table: 'cells',
      intent: 'add column rate = cases / 1000',
    });
    expect(action).toMatchObject({
      verb: 'analyze',
      analysisId: 'rate',
      def: { builtin: 'formula', expression: 'cases / 1000', name: 'rate', table: 'cells' },
      table: 'cells',
    });
    expect((action as Extract<DispatchAction, { verb: 'analyze' }>).cause.intent).toBe('add column rate = cases / 1000');
  });

  it('still takes an analyze with no declaration — the def already named that one', () => {
    expect(userAction({ verb: 'analyze', analysisId: 'byWeek' })).toMatchObject({ verb: 'analyze', analysisId: 'byWeek' });
    expect('def' in (userAction({ verb: 'analyze', analysisId: 'byWeek' }) as object)).toBe(false);
  });

  it('refuses a declaration that is not a record — the one thing this door judges', () => {
    expect(userAction({ verb: 'analyze', analysisId: 'rate', def: 'cases / 1000' })).toEqual({
      error: 'analyze.def must be a record naming a builtin analysis',
    });
    expect(userAction({ verb: 'analyze', def: {} })).toEqual({ error: 'analyze needs analysisId' });
  });
});

describe('what the library then does with it', () => {
  const DEF: DashboardDef = {
    data: { cells: { rows: [
      { id: 'a', jurisdiction: 'Texas', cases: 120, ytd: 600 },
      { id: 'b', jurisdiction: 'Maine', cases: 0, ytd: 0 },
      { id: 'c', jurisdiction: 'Ohio', cases: 30, ytd: 300 },
    ] } },
    actors: { sheet: { actor: 'user', label: 'The rows' } },
    defaultTable: 'cells',
  };

  it('lands the column as an act, with the numbers the formula worked out', async () => {
    const session = buildDashboard(DEF).createSession();
    const action = userAction({ verb: 'analyze', analysisId: 'share', def: { builtin: 'formula', expression: 'cases / ytd', name: 'share', table: 'cells' }, table: 'cells', intent: 'add column share = cases / ytd' });
    const res = await session.dispatch(action as DispatchAction);
    expect(res.ok).toBe(true);
    expect(session.log.records.at(-1)!.viewId).toBe('analysis:share');
    const rows = await session.viewQuery({ columns: ['id', 'share'], limit: 10 });
    // Maine divides by zero: a silence, never Infinity
    expect(rows.ok && rows.rows.map((r) => r['share'])).toEqual([0.2, null, 0.1]);
  });

  it('refuses a formula over a column that is not a number, in the library’s sentence, and lands nothing', async () => {
    const session = buildDashboard(DEF).createSession();
    const action = userAction({ verb: 'analyze', analysisId: 'odd', def: { builtin: 'formula', expression: 'cases / jurisdiction', name: 'odd', table: 'cells' }, table: 'cells' });
    const res = await session.dispatch(action as DispatchAction);
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.rejection.detail).toBe(
      'the formula "cases / jurisdiction" reads "jurisdiction", which table "cells" holds as string — a formula reads numbers',
    );
    expect(session.log.records).toHaveLength(0);
  });
});
