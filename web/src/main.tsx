/**
 * The app's root: one component, and no router.
 *
 * The landing page used to be switched in here — `entered ? <App/> : <Home/>`
 * — so that the dashboard's reads did not run behind it. That law has not
 * changed; only where it is kept has. The desk carries a `front` slot and
 * mounts NOTHING of itself until the reader goes in, so `App` holds the front
 * door and the switch is one line inside it.
 */
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(<App />);
