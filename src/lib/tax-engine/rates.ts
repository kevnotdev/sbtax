import type { AssetKind, ExpenseCategoryId, Province } from './types';

/**
 * Every rate in this file was checked on 2026-11-10 against published tables
 * (taxtips.ca corporate tax rate pages for 2024, 2025 and 2026) and the Bill C-15
 * summaries for capital cost allowance. Re-verify against CRA and provincial
 * sources before each filing season; several provinces changed rates mid-year.
 */

/** Federal rate on small business income: 38% less 10% abatement less 19% deduction. */
export const FEDERAL_BASE_RATE = 0.38;
export const FEDERAL_ABATEMENT = 0.10;
export const SMALL_BUSINESS_DEDUCTION = 0.19;
export const FEDERAL_SMALL_BUSINESS_RATE = 0.09;

/** Federal business limit for a full year. Prorated for short tax years. */
export const BUSINESS_LIMIT = 500_000;

/** Tax years starting before this date are not supported (rates below start here). */
export const EARLIEST_YEAR_START = '2024-01-01';

interface RateStep {
  from: string; // YYYY-MM-DD, inclusive
  rate: number;
  /** Announced in a budget; confirm it became law. */
  announced?: boolean;
}

export interface ProvinceInfo {
  name: string;
  supported: boolean;
  /** Small business rate, oldest first. A tax year that straddles a change is prorated by days. */
  smallBusinessRate: RateStep[];
}

export const PROVINCES: Record<Province, ProvinceInfo> = {
  AB: { name: 'Alberta', supported: true, smallBusinessRate: [{ from: '2024-01-01', rate: 0.02 }] },
  BC: { name: 'British Columbia', supported: true, smallBusinessRate: [{ from: '2024-01-01', rate: 0.02 }] },
  MB: { name: 'Manitoba', supported: true, smallBusinessRate: [{ from: '2024-01-01', rate: 0 }] },
  NB: { name: 'New Brunswick', supported: true, smallBusinessRate: [{ from: '2024-01-01', rate: 0.025 }] },
  NL: {
    name: 'Newfoundland and Labrador',
    supported: true,
    smallBusinessRate: [
      { from: '2024-01-01', rate: 0.025 },
      { from: '2026-01-01', rate: 0.02, announced: true },
      { from: '2027-01-01', rate: 0.015, announced: true },
      { from: '2028-01-01', rate: 0.01, announced: true },
    ],
  },
  NS: {
    name: 'Nova Scotia',
    supported: true,
    smallBusinessRate: [
      { from: '2024-01-01', rate: 0.025 },
      { from: '2025-04-01', rate: 0.015 },
    ],
  },
  NT: { name: 'Northwest Territories', supported: true, smallBusinessRate: [{ from: '2024-01-01', rate: 0.02 }] },
  NU: { name: 'Nunavut', supported: true, smallBusinessRate: [{ from: '2024-01-01', rate: 0.03 }] },
  ON: {
    name: 'Ontario',
    supported: true,
    smallBusinessRate: [
      { from: '2024-01-01', rate: 0.032 },
      { from: '2026-07-01', rate: 0.022, announced: true },
    ],
  },
  PE: { name: 'Prince Edward Island', supported: true, smallBusinessRate: [{ from: '2024-01-01', rate: 0.01 }] },
  // Quebec corporations file a separate CO-17 return with Revenu Quebec.
  QC: { name: 'Quebec', supported: false, smallBusinessRate: [{ from: '2024-01-01', rate: 0.032 }] },
  SK: { name: 'Saskatchewan', supported: true, smallBusinessRate: [{ from: '2024-01-01', rate: 0.01 }] },
  YT: { name: 'Yukon', supported: true, smallBusinessRate: [{ from: '2024-01-01', rate: 0 }] },
};

export const PROVINCE_ORDER: Province[] = [
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
];

/* ------------------------------------------------------------------ */
/* Capital cost allowance (the tax write-off for equipment)            */
/* ------------------------------------------------------------------ */

export interface AssetKindInfo {
  label: string;
  examples: string;
  classNumber: number;
  rate: number;
}

export const ASSET_KINDS: Record<AssetKind, AssetKindInfo> = {
  computer: { label: 'Computer or hardware', examples: 'Laptop, monitor, server', classNumber: 50, rate: 0.55 },
  equipment: { label: 'Furniture or equipment', examples: 'Desk, chair, phone, camera', classNumber: 8, rate: 0.2 },
  software: { label: 'Software or small tools', examples: 'Purchased software, tools under $500', classNumber: 12, rate: 1 },
};

