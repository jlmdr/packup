// Staff screen: bookings the intake agent couldn't confirm, reviewed before dispatch.
import { store } from '../core/store.js';
import { listCities, listBarangays } from '../tools/address-tools.js';
import { agents } from '../agents/index.js';
import { formatPhone } from '../core/util.js';
import { $, on, esc, toast, ICONS, statusBadge } from './dom.js';

let el;

const pending = (state) => state.parcels.filter((p) => p.status === 'flagged' && p.flag?.type === 'intake');

const barangayOptions = (city, selected = '') => `<option value="">Choose barangay</option>${listBarangays(city)
  .map((b) => `<option${b === selected ? ' selected' : ''}>${esc(b)}</option>`).join('')}`;

function card(p) {
  const cities = listCities().map((c) => `<option${c === p.city ? ' selected' : ''}>${esc(c)}</option>`).join('');
  return `
  <article class="panel review-card" data-ref="${p.ref}">
    <div class="review-meta">
      <span class="ref">${p.ref}</span>${statusBadge(p.status)}
      <span class="muted small">${esc(p.recipient)}, ${esc(formatPhone(p.phone))}</span>
      <span class="muted small">Booked ${esc(p.createdAt)} by ${esc(p.sender)}</span>
    </div>
    <p class="flag-reason">${ICONS.flag}<span>${esc(p.flag.reason)}</span></p>
    ${p.item ? `<p class="small"><strong>Contents:</strong> ${esc(p.item)}${(p.handling || []).map((t) => ` <span class="tag tag--muted">${t}</span>`).join('')}</p>` : ''}
    <div><p class="muted small">Address as typed</p><p class="typed">${esc(p.typedAddress || [p.street, p.landmark].filter(Boolean).join(', '))}</p></div>
    <div class="field"><label for="st-${p.ref}">House, lot or street</label><input id="st-${p.ref}" name="street" value="${esc(p.street)}"></div>
    <div class="field-row">
      <div class="field"><label for="ct-${p.ref}">City</label>
        <select id="ct-${p.ref}" name="city"><option value="">Choose city</option>${cities}</select></div>
      <div class="field"><label for="bg-${p.ref}">Barangay</label>
        <select id="bg-${p.ref}" name="barangay">${barangayOptions(p.city, p.barangay)}</select></div>
    </div>
    <div class="field"><label for="lm-${p.ref}">Landmark note for the rider</label><input id="lm-${p.ref}" name="landmark" value="${esc(p.landmark)}"></div>
    <div class="actions-bar">
      <button class="btn btn--primary btn--sm" data-action="confirm">Confirm address</button>
      <span class="muted small">Tip: call the recipient if the address is still unclear.</span>
    </div>
  </article>`;
}

function render(state) {
  const list = pending(state);
  el.innerHTML = `
    <div class="screen-head">
      <div>
        <h1>Intake review</h1>
        <p>Bookings with a risky address, flagged by the address check. Call the recipient if needed, then confirm before dispatch.</p>
      </div>
    </div>
    ${list.length ? list.map(card).join('') : `
      <div class="panel empty">${ICONS.box}
        <h3>Nothing to review</h3>
        <p>When the agent isn’t sure about an address, the booking appears here.</p>
      </div>`}`;
}

export function mount(root) {
  el = root;
  on(el, 'click', '[data-action=confirm]', async (_, btn) => {
    const cardEl = btn.closest('[data-ref]');
    const ref = cardEl.dataset.ref;
    const city = $('[name=city]', cardEl).value;
    const barangay = $('[name=barangay]', cardEl).value;
    if (!city || !barangay) { toast('Choose the city and barangay to confirm the address.', 'flag'); return; }
    const street = $('[name=street]', cardEl).value.trim();
    const landmark = $('[name=landmark]', cardEl).value.trim();
    const parcel = store.get().parcels.find((p) => p.ref === ref);
    btn.disabled = true;
    const { note } = await agents.intake.writeRiderNote({ street, city, barangay, landmark, typedAddress: `${street} ${landmark}`, tags: parcel.handling || [] });
    store.updateParcel(ref, {
      street,
      city,
      barangay,
      landmark,
      riderNote: note,
      status: 'ready',
      flag: null,
    }, 'address confirmed');
    toast(`${ref} confirmed and ready for dispatch.`);
  });
  on(el, 'change', '[name=city]', (_, select) => {
    $('[name=barangay]', select.closest('[data-ref]')).innerHTML = barangayOptions(select.value);
  });
  render(store.get());
}

export function update(state, change) {
  if (change.type === 'tick') return;
  // Avoid wiping a half-edited card on unrelated updates.
  if (el.contains(document.activeElement) && ['INPUT', 'SELECT'].includes(document.activeElement.tagName) && change.type !== 'reset') return;
  render(state);
}

export const badgeCount = (state) => pending(state).length;
