// Rider assignment agent: builds the morning plan for the dispatcher to review.
// Considers area, parcel size vs vehicle, workload and availability. Does not set route order.
import { getParcelsForBatch, getAreaOf } from '../tools/parcel-tools.js';
import {
  getAvailableRiders, getAllRiders, getNeighbourAreas, vehicleFits, vehicleCapacity, areaName,
} from '../tools/rider-tools.js';

const SIZE_ORDER = { large: 0, medium: 1, small: 2 };

export function planMorningBatch() {
  const parcels = [...getParcelsForBatch()].sort((a, b) => SIZE_ORDER[a.size] - SIZE_ORDER[b.size]);
  const riders = getAvailableRiders();
  const load = Object.fromEntries(riders.map((r) => [r.id, 0]));
  const byRider = Object.fromEntries(riders.map((r) => [r.id, []]));
  const covering = {}; // ref -> area the rider is covering outside their own
  const flagged = [];

  const hasRoom = (r) => load[r.id] < vehicleCapacity(r.vehicle);
  const leastLoaded = (list) => list.sort((a, b) => load[a.id] - load[b.id])[0];
  const give = (rider, parcel, area) => {
    byRider[rider.id].push(parcel.ref);
    load[rider.id] += 1;
    if (rider.area !== 'all' && rider.area !== area) covering[parcel.ref] = area;
  };

  for (const parcel of parcels) {
    const area = getAreaOf(parcel);
    if (parcel.status === 'flagged' || !area) {
      flagged.push({ ref: parcel.ref, reason: 'Address not confirmed yet. Waiting on intake review.' });
      continue;
    }

    const fits = riders.filter((r) => vehicleFits(r.vehicle, parcel.size) && hasRoom(r));
    if (!fits.length) {
      const vanOff = getAllRiders().find((r) => r.vehicle === 'van' && !r.available);
      flagged.push({
        ref: parcel.ref,
        reason: parcel.size === 'large' && vanOff
          ? `Large parcel needs a van. ${vanOff.name}, the only van rider, is unavailable today.`
          : 'No rider with a suitable vehicle has room left today.',
      });
      continue;
    }

    const home = fits.filter((r) => r.area === area);
    const anyArea = fits.filter((r) => r.area === 'all');
    const neighbours = fits.filter((r) => getNeighbourAreas(area).includes(r.area));
    const pick = leastLoaded(home) || leastLoaded(anyArea) || leastLoaded(neighbours);

    if (pick) give(pick, parcel, area);
    else flagged.push({ ref: parcel.ref, reason: `Riders in ${areaName(area)} and neighbouring areas are full.` });
  }

  return {
    byRider,
    covering,
    flagged,
    totals: { parcels: parcels.length, assigned: parcels.length - flagged.length, flagged: flagged.length },
  };
}
