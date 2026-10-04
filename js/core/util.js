// Small shared helpers with no app knowledge.
export const digitsOnly = (s = '') => s.replace(/\D/g, '');
export const normalise = (s = '') => s.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
export const clockTime = () => new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
export const formatPhone = (p = '') => {
  const d = digitsOnly(p);
  return d.length === 11 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : p;
};
export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
