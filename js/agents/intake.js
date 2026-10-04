// Intake agent: checks the booking while the customer, or counter staff, fill in the form.
// Simulated reasoning, same contract a real LLM agent would use: tools in, structured decision out.
import {
  findNamedBarangays, findPartialBarangays, matchLandmark, hasStreetDetail, getPastDelivery,
  findOutsideCoverage, extractDescriptors,
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

const pastOption = (past) => ({
  label: `${past.street}, ${past.barangay}`,
  value: { street: past.street, barangay: past.barangay, landmark: past.landmark },
});

/**
 * Check the address fields. The barangay itself is a required dropdown (a rule);
 * the agent fills it from what the customer typed, catches conflicts and suggests past addresses.
 *
 * Returns { status, message?, options?, barangay?, conflict? } where status is one of:
 *   'empty' | 'past' | 'auto' | 'choose' | 'conflict' | 'blocked' | 'thin' | 'clear'
 */
export function checkAddressFields({ street = '', barangay = '', landmark = '', phone = '' }, { pastDismissed = false, conflictKept = false } = {}) {
  const text = `${street} ${landmark}`.trim();
  const past = getPastDelivery(phone);

  if (!text && !barangay) {
    return past && !pastDismissed
      ? { status: 'past', message: `We delivered to this number on ${formatDate(past.date)}. Use the same address?`, options: [pastOption(past)] }
      : { status: 'empty' };
  }

  const outside = findOutsideCoverage(text);
  if (outside) {
    return { status: 'blocked', message: `This address looks like it’s in ${outside.place}, outside our Angeles City coverage. We can’t deliver there yet.` };
  }

  // What the typed text says about the barangay: a named barangay, or a known landmark.
  const named = findNamedBarangays(text)[0];
  const hit = matchLandmark(text);
  const inferred = named || hit?.barangay || null;
  const source = named ? 'The address' : hit ? hit.label : null;

  if (!barangay) {
    if (inferred) return { status: 'auto', barangay: inferred, message: `Barangay set to ${inferred}, based on ${source === 'The address' ? 'the address' : source}.` };
    const family = findPartialBarangays(text);
    if (family.length) {
      return { status: 'choose', message: `There are ${family.length} barangays with that name in Angeles City. Which one?`, options: family.map((b) => ({ label: b, value: { barangay: b } })) };
    }
    return { status: 'empty' };
  }

  if (inferred && inferred !== barangay && !conflictKept) {
    return {
      status: 'conflict',
      message: `${source} points to ${inferred}, but ${barangay} is selected. Which is right?`,
      options: [{ label: inferred, value: { barangay: inferred } }],
      keepLabel: `Keep ${barangay}`,
    };
  }

  if (past && past.barangay !== barangay && !pastDismissed) {
    return {
      status: 'past',
      message: `This number’s last successful delivery was in ${past.barangay}. Is it the same address?`,
      options: [pastOption(past)],
      newLabel: 'No, this is a new address',
    };
  }

  if (!hasStreetDetail(street) && !landmark.trim()) {
    return { status: 'thin', message: `Add a house number, lot or street, or a landmark, so the rider can find the exact spot in ${barangay}.` };
  }

  return { status: 'clear', message: `Address confirmed in ${barangay}.` };
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
export function checkDuplicate({ phone, barangay, street }) {
  const recent = findRecentBookings(phone);
  const same = recent.find((p) => (barangay && p.barangay === barangay) || (!barangay && p.street === street));
  if (!same) return null;
  return {
    ref: same.ref,
    message: `${same.recipient} already has a booking to this address today (${same.ref}, booked ${same.createdAt}). Is this a separate parcel?`,
  };
}

// Rider note ----------------------------------------------------------------------

/** One clear instruction for the rider, built from the address details and item handling. */
export function writeRiderNote({ street, barangay, landmark, typedAddress = '', tags = [] }) {
  const parts = [];
  const where = [street, barangay].filter(Boolean).join(', ');
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
