// Booking help: part of the intake agent. Answers questions people have while booking,
// using the same tools as the form checks. Booking topics only; everything else is redirected.
import { findNamedBarangays, matchLandmark, findOutsideCoverage } from '../tools/address-tools.js';
import { estimateRate } from '../tools/rate-tools.js';
import { screenItem } from './intake.js';
import { normalise } from '../core/util.js';

const has = (text, words) => words.some((w) => text.includes(w));
const STAFF_ONLY = ['refund', 'complaint', 'complain', 'compensation', 'damaged', 'lost', 'reimburse'];
const TRACKING = ['where is my', 'track', 'status of my', 'nasaan'];
const RATES = ['how much', 'magkano', 'rate', 'price', 'cost', 'fee', 'shipping'];
const COVERAGE = ['deliver to', 'do you deliver', 'cover', 'coverage', 'service area'];
const BARANGAY = ['barangay', 'brgy', 'what area', 'which area'];
const ITEMS = ['can i send', 'can i ship', 'pwede', 'allowed', 'accept'];

function zoneOf(text) {
  if (has(text, ['visayas', 'mindanao', 'cebu', 'davao', 'iloilo', 'bacolod', 'cagayan de oro'])) return 2;
  if (has(text, ['luzon', 'manila', 'quezon city', 'baguio', 'tarlac', 'bulacan', 'batangas', 'mabalacat', 'san fernando'])) return 1;
  return 0;
}

/**
 * Answer a booking question. Returns { message, action? }, where action can be
 * { type: 'fill-barangay', barangay } so the form can apply it with one tap.
 */
export function answerBookingQuestion(question = '') {
  const q = normalise(question).replace(/[^a-z0-9ñ\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!q) return { message: 'Ask about what you can send, rates, our coverage, or your address.' };

  if (has(q, STAFF_ONLY)) {
    return { message: 'Refunds, complaints and lost or damaged parcels are handled by our staff. Please speak to the counter or call the branch.' };
  }
  if (has(q, TRACKING)) {
    return { message: 'For a parcel you’ve already sent, our staff can check it with your reference code (PU- followed by six digits).' };
  }

  const landmark = matchLandmark(q);
  const named = findNamedBarangays(q)[0];
  if (landmark && (has(q, BARANGAY) || has(q, ['near', 'malapit', 'tapat', 'beside']))) {
    return {
      message: `${landmark.label} is in ${landmark.barangay}.`,
      action: { type: 'fill-barangay', barangay: landmark.barangay },
    };
  }

  const outside = findOutsideCoverage(q);
  if (has(q, RATES)) {
    const kg = Number((q.match(/(\d+(?:\.\d+)?)\s*(kg|kilo)/) || [])[1]);
    if (!kg) return { message: 'Rates depend on weight and destination. Tell me the weight, like “How much for 2 kg?”, or see the rate table.' };
    const zone = zoneOf(q);
    const r = estimateRate(kg, zone);
    const note = outside || zone > 0 ? ' Note that this branch only delivers within Angeles City for now.' : '';
    return { message: `About ₱${r.amount} for ${kg} kg (${r.tier}, ${r.zone.toLowerCase()}).${note}` };
  }

  if (outside) return { message: `Sorry, ${outside.place} is outside our coverage. This branch delivers within Angeles City only, for now.` };
  if (named && has(q, COVERAGE)) return { message: `Yes, ${named} is in Angeles City and within our coverage.` };
  if (has(q, COVERAGE)) return { message: 'We deliver to all 33 barangays of Angeles City. Areas outside the city aren’t covered yet.' };

  const item = screenItem(q.replace(/^(can i send|can i ship|pwede ba|pwede|is it allowed to send)\s*/, ''));
  if (has(q, ITEMS) || item.status !== 'clear') {
    if (item.status === 'blocked') return { message: item.message.split('. ')[0] + '.' };
    if (item.status === 'care') return { message: `Yes, with care: ${item.notes.join(' ')}` };
    return { message: 'Yes, everyday items like clothes, shoes, documents and gadget accessories are fine. We can’t accept cash, fuel, fireworks, firearms, live animals or illegal items.' };
  }

  if (has(q, BARANGAY)) {
    return { message: 'Pick the barangay from the list. If you’re not sure, tell me a nearby landmark, like “I’m near Marquee Mall”.' };
  }

  return { message: 'I can help with booking questions: what you can send, rates, our coverage, and addresses.' };
}
