// Demo controls: stand-in for the rider app. Lets the presenter trigger real-world events.
import { store } from '../core/store.js';
import { demo } from '../core/simulation.js';
import { engineLabel } from '../agents/index.js';
import { $, on, esc, toast } from './dom.js';

let el;
const REASONS = ['Customer not home', 'Address not found', 'Customer refused'];

function render(state) {
  const riders = state.riders.filter((r) => r.available);
  const active = riders.filter((r) => r.queue.length);
  const delivering = state.phase === 'delivering';
  const selected = $('#demo-rider', el)?.value;
  el.innerHTML = `
    <div class="panel-title"><h2>Demo controls</h2><button class="btn btn--ghost btn--sm" type="button" data-close>Close</button></div>
    <p class="muted small">Stand-in for the rider app. Trigger what riders would report from the field.</p>

    <div class="drawer-section">
      <h3>Rider events</h3>
      ${delivering ? '' : '<p class="muted small">Available once dispatch starts deliveries. You can still mark a rider absent before the morning assignment.</p>'}
      <label class="visually-hidden" for="demo-rider">Rider</label>
      <select id="demo-rider" class="control control--sm">${riders.map((r) => `<option value="${r.id}"${r.id === selected ? ' selected' : ''}>${esc(r.name)}${delivering ? `, ${r.queue.length} to go` : ''}</option>`).join('')}</select>
      <div class="btn-row">
        <button class="btn btn--ghost btn--sm" data-action="delivered" ${delivering && active.length ? '' : 'disabled'}>Mark next delivered</button>
        <button class="btn btn--danger btn--sm" data-action="absent" ${riders.length ? '' : 'disabled'}>Mark rider absent</button>
      </div>
      <label class="visually-hidden" for="demo-reason">Failure reason</label>
      <select id="demo-reason" class="control control--sm">${REASONS.map((r) => `<option>${r}</option>`).join('')}</select>
      <button class="btn btn--danger btn--sm" data-action="failed" ${delivering && active.length ? '' : 'disabled'}>Report failed attempt</button>
    </div>

    <div class="drawer-section">
      <h3>Simulation</h3>
      <div class="btn-row">
        <button class="btn btn--ghost btn--sm" data-action="pause" ${delivering ? '' : 'disabled'}>${demo.isPaused() ? 'Resume riders' : 'Pause riders'}</button>
        <button class="btn btn--ghost btn--sm" data-action="reset">Reset demo</button>
      </div>
    </div>

    <div class="drawer-section">
      <h3>Agent engine</h3>
      <p class="small"><strong>${engineLabel()}</strong></p>
      <p class="muted small">Add <code>?ai=live</code> to the address, with the backend proxy running, to send agent decisions to a live model. See docs/ai-integration.md.</p>
    </div>

    <div class="drawer-section">
      <h3>Suggested demo</h3>
      <ol>
        <li>Book with “Landmark in Filipino”, then try “Barangay mismatch” and “Sending to Manila”.</li>
        <li>Confirm the flagged bookings in Intake review.</li>
        <li>Run the morning assignment, approve it, and hand the outbound parcels to the hub.</li>
        <li>Start deliveries, then report a failed attempt.</li>
        <li>Ask the delivery status agent about that parcel.</li>
      </ol>
    </div>`;
}

export function mount(root) {
  el = root;
  const rider = () => $('#demo-rider', el).value;
  on(el, 'click', '[data-action=delivered]', () => {
    const ref = demo.markDelivered(rider());
    toast(ref ? `${ref} marked delivered.` : 'This rider has no parcels left.');
  });
  on(el, 'click', '[data-action=failed]', () => {
    const reason = $('#demo-reason', el).value;
    const ref = demo.markFailed(rider(), reason);
    toast(ref ? `${ref}: failed attempt, ${reason.toLowerCase()}.` : 'This rider has no parcels left.', ref ? 'flag' : '');
  });
  on(el, 'click', '[data-action=absent]', () => {
    const r = store.get().riders.find((x) => x.id === rider());
    const n = demo.riderAbsent(r.id);
    toast(n ? `${r.name} marked absent. ${n} parcels flagged for dispatch.` : `${r.name} marked absent.`, 'flag');
  });
  on(el, 'click', '[data-action=pause]', () => { demo.togglePause(); render(store.get()); });
  on(el, 'click', '[data-action=reset]', () => { demo.reset(); toast('Demo reset.'); });
  render(store.get());
}

export function update(state, change) {
  if (change.type === 'tick') return;
  if (el.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
  render(state);
}
