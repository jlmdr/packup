// Fixed form rules. Plain software: no judgement needed, so no agent.
import { digitsOnly } from './util.js';

const ok = (extra = {}) => ({ ok: true, ...extra });
const fail = (message, extra = {}) => ({ ok: false, message, ...extra });

/** Philippine mobile numbers: 09XXXXXXXXX (11 digits) or +63 9XXXXXXXXX. */
export function validateMobile(value = '', { required = true } = {}) {
  const raw = value.trim();
  if (!raw) return required ? fail('Enter a mobile number.') : ok();
  if (/[^\d\s+()-]/.test(raw)) return fail('Use numbers only, like 0917 123 4567.');
  let d = digitsOnly(raw);
  if (d.startsWith('63')) d = `0${d.slice(2)}`;
  if (!d.startsWith('09')) return fail('Mobile numbers start with 09 or +63 9.');
  const gap = 11 - d.length;
  if (gap > 0) return fail(`This number is ${gap} digit${gap === 1 ? '' : 's'} short. Mobile numbers have 11 digits.`);
  if (gap < 0) return fail('This number has too many digits. Mobile numbers have 11 digits.');
  return ok({ normalised: d });
}

export function validateName(value = '', label = 'name') {
  const v = value.trim();
  if (!v) return fail(`Enter the ${label}.`);
  if (v.length < 2) return fail(`The ${label} needs at least 2 characters.`);
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ .'-]+$/.test(v)) return fail(`Use letters only for the ${label}.`);
  return ok();
}

export function validateStreet(value = '') {
  const v = value.trim();
  if (!v) return fail('Enter the house, lot or street.');
  if ((v.match(/[A-Za-z0-9ñÑ]/g) || []).length < 3) return fail('Add the house number, lot or street name.');
  return ok();
}

/** Whether the text has a house, lot, unit or street detail. */
export function hasStreetDetail(text = '') {
  return /\d/.test(text) || /\b(blk|block|lot|unit|purok|st|street|ave|avenue|rd|road|hwy|highway|subd|village)\b/i.test(text);
}

/** Hard stop: is there enough for a rider to find the place at all? */
export function addressTooThin({ street = '', landmark = '' }) {
  if (hasStreetDetail(street) || landmark.trim()) return null;
  return 'Add a house number, lot, street or landmark before booking. A rider can’t find an address from the barangay alone.';
}

/** Why staff should check a booking before dispatch, if at all. */
export function intakeReviewReason({ conflictKept, newAddress, barangay, pastBarangay }) {
  if (conflictKept) return 'The landmark points to a different barangay, and the customer kept their choice. Call to confirm.';
  if (newAddress) return `New address in ${barangay}; the last successful delivery was in ${pastBarangay}. Call to confirm.`;
  return null;
}

export function validateBarangay(value = '', allowed = []) {
  if (!value) return fail('Choose the barangay.');
  if (allowed.length && !allowed.includes(value)) return fail('Choose a barangay from the list.');
  return ok();
}

export function validateItem(value = '') {
  const v = value.trim();
  if (!v) return fail('Tell us what’s inside the parcel.');
  if (v.length < 3) return fail('Describe the item in a few words, like “2 shirts”.');
  return ok();
}

const MAX_WEIGHT = 50;
const sizeForWeight = (kg) => (kg <= 3 ? 'small' : kg <= 10 ? 'medium' : 'large');

export function validateWeight(value) {
  const kg = Number(value);
  if (value === '' || Number.isNaN(kg)) return fail('Enter the weight in kilograms.');
  if (kg < 0.1) return fail('The minimum weight is 0.1 kg.');
  if (kg > MAX_WEIGHT) return fail(`We accept parcels up to ${MAX_WEIGHT} kg.`);
  return ok({ kg });
}

/** Size must match weight; returns the size it should be when it doesn't. */
export function validateSize(size, weightValue) {
  const w = validateWeight(weightValue);
  if (!w.ok) return ok();
  const expected = sizeForWeight(w.kg);
  return expected === size ? ok() : fail(`${w.kg} kg is a ${expected} parcel.`, { expected });
}

export function validateDifferentNumbers(sender = '', recipient = '') {
  const a = validateMobile(sender, { required: false });
  const b = validateMobile(recipient);
  if (a.normalised && b.normalised && a.normalised === b.normalised) return fail('Sender and recipient can’t have the same number.');
  return ok();
}
