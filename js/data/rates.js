// Rate table modelled on published Philippine courier rates. Display only in the POC.
export const RATE_ZONES = ['Same city', 'Within Luzon', 'Visayas / Mindanao'];
export const RATE_TABLE = [
  { weight: 'Up to 0.5 kg', rates: ['₱80', '₱90', '₱105'] },
  { weight: '0.5–1 kg', rates: ['₱120', '₱155', '₱180'] },
  { weight: '1–3 kg', rates: ['₱150', '₱180', '₱205'] },
  { weight: '3–5 kg', rates: ['₱250', '₱360', '₱400'] },
  { weight: 'Over 5 kg', rates: ['+₱50/kg', '+₱90/kg', '+₱100/kg'] },
];
