// Rider tools: read-only views of the roster and live positions.
import { store } from '../core/store.js';
import { AREAS, BARANGAYS } from '../data/barangays.js';
import { VEHICLES } from '../data/riders.js';
import { distance } from '../core/util.js';

export const getAvailableRiders = () => store.get().riders.filter((r) => r.available);
export const getAllRiders = () => store.get().riders;
export const getRider = (id) => store.get().riders.find((r) => r.id === id) || null;
export const getNeighbourAreas = (area) => AREAS[area]?.neighbours || [];
export const areaName = (area) => (area === 'all' ? 'All areas' : AREAS[area]?.name || area);
export const vehicleFits = (vehicle, size) => VEHICLES[vehicle].sizes.includes(size);
export const vehicleCapacity = (vehicle) => VEHICLES[vehicle].capacity;
export const vehicleLabel = (vehicle) => VEHICLES[vehicle].label;

/** Nearest barangay to a rider's current position. */
export function getRiderLocation(id) {
  const r = getRider(id);
  if (!r) return null;
  return BARANGAYS.reduce((best, b) => (distance(r, b) < distance(r, best) ? b : best)).name;
}
