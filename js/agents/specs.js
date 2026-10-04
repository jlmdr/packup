// What each agent capability needs to run on a live model: its tier, tools, instructions,
// the exact output shape the UI expects, and guardrail checks on the answer.
// The simulated agents in this folder return the same shapes.
import { listCities, listBarangays } from '../tools/address-tools.js';
import { getParcelsForBatch, getParcel } from '../tools/parcel-tools.js';
import { getAllRiders, vehicleFits, vehicleCapacity } from '../tools/rider-tools.js';
import { normalise } from '../core/util.js';
import { MONEY_POLICY, NOT_RECEIVED, COMPLAINT } from './delivery-status.js';

const str = { type: 'string' };
const strs = { type: 'array', items: str };
const json = (value) => JSON.stringify(value, null, 2);
const CONTEXT = 'You work for PackUp, a parcel courier that delivers nationwide with its own riders. Be brief and plain. Use tools for facts; never invent cities, barangays, parcels, riders or rates.';

const knownPlace = (city, barangay, path) => {
  if (city && !listCities().includes(city)) return [`${path}.city is not a listed city: ${city}`];
  if (barangay && !listBarangays(city).includes(barangay)) return [`${path}.barangay is not in ${city || 'the selected city'}: ${barangay}`];
  return [];
};

const addressOption = {
  type: 'object',
  properties: { label: str, value: { type: 'object', properties: { street: str, city: str, barangay: str, landmark: str } } },
  required: ['label', 'value'],
};

