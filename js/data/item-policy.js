// Sample PackUp item policy for the POC. Words cover English and common Filipino terms.
export const NOT_ACCEPTED = [
  { label: 'cash or money', words: ['cash', 'money', 'pera', 'bills', 'coins'] },
  { label: 'firearms or ammunition', words: ['gun', 'guns', 'firearm', 'baril', 'bala', 'ammo', 'ammunition'] },
  { label: 'fireworks or explosives', words: ['firecracker', 'firecrackers', 'fireworks', 'paputok', 'kwitis', 'explosive', 'explosives'] },
  { label: 'flammable fuel or gas', words: ['gasoline', 'gasolina', 'diesel', 'kerosene', 'gaas', 'butane', 'lpg', 'thinner', 'lighter fluid'] },
  { label: 'live animals', words: ['live', 'buhay', 'puppy', 'kitten', 'chicks', 'alimango'] },
  { label: 'illegal drugs', words: ['marijuana', 'shabu', 'weed'] },
];

export const NEEDS_CARE = [
  { label: 'battery', words: ['battery', 'batteries', 'baterya', 'powerbank', 'power bank', 'phone', 'cellphone', 'laptop', 'tablet', 'vape'], note: 'Contains a battery. Staff check it’s switched off and protected.', tag: 'Battery' },
  { label: 'liquid', words: ['perfume', 'pabango', 'cologne', 'liquid', 'shampoo', 'lotion', 'oil', 'alcohol', 'sauce'], note: 'Liquid. Must be sealed and wrapped against leaks.', tag: 'Liquid' },
  { label: 'food', words: ['food', 'pagkain', 'cake', 'ulam', 'frozen', 'meat', 'fish', 'longganisa', 'tocino', 'pastries'], note: 'Food. Perishables go out same day, at the sender’s risk.', tag: 'Food' },
  { label: 'fragile', words: ['glass', 'fragile', 'ceramic', 'plates', 'mirror', 'bottle', 'bote', 'babasagin'], note: 'Fragile. Needs padding; marked handle with care.', tag: 'Fragile' },
];
