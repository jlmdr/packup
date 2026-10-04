// Destination cities and their barangays. Sample data for the prototype: a handful of cities,
// with a partial barangay list for each. Production would load the full national list.
import { BARANGAYS } from './barangays.js';

export const CITIES = [
  { name: 'Angeles City', province: 'Pampanga', region: 'luzon', aliases: ['angeles'], barangays: BARANGAYS.map((b) => b.name) },
  { name: 'San Fernando', province: 'Pampanga', region: 'luzon', aliases: ['san fernando', 'csfp'], barangays: ['Del Pilar', 'Dolores', 'Maimpis', 'San Agustin', 'Santo Niño', 'Sindalan', 'Telabastagan'] },
  { name: 'Mabalacat', province: 'Pampanga', region: 'luzon', aliases: ['mabalacat'], barangays: ['Camachiles', 'Dau', 'Dolores', 'Mabiga', 'Mamatitang', 'San Francisco'] },
  { name: 'Manila', province: 'Metro Manila', region: 'luzon', aliases: ['manila', 'city of manila'], barangays: ['Binondo', 'Ermita', 'Intramuros', 'Malate', 'Paco', 'Quiapo', 'Sampaloc', 'Tondo'] },
  { name: 'Quezon City', province: 'Metro Manila', region: 'luzon', aliases: ['quezon city', 'qc'], barangays: ['Bagong Pag-asa', 'Batasan Hills', 'Commonwealth', 'Holy Spirit', 'Loyola Heights', 'Pinyahan', 'Teachers Village East'] },
  { name: 'Makati', province: 'Metro Manila', region: 'luzon', aliases: ['makati'], barangays: ['Bel-Air', 'Guadalupe Nuevo', 'Pio del Pilar', 'Poblacion', 'San Antonio', 'San Lorenzo', 'Urdaneta'] },
  { name: 'Cebu City', province: 'Cebu', region: 'visayas', aliases: ['cebu'], barangays: ['Apas', 'Banilad', 'Capitol Site', 'Guadalupe', 'Kamputhaw', 'Lahug', 'Mabolo', 'Talamban'] },
  { name: 'Davao City', province: 'Davao del Sur', region: 'mindanao', aliases: ['davao'], barangays: ['Agdao', 'Bajada', 'Buhangin', 'Matina Crossing', 'Talomo', 'Toril'] },
].map((c) => ({ ...c, barangays: [...c.barangays].sort() }));
