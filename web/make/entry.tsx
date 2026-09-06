/**
 * THE WIZARD'S PAGE — and, once it has published, the page it published.
 *
 * There is one component and no configuration, which is the point:
 * `vizfootprint-studio/make` needs nothing from this demo. The CDC desk is a
 * definition somebody wrote in TypeScript; this is the other half of the studio,
 * where a person writes one by bringing a file.
 *
 * **This entry has two roles and does not choose between them.** `Make` looks at
 * the document: a page carrying a payload block is a desk somebody published, so
 * it opens that; a page carrying none is the wizard. That is what makes
 * publishing a copy of THIS page work at all — the file it hands over is this
 * bundle with a payload in it.
 *
 * Which is why the real artifact is `npm run make:page`
 * (`web/make.vite.config.ts` + vite-plugin-singlefile), not the dev server: a
 * page whose code lives in `assets/index-abc.js` copies as a page missing its
 * code, and the wizard REFUSES to publish from one, naming the files it found.
 * The dev server is exactly that page, and the refusal there is the honest
 * answer rather than a bug.
 */
import { createRoot } from 'react-dom/client';
import { Make } from 'vizfootprint-studio/make';
import 'vizfootprint-ui/styles.css';
// the desk a made definition opens carries the Story tab, whose scroll lens is storydeck's
import 'storydeck/storydeck.css';

const root = document.getElementById('root');
if (root === null) throw new Error('the page has no #root to mount into');

createRoot(root).render(<Make />);
