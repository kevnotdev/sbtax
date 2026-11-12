import type { Calculation, ReturnData } from './types';
import { EARLIEST_YEAR_START, PROVINCES } from './rates';
import { daysInclusive, isDate, isFirstYear } from './calculator';
import { dateLong, money, percent } from '../format';
import { diagnoseImbalance, expenseAnchor, lossSuggestions, type Suggestion, type Target } from './advice';

export type StepId =
  | 'start' | 'company' | 'income' | 'expenses' | 'equipment' | 'balances' | 'review' | 'file';

export interface Issue {
  id: string;
  /** blocker: must be fixed before filing. warning: worth a second look. note: something to do outside this return. */
  level: 'blocker' | 'warning' | 'note';
  step: StepId;
  title: string;
  detail?: string;
  /** The field on `step` to bring into view (a `data-anchor` value). */
  anchor?: string;
  /** Where the fix is made, when that isn't `step`. */
  target?: Target;
  /** Ways to fix it, most likely first. */
  suggestions?: Suggestion[];
}

/** Where to send someone who wants to fix this issue. */
export function issueTarget(issue: Issue): Target {
  return issue.target ?? { step: issue.step, anchor: issue.anchor };
}

const POSTAL = /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/;

/** Business numbers carry a Luhn check digit, so most typos are detectable. */
export function passesLuhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function findIssues(data: ReturnData, calc: Calculation, today: string): Issue[] {
  const out: Issue[] = [];
  const add = (
    level: Issue['level'], step: StepId, id: string, title: string, detail?: string,
    more?: Pick<Issue, 'anchor' | 'target' | 'suggestions'>,
  ) => out.push({ id, level, step, title, detail, ...more });
  const { screening: s, company: c } = data;

  /* ---- Is this for your company? ---- */
  if (Object.values(s).some(v => v === null)) {
    add('blocker', 'start', 'screening-open', 'Answer the four questions about your company', undefined, { anchor: 'screening' });
  }
  if (s.canadianPrivate === false) {
    add('blocker', 'start', 'not-ccpc', 'Only Canadian-controlled private corporations are supported',
      'Companies with non-resident or public owners are taxed under different rules.', { anchor: 'screening' });
  }
  if (s.otherCorporations === true) {
    add('blocker', 'start', 'associated', 'Companies with related corporations aren’t supported yet',
      'Related corporations have to share the small business limit, which this return doesn’t handle.', { anchor: 'screening' });
  }
  if (s.investments === true) {
    add('blocker', 'start', 'investments', 'Investment and rental income aren’t supported yet',
      'That income is taxed at a different rate with refundable taxes this return doesn’t calculate.', { anchor: 'screening' });
  }
  if (s.soldEquipment === true) {
    add('blocker', 'start', 'disposals', 'Selling or scrapping equipment isn’t supported yet',
      'A sale can trigger recaptured write-offs that this return doesn’t calculate.', { anchor: 'screening' });
  }

  /* ---- Company ---- */
  if (!c.legalName.trim()) add('blocker', 'company', 'name', 'Add the company’s legal name', undefined, { anchor: 'legalName' });
  const bn = c.businessNumber.replace(/\D/g, '');
  if (bn.length !== 9) {
    add('blocker', 'company', 'bn', 'Add the 9-digit business number', undefined, { anchor: 'businessNumber' });
  } else if (!passesLuhn(bn)) {
    add('warning', 'company', 'bn-check', 'Double-check the business number',
      'It doesn’t match the pattern CRA business numbers follow.', { anchor: 'businessNumber' });
  }
  if (!c.province) {
    add('blocker', 'company', 'province', 'Choose the province or territory', undefined, { anchor: 'province' });
  } else if (!PROVINCES[c.province].supported) {
    add('blocker', 'company', 'province-unsupported', `${PROVINCES[c.province].name} isn’t supported yet`,
      'Quebec corporations also file a separate CO-17 return with Revenu Québec.', { anchor: 'province' });
  }
  if (!isDate(c.incorporationDate)) add('blocker', 'company', 'incorporation', 'Add the incorporation date', undefined, { anchor: 'incorporationDate' });
  if (!isDate(c.yearStart) || !isDate(c.yearEnd)) {
    add('blocker', 'company', 'year', 'Add the first and last day of the tax year', undefined, { anchor: 'yearStart' });
  } else {
    const days = daysInclusive(c.yearStart, c.yearEnd);
    if (days === 0) {
      add('blocker', 'company', 'year-order', 'The tax year has to end after it starts', undefined, { anchor: 'yearEnd' });
    } else if (days > 371) {
      add('blocker', 'company', 'year-long', 'A tax year can’t be longer than 53 weeks', undefined, { anchor: 'yearEnd' });
    }
    if (c.yearStart < EARLIEST_YEAR_START) {
      add('blocker', 'company', 'year-early', 'Tax years that started before 2024 aren’t supported', undefined, { anchor: 'yearStart' });
    }
    if (isDate(c.incorporationDate) && c.incorporationDate > c.yearEnd) {
      add('blocker', 'company', 'incorporation-late', 'The company was incorporated after this tax year ended', undefined, { anchor: 'incorporationDate' });
    } else if (isDate(c.incorporationDate) && c.incorporationDate > c.yearStart && days > 0) {
      add('blocker', 'company', 'year-before-incorporation',
        'The tax year can’t start before the company existed',
        `Set the first day of the tax year to ${dateLong(c.incorporationDate)}.`, { anchor: 'yearStart' });
    }
    if (c.yearEnd >= today) {
      add('warning', 'company', 'year-open', 'This tax year hasn’t ended yet',
        'You can prepare the return now, but it can only be filed after the last day of the year.', { anchor: 'yearEnd' });
    }
  }
  if (!c.street.trim() || !c.city.trim()) add('blocker', 'company', 'address', 'Add the head office address', undefined, { anchor: 'street' });
  if (!POSTAL.test(c.postalCode.trim().toUpperCase())) {
    add('blocker', 'company', 'postal', 'Add a valid postal code', 'For example, M5V 2T6.', { anchor: 'postalCode' });
  }

  /* ---- Income ---- */
  if (data.hadActivity === null) {
    add('blocker', 'income', 'activity', 'Say whether the company was active this year', undefined, { anchor: 'activity' });
  } else if (data.hadActivity) {
    if (data.revenue === null) add('blocker', 'income', 'revenue', 'Add the company’s revenue', undefined, { anchor: 'revenue' });
    else if (data.revenue < 0) add('blocker', 'income', 'revenue-negative', 'Revenue can’t be negative', undefined, { anchor: 'revenue' });
  }

  if (!calc.isNil) {
    /* ---- Expenses ---- */
    const emptyLine = data.expenses.find(e => e.amount === null);
    if (emptyLine) {
      add('blocker', 'expenses', 'expense-empty', 'Add an amount to every expense, or remove the empty ones',
        undefined, { anchor: expenseAnchor(emptyLine.id) });
    }
    const negativeLine = data.expenses.find(e => (e.amount ?? 0) < 0);
    if (negativeLine) {
      add('blocker', 'expenses', 'expense-negative', 'Expenses can’t be negative',
        undefined, { anchor: expenseAnchor(negativeLine.id) });
    }
    if (data.hadActivity && data.expenses.length === 0 && (data.revenue ?? 0) > 0) {
      add('warning', 'expenses', 'no-expenses', 'No expenses entered',
        'Most companies have at least bank or accounting fees. Skipping them means paying more tax than you owe.',
        { anchor: 'add-expense' });
    }
    if (data.expenses.some(e => e.category === 'salary' && (e.amount ?? 0) > 0)) {
      add('note', 'expenses', 't4', 'Salary needs T4 slips',
        'T4 slips and a T4 summary are due to CRA by the last day of February. They’re filed separately from this return.');
    }

    /* ---- Equipment ---- */
    for (const a of data.assets) {
      const name = a.description.trim() || 'An equipment item';
      if (!a.description.trim() || a.cost === null || a.cost <= 0 || !isDate(a.date)) {
        add('blocker', 'equipment', `asset-incomplete-${a.id}`, `${name} needs a description, date and cost`, undefined, { anchor: `asset-${a.id}` });
      } else if (isDate(c.yearStart) && isDate(c.yearEnd) && (a.date < c.yearStart || a.date > c.yearEnd)) {
        add('blocker', 'equipment', `asset-date-${a.id}`, `${name} wasn’t bought during this tax year`,
          'Only add equipment bought this year. Earlier purchases come in through last year’s remaining balance.', { anchor: `asset-${a.id}` });
      }
    }
  }

  /* ---- Year-end balances ---- */
  const b = data.balances;
  if (b.cash === null) add('blocker', 'balances', 'cash', 'Add the bank balance at year end', undefined, { anchor: 'cash' });
  if (b.shareCapital === null) add('blocker', 'balances', 'shares', 'Add what was paid for the company’s shares', undefined, { anchor: 'shareCapital' });
  if (!isFirstYear(data) && b.openingRetainedEarnings === null) {
    add('blocker', 'balances', 'opening-re', 'Add last year’s retained earnings', 'Enter 0 if there were none.', { anchor: 'openingRetainedEarnings' });
  }
  const imbalance = b.cash !== null && b.shareCapital !== null ? diagnoseImbalance(data, calc) : null;
  if (imbalance) {
    add('blocker', 'balances', 'unbalanced',
      `The books are out by ${money(Math.abs(calc.balanceSheet.difference))}`,
      `What the company has must equal what it owes plus what belongs to you. ${imbalance.why}`,
      { anchor: 'books-check', suggestions: imbalance.suggestions });
  }
  if ((b.cash ?? 0) < 0) {
    add('warning', 'balances', 'overdraft', 'The bank balance is negative',
      'That’s fine if the account was overdrawn at year end. Otherwise check the number.', { anchor: 'cash' });
  }
  if (calc.balanceSheet.dueFromShareholder > 0) {
    add('warning', 'balances', 'shareholder-debit', 'You owe the company money',
      'If it isn’t repaid within a year of the company’s year end, CRA can tax it as your personal income.', { anchor: 'shareholderLoan' });
  }
  if ((data.dividendsPaid ?? 0) > 0) {
    add('note', 'balances', 't5', 'Dividends need a T5 slip',
      'A T5 slip for the dividends is due to CRA by the last day of February. It’s filed separately from this return.', { anchor: 'dividends' });
  }

  /* ---- Things the return can't handle ---- */
  if (calc.taxLoss > 0) {
    add('warning', 'review', 'loss', `The company lost ${money(calc.taxLoss)} this year`,
      'No tax is owed. The loss isn’t wasted: it carries forward for up to 20 years and reduces tax in a profitable '
        + `year. Next year’s return will ask for the unused amount, ${money(calc.lossClosing)}. `
        + 'A loss can also be carried back up to 3 years for a refund of tax already paid. This return doesn’t do '
        + 'that, and the request is due with this return, so talk to an accountant if the company paid tax in the last three years.',
      (() => {
        const suggestions = lossSuggestions(data, calc);
        const first = suggestions[0].goTo!;
        return { target: { step: first.step, anchor: first.anchor }, suggestions };
      })());
  }
  if (calc.overBusinessLimit) {
    add('blocker', 'review', 'over-limit',
      `Taxable income is over the ${money(calc.businessLimit, 0)} small business limit`,
      'Income above the limit is taxed at the general rate, which this return doesn’t calculate.',
      { target: { step: 'income', anchor: 'revenue' } });
  }
  if (calc.provincialRateIsAnnounced && c.province) {
    add('warning', 'review', 'rate-announced',
      `The ${PROVINCES[c.province].name} rate of ${percent(calc.provincialRate)} includes a budget change`,
      'The change was announced in a provincial budget. Confirm it became law before relying on this number.',
      { target: { step: 'company', anchor: 'province' } });
  }

  /* ---- Filing ---- */
  if (!data.owner.name.trim() || !data.owner.title.trim()) {
    add('blocker', 'file', 'signer', 'Add the name and title of the person signing', undefined, { anchor: 'signer' });
  }

  return out;
}

export type StepStatus = 'todo' | 'partial' | 'done';

/** A step is done once it has been opened and nothing on it blocks filing. */
export function stepStatus(step: StepId, issues: Issue[], visited: StepId[]): StepStatus {
  if (!visited.includes(step)) return 'todo';
  if (step === 'review') return issues.some(i => i.level === 'blocker' && i.step !== 'file') ? 'partial' : 'done';
  return issues.some(i => i.level === 'blocker' && i.step === step) ? 'partial' : 'done';
}

/** Everything except the signature is in order. */
export function readyToFile(issues: Issue[]): boolean {
  return !issues.some(i => i.level === 'blocker' && i.step !== 'file');
}

/** A return can be prepared early, but CRA only accepts it once the tax year is over. */
export function yearStillOpen(issues: Issue[]): boolean {
  return issues.some(i => i.id === 'year-open');
}
