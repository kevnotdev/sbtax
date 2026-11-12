import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPriorReturn, itemsToLines, looksLikeReturn, nextTaxYear, parseAmount, parsePriorReturn,
} from './prior-return';
import { calculate } from '../tax-engine/calculator';
import { EMPTY_RETURN } from '../tax-engine/sample';

/**
 * Lines as they come out of a tax program's PDF copy of a T2 return, for a made-up company.
 * The shapes (line numbers, column breaks, bracketed negatives, trailing row letters)
 * follow a real UFile printout; none of the values do.
 */
const PRINTOUT = [
  'T2 Corporation Income Tax Return  |  200',
  'Business number (BN) 001 123456782RC0001  |  R C',
  'Corporation\'s name  |  To which tax year does this return apply?',
  '002 NORTHLINE CONSULTING INC.',
  'Year Month Day  |  Year Month Day',
  '060  |  2025 02 01  |  061  |  2026 01 31',
  'X 1 Canadian-controlled private corporation (CCPC)',
  'Net income or (loss) for income tax purposes from Schedule 1, financial statements, or GIFI 300  |  (8,250 )A',
  'Provincial or territorial jurisdiction 750 ON',
  'I, 950 Sample  |  951 Sam  |  954 Director  |  ,',
  'BALANCE SHEET INFORMATION  |  SCHEDULE 100',
  '2780 Due to shareholder(s) / director(s) +  |  2,000',
  '3500 Common shares +',
  '3600 Retained earnings / deficit +  |  12,400',
  '3849 Retained earnings / deficit - end +=  |  12,400',
  'Non-capital losses before any request for a carryback (amount 1P minus amount 1Q)  |  8,250 1R',
  'Closing balance of non-capital losses to be carried forward to future tax years (amount 1R minus amount 1S) 180  |  8,250',
];

test('amounts: commas, brackets for negatives, and text that is not an amount', () => {
  assert.equal(parseAmount('5,449'), 5449);
  assert.equal(parseAmount('(21,639 )'), -21639);
  assert.equal(parseAmount('(21,639)'), -21639);
  assert.equal(parseAmount('-12.50'), -12.5);
  assert.equal(parseAmount('0'), 0);
  assert.equal(parseAmount('+='), null);
  assert.equal(parseAmount('SCHEDULE 100'), null);
});

test('reads what carries forward from a printed T2 return', () => {
  const found = parsePriorReturn(PRINTOUT, 'UFile.ca v2026');
  assert.equal(found.software, 'UFile');
  assert.equal(found.legalName?.value, 'NORTHLINE CONSULTING INC.');
  assert.equal(found.businessNumber?.value, '123456782');
  assert.equal(found.province?.value, 'ON');
  assert.equal(found.yearStart?.value, '2025-02-01');
  assert.equal(found.yearEnd?.value, '2026-01-31');
  assert.equal(found.isCcpc?.value, true);
  assert.equal(found.signerName?.value, 'Sam Sample');
  assert.equal(found.signerTitle?.value, 'Director');
  assert.equal(found.netIncomeForTax?.value, -8250);
  assert.equal(found.retainedEarnings?.value, 12400);
  assert.equal(found.retainedEarnings?.source, 'Schedule 100, line 3849');
  assert.equal(found.dueToShareholder?.value, 2000);
  assert.equal(found.lossesCarriedForward?.value, 8250);
  // A blank line on the return is "not stated", not zero.
  assert.equal(found.shareCapital, undefined);
  assert.equal(looksLikeReturn(found), true);
});

test('a PDF that is not a tax return is turned away', () => {
  assert.equal(looksLikeReturn(parsePriorReturn(['Invoice 1042', 'Total due  |  1,250'])), false);
  assert.equal(looksLikeReturn(parsePriorReturn([])), false);
});

test('the next tax year follows the uploaded one, month ends included', () => {
  assert.deepEqual(nextTaxYear('2026-01-31'), { yearStart: '2026-02-01', yearEnd: '2027-01-31' });
  assert.deepEqual(nextTaxYear('2025-12-31'), { yearStart: '2026-01-01', yearEnd: '2026-12-31' });
  assert.deepEqual(nextTaxYear('2024-02-29'), { yearStart: '2024-03-01', yearEnd: '2025-02-28' });
});

test('applying a prior return sets up this year and feeds the calculation', () => {
  const started = { ...EMPTY_RETURN, owner: { name: 'Typed Earlier', title: 'Owner' } };
  const d = applyPriorReturn(started, parsePriorReturn(PRINTOUT));
  assert.equal(d.company.legalName, 'NORTHLINE CONSULTING INC.');
  assert.equal(d.company.yearStart, '2026-02-01');
  assert.equal(d.company.yearEnd, '2027-01-31');
  assert.equal(d.screening.canadianPrivate, true);
  assert.equal(d.screening.investments, null, 'questions the return cannot answer stay open');
  assert.equal(d.balances.openingRetainedEarnings, 12400);
  assert.equal(d.balances.shareCapital, null, 'nothing found, so nothing overwritten');
  assert.equal(d.priorLosses, 8250);
  assert.equal(d.owner.name, 'Sam Sample');

  // The carried loss does its job: $10,000 of profit this year is taxed on $1,750.
  const c = calculate({ ...d, hadActivity: true, revenue: 10000 });
  assert.equal(c.lossApplied, 8250);
  assert.equal(c.taxableIncome, 1750);
});

test('text items are rebuilt into lines with column breaks', () => {
  const lines = itemsToLines([
    { str: '+=', x: 300, y: 500, width: 10 },
    { str: '3849 Retained earnings / deficit - end . . . . . . . .', x: 40, y: 500.4, width: 255 },
    { str: '12,400', x: 480, y: 500, width: 30 },
    { str: 'SCHEDULE 100', x: 400, y: 700, width: 70 },
    { str: '   ', x: 10, y: 600, width: 5 },
  ]);
  assert.deepEqual(lines, ['SCHEDULE 100', '3849 Retained earnings / deficit - end +=  |  12,400']);
});
