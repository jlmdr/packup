// Item tools: policy lookups for what customers say is inside a parcel.
import { NOT_ACCEPTED, NEEDS_CARE } from '../data/item-policy.js';
import { normalise } from '../core/util.js';

const mentions = (text, words) => {
  const t = ` ${normalise(text).replace(/[^a-zñ0-9 ]/g, ' ')} `;
  return words.filter((w) => t.includes(` ${w} `) || t.includes(` ${w}s `));
};

export const findNotAccepted = (text) => NOT_ACCEPTED.filter((r) => mentions(text, r.words).length);
export const findNeedsCare = (text) => NEEDS_CARE.filter((r) => mentions(text, r.words).length);
