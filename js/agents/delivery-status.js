// Delivery status agent: answers staff questions about a parcel and drafts a reply.
// Read-only. Escalates money, policy and disputed deliveries to a supervisor.
import { findParcels } from '../tools/parcel-tools.js';
import { getRider, getRiderLocation } from '../tools/rider-tools.js';
import { normalise } from '../core/util.js';
import { DELIVERY_AREA_CITY } from '../data/barangays.js';

export const MONEY_POLICY = ['refund', 'compensation', 'reimburse', 'money back', 'charge back', 'bayad', 'discount', 'free shipping'];
export const NOT_RECEIVED = ['not received', "didn't receive", 'did not receive', 'never received', 'never got', "didn't get", 'hindi natanggap', 'hindi ko natanggap', 'wala pa'];
export const COMPLAINT = ['complaint', 'complain', 'rude', 'damaged', 'broken', 'sira', 'bastos'];

const has = (text, words) => words.some((w) => text.includes(w));
const firstName = (name) => name.split(' ')[0];

function describe(parcel) {
  const rider = parcel.riderId ? getRider(parcel.riderId) : null;
  const last = parcel.history[parcel.history.length - 1];
  switch (parcel.status) {
    case 'ready':
      return parcel.city === DELIVERY_AREA_CITY
        ? { summary: 'Booked and waiting for today’s dispatch.', reply: 'It’s booked and will be assigned to a rider in today’s dispatch.' }
        : { summary: `Booked; goes to the hub today for delivery in ${parcel.city}.`, reply: `It’s booked and leaves for our hub today, on its way to ${parcel.city}.` };
    case 'outbound':
      return { summary: `Sent to the hub for delivery in ${parcel.city}.`, reply: `It has left our branch and is on its way to ${parcel.city}, where our team there will deliver it.` };
    case 'flagged':
      return { summary: 'On hold while our team confirms the address.', reply: 'Our team is confirming the delivery address before it goes out. We may call to check a detail.' };
    case 'assigned':
      return { summary: `Assigned to ${rider.name}. Leaves the hub when deliveries start.`, reply: `It’s assigned to our rider ${firstName(rider.name)} and will go out for delivery today.` };
    case 'out': {
      const near = getRiderLocation(rider.id);
      return {
        summary: `Out for delivery with ${rider.name}, currently near ${near}.`,
        reply: `It’s out for delivery today with our rider ${firstName(rider.name)}, who is currently around ${near}. You can expect it within the day.`,
      };
    }
    case 'delivered':
      return { summary: `Delivered at ${last.time}.`, reply: `It was delivered today at ${last.time}.` };
    case 'failed':
      return {
        summary: `Delivery attempt failed at ${last.time}: ${parcel.failReason.toLowerCase()}.`,
        reply: `Our rider tried to deliver it today at ${last.time}, but ${failPhrase(parcel.failReason)}. We’ll try again on the next working day.`,
        explanation: {
          why: parcel.failReason,
          next: parcel.failReason === 'Address not found'
            ? 'Confirm the exact address or a landmark with the customer, then update the booking before the next attempt.'
            : 'Next attempt is on the next working day. Staff can reschedule or arrange branch pickup if the customer asks.',
        },
      };
    default:
      return { summary: 'Status unavailable.', reply: '' };
  }
}

function failPhrase(reason) {
  return {
    'Customer not home': 'no one was available to receive it',
    'Address not found': 'they couldn’t find the address',
    'Customer refused': 'the parcel was refused at the door',
  }[reason] || reason.toLowerCase();
}

/**
 * Answer a staff question. Returns:
 *   kind: 'answer' | 'escalate' | 'choose' | 'not_found' | 'empty'
 * Parcels are returned by reference code, so a live model and the simulation share one shape.
 */
export function answer(question) {
  const q = question.trim();
  if (!q) return { kind: 'empty' };
  const text = normalise(q);
  const matches = findParcels(q);

  if (!matches.length) {
    return { kind: 'not_found', message: 'I couldn’t find a parcel matching that. Try the reference code (PU-123456), the recipient’s phone number, or their full name.' };
  }
  if (matches.length > 1) {
    return { kind: 'choose', message: `I found ${matches.length} parcels that could match. Which one?`, choiceRefs: matches.slice(0, 6).map((p) => p.ref) };
  }

  const parcel = matches[0];
  if (has(text, MONEY_POLICY)) {
    return { kind: 'escalate', parcelRef: parcel.ref, reason: 'This involves money or policy (refunds, compensation, fees). A supervisor needs to decide.' };
  }
  if (parcel.status === 'delivered' && has(text, NOT_RECEIVED)) {
    return { kind: 'escalate', parcelRef: parcel.ref, reason: 'Marked delivered, but the customer says they didn’t receive it. A supervisor should check proof of delivery with the rider.' };
  }
  if (has(text, COMPLAINT)) {
    return { kind: 'escalate', parcelRef: parcel.ref, reason: 'This is a complaint about the service. A supervisor should handle it directly.' };
  }

  const d = describe(parcel);
  return {
    kind: 'answer',
    parcelRef: parcel.ref,
    summary: d.summary,
    explanation: d.explanation || null,
    draft: `Hi ${firstName(parcel.recipient)}, thanks for checking on parcel ${parcel.ref}. ${d.reply} Let us know if there’s anything else we can help with.`,
  };
}
