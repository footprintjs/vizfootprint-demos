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
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  // WHY a longer budget than vitest's 5,000 ms default: two tests drive a whole
  // scripted analyst turn over the real 90,300-row snapshot — building the
  // surface, dispatching the verbs and folding every commit. Each finishes in
  // about four seconds ALONE, so under the full suite's parallelism they were
  // failing on the clock rather than on anything they assert. A budget that
  // fails when the machine is busy is a budget that reports the machine, not
  // the code.
  test: { include: ['tests/**/*.test.{ts,tsx}'], testTimeout: 30_000, hookTimeout: 30_000 },
});
