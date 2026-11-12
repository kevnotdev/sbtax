import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, calculate, daysInclusive, provincialRate } from './calculator';
import { diagnoseImbalance } from './advice';
import { findIssues, issueTarget, passesLuhn, readyToFile } from './checks';
import { firstYearWriteOff } from './rates';
import { EMPTY_RETURN, SAMPLE_RETURN } from './sample';
import type { ReturnData } from './types';

const clone = (d: ReturnData): ReturnData => JSON.parse(JSON.stringify(d));
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);

test('sample company: profit, tax and balance sheet', () => {
  const c = calculate(SAMPLE_RETURN);
  near(c.operatingExpenses, 10600);
  near(c.cca.total, 3499); // laptop bought March 2025 is fully written off
  near(c.incomeBeforeTax, 130901);
  near(c.mealsNonDeductible, 475);
  near(c.taxableIncome, 131376);
  near(c.federalTax, 11823.84);
  near(c.provincialTax, 4204.03);
  near(c.totalTax, 16027.87);
  near(c.balanceSheet.retainedEarnings, 99373.13);
  near(c.balanceSheet.taxesPayable, 19227.87);
  near(c.balanceSheet.difference, 0);
  assert.equal(c.balanceSheet.balanced, true);
  assert.equal(c.filingDue, '2026-06-30');
  assert.equal(c.balanceDue, '2026-03-31');
});

test('sample company is ready to file', () => {
  const issues = findIssues(SAMPLE_RETURN, calculate(SAMPLE_RETURN), '2026-11-10');
  assert.deepEqual(issues.filter(i => i.level === 'blocker'), []);
  assert.equal(readyToFile(issues), true);
  assert.ok(issues.some(i => i.id === 't5'), 'dividends raise the T5 reminder');
});

test('an empty return is not ready and does not crash', () => {
  const c = calculate(EMPTY_RETURN);
  assert.equal(c.totalTax, 0);
  assert.equal(readyToFile(findIssues(EMPTY_RETURN, c, '2026-11-10')), false);
});

test('nil return: no tax, books still have to tie', () => {
  const d = clone(EMPTY_RETURN);
  d.hadActivity = false;
  d.revenue = 9999; // ignored
  d.balances = { ...d.balances, cash: 100, shareCapital: 100, openingRetainedEarnings: 0 };
  const c = calculate(d);
  assert.equal(c.isNil, true);
  assert.equal(c.revenue, 0);
  assert.equal(c.totalTax, 0);
  assert.equal(c.balanceSheet.balanced, true);
});

test('instalments reduce the balance owing and the tax liability', () => {
  const d = clone(SAMPLE_RETURN);
  d.instalmentsPaid = 10000;
  d.balances.cash = 104551;
  const c = calculate(d);
  near(c.balanceOwing, 6027.87);
  assert.equal(c.balanceSheet.balanced, true);
});

test('provincial rate is prorated across a mid-year change', () => {
  // Nova Scotia: 2.5% to March 31, 2025, then 1.5%.
  const { rate } = provincialRate('NS', '2025-01-01', '2025-12-31');
  near(rate, (0.025 * 90 + 0.015 * 275) / 365);
  near(provincialRate('NS', '2024-01-01', '2024-12-31').rate, 0.025);
  near(provincialRate('NS', '2026-01-01', '2026-12-31').rate, 0.015);
  const on = provincialRate('ON', '2026-01-01', '2026-12-31');
  near(on.rate, (0.032 * 181 + 0.022 * 184) / 365);
  assert.equal(on.announced, true);
  assert.equal(provincialRate('ON', '2025-01-01', '2025-12-31').announced, false);
});

test('first-year write-off rules by purchase date', () => {
  near(firstYearWriteOff('computer', '2024-03-01').share, 0.55);
  near(firstYearWriteOff('computer', '2024-04-16').share, 1);
  near(firstYearWriteOff('computer', '2027-01-01').share, 0.825);
  near(firstYearWriteOff('equipment', '2024-06-01').share, 0.2);
  near(firstYearWriteOff('equipment', '2025-06-01').share, 0.3);
  near(firstYearWriteOff('software', '2025-06-01').share, 1);
});

test('equipment: opening balance and new purchase, books depreciate with tax', () => {
  const d = clone(SAMPLE_RETURN);
  d.openingUcc.equipment = 1000;
  d.assets.push({ id: 'a2', description: 'Desk', kind: 'equipment', date: '2025-05-01', cost: 2000 });
  const c = calculate(d);
  const cls = c.cca.classes.find(k => k.kind === 'equipment')!;
  near(cls.claim, 1000 * 0.2 + 2000 * 0.3);
  near(cls.closing, 3000 - 800);
  near(c.balanceSheet.equipment, 2200);
});

