// Staff screen: live rider map plus the delivery status agent.
import { store } from '../core/store.js';
import { agents } from '../agents/index.js';
import { getRiderLocation, areaName } from '../tools/rider-tools.js';
import { renderMap, updateStops, updateRiders } from './map.js';
import { $, on, esc, agentNote, statusBadge, initials, toast } from './dom.js';
import { formatPhone } from '../core/util.js';

let el;
let lastAnswer = null;
const parcelByRef = (ref) => store.get().parcels.find((p) => p.ref === ref);
let lastQuestion = '';

function examples(state) {
  const by = (s) => state.parcels.find((p) => p.status === s);
  const out = by('out') || by('assigned') || by('ready');
  const failed = by('failed');
  const delivered = by('delivered');
  const list = [];
  if (out) list.push({ label: `Where is ${out.ref}?`, q: `Where is ${out.ref}?` });
  if (failed) list.push({ label: `${failed.recipient.split(' ')[0]}’s parcel didn’t arrive`, q: `${failed.recipient} is asking why the parcel didn’t arrive` });
  if (delivered) list.push({ label: 'Delivered, but not received', q: `${delivered.recipient} says they didn't receive the parcel` });
  if (out) list.push({ label: 'Customer wants a refund', q: `${out.recipient} wants a refund for the delay` });
  list.push({ label: 'By phone number', q: `Parcel for ${formatPhone((out || state.parcels[0]).phone)}` });
  return list;
}

function answerHtml(a) {
  if (!a) return '';
  const who = '<span class="agent-who">Delivery status</span>';
  const head = (p) => `<p><span class="ref">${p.ref}</span> ${statusBadge(p.status)}<br><span class="muted small">${esc(p.recipient)}, ${esc(p.barangay || 'address under review')}</span></p>`;
  switch (a.kind) {
    case 'thinking':
      return agentNote(`${who}<p>Looking it up <span class="agent-thinking"><i></i><i></i><i></i></span></p>`);
    case 'not_found':
    case 'empty':
      return agentNote(`${who}<p>${esc(a.message || 'Type a reference code, phone number or name.')}</p>`);
    case 'choose':
      return agentNote(`${who}<p>${esc(a.message)}</p><div class="agent-actions">${a.choiceRefs.map(parcelByRef).filter(Boolean).map((p) =>
        `<button class="option-btn" data-pick="${p.ref}">${p.ref}, ${esc(p.recipient)}</button>`).join('')}</div>`);
    case 'escalate':
      return agentNote(`${who}<div class="answer-card">${head(parcelByRef(a.parcelRef))}
        <div class="escalation">Flagged for a supervisor. ${esc(a.reason)}</div>
        <p class="muted small">No reply drafted. A supervisor should respond to this customer.</p></div>`);
    default:
      return agentNote(`${who}<div class="answer-card">${head(parcelByRef(a.parcelRef))}
        <p><strong>${esc(a.summary)}</strong></p>
        ${a.explanation ? `<p class="small"><strong>Why:</strong> ${esc(a.explanation.why)}.<br><strong>Next:</strong> ${esc(a.explanation.next)}</p>` : ''}
        <div><p class="muted small">Draft reply</p><p class="draft">${esc(a.draft)}</p></div>
        <div class="agent-actions"><button class="btn btn--ghost btn--sm" data-action="copy">Copy reply</button>
        <span class="muted small">Read it out or paste it to the customer.</span></div></div>`);
  }
}

function riderList(state) {
  return state.riders.map((r) => {
    const delivered = state.parcels.filter((p) => p.riderId === r.id && p.status === 'delivered').length;
    let status;
    if (!r.available) status = esc(r.note || 'Unavailable');
    else if (state.phase !== 'delivering') status = 'At the hub';
    else if (r.queue.length) status = `${r.queue.length} to go, near ${getRiderLocation(r.id)}`;
    else status = `Done, ${delivered} delivered`;
    return `<li><span class="avatar avatar--sm" data-area="${r.area}">${initials(r.name)}</span>
      <span class="grow"><strong>${esc(r.name)}</strong><br><span class="muted small">${status}</span></span>
      <span class="muted small">${areaName(r.area)}</span></li>`;
  }).join('');
}

