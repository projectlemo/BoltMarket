import './fonts';
import './index.css';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { resolveState } from './router';

async function boot() {
  const state = await resolveState(window.location.href);
  const el = document.getElementById('root');
  if (!el) return;
  const app = <App initial={state} />;
  // Hydrate only when the static HTML was rendered for this exact route
  // (404.html is also served for client-only URLs such as /portal/support/42/).
  if (el.firstElementChild && el.dataset.route === `${state.lang}:${state.path}`) {
    hydrateRoot(el, app);
  } else {
    el.textContent = '';
    createRoot(el).render(app);
  }
}

void boot();
