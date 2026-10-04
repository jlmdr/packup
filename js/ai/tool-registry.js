// Tools a live model may call, described as JSON schemas and backed by the same read-only
// functions the simulated agents use. Nothing here can change a booking.
import {
  findCities, findNamedBarangays, findPartialBarangays, matchLandmark, getPastDelivery,
  hasStreetDetail, listCities, listBarangays,
} from '../tools/address-tools.js';
import { findNotAccepted, findNeedsCare } from '../tools/item-tools.js';
import { estimateRate, deliveryZone } from '../tools/rate-tools.js';
import { findParcels, getParcelsForBatch, getAreaOf, findRecentBookings } from '../tools/parcel-tools.js';
import {
  getAllRiders, getRider, getNeighbourAreas, vehicleFits, vehicleCapacity, getRiderLocation,
} from '../tools/rider-tools.js';

const text = { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] };
const textInCity = { type: 'object', properties: { text: { type: 'string' }, city: { type: 'string' } }, required: ['text'] };
const city = { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] };
const none = { type: 'object', properties: {} };
const phone = { type: 'object', properties: { phone: { type: 'string' } }, required: ['phone'] };

const parcelSummary = (p) => ({
  ref: p.ref, recipient: p.recipient, city: p.city, barangay: p.barangay, area: getAreaOf(p), size: p.size,
  status: p.status, riderId: p.riderId, failReason: p.failReason || null,
  lastEvent: p.history[p.history.length - 1],
});
const riderSummary = (r) => ({
  id: r.id, name: r.name, vehicle: r.vehicle, area: r.area, available: r.available,
  capacity: vehicleCapacity(r.vehicle), note: r.note || null,
});

const TOOLS = {
  // Address
  find_cities: { description: 'Cities named in the text, including aliases like "QC".', input: text, run: ({ text: t }) => findCities(t) },
  find_named_barangays: { description: 'Barangays fully named in the text as { city, barangay }, optionally within one city.', input: textInCity, run: ({ text: t, city: c }) => findNamedBarangays(t, c) },
  find_partial_barangays: { description: 'Barangays in a city that share a partial name in the text, e.g. "Lourdes".', input: { ...textInCity, required: ['text', 'city'] }, run: ({ text: t, city: c }) => findPartialBarangays(t, c) },
  match_landmark: { description: 'A known landmark in the text, with its city and barangay.', input: text, run: ({ text: t }) => matchLandmark(t) },
  has_street_detail: { description: 'Whether the text has a house, lot, unit or street detail.', input: text, run: ({ text: t }) => hasStreetDetail(t) },
  get_past_delivery: { description: 'Last successful delivery address for a phone number.', input: phone, run: ({ phone: p }) => getPastDelivery(p) },
  list_cities: { description: 'Cities the booking form offers.', input: none, run: () => listCities() },
  list_barangays: { description: 'Barangays of a city.', input: city, run: ({ city: c }) => listBarangays(c) },
  // Items and rates
  find_not_accepted_items: { description: 'Item policy categories that cannot be carried, found in the description.', input: text, run: ({ text: t }) => findNotAccepted(t).map((r) => r.label) },
  find_care_items: { description: 'Item policy categories that need handling notes, found in the description.', input: text, run: ({ text: t }) => findNeedsCare(t).map(({ label, note, tag }) => ({ label, note, tag })) },
  delivery_zone: {
    description: 'Delivery zone between two cities: 0 same city, 1 within Luzon, 2 Visayas or Mindanao.',
    input: { type: 'object', properties: { fromCity: { type: 'string' }, toCity: { type: 'string' } }, required: ['fromCity', 'toCity'] },
    run: ({ fromCity, toCity }) => deliveryZone(fromCity, toCity),
  },
  estimate_rate: {
    description: 'Estimated fee in pesos. zone: 0 same city, 1 within Luzon, 2 Visayas or Mindanao.',
    input: { type: 'object', properties: { kg: { type: 'number' }, zone: { type: 'number', enum: [0, 1, 2] } }, required: ['kg'] },
    run: ({ kg, zone = 0 }) => estimateRate(kg, zone),
  },
  // Parcels
  find_parcels: { description: 'Parcels matching a reference code, phone number or recipient name in free text.', input: text, run: ({ text: t }) => findParcels(t).slice(0, 6).map(parcelSummary) },
  get_batch_parcels: { description: 'Parcels in this morning\'s dispatch batch.', input: none, run: () => getParcelsForBatch().map(parcelSummary) },
  find_recent_bookings: { description: 'Bookings made today for a recipient phone number.', input: phone, run: ({ phone: p }) => findRecentBookings(p).map(parcelSummary) },
  // Riders
  list_riders: { description: 'All riders with vehicle, home area, availability and capacity.', input: none, run: () => getAllRiders().map(riderSummary) },
  get_neighbour_areas: {
    description: 'Delivery areas next to an area.',
    input: { type: 'object', properties: { area: { type: 'string' } }, required: ['area'] },
    run: ({ area }) => getNeighbourAreas(area),
  },
  vehicle_fits: {
    description: 'Whether a vehicle can carry a parcel size.',
    input: { type: 'object', properties: { vehicle: { type: 'string' }, size: { type: 'string' } }, required: ['vehicle', 'size'] },
    run: ({ vehicle, size }) => vehicleFits(vehicle, size),
  },
  get_rider_location: {
    description: 'A rider\'s name and the barangay they are currently near.',
    input: { type: 'object', properties: { riderId: { type: 'string' } }, required: ['riderId'] },
    run: ({ riderId }) => ({ name: getRider(riderId)?.name || null, near: getRiderLocation(riderId) }),
  },
};

/** Tool descriptions in the provider-neutral format the proxy expects. */
export const toolSpecs = (names) => names.map((name) => ({ name, description: TOOLS[name].description, inputSchema: TOOLS[name].input }));

/** Run a tool by name. Errors come back as data so the model can recover. */
export function runTool(name, input = {}) {
  const tool = TOOLS[name];
  if (!tool) return { error: `Unknown tool: ${name}` };
  try {
    return { result: tool.run(input) ?? null };
  } catch (err) {
    return { error: err.message };
  }
}