function render(state) {
  const delivering = state.phase === 'delivering';
  el.innerHTML = `
    <div class="screen-head">
      <div><h1>Tracking</h1><p>Live rider positions and parcel status. Ask the delivery status agent about any parcel.</p></div>
    </div>
    <div class="split split--map">
      <section class="panel map-panel" aria-labelledby="map-title">
        <div class="panel-title"><h2 id="map-title">Angeles City</h2>
          <span class="muted small" id="map-caption">${delivering ? 'Deliveries in progress' : 'Riders appear once dispatch starts deliveries'}</span></div>
        <div id="map"></div>
      </section>
      <div class="stack">
        <section class="panel" aria-labelledby="ask-title">
          <div class="panel-title"><h2 id="ask-title">Ask about a parcel</h2></div>
          <form class="ask-form" id="ask-form">
            <label class="visually-hidden" for="ask-input">Reference code, phone number, name or question</label>
            <input id="ask-input" class="control" placeholder="Reference code, mobile number or name" autocomplete="off" value="${esc(lastQuestion)}">
            <button class="btn btn--primary" type="submit">Ask</button>
          </form>
          <div class="chips" id="ask-examples"></div>
          <div id="answer" aria-live="polite">${answerHtml(lastAnswer)}</div>
        </section>
        <section class="panel" aria-labelledby="riders-title">
          <div class="panel-title"><h2 id="riders-title">Riders</h2></div>
          <ul class="rider-status" id="rider-status">${riderList(state)}</ul>
        </section>
      </div>
    </div>`;
  const map = $('#map', el);
  renderMap(map);
  refresh(state);
}

function refresh(state) {
  const map = $('#map', el);
  updateStops(map, state.parcels);
  updateRiders(map, state.riders, state.phase === 'delivering');
}

function refreshPanels(state) {
  $('#rider-status', el).innerHTML = riderList(state);
  $('#ask-examples', el).innerHTML = examples(state).map((x, i) => `<button type="button" class="chip" data-example="${i}">${esc(x.label)}</button>`).join('');
  $('#map-caption', el).textContent = state.phase === 'delivering' ? 'Deliveries in progress' : 'Riders appear once dispatch starts deliveries';
}

let askRun = 0;
async function ask(question) {
  const run = ++askRun;
  lastQuestion = question;
  lastAnswer = { kind: 'thinking' };
  $('#answer', el).innerHTML = answerHtml(lastAnswer);
  const reply = await agents.deliveryStatus.answer(question);
  if (run !== askRun) return;
  lastAnswer = reply;
  $('#answer', el).innerHTML = answerHtml(lastAnswer);
}

export function mount(root) {
  el = root;
  on(el, 'submit', '#ask-form', (e) => { e.preventDefault(); ask($('#ask-input', el).value); });
  on(el, 'click', '[data-example]', (_, btn) => {
    const x = examples(store.get())[Number(btn.dataset.example)];
    $('#ask-input', el).value = x.q;
    ask(x.q);
  });
  on(el, 'click', '[data-pick]', (_, btn) => { $('#ask-input', el).value = btn.dataset.pick; ask(btn.dataset.pick); });
  on(el, 'click', '[data-action=copy]', async () => {
    try { await navigator.clipboard.writeText(lastAnswer.draft); toast('Reply copied.'); } catch { toast('Copy isn’t available here. Select the text instead.', 'flag'); }
  });
  render(store.get());
  refreshPanels(store.get());
}

export function update(state, change) {
  if (change.type === 'reset') { lastAnswer = null; lastQuestion = ''; render(state); refreshPanels(state); return; }
  refresh(state);
  if (change.type !== 'tick') refreshPanels(state);
}
