const cents = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', currencyDisplay: 'narrowSymbol' });
const dollars = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0,
});

/** $16,027.87, or $16,028 with digits = 0. Negative amounts use a real minus sign. */
export function money(n: number, digits: 0 | 2 = 2): string {
  const s = (digits === 0 ? dollars : cents).format(Math.abs(n));
  return n < 0 ? `−${s}` : s;
}

/** 0.032 -> "3.2%". Up to two decimals, so prorated rates stay readable. */
export function percent(rate: number): string {
  return `${Math.round(rate * 10000) / 100}%`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-03-31" -> "Mar 31, 2026". Built by hand so server and browser agree. */
export function dateLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function formatBusinessNumber(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 9);
  return d.replace(/(\d{5})(\d{1,4})/, '$1 $2');
}