export const SPECS = {
  'intake.checkAddress': {
    name: 'intake.checkAddress',
    tier: 'fast',
    tools: ['find_cities', 'find_named_barangays', 'find_partial_barangays', 'match_landmark', 'has_street_detail', 'get_past_delivery'],
    system: `${CONTEXT}
You check a delivery address while a customer fills in a booking form. City and barangay are required dropdowns; your job is judgement on top of them.
Decide one status:
- "empty": nothing to say yet.
- "past": the recipient's phone has a past delivery and the form is empty or names a different place. Offer it as an option. Skip if flags.pastDismissed.
- "auto": the city or barangay is not selected, but the street or landmark clearly identifies it. Return "city" and, if clear, "barangay".
- "choose": the text matches several places (e.g. "Dolores" in two cities, or "Lourdes" within one). Offer each as an option.
- "conflict": the selected city or barangay contradicts the street or landmark. Offer the inferred place and set keepLabel to "Keep <selected>". Skip if flags.conflictKept.
- "thin": no house, lot or street detail and no landmark.
- "clear": the address is deliverable.
Messages are one or two short sentences addressed to the customer.`,
    prompt: ({ fields, flags }) => `Form fields:\n${json(fields)}\n\nFlags:\n${json(flags)}`,
    output: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: ['empty', 'past', 'auto', 'choose', 'conflict', 'thin', 'clear'] },
        message: str,
        city: str,
        barangay: str,
        options: { type: 'array', items: addressOption },
        keepLabel: str,
        newLabel: str,
      },
    },
    check: (out) => [
      ...knownPlace(out.city, out.barangay, 'output'),
      ...(out.options || []).flatMap((o, i) => knownPlace(o.value.city, o.value.barangay, `options[${i}].value`)),
      ...(out.status === 'auto' && !out.city ? ['status "auto" needs a city'] : []),
    ],
  },

  'intake.screenItem': {
    name: 'intake.screenItem',
    tier: 'fast',
    tools: ['find_not_accepted_items', 'find_care_items'],
    system: `${CONTEXT}
You read what a customer says is inside a parcel and apply the item policy, including everyday and Filipino words (e.g. "pabango" is perfume).
- "blocked": anything not accepted. The message names what can't be carried.
- "care": accepted with handling notes. Return each note and its tag (Battery, Liquid, Food, Fragile).
- "clear": nothing restricted. "empty": no description.`,
    prompt: ({ description }) => `Item description: ${json(description)}`,
    output: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: ['empty', 'clear', 'care', 'blocked'] },
        message: str,
        notes: strs,
        tags: { type: 'array', items: { type: 'string', enum: ['Battery', 'Liquid', 'Food', 'Fragile'] } },
      },
    },
  },

  'intake.writeRiderNote': {
    name: 'intake.writeRiderNote',
    tier: 'fast',
    tools: [],
    system: `${CONTEXT}
Write one short instruction for the rider: where to deliver, the landmark translated to English, details to look for (gate colour, house), and handling (fragile, food, liquid, battery). At most three short sentences.`,
    prompt: (input) => `Booking details:\n${json(input)}`,
    output: { type: 'object', required: ['note'], properties: { note: str } },
    check: (out, input) => (input.barangay && !out.note.includes(input.barangay) ? ['the note must name the barangay'] : []),
  },

  'intake.answerQuestion': {
    name: 'intake.answerQuestion',
    tier: 'fast',
    tools: ['match_landmark', 'find_cities', 'find_named_barangays', 'delivery_zone', 'estimate_rate', 'find_not_accepted_items', 'find_care_items'],
    system: `${CONTEXT}
You answer questions people have while booking: what they can send, rates, where we deliver (nationwide), and which city and barangay an address is in. Only booking topics.
For rates, use the sender's city from the context with the destination to find the zone.
Refunds, complaints and lost or damaged parcels: tell them staff handle it. A parcel already sent: staff can check it with the reference code.
When you identify the customer's city and barangay, add action { "type": "fill-address", "city": <city>, "barangay": <barangay> } so the form can fill it in.`,
    prompt: ({ question, context }) => `Question: ${json(question)}\nForm context: ${json(context || {})}`,
    output: {
      type: 'object',
      required: ['message'],
      properties: {
        message: str,
        action: { type: 'object', required: ['type', 'city', 'barangay'], properties: { type: { type: 'string', enum: ['fill-address'] }, city: str, barangay: str } },
      },
    },
    check: (out) => (out.action ? knownPlace(out.action.city, out.action.barangay, 'action') : []),
  },

  'assignment.planBatch': {
    name: 'assignment.planBatch',
    tier: 'strong',
    tools: ['get_batch_parcels', 'list_riders', 'get_neighbour_areas', 'vehicle_fits'],
    system: `${CONTEXT}
You draft the morning dispatch plan for a dispatcher to review. The batch holds parcels for the riders' delivery area only; parcels for other cities go to the hub separately. Assign each parcel in the batch to one available rider:
- Prefer the rider whose home area matches the parcel's area; a rider with area "all" can take any area.
- The vehicle must fit the parcel size, and no rider may exceed their capacity.
- When an area's riders are full, move overflow to the least-loaded rider in a neighbouring area, and record it in "covering" (ref → area covered).
- Flag what you can't assign with a one-sentence reason a dispatcher can act on. Parcels still flagged by intake stay flagged.
Do not decide delivery order.`,
    prompt: () => 'Draft this morning\'s plan.',
    output: {
      type: 'object',
      required: ['byRider', 'covering', 'flagged', 'totals'],
      properties: {
        byRider: { type: 'object', additionalProperties: strs },
        covering: { type: 'object', additionalProperties: str },
        flagged: { type: 'array', items: { type: 'object', required: ['ref', 'reason'], properties: { ref: str, reason: str } } },
        totals: {
          type: 'object',
          required: ['parcels', 'assigned', 'flagged'],
          properties: { parcels: { type: 'number' }, assigned: { type: 'number' }, flagged: { type: 'number' } },
        },
      },
    },
    // Hard rules a plan must satisfy, whoever drafted it.
    check: (plan) => {
      const batch = new Map(getParcelsForBatch().map((p) => [p.ref, p]));
      const riders = new Map(getAllRiders().map((r) => [r.id, r]));
      const seen = new Set();
      const problems = [];
      Object.entries(plan.byRider).forEach(([riderId, refs]) => {
        const rider = riders.get(riderId);
        if (!rider?.available) { problems.push(`rider ${riderId} is not available`); return; }
        if (refs.length > vehicleCapacity(rider.vehicle)) problems.push(`rider ${riderId} is over capacity`);
        refs.forEach((ref) => {
          const parcel = batch.get(ref);
          if (!parcel) problems.push(`${ref} is not in the batch`);
          else if (parcel.status === 'flagged') problems.push(`${ref} is still flagged by intake`);
          else if (!vehicleFits(rider.vehicle, parcel.size)) problems.push(`${ref} does not fit ${rider.name}'s vehicle`);
          if (seen.has(ref)) problems.push(`${ref} is assigned twice`);
          seen.add(ref);
        });
      });
      plan.flagged.forEach(({ ref }) => { if (seen.has(ref)) problems.push(`${ref} is both assigned and flagged`); seen.add(ref); });
      batch.forEach((_, ref) => { if (!seen.has(ref)) problems.push(`${ref} is missing from the plan`); });
      return problems;
    },
  },

  'deliveryStatus.answer': {
    name: 'deliveryStatus.answer',
    tier: 'fast',
    tools: ['find_parcels', 'get_rider_location'],
    system: `${CONTEXT}
You help the tracking team answer a customer asking about a parcel. You are read-only: never promise refunds, reschedules or changes.
- Find the parcel. None: kind "not_found". Several: kind "choose" with their refs in choiceRefs.
- Money or policy (refunds, compensation, fees), a "delivered" parcel the customer says they didn't receive, or a complaint: kind "escalate" with a reason for the supervisor, and no draft.
- Otherwise kind "answer": a one-line summary for staff, and a short, friendly draft reply to the customer. "Out for delivery" means it arrives today; never give a time estimate. A parcel "sent to hub" is travelling to another city for delivery there.
- For a failed attempt, add explanation { why, next }.`,
    prompt: ({ question }) => `Staff question: ${json(question)}`,
    output: {
      type: 'object',
      required: ['kind'],
      properties: {
        kind: { type: 'string', enum: ['answer', 'escalate', 'choose', 'not_found', 'empty'] },
        message: str,
        parcelRef: str,
        choiceRefs: strs,
        summary: str,
        draft: str,
        reason: str,
        explanation: { type: ['object', 'null'], properties: { why: str, next: str } },
      },
    },
    // Guardrail: money, policy and disputes always escalate, whatever the model says.
    check: (out, { question }) => {
      const q = normalise(question);
      const mustEscalate = [...MONEY_POLICY, ...COMPLAINT].some((w) => q.includes(w));
      const disputed = NOT_RECEIVED.some((w) => q.includes(w));
      const problems = [];
      if (['answer', 'escalate'].includes(out.kind) && !getParcel(out.parcelRef || '')) problems.push('parcelRef must be a real parcel');
      if (mustEscalate && out.kind === 'answer') problems.push('money, policy and complaints must escalate');
      if (disputed && out.kind === 'answer' && getParcel(out.parcelRef || '')?.status === 'delivered') problems.push('disputed deliveries must escalate');
      if (out.kind === 'escalate' && out.draft) problems.push('escalations must not include a draft');
      return problems;
    },
  },
};
