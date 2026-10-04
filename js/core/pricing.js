// Pricing rules: delivery zone and fee from the published rate table. Plain software, no judgement.
import { RATE_TABLE, RATE_ZONES } from '../data/rates.js';
import { CITIES } from '../data/locations.js';

const peso = (s) => Number(s.replace(/[^\d]/g, ''));
const regionOf = (city) => CITIES.find((c) => c.name === city)?.region || null;

/** Zone index: 0 same city, 1 within Luzon, 2 Visayas or Mindanao. Null when either city is unknown. */
export function deliveryZone(fromCity, toCity) {
  const from = regionOf(fromCity);
  const to = regionOf(toCity);
  if (!from || !to) return null;
  if (fromCity === toCity) return 0;
  return from === 'luzon' && to === 'luzon' ? 1 : 2;
}

/** Estimated fee in pesos for a weight and zone index. */
export function estimateRate(kg, zone = 0) {
  const tiers = [0.5, 1, 3, 5];
  const i = tiers.findIndex((max) => kg <= max);
  if (i >= 0) return { amount: peso(RATE_TABLE[i].rates[zone]), tier: RATE_TABLE[i].weight, zone: RATE_ZONES[zone] };
  const base = peso(RATE_TABLE[3].rates[zone]);
  const perKg = peso(RATE_TABLE[4].rates[zone]);
  return { amount: base + perKg * Math.ceil(kg - 5), tier: 'Over 5 kg', zone: RATE_ZONES[zone] };
}
