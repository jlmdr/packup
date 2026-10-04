// Intake agent: checks the booking while the customer, or counter staff, fill in the form.
// Simulated reasoning, same contract a real LLM agent would use: tools in, structured decision out.
import {
  findCities, findNamedBarangays, findPartialBarangays, matchLandmark, hasStreetDetail, getPastDelivery,
  extractDescriptors,
} from '../tools/address-tools.js';
import { findNotAccepted, findNeedsCare } from '../tools/item-tools.js';
import { findRecentBookings } from '../tools/parcel-tools.js';
import { formatDate } from '../core/util.js';

const TRANSLATIONS = [
  [/\btapat (ng|sa)\b/i, 'Across from'], [/\bmalapit sa\b/i, 'Near'], [/\bkatabi ng\b/i, 'Beside'],
  [/\blikod ng\b/i, 'Behind'], [/\bharap ng\b/i, 'In front of'],
  [/\bsimbahan\b/i, 'the church'], [/\bkapilya\b/i, 'the chapel'], [/\bpalengke\b/i, 'the market'],
  [/\beskwelahan\b/i, 'the school'],
];

/** Turn a Filipino landmark phrase into a short English rider note, keeping the original. */
export function translateLandmark(note = '') {
  const text = note.trim();
  if (!text) return '';
  let english = text;
  TRANSLATIONS.forEach(([re, en]) => { english = english.replace(re, en); });
  english = english.charAt(0).toUpperCase() + english.slice(1);
  return english.toLowerCase() === text.toLowerCase() ? english : `${english} (“${text}”)`;
}

const place = (city, barangay) => [barangay, city].filter(Boolean).join(', ');

const pastOption = (past) => ({
  label: `${past.street}, ${place(past.city, past.barangay)}`,
  value: { street: past.street, city: past.city, barangay: past.barangay, landmark: past.landmark },
});

/**
 * Check the address fields. City and barangay are required dropdowns (rules);
 * the agent fills them from what the customer typed, catches conflicts and suggests past addresses.
 *
 * Returns { status, message?, options?, city?, barangay? } where status is one of:
 *   'empty' | 'past' | 'auto' | 'choose' | 'conflict' | 'thin' | 'clear'
 */
export function checkAddressFields({ street = '', city = '', barangay = '', landmark = '', phone = '' }, { pastDismissed = false, conflictKept = false } = {}) {
  const text = `${street} ${landmark}`.trim();
  const past = getPastDelivery(phone);

  if (!text && !city && !barangay) {
    return past && !pastDismissed
      ? { status: 'past', message: `We delivered to this number on ${formatDate(past.date)}. Use the same address?`, options: [pastOption(past)] }
      : { status: 'empty' };
  }

  // What the typed text says about the place.
  const hit = matchLandmark(text);
  const namedCity = findCities(text)[0] || null;
  const inferredCity = namedCity || hit?.city || null;
  const named = findNamedBarangays(text, city || inferredCity);
  const inferredBarangay = named[0]?.barangay || (hit && (!city || hit.city === city) ? hit.barangay : null);
  const source = hit && !named.length ? hit.label : 'The address';

  // Nothing selected yet: fill in what the text makes clear, or ask.
  if (!city) {
    const anywhere = findNamedBarangays(text);
    if (!inferredCity && anywhere.length > 1) {
      return {
        status: 'choose',
        message: `${anywhere[0].barangay} is in more than one city. Which one?`,
        options: anywhere.map((m) => ({ label: place(m.city, m.barangay), value: { city: m.city, barangay: m.barangay } })),
      };
    }
    const fillCity = inferredCity || anywhere[0]?.city;
    const fillBarangay = inferredBarangay || anywhere[0]?.barangay || null;
    if (fillCity) {
      return { status: 'auto', city: fillCity, barangay: fillBarangay, message: `Set to ${place(fillCity, fillBarangay)}, based on ${source === 'The address' ? 'the address' : source}.` };
    }
    return { status: 'empty' };
  }

  // The text names a different city than the one selected.
  if (namedCity && namedCity !== city && !conflictKept) {
    return {
      status: 'conflict',
      message: `The address mentions ${namedCity}, but ${city} is selected. Which is right?`,
      options: [{ label: namedCity, value: { city: namedCity, barangay: findNamedBarangays(text, namedCity)[0]?.barangay || '' } }],
      keepLabel: `Keep ${city}`,
    };
  }

  if (!barangay) {
    if (inferredBarangay) return { status: 'auto', city, barangay: inferredBarangay, message: `Barangay set to ${inferredBarangay}, based on ${source === 'The address' ? 'the address' : source}.` };
    const family = findPartialBarangays(text, city);
    if (family.length) {
      return { status: 'choose', message: `There are ${family.length} barangays with that name in ${city}. Which one?`, options: family.map((b) => ({ label: b, value: { city, barangay: b } })) };
    }
    return { status: 'empty' };
  }

  if (inferredBarangay && inferredBarangay !== barangay && !conflictKept) {
    return {
      status: 'conflict',
      message: `${source} points to ${inferredBarangay}, but ${barangay} is selected. Which is right?`,
      options: [{ label: inferredBarangay, value: { city, barangay: inferredBarangay } }],
      keepLabel: `Keep ${barangay}`,
    };
  }

  if (past && (past.city !== city || past.barangay !== barangay) && !pastDismissed) {
    return {
      status: 'past',
      message: `This number’s last successful delivery was in ${place(past.city, past.barangay)}. Is it the same address?`,
      options: [pastOption(past)],
      newLabel: 'No, this is a new address',
    };
  }

  if (!hasStreetDetail(street) && !landmark.trim()) {
    return { status: 'thin', message: `Add a house number, lot or street, or a landmark, so the rider can find the exact spot in ${barangay}.` };
  }

  return { status: 'clear', message: `Address confirmed: ${place(city, barangay)}.` };
}

