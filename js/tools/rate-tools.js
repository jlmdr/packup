// Rate tools: read the published rate table.
import { RATE_TABLE, RATE_ZONES } from '../data/rates.js';

const peso = (s) => Number(s.replace(/[^\d]/g, ''));

/** Estimated fee for a weight and zone index (0 same city, 1 Luzon, 2 Visayas/Mindanao). */
export function estimateRate(kg, zone = 0) {
  const tiers = [0.5, 1, 3, 5];
  const i = tiers.findIndex((max) => kg <= max);
  if (i >= 0) return { amount: peso(RATE_TABLE[i].rates[zone]), tier: RATE_TABLE[i].weight, zone: RATE_ZONES[zone] };
  const base = peso(RATE_TABLE[3].rates[zone]);
  const perKg = peso(RATE_TABLE[4].rates[zone]);
  return { amount: base + perKg * Math.ceil(kg - 5), tier: 'Over 5 kg', zone: RATE_ZONES[zone] };
}
