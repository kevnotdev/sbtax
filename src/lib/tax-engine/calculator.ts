import type {
  Calculation, CcaAssetResult, CcaClassResult, AssetKind, ExpenseCategoryId, Province, ReturnData,
} from './types';
import {
  ASSET_KINDS, BUSINESS_LIMIT, EXPENSE_CATEGORY_BY_ID, FEDERAL_SMALL_BUSINESS_RATE,
  PROVINCES, firstYearWriteOff,
} from './rates';

const DAY = 86_400_000;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

export function isDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

const toTime = (s: string) => Date.parse(`${s}T00:00:00Z`);
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Days from start to end, counting both. 0 when either date is missing or reversed. */
export function daysInclusive(start: string, end: string): number {
  if (!isDate(start) || !isDate(end)) return 0;
  const d = Math.round((toTime(end) - toTime(start)) / DAY) + 1;
  return d > 0 ? d : 0;
}

/**
 * Same day N months later. A month-end date stays a month-end date,
 * which is how CRA counts filing and payment deadlines.
 */
export function addMonths(date: string, months: number): string {
  const d = new Date(toTime(date));
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const lastOf = (yy: number, mm: number) => new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
  const isMonthEnd = day === lastOf(y, m);
  const ty = y + Math.floor((m + months) / 12);
  const tm = (((m + months) % 12) + 12) % 12;
  const tDay = isMonthEnd ? lastOf(ty, tm) : Math.min(day, lastOf(ty, tm));
  return toIso(Date.UTC(ty, tm, tDay));
}

/** Small business rate for the tax year, prorated by days when the rate changed mid-year. */
export function provincialRate(
  province: Province, yearStart: string, yearEnd: string,
): { rate: number; announced: boolean } {
  const steps = PROVINCES[province].smallBusinessRate;
  const total = daysInclusive(yearStart, yearEnd);
  if (!total) return { rate: steps[steps.length - 1].rate, announced: false };

  let weighted = 0;
  let announced = false;
  steps.forEach((step, i) => {
    const next = steps[i + 1];
    const from = Math.max(toTime(step.from), toTime(yearStart));
    const to = Math.min(next ? toTime(next.from) - DAY : Infinity, toTime(yearEnd));
    const days = Math.round((to - from) / DAY) + 1;
    if (days > 0) {
      weighted += step.rate * days;
      if (step.announced) announced = true;
    }
  });
  return { rate: weighted / total, announced };
}

