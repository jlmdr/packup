// Booking help: part of the intake agent. Answers questions people have while booking,
// using the same tools as the form checks. Booking topics only; everything else is redirected.
import { findCities, findNamedBarangays, matchLandmark } from '../tools/address-tools.js';
import { estimateRate, deliveryZone } from '../tools/rate-tools.js';
import { screenItem } from './intake.js';
import { normalise } from '../core/util.js';

const has = (text, words) => words.some((w) => text.includes(w));
const STAFF_ONLY = ['refund', 'complaint', 'complain', 'compensation', 'damaged', 'lost', 'reimburse'];
const TRACKING = ['where is my', 'track', 'status of my', 'nasaan'];
const RATES = ['how much', 'magkano', 'rate', 'price', 'cost', 'fee', 'shipping'];
const COVERAGE = ['deliver to', 'do you deliver', 'ship to', 'send to', 'cover', 'coverage', 'nationwide'];
const BARANGAY = ['barangay', 'brgy', 'what area', 'which area'];
const ITEMS = ['can i send', 'can i ship', 'pwede', 'allowed', 'accept'];

/** Zone from a named destination and the sender's city, or from region words in the question. */
function zoneFor(q, fromCity) {
  const to = findCities(q)[0];
  const zone = to && fromCity ? deliveryZone(fromCity, to) : null;
  if (zone !== null) return { zone, to };
  if (has(q, ['visayas', 'mindanao'])) return { zone: 2, to };
  if (has(q, ['luzon'])) return { zone: 1, to };
  return { zone: 0, to, assumed: true };
}

/**
 * Answer a booking question. Context carries the sender's city from the form, when known.
 * Returns { message, action? }, where action { type: 'fill-address', city, barangay } lets the form apply it.
 */
export function answerBookingQuestion(question = '', { fromCity = '' } = {}) {
  const q = normalise(question).replace(/[^a-z0-9ñ\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!q) return { message: 'Ask about what you can send, rates, where we deliver, or your address.' };

  if (has(q, STAFF_ONLY)) {
    return { message: 'Refunds, complaints and lost or damaged parcels are handled by our staff. Please speak to the counter or call the branch.' };
  }
  if (has(q, TRACKING)) {
    return { message: 'For a parcel you’ve already sent, our staff can check it with your reference code (PU- followed by six digits).' };
  }

  const landmark = matchLandmark(q);
  if (landmark && (has(q, BARANGAY) || has(q, ['near', 'malapit', 'tapat', 'beside']))) {
    return {
      message: `${landmark.label} is in ${landmark.barangay}, ${landmark.city}.`,
      action: { type: 'fill-address', city: landmark.city, barangay: landmark.barangay },
    };
  }

  if (has(q, RATES)) {
    const kg = Number((q.match(/(\d+(?:\.\d+)?)\s*(kg|kilo)/) || [])[1]);
    if (!kg) return { message: 'Rates depend on weight and destination. Tell me both, like “How much for 2 kg to Cebu?”, or see the rate table.' };
    const { zone, to, assumed } = zoneFor(q, fromCity);
    const r = estimateRate(kg, zone);
    const where = to ? ` to ${to}` : '';
    const note = assumed ? ' Tell me the destination for an exact zone.' : '';
    return { message: `About ₱${r.amount} for ${kg} kg${where} (${r.tier}, ${r.zone.toLowerCase()}).${note}` };
  }

  const city = findCities(q)[0];
  if (has(q, COVERAGE)) {
    if (city) return { message: `Yes, we deliver to ${city}. Choose it in the City list, then the barangay.` };
    return { message: 'We deliver nationwide. Choose the destination city, then the barangay, in the form.' };
  }

  const item = screenItem(q.replace(/^(can i send|can i ship|pwede ba|pwede|is it allowed to send)\s*/, ''));
  if (has(q, ITEMS) || item.status !== 'clear') {
    if (item.status === 'blocked') return { message: item.message.split('. ')[0] + '.' };
    if (item.status === 'care') return { message: `Yes, with care: ${item.notes.join(' ')}` };
    return { message: 'Yes, everyday items like clothes, shoes, documents and gadget accessories are fine. We can’t accept cash, fuel, fireworks, firearms, live animals or illegal items.' };
  }

  const named = findNamedBarangays(q);
  if (named.length === 1 && has(q, BARANGAY)) {
    return { message: `${named[0].barangay} is in ${named[0].city}.`, action: { type: 'fill-address', city: named[0].city, barangay: named[0].barangay } };
  }
  if (has(q, BARANGAY)) {
    return { message: 'Choose the city first, then the barangay from the list. If you’re not sure, tell me a nearby landmark, like “I’m near Marquee Mall”.' };
  }

  return { message: 'I can help with booking questions: what you can send, rates, where we deliver, and addresses.' };
}
