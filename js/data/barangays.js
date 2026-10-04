// The delivery area used by the prototype's riders and map (sample data).
// Barangays are grouped into rider areas; coordinates are for the schematic map only (viewBox 1000 x 700).

export const DELIVERY_AREA_CITY = 'Angeles City';

export const AREAS = {
  north: { id: 'north', name: 'North', neighbours: ['central', 'west', 'east'] },
  central: { id: 'central', name: 'Central', neighbours: ['north', 'east', 'west'] },
  east: { id: 'east', name: 'East', neighbours: ['central', 'north'] },
  west: { id: 'west', name: 'West', neighbours: ['central', 'north'] },
};

export const BARANGAYS = [
  // North
  { name: 'Balibago', area: 'north', x: 700, y: 110 },
  { name: 'Malabanias', area: 'north', x: 535, y: 105 },
  { name: 'Ninoy Aquino', area: 'north', x: 845, y: 150 },
  { name: 'Pampang', area: 'north', x: 625, y: 190 },
  { name: 'Anunas', area: 'north', x: 420, y: 165 },
  { name: 'Santa Teresita', area: 'north', x: 760, y: 235 },
  { name: 'Cutcut', area: 'north', x: 480, y: 245 },
  { name: 'Salapungan', area: 'north', x: 585, y: 270 },
  // Central
  { name: 'Claro M. Recto', area: 'central', x: 650, y: 315 },
  { name: 'Santo Cristo', area: 'central', x: 500, y: 335 },
  { name: 'Santo Domingo', area: 'central', x: 590, y: 360 },
  { name: 'Agapito del Rosario', area: 'central', x: 420, y: 395 },
  { name: 'Santo Rosario', area: 'central', x: 545, y: 420 },
  { name: 'Lourdes North West', area: 'central', x: 665, y: 400 },
  { name: 'Lourdes Sur East', area: 'central', x: 745, y: 440 },
  { name: 'Lourdes Sur', area: 'central', x: 680, y: 480 },
  { name: 'San Nicolas', area: 'central', x: 520, y: 490 },
  { name: 'Virgen Delos Remedios', area: 'central', x: 410, y: 470 },
  { name: 'Santa Trinidad', area: 'central', x: 460, y: 545 },
  // East
  { name: 'Pandan', area: 'east', x: 910, y: 285 },
  { name: 'Pulung Bulu', area: 'east', x: 800, y: 345 },
  { name: 'Pulung Cacutud', area: 'east', x: 870, y: 420 },
  { name: 'Pulung Maragul', area: 'east', x: 850, y: 510 },
  { name: 'San Jose', area: 'east', x: 610, y: 560 },
  { name: 'Cutud', area: 'east', x: 760, y: 570 },
  { name: 'Tabun', area: 'east', x: 680, y: 630 },
  { name: 'Mining', area: 'east', x: 885, y: 610 },
  // West
  { name: 'Sapangbato', area: 'west', x: 140, y: 130 },
  { name: 'Cuayan', area: 'west', x: 255, y: 215 },
  { name: 'Margot', area: 'west', x: 105, y: 285 },
  { name: 'Amsic', area: 'west', x: 330, y: 280 },
  { name: 'Sapalibutad', area: 'west', x: 225, y: 380 },
  { name: 'Capaya', area: 'west', x: 300, y: 505 },
];

export const HUB = { name: 'PackUp hub', x: 560, y: 450 };
