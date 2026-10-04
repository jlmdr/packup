// Parcel tools: read-only lookups used by the assignment and delivery status agents.
import { store } from '../core/store.js';
import { getDeliveryAreaBarangay } from './address-tools.js';
import { DELIVERY_AREA_CITY } from '../data/barangays.js';
import { normalise, digitsOnly } from '../core/util.js';

const inDeliveryArea = (p) => p.city === DELIVERY_AREA_CITY;

/** Parcels for the local riders: cleared for dispatch, plus ones still waiting on intake review. */
export const getParcelsForBatch = () =>
  store.get().parcels.filter((p) => inDeliveryArea(p) && (p.status === 'ready' || (p.status === 'flagged' && p.flag?.type === 'intake')));

/** Parcels for other cities, ready to hand to the hub for long-haul. */
export const getOutboundParcels = () => store.get().parcels.filter((p) => !inDeliveryArea(p) && p.status === 'ready');

export const getParcel = (ref) => store.get().parcels.find((p) => p.ref === ref.toUpperCase()) || null;
export const getAreaOf = (parcel) => (inDeliveryArea(parcel) ? getDeliveryAreaBarangay(parcel.barangay)?.area || null : null);

/** Find parcels by reference code, phone number, or recipient name inside free text. */
export function findParcels(query) {
  const parcels = store.get().parcels;
  const ref = query.match(/PU-?\s?(\d{6})/i);
  if (ref) return parcels.filter((p) => p.ref === `PU-${ref[1]}`);

  const phone = query.match(/(?:\+?63|0)9[\d\s-]{9,12}/);
  if (phone) {
    const d = digitsOnly(phone[0]).replace(/^63/, '0');
    const hits = parcels.filter((p) => digitsOnly(p.phone) === d);
    if (hits.length) return hits;
  }

  const q = ` ${normalise(query.replace(/['’]s\b/gi, ''))} `;
  let best = 0;
  let matches = [];
  for (const p of parcels) {
    const tokens = normalise(p.recipient).split(' ').filter((t) => t.length > 2);
    const score = tokens.filter((t) => q.includes(` ${t} `)).length;
    if (score > best) { best = score; matches = [p]; } else if (score === best && score > 0) matches.push(p);
  }
  return matches;
}

/** Bookings for the same recipient number made today (newest first). */
export function findRecentBookings(phone) {
  const d = digitsOnly(phone).replace(/^63/, '0');
  return store.get().parcels.filter((p) => p.bookedToday && digitsOnly(p.phone) === d).reverse();
}