/**
 * Share of an item's cost that can be written off in the year it was bought,
 * before any short-year proration.
 *
 * - Class 12 is 100%.
 * - Class 50 bought after April 15, 2024 and in use before 2027: 100%
 *   (productivity-enhancing assets, enacted in Bill C-15, March 2026).
 * - Bought in 2024: the half-year rule is suspended, so the normal class rate.
 * - Bought 2025 through 2029: the reinstated Accelerated Investment Incentive,
 *   1.5 times the class rate.
 * - Otherwise the half-year rule: half the class rate.
 *
 * Not modelled: the "Productivity Mega Deduction" announced September 2026
 * (100% for more classes). It was a proposal when this was written.
 */
export function firstYearWriteOff(kind: AssetKind, date: string): { share: number; rule: string } {
  const { rate } = ASSET_KINDS[kind];
  if (kind === 'software') return { share: 1, rule: 'Fully written off in the first year' };
  if (kind === 'computer' && date >= '2024-04-16' && date <= '2026-12-31') {
    return { share: 1, rule: 'Fully written off in the first year' };
  }
  if (date >= '2024-01-01' && date <= '2024-12-31') {
    return { share: rate, rule: `${pct(rate)} in the first year, then ${pct(rate)} of what is left each year` };
  }
  if (date >= '2025-01-01' && date <= '2029-12-31') {
    const share = Math.min(1, rate * 1.5);
    return { share, rule: `${pct(share)} in the first year, then ${pct(rate)} of what is left each year` };
  }
  return { share: rate / 2, rule: `${pct(rate / 2)} in the first year, then ${pct(rate)} of what is left each year` };
}

function pct(n: number): string {
  return `${Math.round(n * 1000) / 10}%`;
}

/* ------------------------------------------------------------------ */
/* Expense categories and their GIFI codes (Schedule 125)              */
/* ------------------------------------------------------------------ */

export interface ExpenseCategory {
  id: ExpenseCategoryId;
  label: string;
  hint?: string;
  gifi: string;
  /** Only half of meals and entertainment is deductible. */
  halfDeductible?: boolean;
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'subcontractors', label: 'Subcontractors', hint: 'Freelancers and other businesses you paid to do work', gifi: '9110' },
  { id: 'software', label: 'Software and subscriptions', hint: 'Cloud hosting, SaaS tools, domains', gifi: '9150' },
  { id: 'salary', label: 'Salary', hint: 'Gross pay to you or employees, before deductions', gifi: '9060' },
  { id: 'payroll', label: 'Employer CPP and EI', hint: 'The company’s share of payroll contributions', gifi: '8622' },
  { id: 'professional', label: 'Accounting and legal fees', gifi: '8860' },
  { id: 'office', label: 'Office supplies', gifi: '8810' },
  { id: 'phone', label: 'Phone and internet', gifi: '9225' },
  { id: 'meals', label: 'Meals with clients', hint: 'Only half counts for tax. We handle that for you.', gifi: '8523', halfDeductible: true },
  { id: 'travel', label: 'Travel', hint: 'Flights, hotels, transit, taxis', gifi: '9200' },
  { id: 'vehicle', label: 'Vehicle costs', hint: 'Mileage paid to you, fuel, parking', gifi: '9281' },
  { id: 'advertising', label: 'Advertising and marketing', gifi: '8520' },
  { id: 'insurance', label: 'Business insurance', gifi: '8690' },
  { id: 'bank', label: 'Bank and payment fees', hint: 'Account fees, Stripe or PayPal fees, interest', gifi: '8710' },
  { id: 'rent', label: 'Rent and co-working', gifi: '8910' },
  { id: 'homeOffice', label: 'Home office', hint: 'Amounts the company paid you for using your home', gifi: '9270' },
  { id: 'dues', label: 'Licences and memberships', hint: 'Professional dues, business licences', gifi: '8760' },
  { id: 'training', label: 'Courses and conferences', gifi: '9270' },
  { id: 'other', label: 'Something else', hint: 'Any other cost of running the business', gifi: '9270' },
];

export const EXPENSE_CATEGORY_BY_ID = Object.fromEntries(
  EXPENSE_CATEGORIES.map(c => [c.id, c]),
) as Record<ExpenseCategoryId, ExpenseCategory>;
