// Schematic map of the riders' delivery area: barangays, hub, stops and live rider markers.
// Production would use Google Maps; the POC draws its own SVG.
import { BARANGAYS, HUB, AREAS } from '../data/barangays.js';
import { stopPosition } from '../core/simulation.js';
import { esc, initials } from './dom.js';

export function renderMap(container) {
  container.innerHTML = `
  <svg class="map-svg" viewBox="0 0 1000 700" role="img" aria-label="Schematic map of the delivery area with rider positions">
    <defs>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M40 0H0V40" fill="none" stroke="var(--line)" stroke-width="0.6"/>
      </pattern>
    </defs>
    <rect width="1000" height="700" fill="var(--surface-muted)"/>
    <rect width="1000" height="700" fill="url(#grid)" opacity="0.7"/>
    <path d="M70 90 Q300 40 560 60 T960 110 L975 400 Q960 640 760 675 L330 670 Q120 640 60 420 Z"
      fill="var(--surface)" stroke="var(--ink-faint)" stroke-width="1.5" stroke-dasharray="6 5"/>
    <path d="M600 20 L600 700" stroke="var(--line)" stroke-width="10" stroke-linecap="round"/>
    <text x="612" y="40" font-size="15" fill="var(--ink-faint)">To Clark</text>
    <text x="612" y="690" font-size="15" fill="var(--ink-faint)">To San Fernando</text>
    <g class="barangays">
      ${BARANGAYS.map((b) => `
        <g transform="translate(${b.x} ${b.y})" data-area="${b.area}">
          <circle r="7" fill="var(--tint)" opacity="0.9"/>
          <text x="11" y="5" font-size="15" fill="var(--ink-soft)">${esc(b.name)}</text>
        </g>`).join('')}
    </g>
    <g transform="translate(${HUB.x} ${HUB.y})">
      <rect x="-12" y="-12" width="24" height="24" rx="4" fill="var(--accent)" stroke="var(--ink)" stroke-width="2"/>
      <text x="16" y="5" font-size="14" font-weight="700" fill="var(--ink)">Hub</text>
    </g>
    <g class="stops"></g>
    <g class="riders"></g>
  </svg>
  <div class="map-legend">
    ${Object.values(AREAS).map((a) => `<span><i class="swatch" data-area="${a.id}"></i>${a.name}</span>`).join('')}
    <span><i class="swatch swatch--square" data-kind="delivered"></i>Delivered</span>
    <span><i class="swatch swatch--square" data-kind="failed"></i>Failed attempt</span>
    <span>Schematic, not to scale</span>
  </div>`;
}

export function updateStops(container, parcels) {
  const g = container.querySelector('.stops');
  const shown = parcels.filter((p) => ['out', 'delivered', 'failed'].includes(p.status));
  g.innerHTML = shown.map((p) => {
    const { x, y } = stopPosition(p);
    const fill = p.status === 'delivered' ? 'var(--ok)' : p.status === 'failed' ? 'var(--flag)' : 'var(--surface)';
    return `<rect x="${x - 5.5}" y="${y - 5.5}" width="11" height="11" rx="1.5" fill="${fill}" stroke="var(--ink)" stroke-width="1.2"><title>${p.ref}</title></rect>`;
  }).join('');
}

export function updateRiders(container, riders, show) {
  const g = container.querySelector('.riders');
  const active = show ? riders.filter((r) => r.available && (r.queue.length || r.x !== HUB.x)) : [];
  // Reuse marker nodes so position changes animate smoothly.
  const existing = new Map([...g.children].map((n) => [n.dataset.id, n]));
  active.forEach((r) => {
    let node = existing.get(r.id);
    if (!node) {
      node = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      node.dataset.id = r.id;
      node.setAttribute('class', 'rider-marker');
      node.dataset.area = r.area;
      node.innerHTML = `<circle r="18" fill="var(--tint)" stroke="var(--surface)" stroke-width="3"/>
        <text y="5" font-size="14" font-weight="700" text-anchor="middle" fill="#fff">${initials(r.name)}</text><title>${esc(r.name)}</title>`;
      g.append(node);
    }
    node.style.transform = `translate(${r.x}px, ${r.y}px)`;
    existing.delete(r.id);
  });
  existing.forEach((n) => n.remove());
}
