/**
 * The app's root: the front door, then the dashboard.
 *
 * One piece of state and no router — there is nothing to address here but
 * "before the click" and "after it", and `App` is deliberately not mounted
 * until then, so the dashboard's reads (the rows, the map shapes, the state
 * poll) do not run behind the landing page.
 */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { Home } from './Home.js';

function Demo(): JSX.Element {
  const [entered, setEntered] = useState(false);
  return entered ? <App /> : <Home onEnter={() => setEntered(true)} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(<Demo />);
