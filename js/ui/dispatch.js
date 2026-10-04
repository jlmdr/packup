// Staff screen: run the morning assignment, review the plan (flagged first), approve and release.
import { store } from '../core/store.js';
import { agents } from '../agents/index.js';
import { startDeliveries } from '../core/simulation.js';
import { getAllRiders, getAvailableRiders, areaName, vehicleLabel, vehicleCapacity, vehicleFits } from '../tools/rider-tools.js';
import { getParcel, getParcelsForBatch, getOutboundParcels } from '../tools/parcel-tools.js';
import { on, esc, toast, ICONS, initials, agentNote } from './dom.js';
import { AREAS } from '../data/barangays.js';

let el;
let thinking = false;

const needsAttention = (state) => {
  if (state.phase === 'morning') return [];
  if (state.phase === 'planned') return state.plan.flagged.map((f) => ({ parcel: getParcel(f.ref), reason: f.reason }));
  return state.parcels
    .filter((p) => (p.status === 'flagged' && p.flag?.type === 'dispatch') || p.status === 'ready')
    .map((p) => ({ parcel: p, reason: p.status === 'ready' ? 'Booked or confirmed after the morning batch.' : p.flag.reason }));
};

function attentionList(items, canAssign) {
  if (!items.length) return '';
  const riders = getAvailableRiders();
  return `
  <section class="panel attention" aria-labelledby="att-title">
    <div class="panel-title"><h2 id="att-title">Needs your attention (${items.length})</h2></div>
    ${items.map(({ parcel: p, reason }) => {
      const fits = riders.filter((r) => vehicleFits(r.vehicle, p.size));
      const intakeHold = p.flag?.type === 'intake';
      return `
      <div class="attention-item">
        <div>
          <span class="ref">${p.ref}</span> <span class="tag tag--muted">${p.size}</span>
          <span class="muted small">${esc(p.recipient)}, ${esc(p.barangay || 'barangay unknown')}</span>
          <p class="flag-reason">${ICONS.flag}<span>${esc(reason)}</span></p>
        </div>
        ${canAssign && !intakeHold ? `
        <div class="assign" data-ref="${p.ref}">
          <label class="visually-hidden" for="as-${p.ref}">Assign ${p.ref} to</label>
          <select id="as-${p.ref}" class="control control--sm">${fits.length ? fits.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('') : '<option value="">No suitable rider</option>'}</select>
          <button class="btn btn--ghost btn--sm" data-action="assign" ${fits.length ? '' : 'disabled'}>Assign</button>
        </div>` : intakeHold ? '<a class="btn btn--ghost btn--sm" href="#review">Open intake review</a>' : ''}
      </div>`;
    }).join('')}
  </section>`;
}

function outboundPanel(state) {
  const waiting = getOutboundParcels();
  const sent = state.parcels.filter((p) => p.status === 'outbound').length;
  if (!waiting.length && !sent) return '';
  const byCity = Object.entries(waiting.reduce((acc, p) => ({ ...acc, [p.city]: (acc[p.city] || 0) + 1 }), {}))
    .map(([city, n]) => `${esc(city)} (${n})`).join(', ');
  return `
  <section class="panel outbound" aria-labelledby="out-title">
    <div class="panel-title"><h2 id="out-title">Outbound to hub</h2>${sent ? `<span class="muted small">${sent} sent today</span>` : ''}</div>
    ${waiting.length ? `
      <p class="small">${waiting.length} parcel${waiting.length > 1 ? 's' : ''} for other cities: ${byCity}. These travel by long-haul from the hub, so they skip local rider assignment.</p>
      <div class="actions-bar panel-note"><button class="btn btn--ghost btn--sm" data-action="hub">Hand over to hub</button></div>`
      : '<p class="muted small">All parcels for other cities have been handed to the hub.</p>'}
  </section>`;
}

function riderColumns(state) {
  const plan = state.plan;
  return `<div class="rider-grid">${getAllRiders().map((r) => {
    const refs = state.phase === 'planned' ? (plan.byRider[r.id] || []) : state.parcels.filter((p) => p.riderId === r.id).map((p) => p.ref);
    const cap = vehicleCapacity(r.vehicle);
    return `
    <article class="panel rider-col" data-off="${!r.available}">
      <div class="rider-head">
        <span class="avatar" data-area="${r.area}">${initials(r.name)}</span>
        <div><h3>${esc(r.name)}</h3><span class="muted small">${vehicleLabel(r.vehicle)}, ${areaName(r.area)}</span></div>
      </div>
      ${r.available ? `
        <span class="small">${refs.length} of ${cap} parcels</span>
        <div class="load"><i style="--fill: ${Math.min(100, (refs.length / cap) * 100)}%"></i></div>
        <ul class="parcel-list">${refs.map((ref) => {
          const p = getParcel(ref);
          const cover = plan?.covering?.[ref];
          return `<li><span class="pl-ref">${ref}</span><span class="pl-place muted">${esc(p.barangay)}</span><span class="pl-tags">${cover ? `<span class="tag" title="Covering ${areaName(cover)} to balance workloads">+ ${areaName(cover)}</span>` : ''}${p.size !== 'small' ? `<span class="tag tag--muted">${p.size}</span>` : ''}</span></li>`;
        }).join('')}</ul>`
        : `<p class="muted small">${esc(r.note || 'Unavailable')}</p>`}
    </article>`;
  }).join('')}</div>`;
}

