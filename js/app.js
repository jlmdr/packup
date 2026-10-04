// App shell: hash routing, screen mounting and store subscriptions.
import { store } from './core/store.js';
import { $, $$, toast } from './ui/dom.js';
import { onFallback } from './agents/index.js';
import * as booking from './ui/booking.js';
import * as review from './ui/intake-review.js';
import * as dispatch from './ui/dispatch.js';
import * as tracking from './ui/tracking.js';
import * as demoPanel from './ui/demo-panel.js';

const SCREENS = { book: booking, review, dispatch, tracking };
const DEFAULT = 'book';

function currentScreen() {
  const id = location.hash.slice(1);
  return SCREENS[id] ? id : DEFAULT;
}

function show(id) {
  Object.keys(SCREENS).forEach((key) => { $(`#screen-${key}`).hidden = key !== id; });
  $$('.nav a').forEach((a) => {
    if (a.dataset.screen === id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

function updateCounts(state) {
  const counts = { review: review.badgeCount(state), dispatch: dispatch.badgeCount(state) };
  Object.entries(counts).forEach(([key, n]) => {
    const badge = $(`[data-count=${key}]`);
    badge.textContent = n;
    badge.hidden = n === 0;
  });
}

function setupDrawer() {
  const toggle = $('.demo-toggle');
  const drawer = $('#demo-drawer');
  const set = (open) => { drawer.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); };
  toggle.addEventListener('click', () => set(!drawer.classList.contains('open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  drawer.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) set(false); });
}

function start() {
  Object.entries(SCREENS).forEach(([key, screen]) => screen.mount($(`#screen-${key}`)));
  demoPanel.mount($('#demo-drawer'));
  setupDrawer();

  store.subscribe((state, change) => {
    Object.values(SCREENS).forEach((screen) => screen.update(state, change));
    demoPanel.update(state, change);
    if (change.type !== 'tick') updateCounts(state);
  });

  // Tell the presenter once if live decisions fall back to the simulated agents.
  const stop = onFallback(() => { toast('Live model unavailable, so the simulated agents answered.', 'flag'); stop(); });

  window.addEventListener('hashchange', () => show(currentScreen()));
  show(currentScreen());
  updateCounts(store.get());
}

start();
