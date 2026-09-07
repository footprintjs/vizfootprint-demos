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
  test: { include: ['tests/**/*.test.{ts,tsx}'] },
});
