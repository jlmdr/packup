// Rider roster for the delivery area (sample data).
// Capacity is kept small so the demo shows workload balancing clearly.
export const VEHICLES = {
  motorcycle: { label: 'Motorcycle', capacity: 10, sizes: ['small', 'medium'] },
  van: { label: 'Van', capacity: 18, sizes: ['small', 'medium', 'large'] },
};

export const RIDERS = [
  { id: 'R1', name: 'Mark Lising', vehicle: 'motorcycle', area: 'central', available: true },
  { id: 'R2', name: 'Joy Manalo', vehicle: 'motorcycle', area: 'central', available: true },
  { id: 'R3', name: 'Paolo Dizon', vehicle: 'motorcycle', area: 'north', available: true },
  { id: 'R4', name: 'Rica Santos', vehicle: 'motorcycle', area: 'east', available: true },
  { id: 'R5', name: 'Ben Tolentino', vehicle: 'motorcycle', area: 'west', available: true },
  { id: 'R6', name: 'Arnel Cruz', vehicle: 'van', area: 'all', available: false, note: 'On leave today' },
];
