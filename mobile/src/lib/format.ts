const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const money = (v: number | null | undefined) => '₹' + inr.format(v ?? 0);

export function showDate(s: string | null | undefined) {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function showDateTime(s: string | null | undefined) {
  if (!s) return '—';
  const raw = /(?:Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s}Z`;
  const d = new Date(raw);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}

// Same formats as the web app's copied image: dd-mm-yyyy and 2-decimal Indian grouping.
const value2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatValue = (v: number | null | undefined) => value2.format(v ?? 0);

export function dmy(value: string | Date | null | undefined) {
  if (!value) return '';
  if (value instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(value.getDate())}-${p(value.getMonth() + 1)}-${value.getFullYear()}`;
  }
  const [y, m, d] = value.slice(0, 10).split('-');
  return y && m && d ? `${d}-${m}-${y}` : '';
}

const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export const qty = (v: number | null | undefined) => num.format(v ?? 0);
