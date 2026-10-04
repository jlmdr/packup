// Address tools: the only way agents read address data.
import { BARANGAYS } from '../data/barangays.js';
import { CITIES } from '../data/locations.js';
import { LANDMARKS } from '../data/landmarks.js';
import { DELIVERY_HISTORY } from '../data/history.js';
import { normalise, digitsOnly } from '../core/util.js';
import { hasStreetDetail } from '../core/validation.js';

export { hasStreetDetail };

const expandAbbreviations = (text) =>
  normalise(text)
    .replace(/\bsto\b/g, 'santo')
    .replace(/\bsta\b/g, 'santa')
    .replace(/\b(brgy|bgy|barangay)\b/g, ' ')
    .replace(/[^a-z0-9ñ\s-]/g, ' ')
    .replace(/\s+/g, ' ');

const plain = (s) => normalise(s).replace(/ñ/g, 'n');
const inCities = (city) => (city ? CITIES.filter((c) => c.name === city) : CITIES);

export const listCities = () => CITIES.map((c) => c.name);
export const getCity = (name) => CITIES.find((c) => c.name === name) || null;
export const listBarangays = (city) => getCity(city)?.barangays || [];

/** Cities named in the text, by name or common alias (e.g. "QC"). */
export function findCities(text) {
  const t = ` ${expandAbbreviations(text)} `;
  return CITIES.filter((c) => [c.name, ...c.aliases].some((a) => t.includes(` ${normalise(a)} `))).map((c) => c.name);
}

/** Barangays fully named in the text as { city, barangay }, longest name first. Optionally within one city. */
export function findNamedBarangays(text, city = null) {
  const t = ` ${plain(expandAbbreviations(text))} `;
  return inCities(city)
    .flatMap((c) => c.barangays.map((b) => ({ city: c.name, barangay: b })))
    .filter(({ barangay }) => t.includes(` ${plain(barangay)} `))
    .sort((a, b) => b.barangay.length - a.barangay.length);
}

/** Barangays in one city sharing a partial name found in the text, e.g. "Lourdes" or "Pulung". */
export function findPartialBarangays(text, city) {
  const words = new Set(expandAbbreviations(text).split(' ').filter((w) => w.length >= 4));
  const families = new Map();
  listBarangays(city).forEach((b) => {
    const first = plain(b).split(' ')[0];
    if (words.has(first)) families.set(first, [...(families.get(first) || []), b]);
  });
  return [...families.values()].find((list) => list.length > 1) || [];
}

/** Known landmark mentioned in the text, with its city and barangay. */
export function matchLandmark(text) {
  const t = normalise(text);
  return LANDMARKS.find((l) => l.keys.some((k) => t.includes(k))) || null;
}

/** Last successful delivery address for a phone number, if any. */
export function getPastDelivery(phone) {
  return DELIVERY_HISTORY[digitsOnly(phone)] || null;
}

/** A barangay in the riders' delivery area (with its rider area and map position). */
export const getDeliveryAreaBarangay = (name) => BARANGAYS.find((b) => b.name === name) || null;

/** Descriptive details riders look for, e.g. "blue gate", "yellow house". */
export function extractDescriptors(text) {
  const re = /\b(blue|green|red|yellow|white|black|orange|pink|gr[ae]y|brown|asul|berde|pula|dilaw|puti|itim)\s+(gate|house|door|building|fence|store|roof)\b/gi;
  return [...text.matchAll(re)].map((m) => m[0].toLowerCase());
}