function render(state) {
  const batch = getParcelsForBatch();
  const riders = getAllRiders();
  const available = riders.filter((r) => r.available).length;
  const { phase, plan } = state;
  const att = needsAttention(state);

  let body = '';
  if (phase === 'morning') {
    body = `
      <section class="panel summary-strip">
        <div><b>${batch.length}</b><span>local parcels before cut-off</span></div>
        <div><b>${available} of ${riders.length}</b><span>riders available</span></div>
        <div><b>${getOutboundParcels().length}</b><span>for other cities</span></div>
        <div><b>${Object.keys(AREAS).length}</b><span>delivery areas</span></div>
      </section>
      ${thinking ? agentNote('<span class="agent-who">Rider assignment</span><p>Matching parcels to areas, vehicles and workloads <span class="agent-thinking"><i></i><i></i><i></i></span></p>') : ''}
      <div class="actions-bar"><button class="btn btn--accent" data-action="plan" ${thinking ? 'disabled' : ''}>Run morning assignment</button>
      <span class="muted small">The agent drafts the plan. Nothing goes to riders until you approve.</span></div>
      ${outboundPanel(state)}
      ${riderColumns(state)}`;
  } else if (phase === 'planned') {
    body = `
      ${agentNote(`<span class="agent-who">Rider assignment</span><p>Plan ready: ${plan.totals.assigned} of ${plan.totals.parcels} parcels assigned across ${Object.values(plan.byRider).filter((x) => x.length).length} riders. ${plan.totals.flagged ? `${plan.totals.flagged} need your attention.` : ''} ${Object.keys(plan.covering).length ? `${Object.keys(plan.covering).length} overflow parcels moved to neighbouring riders to balance workloads.` : ''}</p>`)}
      ${attentionList(att, false)}
      <div class="actions-bar">
        <button class="btn btn--primary" data-action="approve">Approve and release to riders</button>
        <button class="btn btn--ghost" data-action="discard">Discard plan</button>
      </div>
      ${outboundPanel(state)}
      ${riderColumns(state)}`;
  } else {
    body = `
      ${attentionList(att, true)}
      <div class="actions-bar">
        ${phase === 'released' ? '<button class="btn btn--accent" data-action="start">Start deliveries</button><span class="muted small">Riders leave the hub and appear on the tracking map.</span>' : '<a class="btn btn--ghost" href="#tracking">Open tracking map</a><span class="muted small">Deliveries in progress.</span>'}
      </div>
      ${outboundPanel(state)}
      ${riderColumns(state)}`;
  }

  el.innerHTML = `
    <div class="screen-head">
      <div>
        <h1>Dispatch</h1>
        <p>${phase === 'morning' ? 'Assign today’s parcels to riders in one batch.' : phase === 'planned' ? 'Review the draft plan. Flagged parcels are listed first.' : 'Plan released. Anything new or flagged during the day shows up here.'}</p>
      </div>
    </div>
    <div class="stack">${body}</div>`;
}

export function mount(root) {
  el = root;
  on(el, 'click', '[data-action=plan]', async () => {
    thinking = true; render(store.get());
    const plan = await agents.assignment.planBatch();
    thinking = false;
    store.setPlan(plan);
  });
  on(el, 'click', '[data-action=hub]', () => {
    const refs = getOutboundParcels().map((p) => p.ref);
    store.sendToHub(refs);
    toast(`${refs.length} parcel${refs.length > 1 ? 's' : ''} handed to the hub.`);
  });
  on(el, 'click', '[data-action=approve]', () => { store.releasePlan(); toast('Plan approved and released to riders.'); });
  on(el, 'click', '[data-action=discard]', () => store.setPlan(null));
  on(el, 'click', '[data-action=start]', () => { startDeliveries(); toast('Deliveries started.'); location.hash = '#tracking'; });
  on(el, 'click', '[data-action=assign]', (_, btn) => {
    const box = btn.closest('[data-ref]');
    const riderId = box.querySelector('select').value;
    if (!riderId) return;
    store.assignManually(box.dataset.ref, riderId);
    toast(`${box.dataset.ref} assigned.`);
  });
  render(store.get());
}

export function update(state, change) {
  if (change.type === 'tick') return;
  render(state);
}

export const badgeCount = (state) => needsAttention(state).length;