export function calculate(data: ReturnData): Calculation {
  const { company } = data;
  const isNil = data.hadActivity === false;
  const days = daysInclusive(company.yearStart, company.yearEnd);
  // Deductions that accrue over time are scaled down for a tax year shorter than 365 days.
  const yearFraction = days ? Math.min(1, days / 365) : 1;
  const firstYear = isDate(company.incorporationDate) && isDate(company.yearStart)
    && company.incorporationDate >= company.yearStart;

  /* ---- Income statement ---- */
  const revenue = isNil ? 0 : num(data.revenue);

  const byCategory = new Map<ExpenseCategoryId, number>();
  let meals = 0;
  if (!isNil) {
    for (const line of data.expenses) {
      const amount = num(line.amount);
      if (!amount) continue;
      byCategory.set(line.category, round2((byCategory.get(line.category) ?? 0) + amount));
      if (EXPENSE_CATEGORY_BY_ID[line.category].halfDeductible) meals += amount;
    }
  }
  const expensesByCategory = [...byCategory].map(([category, amount]) => ({ category, amount }));
  const operatingExpenses = round2(expensesByCategory.reduce((s, e) => s + e.amount, 0));
  const mealsNonDeductible = round2(meals * 0.5);

  /* ---- Equipment write-off (Schedule 8) ---- */
  const assetResults: CcaAssetResult[] = [];
  const classes: CcaClassResult[] = (Object.keys(ASSET_KINDS) as AssetKind[]).map(kind => {
    const info = ASSET_KINDS[kind];
    const opening = firstYear || kind === 'software' ? 0 : Math.max(0, num(data.openingUcc[kind]));
    let additions = 0;
    let claim = isNil ? 0 : round2(opening * info.rate * yearFraction);

    if (!isNil) {
      for (const asset of data.assets) {
        if (asset.kind !== kind) continue;
        const cost = Math.max(0, num(asset.cost));
        if (!cost) continue;
        const { share, rule } = firstYearWriteOff(kind, asset.date);
        const assetClaim = round2(cost * share * yearFraction);
        additions += cost;
        claim += assetClaim;
        assetResults.push({ id: asset.id, description: asset.description, kind, cost, claim: assetClaim, rule });
      }
    }
    claim = round2(claim);
    additions = round2(additions);
    return {
      kind, classNumber: info.classNumber, rate: info.rate,
      opening, additions, claim, closing: round2(opening + additions - claim),
    };
  });
  const ccaTotal = round2(classes.reduce((s, c) => s + c.claim, 0));

  /* ---- Profit and tax ---- */
  // The books depreciate equipment at the same pace as the tax write-off, so the two cancel on Schedule 1.
  const amortization = ccaTotal;
  const totalExpenses = round2(operatingExpenses + amortization);
  const incomeBeforeTax = round2(revenue - totalExpenses);
  const netIncomeForTax = round2(incomeBeforeTax + mealsNonDeductible);
  const taxableIncome = Math.max(0, netIncomeForTax);
  const taxLoss = Math.max(0, -netIncomeForTax);

  const businessLimit = round2(BUSINESS_LIMIT * yearFraction);
  const overBusinessLimit = taxableIncome > businessLimit;

  const prov = company.province
    ? provincialRate(company.province, company.yearStart, company.yearEnd)
    : { rate: 0, announced: false };
  const federalTax = round2(taxableIncome * FEDERAL_SMALL_BUSINESS_RATE);
  const provincialTax = round2(taxableIncome * prov.rate);
  const totalTax = round2(federalTax + provincialTax);
  const instalmentsPaid = Math.max(0, num(data.instalmentsPaid));
  const balanceOwing = round2(totalTax - instalmentsPaid);
  const netIncomeAfterTax = round2(incomeBeforeTax - totalTax);

  /* ---- Balance sheet (Schedule 100) ---- */
  const b = data.balances;
  const cash = num(b.cash);
  const receivables = num(b.receivables);
  const equipment = round2(classes.reduce((s, c) => s + c.closing, 0));
  const loan = num(b.shareholderLoan);
  // Income tax still unpaid at year end, plus sales tax held for CRA. A net refund is an asset.
  const netTaxes = round2(balanceOwing + num(b.salesTaxOwing));
  const taxesPayable = Math.max(0, netTaxes);
  const taxesReceivable = Math.max(0, -netTaxes);
  const dueToShareholder = Math.max(0, loan);
  const dueFromShareholder = Math.max(0, -loan);
  const payables = num(b.payables);

  const totalAssets = round2(cash + receivables + taxesReceivable + dueFromShareholder + equipment);
  const totalLiabilities = round2(payables + taxesPayable + dueToShareholder);
  const shareCapital = num(b.shareCapital);
  const openingRetainedEarnings = firstYear ? 0 : num(b.openingRetainedEarnings);
  const dividends = Math.max(0, num(data.dividendsPaid));
  const retainedEarnings = round2(openingRetainedEarnings + netIncomeAfterTax - dividends);
  const totalEquity = round2(shareCapital + retainedEarnings);
  const totalLiabilitiesAndEquity = round2(totalLiabilities + totalEquity);
  const difference = round2(totalAssets - totalLiabilitiesAndEquity);

  const hasYearEnd = isDate(company.yearEnd);

  return {
    isNil,
    daysInYear: days,
    revenue,
    expensesByCategory,
    operatingExpenses,
    amortization,
    totalExpenses,
    incomeBeforeTax,
    netIncomeAfterTax,
    mealsNonDeductible,
    netIncomeForTax,
    taxableIncome,
    taxLoss,
    businessLimit,
    overBusinessLimit,
    federalRate: FEDERAL_SMALL_BUSINESS_RATE,
    provincialRate: prov.rate,
    provincialRateIsAnnounced: prov.announced,
    federalTax,
    provincialTax,
    totalTax,
    instalmentsPaid,
    balanceOwing,
    cca: { assets: assetResults, classes, total: ccaTotal },
    balanceSheet: {
      cash, receivables, taxesReceivable, dueFromShareholder, equipment, totalAssets,
      payables, taxesPayable, dueToShareholder, totalLiabilities,
      shareCapital, openingRetainedEarnings, dividends, retainedEarnings, totalEquity,
      totalLiabilitiesAndEquity, difference,
      balanced: Math.abs(difference) < 1,
    },
    // T2 is due six months after year end. A small CCPC has three months to pay.
    filingDue: hasYearEnd ? addMonths(company.yearEnd, 6) : null,
    balanceDue: hasYearEnd ? addMonths(company.yearEnd, 3) : null,
  };
}

/** True when the company's first tax year is the one being filed. */
export function isFirstYear(data: ReturnData): boolean {
  const { incorporationDate, yearStart } = data.company;
  return isDate(incorporationDate) && isDate(yearStart) && incorporationDate >= yearStart;
}
