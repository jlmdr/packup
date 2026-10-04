// Customer screen (also used by staff at the counter): booking form.
// Plain validation owns the rules (required fields, a barangay from the list);
// the intake agent handles the judgement calls on top.
import { agents } from '../agents/index.js';
import { listCities, listBarangays, getPastDelivery } from '../tools/address-tools.js';
import { deliveryZone, estimateRate } from '../core/pricing.js';
import {
  validateMobile, validateName, validateStreet, validateCity, validateBarangay, validateItem, validateWeight, validateSize,
  validateDifferentNumbers, addressTooThin, intakeReviewReason,
} from '../core/validation.js';
import { store } from '../core/store.js';
import { RATE_TABLE, RATE_ZONES } from '../data/rates.js';
import { formatPhone } from '../core/util.js';
import { $, on, esc, agentNote, toast } from './dom.js';

const CITIES = listCities();
const cityOptions = (selected = '') => `<option value="">Choose city</option>${CITIES.map((c) => `<option${c === selected ? ' selected' : ''}>${esc(c)}</option>`).join('')}`;
const barangayOptions = (city, selected = '') => (city
  ? `<option value="">Choose barangay</option>${listBarangays(city).map((b) => `<option${b === selected ? ' selected' : ''}>${esc(b)}</option>`).join('')}`
  : '<option value="">Choose a city first</option>');

const EXAMPLES = [
  { label: 'Which Lourdes?', recipient: 'Ella Cunanan', phone: '0917 555 0102', street: '12 Sampaguita St.', city: 'Angeles City', landmark: 'Near the church, Lourdes', item: '1 pair of shoes', weight: 1 },
  { label: 'Returning recipient', recipient: 'Ana Dizon', phone: '0917 555 0188', item: 'Rice cooker', weight: 3.5, size: 'medium' },
  { label: 'Landmark in Filipino', recipient: 'Joey Pamintuan', phone: '0917 555 0109', street: 'Blk 3 Lot 9', landmark: 'Tapat ng Marquee Mall, blue gate', item: 'Perfume and lotion', weight: 0.8 },
  { label: 'Barangay mismatch', recipient: 'Rose Lansangan', phone: '0917 555 0111', street: 'Blk 3 Lot 9', city: 'Angeles City', barangay: 'Balibago', landmark: 'Tapat ng Marquee Mall', item: 'Documents', weight: 0.3 },
  { label: 'Sending to Manila', recipient: 'Mark Dayrit', phone: '0917 555 0114', street: '45 Real St., Intramuros', item: 'Clothes', weight: 1.2 },
  { label: 'Which Dolores?', recipient: 'Nica Bautista', phone: '0917 555 0116', street: 'Purok 4, Dolores', item: 'Books', weight: 2.5 },
  { label: 'Item not accepted', recipient: 'Lito Bernal', phone: '0917 555 0115', street: '9 Henson St.', city: 'Angeles City', barangay: 'Santo Cristo', item: 'Live crabs', weight: 2 },
  { label: 'Clean address', recipient: 'Carla Yap', phone: '0917 555 0110', street: 'Blk 5 Lot 12, Sampaguita St.', city: 'Angeles City', barangay: 'Santo Rosario', item: 'Phone case', weight: 0.2 },
];

const HELP_EXAMPLES = ['Can I send perfume?', 'How much for 4 kg to Cebu?', 'I’m near Marquee Mall, what’s my barangay?', 'Do you deliver to Davao?'];

let el;
let form;
let address = null;    // latest address decision
let riderNote = '';    // rider note for the current address
let item = null;       // latest item screening
let help = null;       // latest booking-help answer
const runs = { address: 0, item: 0, help: 0 }; // newer requests win over slower, older ones
const flags = { pastDismissed: false, conflictKept: false, newAddress: false, dupOk: false };
const timers = {};

const SIZE_LABEL = { small: 'Small', medium: 'Medium', large: 'Large' };
const fields = () => ({ street: form.street.value, city: form.city.value, barangay: form.barangay.value, landmark: form.landmark.value, phone: form.phone.value });
const compose = (f) => [f.street, f.barangay, f.city].filter(Boolean).join(', ');

const fieldHtml = (name, label, input) =>
  `<div class="field"><label for="f-${name}">${label}</label>${input}<span class="field-error" id="err-${name}"></span></div>`;

