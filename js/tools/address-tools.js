// Address tools: the only way agents read address data.
import { BARANGAYS } from '../data/barangays.js';
import { LANDMARKS } from '../data/landmarks.js';
import { DELIVERY_HISTORY } from '../data/history.js';
import { OUTSIDE_COVERAGE } from '../data/coverage.js';
import { normalise, digitsOnly } from '../core/util.js';
import { hasStreetDetail } from '../core/validation.js';

export { hasStreetDetail };

const expandAbbreviations = (text) =>
  normalise(text)
    .replace(/\bsto\b/g, 'santo')
    .replace(/\bsta\b/g, 'santa')
    .replace(/\b(brgy|bgy|barangay)\b/g, ' ')
    .replace(/\s+/g, ' ');

/** Barangays fully named in the text, longest name first. */
export function findNamedBarangays(text) {
  const t = ` ${expandAbbreviations(text)} `;
  return BARANGAYS
    .filter((b) => t.includes(` ${normalise(b.name)} `))
    .sort((a, b) => b.name.length - a.name.length)
    .map((b) => b.name);
}

/** Barangays sharing a partial name that appears in the text, e.g. "lourdes" or "pulung". */
export function findPartialBarangays(text) {
  const words = new Set(expandAbbreviations(text).split(' ').filter((w) => w.length >= 4));
  const families = new Map();
  for (const b of BARANGAYS) {
    const first = normalise(b.name).split(' ')[0];
    if (words.has(first)) families.set(first, [...(families.get(first) || []), b.name]);
  }
  return [...families.values()].find((list) => list.length > 1) || [];
}

/** Known landmark mentioned in the text, with its barangay. */
export function matchLandmark(text) {
  const t = normalise(text);
  return LANDMARKS.find((l) => l.keys.some((k) => t.includes(k))) || null;
}


/** Last successful delivery address for a phone number, if any. */
export function getPastDelivery(phone) {
  return DELIVERY_HISTORY[digitsOnly(phone)] || null;
}

export const listBarangays = () => BARANGAYS.map((b) => b.name).sort();
export const getBarangay = (name) => BARANGAYS.find((b) => b.name === name) || null;

/** Place outside the branch's coverage mentioned in the text, if any. */
export function findOutsideCoverage(text) {
  const t = ` ${normalise(text)} `;
  return OUTSIDE_COVERAGE.find((c) => c.keys.some((k) => t.includes(` ${normalise(k)} `))) || null;
}

/** Descriptive details riders look for, e.g. "blue gate", "yellow house". */
export function extractDescriptors(text) {
  const re = /\b(blue|green|red|yellow|white|black|orange|pink|gr[ae]y|brown|asul|berde|pula|dilaw|puti|itim)\s+(gate|house|door|building|fence|store|roof)\b/gi;
  return [...text.matchAll(re)].map((m) => m[0].toLowerCase());
}
