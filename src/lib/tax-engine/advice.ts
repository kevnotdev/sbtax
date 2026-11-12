import type { Calculation, ExpenseLine, ReturnData } from './types';
import type { StepId } from './checks';
import { EXPENSE_CATEGORY_BY_ID } from './rates';
import { round2 } from './calculator';
import { money } from '../format';

/** A place in the return: a step, and optionally the field on it (a `data-anchor` value). */
export interface Target {
  step: StepId;
  anchor?: string;
}

/**
 * One thing the person can do about a problem. `apply` changes the return for them;
 * `goTo` takes them to the field to check. A suggestion has one or the other.
 */
export interface Suggestion {
  id: string;
  text: string;
  apply?: { label: string; change: (d: ReturnData) => ReturnData };
  goTo?: Target & { label: string };
}

export interface Diagnosis {
  title: string;
  /** Why the two sides differ, in the person's own numbers. */
  why: string;
  suggestions: Suggestion[];
}

export const expenseAnchor = (id: string) => `expense-${id}`;

function largestExpense(data: ReturnData): ExpenseLine | null {
  let top: ExpenseLine | null = null;
  for (const line of data.expenses) {
    if ((line.amount ?? 0) > (top?.amount ?? 0)) top = line;
  }
  return top;
}

/** An expense bigger than the whole year's revenue is more often a typo than a fact. */
function outlierExpense(data: ReturnData, calc: Calculation): Suggestion | null {
  const top = calc.isNil ? null : largestExpense(data);
  if (!top || (top.amount ?? 0) <= calc.revenue) return null;
  const label = EXPENSE_CATEGORY_BY_ID[top.category].label;
  return {
    id: 'outlier-expense',
    text: `${label} is ${money(top.amount ?? 0)}, more than the ${money(calc.revenue)} the company earned all year. `
      + 'Check for an extra zero or a number in the wrong row.',
    goTo: { label: `Check ${label.toLowerCase()}`, step: 'expenses', anchor: expenseAnchor(top.id) },
  };
}

/** Explains an unbalanced balance sheet and lists what would close the gap. null when the books tie. */
export function diagnoseImbalance(data: ReturnData, calc: Calculation): Diagnosis | null {
  const bs = calc.balanceSheet;
  if (bs.balanced) return null;

  const gap = Math.abs(bs.difference);
  const over = bs.difference > 0;
  const b = data.balances;
  const suggestions: Suggestion[] = [];
  const adjustLoan = (d: ReturnData): ReturnData => ({
    ...d,
    balances: { ...d.balances, shareholderLoan: round2((d.balances.shareholderLoan ?? 0) + bs.difference) },
  });

  const outlier = outlierExpense(data, calc);
  if (outlier) suggestions.push(outlier);

  let why: string;
  if (over) {
    why = calc.netIncomeAfterTax < 0
      ? `The company spent ${money(-calc.netIncomeAfterTax)} more than it earned, yet finished the year with `
        + `${money(bs.totalAssets)}. Nothing entered so far says where ${money(gap)} of that came from.`
      : `Profit, shares and debts explain ${money(bs.totalLiabilitiesAndEquity)}, but the company finished the year `
        + `with ${money(bs.totalAssets)}. Nothing entered so far says where the other ${money(gap)} came from.`;

    suggestions.push({
      id: 'owner-lent',
      text: 'If you put your own money in, or paid company costs personally, the company owes you that money.',
      apply: { label: `The company owes me ${money(gap)}`, change: adjustLoan },
    });
    if (!b.payables) {
      suggestions.push({
        id: 'payables',
        text: 'Bills or a credit card balance still unpaid at year end count as money the company owes.',
        goTo: { label: 'Add unpaid bills', step: 'balances', anchor: 'payables' },
      });
    }
    if (!calc.isNil) {
      suggestions.push({
        id: 'revenue',
        text: 'Sales that reached the bank but aren’t in revenue would also explain it.',
        goTo: { label: 'Check revenue', step: 'income', anchor: 'revenue' },
      });
    }
  } else {
    why = `From the profit, shares and debts you entered, the company should have ${money(bs.totalLiabilitiesAndEquity)}. `
      + `The balances you entered add up to ${money(bs.totalAssets)}. Nothing entered so far says where the other `
      + `${money(gap)} went.`;

    if (!calc.isNil) {
      suggestions.push({
        id: 'dividends',
        text: 'If you paid yourself from the company and it wasn’t salary, it was a dividend. It’s taxed on your personal return.',
        apply: {
          label: `I took ${money(gap)} as dividends`,
          change: d => ({ ...d, dividendsPaid: round2((d.dividendsPaid ?? 0) + gap) }),
        },
      });
    }
    suggestions.push({
      id: 'owner-borrowed',
      text: 'If you took the money and plan to pay it back, you owe it to the company. It has to be repaid within a year.',
      apply: { label: `I owe the company ${money(gap)}`, change: adjustLoan },
    });
    if (!b.receivables) {
      suggestions.push({
        id: 'receivables',
        text: 'Invoices you’d sent that weren’t paid by year end count as something the company has.',
        goTo: { label: 'Add unpaid invoices', step: 'balances', anchor: 'receivables' },
      });
    }
    if (!calc.isNil) {
      suggestions.push({
        id: 'expenses',
        text: 'An expense paid from the bank that isn’t listed would also explain it.',
        goTo: { label: 'Check expenses', step: 'expenses' },
      });
    }
  }

  suggestions.push({
    id: 'cash',
    text: 'The bank balance should be the statement figure for the last day of the tax year, all accounts added together.',
    goTo: { label: 'Check the bank balance', step: 'balances', anchor: 'cash' },
  });

  return {
    title: over
      ? `The company has ${money(gap)} more than these numbers explain`
      : `The company has ${money(gap)} less than these numbers explain`,
    why,
    suggestions,
  };
}

/** A loss year can't be filed here, so the useful advice is where a wrong number would hide. */
export function lossSuggestions(data: ReturnData, calc: Calculation): Suggestion[] {
  const out: Suggestion[] = [];
  const top = largestExpense(data);
  const outlier = outlierExpense(data, calc);
  if (outlier) {
    out.push(outlier);
  } else if (top) {
    const label = EXPENSE_CATEGORY_BY_ID[top.category].label;
    out.push({
      id: 'largest-expense',
      text: `The biggest expense is ${label.toLowerCase()} at ${money(top.amount ?? 0)}. Check it first.`,
      goTo: { label: `Check ${label.toLowerCase()}`, step: 'expenses', anchor: expenseAnchor(top.id) },
    });
  }
  out.push({
    id: 'revenue',
    text: `Revenue is ${money(calc.revenue)}. It should be everything invoiced for the year, including invoices not paid yet.`,
    goTo: { label: 'Check revenue', step: 'income', anchor: 'revenue' },
  });
  return out;
}
