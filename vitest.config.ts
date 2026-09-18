/**
 * The demo's test run. It existed as vitest's defaults until the desk's CELLS
 * needed testing, and a cell is React.
 *
 * WHY the dedupe: `vizfootprint`, `vizfootprint-ui`, `vizfootprint-studio` and
 * `storydeck` are `file:` siblings, each with its own React for its own tests.
 * Two copies of React in one render is the classic hook crash — `useState` off
 * a null dispatcher — so one copy is the contract here exactly as it is in
 * `web/vite.config.ts`. This file says the same thing that one says, for the
 * same reason.
 *
 * WHY TWO PROJECTS: the suites ending `.smoke.test.ts` each launch a REAL
 * headless Chromium (playwright-core, swiftshader) and drive the built site.
 * There are five of them now, and vitest runs files in parallel, so five
 * browsers were competing for one machine's CPU and software GL — which is not
 * a slow test, it is five tests each being made slow by the other four. They
 * failed on the clock rather than on anything they assert, and a DIFFERENT one
 * failed each run, which is the signature.
 *
 * The honest statement is not a longer budget, it is that THESE FIVE ARE NOT
 * INDEPENDENT OF ONE ANOTHER: each wants the whole machine for the length of a
 * page load. So they run one at a time (`fileParallelism: false`, browser
 * project) while every other file keeps the parallelism it had. The timeout
 * below stays what it was for the reason it was raised — two analyst-turn tests
 * fold a 90,300-row snapshot and take about four seconds alone.
 *
 * The rule this encodes, worth keeping: a budget that fails when the machine is
 * busy reports the machine rather than the code, and the answer is to stop
 * making the machine busy, never to widen the budget until the report goes away.
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/** What every project shares: one React, the same plugin, the same budget. */
const shared = {
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
} as const;

/** The browser suites, by the name they are spelled with — one list, read twice (included here, excluded there). */
const BROWSER_SUITES = 'tests/**/*.smoke.test.ts';

export default defineConfig({
  ...shared,
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    projects: [
      {
        ...shared,
        test: {
          name: 'unit',
          include: ['tests/**/*.test.{ts,tsx}'],
          exclude: [BROWSER_SUITES],
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
      {
        ...shared,
        test: {
          name: 'browser',
          include: [BROWSER_SUITES],
          // one browser at a time — see the header
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