function template() {
  return `
  <div class="split">
    <form class="label-sheet" id="booking-form" novalidate>
      <div class="label-tape" aria-hidden="true"></div>
      <div class="label-head">
        <h1>Book a parcel</h1>
        <span class="muted small">Online, or at the counter with our staff</span>
      </div>
      <div class="label-section">
        <h2>From</h2>
        <div class="field-row">
          ${fieldHtml('sender', 'Sender name', '<input id="f-sender" name="sender" autocomplete="name" aria-describedby="err-sender">')}
          ${fieldHtml('senderPhone', 'Sender mobile (optional)', '<input id="f-senderPhone" name="senderPhone" inputmode="tel" placeholder="09XX XXX XXXX" aria-describedby="err-senderPhone">')}
        </div>
        ${fieldHtml('senderCity', 'Sending from (city)', `<select id="f-senderCity" name="senderCity" aria-describedby="err-senderCity">${cityOptions()}</select>`)}
      </div>
      <div class="label-section">
        <h2>To</h2>
        <div class="field-row">
          ${fieldHtml('recipient', 'Recipient name', '<input id="f-recipient" name="recipient" aria-describedby="err-recipient">')}
          ${fieldHtml('phone', 'Recipient mobile', '<input id="f-phone" name="phone" inputmode="tel" placeholder="09XX XXX XXXX" aria-describedby="err-phone">')}
        </div>
        ${fieldHtml('street', 'House, lot or street', '<input id="f-street" name="street" placeholder="e.g. Blk 5 Lot 12, Sampaguita St." aria-describedby="err-street">')}
        <div class="field-row">
          ${fieldHtml('city', 'City', `<select id="f-city" name="city" aria-describedby="err-city">${cityOptions()}</select>`)}
          ${fieldHtml('barangay', 'Barangay', `<select id="f-barangay" name="barangay" aria-describedby="err-barangay">${barangayOptions('')}</select>`)}
        </div>
        ${fieldHtml('landmark', 'Landmark (optional)', '<input id="f-landmark" name="landmark" placeholder="e.g. tapat ng simbahan, blue gate" aria-describedby="err-landmark">')}
        <div id="agent-slot" class="agent-slot" aria-live="polite"></div>
      </div>
      <div class="label-section">
        <h2>Parcel</h2>
        ${fieldHtml('item', 'What’s inside?', '<input id="f-item" name="item" placeholder="e.g. 2 shirts, a phone case" aria-describedby="err-item">')}
        <div id="item-slot" class="agent-slot agent-slot--spaced" aria-live="polite"></div>
        <div class="field-row">
          ${fieldHtml('size', 'Size', `<select id="f-size" name="size" aria-describedby="err-size">
              <option value="small">Small, up to 3 kg</option>
              <option value="medium">Medium, 3 to 10 kg</option>
              <option value="large">Large, over 10 kg</option></select>`)}
          ${fieldHtml('weight', 'Weight (kg)', '<input id="f-weight" name="weight" type="number" min="0.1" max="50" step="0.1" value="1" aria-describedby="err-weight">')}
        </div>
      </div>
      <div id="submit-slot" aria-live="polite"></div>
      <div class="label-foot">
        <span class="muted small" id="fee-estimate">You get a reference code as soon as you book.</span>
        <button class="btn btn--primary" type="submit">Book parcel</button>
      </div>
    </form>

    <div class="stack">
      <div id="confirmation"></div>
      <section class="panel" aria-labelledby="help-title">
        <div class="panel-title"><h2 id="help-title">Need help?</h2></div>
        <form class="ask-form" id="help-form">
          <label class="visually-hidden" for="help-input">Ask a booking question</label>
          <input id="help-input" class="control" placeholder="Ask about items, rates, destinations or your address" autocomplete="off">
          <button class="btn btn--primary" type="submit">Ask</button>
        </form>
        <div class="chips">${HELP_EXAMPLES.map((x, i) => `<button type="button" class="chip" data-help="${i}">${esc(x)}</button>`).join('')}</div>
        <div id="help-slot" class="agent-slot" aria-live="polite"></div>
      </section>
      <section class="panel" aria-labelledby="rates-title">
        <div class="panel-title"><h2 id="rates-title">Rates</h2><span class="muted small">Based on weight and destination</span></div>
        <div class="table-wrap">
          <table class="rate-table">
            <thead><tr><th>Weight</th>${RATE_ZONES.map((z) => `<th>${z}</th>`).join('')}</tr></thead>
            <tbody>${RATE_TABLE.map((r) => `<tr><td>${r.weight}</td>${r.rates.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>
        <p class="muted small panel-note">Pay at the counter or to the rider on pickup.</p>
      </section>
      <section class="panel panel--quiet" aria-labelledby="examples-title">
        <div class="panel-title"><h3 id="examples-title">Demo examples</h3></div>
        <p class="muted small panel-intro">Fill the form with a sample customer to see the checks respond. Book “Clean address” twice to see the duplicate check.</p>
        <div class="chips">${EXAMPLES.map((x, i) => `<button type="button" class="chip" data-example="${i}">${x.label}</button>`).join('')}</div>
      </section>
    </div>
  </div>`;
}

// Field validation (rules) ---------------------------------------------------------
const RULES = {
  sender: () => validateName(form.sender.value, 'sender name'),
  senderPhone: () => {
    const v = validateMobile(form.senderPhone.value, { required: false });
    return v.ok ? validateDifferentNumbers(form.senderPhone.value, form.phone.value) : v;
  },
  recipient: () => validateName(form.recipient.value, 'recipient name'),
  phone: () => validateMobile(form.phone.value),
  senderCity: () => validateCity(form.senderCity.value, CITIES, 'city you’re sending from'),
  street: () => validateStreet(form.street.value),
  city: () => validateCity(form.city.value, CITIES),
  barangay: () => validateBarangay(form.barangay.value, listBarangays(form.city.value)),
  item: () => validateItem(form.item.value),
  weight: () => validateWeight(form.weight.value),
  size: () => validateSize(form.size.value, form.weight.value),
};

function showFieldError(name, check) {
  const err = $(`#err-${name}`, el);
  form[name].toggleAttribute('aria-invalid', !check.ok);
  if (check.ok) { err.innerHTML = ''; return; }
  err.innerHTML = esc(check.message) + (check.expected
    ? ` <button type="button" class="link-btn" data-fix-size="${check.expected}">Change to ${SIZE_LABEL[check.expected]}</button>` : '');
}

function validateField(name) {
  const check = RULES[name]();
  showFieldError(name, check);
  return check.ok;
}

const validateAll = () => Object.keys(RULES).filter((name) => !validateField(name));

// Address agent ------------------------------------------------------------------------
const riderPreview = () => (riderNote ? `<dl class="resolved"><dt>Rider will see</dt><dd>${esc(riderNote)}</dd></dl>` : '');

const noteDetails = (tags = []) => {
  const f = fields();
  return { ...f, typedAddress: `${f.street} ${f.landmark}`, tags };
};

function renderAddress() {
  const slot = $('#agent-slot', el);
  const who = '<span class="agent-who">Address check</span>';
  if (!address || address.status === 'empty') { slot.innerHTML = ''; return; }
  if (address.status === 'thinking') {
    slot.innerHTML = agentNote(`${who}<p><span class="agent-thinking" aria-label="Checking"><i></i><i></i><i></i></span></p>`);
    return;
  }
  if (address.status === 'blocked') { slot.innerHTML = agentNote(`${who}<p>${esc(address.message)}</p>`, 'blocked'); return; }
  if (address.status === 'clear' || address.status === 'auto') {
    slot.innerHTML = agentNote(`${who}<p>${esc(address.message)}</p>${riderPreview()}`, 'clear');
    return;
  }
  const options = (address.options || []).map((o, i) => `<button type="button" class="option-btn" data-option="${i}">${esc(o.label)}</button>`).join('');
  const secondary = address.keepLabel || address.newLabel;
  const extra = secondary ? `<button type="button" class="link-btn" data-action="${address.keepLabel ? 'keep' : 'new-address'}">${esc(secondary)}</button>` : '';
  slot.innerHTML = agentNote(`${who}<p>${esc(address.message)}</p>${options || extra ? `<div class="agent-actions">${options}${extra}</div>` : ''}`);
}

async function runAddressCheck() {
  const run = ++runs.address;
  const decision = await agents.intake.checkAddress(fields(), { ...flags });
  if (run !== runs.address) return null; // the customer kept typing; a newer check is on its way
  if (decision.status === 'auto') {
    setPlace(decision.city, decision.barangay);
    ['city', 'barangay'].forEach((n) => { if (form[n].value) validateField(n); });
  }
  riderNote = ['clear', 'auto'].includes(decision.status) ? (await agents.intake.writeRiderNote(noteDetails())).note : '';
  if (run !== runs.address) return null;
  address = decision;
  renderAddress();
  return address;
}

const showThinking = (key, render) => {
  if (key === 'address') address = { status: 'thinking' };
  if (key === 'item') item = { status: 'thinking' };
  render();
};

function debounce(key, fn, wait) { clearTimeout(timers[key]); timers[key] = setTimeout(fn, wait); }

function scheduleAddressCheck(immediate = false) {
  flags.dupOk = false;
  $('#submit-slot', el).innerHTML = '';
  if (immediate) { runAddressCheck(); return; }
  debounce('address', () => { showThinking('address', renderAddress); runAddressCheck(); }, 650);
}

function setPlace(city, barangay = '') {
  if (city && form.city.value !== city) {
    form.city.value = city;
    form.barangay.innerHTML = barangayOptions(city);
  }
  if (barangay) form.barangay.value = barangay;
  updateFee();
}

function applyAddress(value) {
  if (value.street !== undefined) form.street.value = value.street;
  if (value.landmark !== undefined) form.landmark.value = value.landmark;
  setPlace(value.city, value.barangay);
  ['street', 'city', 'barangay'].forEach(validateField);
  return runAddressCheck();
}

/** Estimated fee from the rate table: a rule, recalculated whenever the cities or weight change. */
function updateFee() {
  const zone = deliveryZone(form.senderCity.value, form.city.value);
  const kg = Number(form.weight.value);
  const box = $('#fee-estimate', el);
  if (zone === null || !(kg > 0)) { box.textContent = 'You get a reference code as soon as you book.'; return; }
  const r = estimateRate(kg, zone);
  box.innerHTML = `Estimated fee: <strong>₱${r.amount}</strong> (${esc(r.zone.toLowerCase())})`;
}

// Item agent ---------------------------------------------------------------------------
function renderItem() {
  const slot = $('#item-slot', el);
  const who = '<span class="agent-who">Item check</span>';
  if (!item || item.status === 'empty' || item.status === 'clear') { slot.innerHTML = ''; return; }
  if (item.status === 'thinking') { slot.innerHTML = agentNote(`${who}<p><span class="agent-thinking"><i></i><i></i><i></i></span></p>`); return; }
  if (item.status === 'blocked') { slot.innerHTML = agentNote(`${who}<p>${esc(item.message)}</p>`, 'blocked'); return; }
  slot.innerHTML = agentNote(`${who}<p>Accepted, with handling notes:</p><ul class="care-list">${item.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`);
}

async function runItemCheck() {
  const run = ++runs.item;
  const decision = await agents.intake.screenItem(form.item.value);
  if (run !== runs.item) return null;
  item = decision;
  renderItem();
  return item;
}

function scheduleItemCheck() {
  if (!form.item.value.trim()) { runs.item += 1; item = null; renderItem(); return; }
  debounce('item', () => { showThinking('item', renderItem); runItemCheck(); }, 600);
}

// Booking help -------------------------------------------------------------------------
function renderHelp() {
  const slot = $('#help-slot', el);
  const who = '<span class="agent-who">Booking help</span>';
  if (!help) { slot.innerHTML = ''; return; }
  if (help.thinking) { slot.innerHTML = agentNote(`${who}<p><span class="agent-thinking"><i></i><i></i><i></i></span></p>`); return; }
  const action = help.action?.type === 'fill-address'
    ? `<div class="agent-actions"><button type="button" class="option-btn" data-help-fill>Use ${esc(help.action.barangay)}, ${esc(help.action.city)} in the form</button></div>` : '';
  slot.innerHTML = agentNote(`${who}<p>${esc(help.message)}</p>${action}`);
}

async function askHelp(question) {
  const run = ++runs.help;
  $('#help-input', el).value = question;
  help = { thinking: true }; renderHelp();
  const reply = await agents.intake.answerQuestion(question, { fromCity: form.senderCity.value });
  if (run !== runs.help) return;
  help = reply;
  renderHelp();
}

// Submit -----------------------------------------------------------------------------
function barcode(ref) {
  const bits = [...ref].flatMap((c) => c.charCodeAt(0).toString(2).padStart(8, '0').split('').map(Number));
  let x = 0;
  const bars = bits.map((b) => { const w = b ? 3 : 1.5; const r = `<rect x="${x}" y="0" width="${w}" height="56"/>`; x += w + 1.5; return r; });
  return `<svg class="barcode" viewBox="0 0 ${x} 56" preserveAspectRatio="none" fill="currentColor" aria-hidden="true">${bars.join('')}</svg>`;
}

function stopAt(node, message) {
  if (message) toast(message, 'flag');
  node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  node.focus?.();
}

async function submit(e) {
  e.preventDefault();
  if (form.dataset.busy) return;
  form.dataset.busy = 'true';
  try {
    await book();
  } finally {
    delete form.dataset.busy;
  }
}

async function book() {

  // 1. Rules: every field at once, including a barangay from the list.
  const invalid = validateAll();
  if (invalid.length) { stopAt(form[invalid[0]], invalid.length > 1 ? `Fix the ${invalid.length} highlighted fields to book.` : 'Fix the highlighted field to book.'); return; }

  // 2. Agent: item screening.
  // A null result means the form changed while the check ran; the newer check takes over.
  clearTimeout(timers.item);
  const itemDecision = await runItemCheck();
  if (!itemDecision) return;
  if (itemDecision.status === 'blocked') { stopAt(form.item); return; }

  // 3. Agent: address. Coverage blocks; an open question must be answered first.
  clearTimeout(timers.address);
  const decision = await runAddressCheck();
  if (!decision) return;
  if (decision.status === 'blocked') { stopAt(form.street); return; }
  if (['conflict', 'past', 'choose'].includes(decision.status)) { stopAt($('#agent-slot', el), 'Answer the address question to book.'); return; }
  const f = fields();
  const tooThin = addressTooThin(f);
  if (tooThin) { address = { status: 'blocked', message: tooThin }; renderAddress(); stopAt(form.street); return; }

  // 4. Agent: duplicate check.
  const dup = flags.dupOk ? null : await agents.intake.checkDuplicate({ phone: f.phone, city: f.city, barangay: f.barangay, street: f.street });
  if (dup) {
    $('#submit-slot', el).innerHTML = `<div class="label-section">${agentNote(`<span class="agent-who">Duplicate check</span><p>${esc(dup.message)}</p>
      <div class="agent-actions"><button type="button" class="option-btn" data-action="dup-new">Yes, book a new parcel</button>
      <button type="button" class="link-btn" data-action="dup-cancel">No, don’t book again</button></div>`)}</div>`;
    stopAt($('#submit-slot', el));
    return;
  }

  // 5. Book. Risky addresses go to intake review; the customer still gets a code.
  const past = getPastDelivery(f.phone);
  const reason = intakeReviewReason({ ...flags, place: `${f.barangay}, ${f.city}`, pastPlace: past && `${past.barangay}, ${past.city}` });
  const flag = reason ? { type: 'intake', reason } : null;
  const tags = itemDecision.tags || [];
  const typed = [f.street, f.barangay, f.city, f.landmark].filter(Boolean).join(', ');
  const { note } = await agents.intake.writeRiderNote(noteDetails(tags));
  const parcel = store.createBooking({
    recipient: form.recipient.value.trim(),
    phone: f.phone.trim(),
    street: f.street.trim(),
    city: f.city,
    barangay: f.barangay,
    landmark: f.landmark.trim(),
    size: form.size.value,
    weight: Number(form.weight.value),
    item: form.item.value.trim(),
    handling: tags,
    sender: form.sender.value.trim(),
    senderCity: form.senderCity.value,
    typedAddress: typed,
    riderNote: note,
  }, flag);

  $('#confirmation', el).innerHTML = `
    <section class="panel waybill" aria-live="polite">
      <p class="muted small">Reference code</p>
      <div class="waybill-ref">${parcel.ref}</div>
      ${barcode(parcel.ref)}
      <dl>
        <dt>Recipient</dt><dd>${esc(parcel.recipient)}, ${esc(formatPhone(parcel.phone))}</dd>
        <dt>Address</dt><dd>${esc(compose(parcel))}</dd>
        <dt>Contents</dt><dd>${esc(parcel.item)}${tags.length ? ` ${tags.map((t) => `<span class="tag tag--muted">${t}</span>`).join(' ')}` : ''}</dd>
        <dt>Rider note</dt><dd>${esc(parcel.riderNote)}</dd>
      </dl>
      <span class="stamp" data-tone="${flag ? 'review' : ''}">${flag ? 'Booked, address check pending' : 'Booked'}</span>
    </section>`;
  $('#confirmation', el).scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast(flag ? `${parcel.ref} booked. Sent to intake review.` : `${parcel.ref} booked and ready for dispatch.`);
  resetForm();
}

function resetForm() {
  form.reset();
  form.barangay.innerHTML = barangayOptions('');
  updateFee();
  Object.keys(RULES).forEach((n) => showFieldError(n, { ok: true }));
  Object.keys(flags).forEach((k) => { flags[k] = false; });
  Object.keys(runs).forEach((k) => { runs[k] += 1; });
  address = null; item = null; riderNote = '';
  renderAddress(); renderItem();
  $('#submit-slot', el).innerHTML = '';
}

// Mount ---------------------------------------------------------------------------------
export function mount(root) {
  el = root;
  el.innerHTML = template();
  form = $('#booking-form', el);
  form.addEventListener('submit', submit);

  ['street', 'landmark', 'phone'].forEach((n) => form[n].addEventListener('input', () => {
    if (n !== 'phone') flags.conflictKept = false;
    scheduleAddressCheck();
  }));
  form.city.addEventListener('change', () => {
    form.barangay.innerHTML = barangayOptions(form.city.value);
    flags.conflictKept = false;
    updateFee();
    scheduleAddressCheck(true);
  });
  form.barangay.addEventListener('change', () => { flags.conflictKept = false; scheduleAddressCheck(true); });
  form.senderCity.addEventListener('change', updateFee);
  form.weight.addEventListener('input', updateFee);
  form.item.addEventListener('input', scheduleItemCheck);

  // Rules: check on leaving a field, re-check live once it has an error.
  Object.keys(RULES).forEach((name) => {
    const input = form[name];
    input.addEventListener('blur', () => { if (input.value.trim() || input.hasAttribute('aria-invalid')) validateField(name); });
    input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (input.hasAttribute('aria-invalid')) validateField(name);
      if (name === 'weight' || name === 'size') validateField('size');
      if (name === 'phone' && form.senderPhone.value) validateField('senderPhone');
    });
  });

  on(el, 'click', '[data-fix-size]', (_, btn) => { form.size.value = btn.dataset.fixSize; validateField('size'); });
  on(el, 'click', '[data-option]', (_, btn) => applyAddress(address.options[Number(btn.dataset.option)].value));
  on(el, 'click', '[data-action=keep]', () => { flags.conflictKept = true; runAddressCheck(); });
  on(el, 'click', '[data-action=new-address]', () => { flags.pastDismissed = true; flags.newAddress = Boolean(form.barangay.value); runAddressCheck(); });
  on(el, 'click', '[data-action=dup-new]', () => { flags.dupOk = true; form.requestSubmit(); });
  on(el, 'click', '[data-action=dup-cancel]', () => { resetForm(); toast('Booking not repeated.'); });

  on(el, 'submit', '#help-form', (e) => { e.preventDefault(); askHelp($('#help-input', el).value); });
  on(el, 'click', '[data-help]', (_, btn) => askHelp(HELP_EXAMPLES[Number(btn.dataset.help)]));
  on(el, 'click', '[data-help-fill]', () => {
    const { city, barangay } = help.action;
    applyAddress({ city, barangay });
    form.barangay.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(`Address set to ${barangay}, ${city}.`);
  });

  on(el, 'click', '[data-example]', (_, btn) => {
    const x = EXAMPLES[Number(btn.dataset.example)];
    resetForm();
    form.sender.value = 'Demo Sender';
    form.senderCity.value = 'Angeles City';
    form.recipient.value = x.recipient;
    form.phone.value = x.phone;
    form.street.value = x.street || '';
    setPlace(x.city || '', x.barangay || '');
    form.landmark.value = x.landmark || '';
    form.item.value = x.item;
    form.weight.value = x.weight;
    form.size.value = x.size || 'small';
    updateFee();
    $('#confirmation', el).innerHTML = '';
    form.street.scrollIntoView({ behavior: 'smooth', block: 'center' });
    scheduleAddressCheck();
    scheduleItemCheck();
  });
}

export function update() { /* booking form keeps its own state */ }
