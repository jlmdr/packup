// The system of record: bookings, riders and day state. Plain software, no judgement.
// Agents never import this directly; they go through js/tools/.
import { SEED_PARCELS, SEED_FLAGGED } from '../data/parcels.js';
import { RIDERS } from '../data/riders.js';
import { HUB } from '../data/barangays.js';
import { clockTime } from './util.js';

const listeners = new Set();
let state;

function initialState() {
  return {
    parcels: structuredClone([...SEED_PARCELS, ...SEED_FLAGGED]),
    riders: RIDERS.map((r) => ({ ...r, x: HUB.x, y: HUB.y, queue: [], moving: false })),
    plan: null, // draft assignment plan awaiting dispatcher approval
    phase: 'morning', // morning -> planned -> released -> delivering
    nextRef: 240401,
  };
}

export const store = {
  get: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  emit(change = {}) { listeners.forEach((fn) => fn(state, change)); },
  reset() { state = initialState(); this.emit({ type: 'reset' }); },

  // Records ----------------------------------------------------------------
  createBooking(fields, flag = null) {
    const ref = `PU-${String(state.nextRef).padStart(6, '0')}`;
    state.nextRef += 13; // spaced so codes aren't consecutive
    const time = clockTime();
    const parcel = {
      ref, ...fields,
      status: flag ? 'flagged' : 'ready',
      flag, riderId: null, createdAt: time, bookedToday: true,
      history: [{ status: 'booked', time }],
    };
    state.parcels.push(parcel);
    this.emit({ type: 'booking', ref });
    return parcel;
  },

  updateParcel(ref, patch, historyStatus) {
    const p = state.parcels.find((x) => x.ref === ref);
    if (!p) return null;
    Object.assign(p, patch);
    if (historyStatus) p.history.push({ status: historyStatus, time: clockTime() });
    this.emit({ type: 'parcel', ref });
    return p;
  },

  setPlan(plan) { state.plan = plan; state.phase = plan ? 'planned' : 'morning'; this.emit({ type: 'plan' }); },

  releasePlan() {
    const { plan } = state;
    if (!plan) return;
    for (const [riderId, refs] of Object.entries(plan.byRider)) {
      const rider = state.riders.find((r) => r.id === riderId);
      rider.queue = [...refs];
      refs.forEach((ref) => this.updateParcel(ref, { status: 'assigned', riderId }, 'assigned'));
    }
    plan.flagged.forEach(({ ref, reason }) => {
      const p = state.parcels.find((x) => x.ref === ref);
      if (p.flag?.type !== 'intake') this.updateParcel(ref, { status: 'flagged', flag: { type: 'dispatch', reason } });
    });
    state.phase = 'released';
    this.emit({ type: 'released' });
  },

  setRider(id, patch) {
    const r = state.riders.find((x) => x.id === id);
    Object.assign(r, patch);
    this.emit({ type: 'rider', id });
    return r;
  },

  /** Dispatcher manually assigns a flagged parcel to a rider. */
  assignManually(ref, riderId) {
    const rider = state.riders.find((r) => r.id === riderId);
    const out = state.phase === 'delivering';
    rider.queue.push(ref);
    this.updateParcel(ref, { status: out ? 'out' : 'assigned', riderId, flag: null }, out ? 'out for delivery' : 'assigned');
  },

  setPhase(phase) { state.phase = phase; this.emit({ type: 'phase' }); },
};

state = initialState();
