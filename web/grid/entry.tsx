/**
 * THE GRID PAGE — the second demo's entry, beside the dashboard's and the
 * wizard's.
 *
 * One component and no configuration, the way `web/make/entry.tsx` is: the
 * desk, its cells and its doors all live in `web/src/GridApp.tsx`, and this
 * file exists only to mount it. The build that produces it is
 * `npm run grid:page` (`web/grid.vite.config.ts`), which proxies `/api` to the
 * demo server in dev exactly as the CDC page's build does — the grid's four
 * tables sit behind `/api/grid/*` in the SAME process, so one server serves
 * both dashboards and neither knows about the other.
 */
import { createRoot } from 'react-dom/client';
import { GridApp } from '../src/GridApp.js';

const root = document.getElementById('root');
if (root === null) throw new Error('the page has no #root to mount into');

createRoot(root).render(<GridApp />);