// Item screening ----------------------------------------------------------------

/** Read what the customer says is inside and apply the item policy. */
export function screenItem(description = '') {
  const text = description.trim();
  if (!text) return { status: 'empty' };
  const banned = findNotAccepted(text);
  if (banned.length) {
    return {
      status: 'blocked',
      message: `We can’t accept ${banned.map((b) => b.label).join(' or ')}. Remove ${banned.length > 1 ? 'these items' : 'it'} from the parcel, or update the description if we misread it.`,
    };
  }
  const care = findNeedsCare(text);
  if (care.length) {
    return { status: 'care', notes: care.map((c) => c.note), tags: care.map((c) => c.tag) };
  }
  return { status: 'clear' };
}

// Duplicate check ---------------------------------------------------------------

/** A booking made today for the same recipient number and barangay, if any. */
export function checkDuplicate({ phone, city, barangay, street }) {
  const recent = findRecentBookings(phone);
  const same = recent.find((p) => (p.city === city && p.barangay === barangay) || (!barangay && p.street === street));
  if (!same) return null;
  return {
    ref: same.ref,
    message: `${same.recipient} already has a booking to this address today (${same.ref}, booked ${same.createdAt}). Is this a separate parcel?`,
  };
}

// Rider note ----------------------------------------------------------------------

/** One clear instruction for the rider, built from the address details and item handling. */
export function writeRiderNote({ street, city, barangay, landmark, typedAddress = '', tags = [] }) {
  const parts = [];
  const where = [street, barangay, city].filter(Boolean).join(', ');
  if (where) parts.push(`Deliver to ${where}.`);
  const note = translateLandmark(landmark).replace(/\s*\(“.*”\)$/, '');
  if (note) parts.push(`${note.replace(/[.,\s]+$/, '')}.`);
  const looks = extractDescriptors(typedAddress).filter((d) => !note.toLowerCase().includes(d));
  if (looks.length) parts.push(`Look for the ${looks.join(' and ')}.`);
  if (tags.includes('Fragile')) parts.push('Fragile, handle with care.');
  if (tags.includes('Food')) parts.push('Food, deliver early in the route.');
  if (tags.includes('Liquid')) parts.push('Liquid, keep upright.');
  if (tags.includes('Battery')) parts.push('Contains a battery.');
  return parts.join(' ');
}
