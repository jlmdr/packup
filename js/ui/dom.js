// Tiny DOM helpers shared by every screen.
import { escapeHtml } from '../core/util.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = escapeHtml;

/** Delegate events: on(root, 'click', '[data-action=x]', handler). */
export function on(root, type, selector, handler) {
  root.addEventListener(type, (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  });
}

export function toast(message, tone = '') {
  const box = $('.toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  if (tone) el.dataset.tone = tone;
  el.textContent = message;
  box.append(el);
  setTimeout(() => el.remove(), 3600);
}

const STATUS_LABELS = {
  ready: 'Booked', flagged: 'Needs review', assigned: 'Assigned',
  out: 'Out for delivery', delivered: 'Delivered', failed: 'Failed attempt', outbound: 'Sent to hub',
};
export const statusBadge = (status) => `<span class="badge" data-status="${status}">${STATUS_LABELS[status] || status}</span>`;

export const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('');

export const ICONS = {
  agent: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0l1.8 5.2L15 7l-5.2 1.8L8 14l-1.8-5.2L1 7l5.2-1.8z"/></svg>',
  flag: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3 1h1v14H3zM5 2h8l-2 3.5L13 9H5z"/></svg>',
  box: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" aria-hidden="true"><path d="M8 22 32 10l24 12v24L32 58 8 46z"/><path d="M8 22l24 12 24-12M32 34v24M20 16l24 12"/></svg>',
};

/** Agent message block, used by every agent so they share one visual voice. */
export function agentNote(inner, tone = '') {
  return `<div class="agent-note"${tone ? ` data-tone="${tone}"` : ''}>
    <span class="agent-mark">${ICONS.agent}</span>
    <div>${inner}</div>
  </div>`;
}
