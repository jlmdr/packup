// Simulated rider movement and delivery events. Stands in for the rider app in the POC.
import { store } from './store.js';
import { BARANGAYS, HUB } from '../data/barangays.js';

const SPEED = 9; // map units per tick
const TICK_MS = 120;
const DWELL_TICKS = 10; // pause at each stop before auto-delivering
let timer = null;
let paused = false;
const dwell = {};

function hash(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

/** Where a parcel's stop sits on the map: its barangay plus a small offset so stops don't overlap. */
export function stopPosition(parcel) {
  const b = BARANGAYS.find((x) => x.name === parcel.barangay) || HUB;
  const h = hash(parcel.ref);
  return { x: b.x + ((h % 41) - 20), y: b.y + (((h >> 5) % 31) - 15) };
}

const parcelByRef = (ref) => store.get().parcels.find((p) => p.ref === ref);

export function startDeliveries() {
  const { riders } = store.get();
  riders.forEach((r) => r.queue.forEach((ref) => store.updateParcel(ref, { status: 'out' }, 'out for delivery')));
  store.setPhase('delivering');
  paused = false;
  if (!timer) timer = setInterval(tick, TICK_MS);
}

function tick() {
  if (paused) return;
  let moved = false;
  for (const r of store.get().riders) {
    if (!r.available || !r.queue.length) { r.moving = false; continue; }
    const target = stopPosition(parcelByRef(r.queue[0]));
    const dx = target.x - r.x;
    const dy = target.y - r.y;
    const dist = Math.hypot(dx, dy);
    if (dist > SPEED) {
      r.x += (dx / dist) * SPEED; r.y += (dy / dist) * SPEED; r.moving = true; moved = true;
    } else {
      r.x = target.x; r.y = target.y; r.moving = false;
      dwell[r.id] = (dwell[r.id] || 0) + 1;
      if (dwell[r.id] >= DWELL_TICKS) { dwell[r.id] = 0; completeStop(r.id, 'delivered'); }
    }
  }
  if (moved) store.emit({ type: 'tick' });
}

function completeStop(riderId, outcome, reason) {
  const r = store.get().riders.find((x) => x.id === riderId);
  const ref = r.queue.shift();
  if (!ref) return null;
  if (outcome === 'delivered') store.updateParcel(ref, { status: 'delivered' }, 'delivered');
  else store.updateParcel(ref, { status: 'failed', failReason: reason }, 'failed attempt');
  return ref;
}

// Demo controls ---------------------------------------------------------------
export const demo = {
  markDelivered: (riderId) => completeStop(riderId, 'delivered'),
  markFailed: (riderId, reason) => completeStop(riderId, 'failed', reason),
  riderAbsent(riderId) {
    const r = store.get().riders.find((x) => x.id === riderId);
    const remaining = [...r.queue];
    store.setRider(riderId, { available: false, queue: [], moving: false, note: 'Marked absent' });
    remaining.forEach((ref) => store.updateParcel(ref, {
      status: 'flagged', riderId: null,
      flag: { type: 'dispatch', reason: `${r.name} was marked absent. Needs reassignment.` },
    }, 'returned to hub'));
    return remaining.length;
  },
  togglePause() { paused = !paused; return paused; },
  isPaused: () => paused,
  reset() { clearInterval(timer); timer = null; paused = false; store.reset(); },
};