test('short first year prorates the write-off and the business limit', () => {
  const d = clone(SAMPLE_RETURN);
  d.company.incorporationDate = '2025-07-01';
  d.company.yearStart = '2025-07-01';
  d.assets = [{ id: 'a1', description: 'Desk', kind: 'equipment', date: '2025-08-01', cost: 1000 }];
  const c = calculate(d);
  assert.equal(c.daysInYear, 184);
  near(c.cca.total, Math.round(1000 * 0.3 * (184 / 365) * 100) / 100);
  near(c.businessLimit, Math.round(500000 * (184 / 365) * 100) / 100);
  assert.equal(c.balanceSheet.openingRetainedEarnings, 0); // ignored in a first year
});

test('scope limits are blockers, not silent wrong answers', () => {
  const big = clone(SAMPLE_RETURN);
  big.revenue = 900000;
  assert.ok(findIssues(big, calculate(big), '2026-11-10').some(i => i.id === 'over-limit'));

  const loss = clone(SAMPLE_RETURN);
  loss.revenue = 1000;
  const lc = calculate(loss);
  assert.equal(lc.totalTax, 0);
  assert.ok(findIssues(loss, lc, '2026-11-10').some(i => i.id === 'loss'));

  const qc = clone(SAMPLE_RETURN);
  qc.company.province = 'QC';
  assert.ok(findIssues(qc, calculate(qc), '2026-11-10').some(i => i.id === 'province-unsupported'));

  const unbalanced = clone(SAMPLE_RETURN);
  unbalanced.balances.cash = 100000;
  assert.ok(findIssues(unbalanced, calculate(unbalanced), '2026-11-10').some(i => i.id === 'unbalanced'));
});

test('date helpers', () => {
  assert.equal(daysInclusive('2024-01-01', '2024-12-31'), 366);
  assert.equal(addMonths('2025-08-31', 6), '2026-02-28');
  assert.equal(addMonths('2025-11-30', 3), '2026-02-28');
  assert.equal(addMonths('2025-06-15', 6), '2025-12-15');
  assert.equal(passesLuhn('123456782'), true);
  assert.equal(passesLuhn('123456789'), false);
});

/* ---- Advice: why the books are out, and what fixes them ---- */

/** $10,000 revenue, $50,000 of internet, $30,000 in the bank: a $40,000 loss and books out by $70,000. */
function lossWithCash(): ReturnData {
  const d = clone(SAMPLE_RETURN);
  d.revenue = 10000;
  d.expenses = [{ id: 'x1', category: 'phone', note: '', amount: 50000 }];
  d.assets = [];
  d.dividendsPaid = 0;
  d.balances = {
    cash: 30000, receivables: 0, payables: 0, salesTaxOwing: 0,
    shareholderLoan: 0, shareCapital: 0, openingRetainedEarnings: 0,
  };
  return d;
}

test('unbalanced books: the issue says why and points at the fix', () => {
  const d = lossWithCash();
  const c = calculate(d);
  near(c.taxLoss, 40000);
  near(c.balanceSheet.difference, 70000);

  const issues = findIssues(d, c, '2026-11-10');
  const unbalanced = issues.find(i => i.id === 'unbalanced')!;
  assert.deepEqual(issueTarget(unbalanced), { step: 'balances', anchor: 'books-check' });
  assert.match(unbalanced.detail!, /\$40,000\.00 more than it earned/);

  const ids = unbalanced.suggestions!.map(s => s.id);
  assert.equal(ids[0], 'outlier-expense', 'the $50,000 phone bill is flagged first');
  assert.deepEqual(unbalanced.suggestions![0].goTo, {
    label: 'Check phone and internet', step: 'expenses', anchor: 'expense-x1',
  });

  // The one-tap fix really does make the two sides match.
  const fixed = unbalanced.suggestions!.find(s => s.id === 'owner-lent')!.apply!.change(d);
  near(fixed.balances.shareholderLoan!, 70000);
  assert.equal(calculate(fixed).balanceSheet.balanced, true);

  // The loss sends people to the number most likely to be wrong, not to a dead end.
  const loss = issues.find(i => i.id === 'loss')!;
  assert.deepEqual(issueTarget(loss), { step: 'expenses', anchor: 'expense-x1' });
});

test('books short of cash: dividend and loan fixes both balance', () => {
  const d = clone(SAMPLE_RETURN);
  d.balances.cash = 104551; // $10,000 less than the books explain
  const diagnosis = diagnoseImbalance(d, calculate(d))!;
  assert.match(diagnosis.title, /\$10,000\.00 less/);
  for (const id of ['dividends', 'owner-borrowed']) {
    const fix = diagnosis.suggestions.find(s => s.id === id)!.apply!.change(d);
    assert.equal(calculate(fix).balanceSheet.balanced, true, id);
  }
  assert.equal(diagnoseImbalance(SAMPLE_RETURN, calculate(SAMPLE_RETURN)), null);
});

test('every blocker and warning has somewhere to send the person', () => {
  const issues = findIssues(EMPTY_RETURN, calculate(EMPTY_RETURN), '2026-11-10');
  for (const i of issues.filter(x => x.level !== 'note')) {
    assert.ok(issueTarget(i).anchor, `${i.id} has no anchor`);
  }
});
