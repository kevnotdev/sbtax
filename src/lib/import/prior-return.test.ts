import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPriorReturn, looksLikeReturn, nextTaxYear, parsePriorReturn } from './prior-return';
import {
  extractGifi, extractLines, extractT2, itemsToLines, parseAmount, segmentDocument, LINE_CATALOGUE,
} from './t2-extract';
import { calculate } from '../tax-engine/calculator';
import { EMPTY_RETURN } from '../tax-engine/sample';

/**
 * Two printouts of the same made-up return, in the two styles tax programs use.
 * The shapes follow real output; none of the values belong to a real company.
 */

/** Style 1: a facsimile of the CRA forms, with form ids in the footers. */
const FACSIMILE: string[][] = [
  ['Corporation Income Tax Return for:', 'NORTHLINE CONSULTING INC.', 'From: 2025-02-01  |  To: 2026-01-31'],
  [
    '07 Nov 2026 NORTHLINE CONSULTING INC.  |  Yr.end: 31-01-2026',
    'Carryforward Schedule',
    'Subject  |  Amount  |  Reference Form',
    'Non-Capital Losses  |  8,250  |  Schedule 4',
    'Foreign Income Tax Credits – Business  |  Schedule 21',
  ],
  [
    'BALANCE SHEET INFORMATION  |  SCHEDULE 100',
    'GIFI #  |  Description  |  Amount',
    '1000 Cash and deposits +',
    '1001 Cash +  |  6,000',
    '2780 Due to shareholder(s) / director(s) +  |  2,000',
    '3500 Common shares +',
    '3600 Retained earnings / deficit +  |  12,400',
    '3849 Retained earnings / deficit - end +=  |  12,400',
    'Version 1.0  |  Page 1 of 1',
  ],
  [
    'INCOME STATEMENT INFORMATION  |  SCHEDULE 125',
    '8000 Trade sales of goods and services +',
    '8299 Total revenue +=  |  0',
    '8523 Meals and entertainment +  |  25',
    '9975 Extraordinary item(s)  |  -',
    '9999 Net income / loss after taxes and extraordinary items =  |  (8,250 )',
  ],
  [
    'T2 Corporation Income Tax Return  |  200',
    'Business number (BN) 001 123456782RC0001  |  R C',
    '002 NORTHLINE CONSULTING INC.',
    '060  |  2025 02 01  |  061  |  2026 01 31',
    'If yes, complete lines 030 to 038 and attach Schedule 24.',
    'X 1 Canadian-controlled private corporation (CCPC)',
    'T2 E (26)  |  Version 1.0  |  Page 1 of 9',
  ],
  [
    // The attachments checklist pairs a line number with a schedule number. Neither is an amount.
    'Is the corporation related to any other corporations?  |  150  |  9',
    'Net income or (loss) for income tax purposes from Schedule 1, financial statements, or GIFI 300  |  (8,250 )A',
    'Non-capital losses of previous tax years from Schedule 4 331',
    'Taxable income (amount C plus amount D) 360',
    'Taxable income from line 360 on page 3  |  A',
    'Business limit 410  |  500,000',
    'Base amount Part I tax – Taxable income (from line 360 on page 3) multiplied by 38% 550  |  0 A',
    'Provincial or territorial jurisdiction 750 ON',
    'I, 950 Sample  |  951 Sam  |  954 Director  |  ,',
    '955 2026-11-07  |  956 (647) 555-0100',
    'T2 E (26)  |  Version 1.0  |  Page 3 of 9',
  ],
  [
    'Schedule 4',
    'Corporation Loss Continuity and Application',
    'Non-capital losses at the beginning of the tax year (amount 1N minus line 100) 102  |  0  |  0',
    'Current-year non-capital loss (from amount 1M) 110  |  8,250',
    'T2 SCH 4 E (25)  |  Version 1.0  |  Page 1 of 7',
  ],
  [
    'Non-capital losses of previous tax years applied in the current tax year 130',
    'Enter the amount from line 130 on line 331 of the T2 return.',
    'Subtotal (total of lines 150, 140, 130 and 135)  |  1Q',
    'Closing balance of non-capital losses to be carried forward (amount 1R minus amount 1S) 180  |  8,250',
    'Section 111(5) continuity  |  600  |  602',
    'T2 SCH 4 E (25)  |  Version 1.0  |  Page 2 of 7',
  ],
  [
    'T2 BAR CODE RETURN',
    'Net income or (loss) for income tax purposes  |  $  |  (8,250)',
  ],
];

/** Style 2: condensed tables, no footers, zero rows left out, codes after descriptions, other negative styles. */
const CONDENSED: string[][] = [
  [
    'T2 Corporation Income Tax Return',
    'Business number  |  001  |  12345 6782 RC 0001',
    '002  |  NORTHLINE CONSULTING INC.',
    'Tax year start  |  060  |  2025/02/01',
    'Tax year end  |  061  |  2026/01/31',
    'Net income for income tax purposes  |  300  |  $(8,250.00)',
    'Jurisdiction  |  750  |  ON',
    'Signing officer  |  950 Sample  |  951 Sam  |  954 Director',
  ],
  [
    'Schedule 100 – Balance Sheet',
    'Cash 1001 6,000.00',
    'Due to shareholder 2780 2,000.00',
    'Retained earnings, end of year 3849 12,400.00',
  ],
  [
    'Schedule 125 - Income Statement',
    'Net income after taxes 9999 -8,250.00',
  ],
  [
    'Schedule 4: Loss continuity',
    'Loss for the year  |  110  |  8,250.00',
    'Closing balance carried forward  |  180  |  8,250.00',
  ],
  ['Schedule 8 – Capital Cost Allowance', 'Class 50  |  1,200.00  |  660.00  |  540.00'],
];

test('amounts are normalised to signed numbers', () => {
  assert.equal(parseAmount('5,449'), 5449);
  assert.equal(parseAmount('(21,639 )'), -21639);
  assert.equal(parseAmount('$(1,250.00)'), -1250);
  assert.equal(parseAmount('($1,250.00)'), -1250);
  assert.equal(parseAmount('-1,250.00'), -1250);
  assert.equal(parseAmount('$ 1,250.00'), 1250);
  assert.equal(parseAmount('0'), 0);
  assert.equal(parseAmount('-'), null);
  assert.equal(parseAmount('+='), null);
  assert.equal(parseAmount('2026-01-31'), null);
  assert.equal(parseAmount('SCHEDULE 100'), null);
});

test('stage 1: pages are grouped under their form, and program pages are set aside', () => {
  const forms = Object.fromEntries(segmentDocument(FACSIMILE).map(s => [s.form, s.pages]));
  assert.deepEqual(forms, {
    other: [1, 2, 9], // cover, the program's carry-forward summary, bar code page
    schedule_100: [3],
    schedule_125: [4],
    t2_jacket: [5, 6],
    schedule_4: [7, 8],
  });
  // A summary page that lists schedule names in its rows is not mistaken for those schedules.
  assert.equal(segmentDocument(FACSIMILE).some(s => s.form === 'schedule_21'), false);

  const condensed = segmentDocument(CONDENSED).map(s => s.form);
  assert.deepEqual(condensed, ['t2_jacket', 'schedule_100', 'schedule_125', 'schedule_4', 'schedule_8']);
});

test('stage 2: GIFI codes, with blank lines as null and printed zeros as zero', () => {
  const x = extractT2(FACSIMILE);
  const s100 = (x.schedules.schedule_100 as { gifi_items: Record<string, number | null> }).gifi_items;
  assert.equal(s100['1001'], 6000);
  assert.equal(s100['1000'], null);
  assert.equal(s100['3500'], null);
  assert.equal(s100['3849'], 12400);
  const s125 = (x.schedules.schedule_125 as { gifi_items: Record<string, number | null> }).gifi_items;
  assert.equal(s125['8299'], 0);
  assert.equal(s125['8523'], 25);
  assert.equal(s125['9975'], null);
  assert.equal(s125['9999'], -8250);
});

test('stage 2: CRA line numbers are read inside their own form only', () => {
  const x = extractT2(FACSIMILE);
  assert.equal(x.t2_jacket.line_300, -8250);
  assert.equal(x.t2_jacket.line_360, null, 'printed with nothing entered');
  assert.equal(x.t2_jacket.line_410, 500000);
  assert.equal(x.t2_jacket.line_550, 0);
  assert.equal(x.t2_jacket.line_750, 'ON');
  assert.equal(x.t2_jacket.line_150, undefined, 'a checklist row is not an amount');
  // Every catalogued line is present, stated or not.
  for (const line of LINE_CATALOGUE.t2_jacket) assert.ok(`line_${line}` in x.t2_jacket, line);

  const s4 = x.schedules.schedule_4 as Record<string, number | null>;
  assert.equal(s4.line_102, 0);
  assert.equal(s4.line_110, 8250);
  assert.equal(s4.line_130, null, 'a reference to line 130 in a sentence is not its value');
  assert.equal(s4.line_180, 8250);
  assert.equal(s4.line_600, undefined, 'two line numbers side by side are not a line and its amount');
  // Line 180 exists on other forms too; the jacket must not pick up Schedule 4's.
  assert.equal(x.t2_jacket.line_180, undefined);
});

test('uncatalogued forms: amounts are taken, look-alike line numbers are not', () => {
  const found = extractLines([
    'Opening balance 112  |  5,449',
    'Adjustment 142  |  0',
    'Loss 210  |  (21,639 )',
    'Lines side by side  |  281  |  282',
    'Phone 956 (647) 555-0100',
    'Date 955 2026-11-07',
  ]);
  assert.deepEqual(found, { '112': 5449, '142': 0, '210': -21639 });
});

test('condensed layout: codes after descriptions, other negative styles, rows left out', () => {
  assert.deepEqual(extractGifi(CONDENSED[1]), { '1001': 6000, '2780': 2000, '3849': 12400 });
  const x = extractT2(CONDENSED);
  assert.equal(x.metadata.business_number, '123456782RC0001');
  assert.equal(x.metadata.tax_year, '2026');
  assert.equal(x.metadata.tax_year_end, '2026-01-31');
  assert.equal(x.metadata.detected_software_vendor, 'Unknown');
  assert.equal(x.t2_jacket.line_300, -8250);
  assert.equal(x.t2_jacket.line_770, null, 'left out of the printout');
  assert.equal((x.schedules.schedule_125 as { gifi_items: Record<string, number | null> }).gifi_items['9999'], -8250);
  assert.ok(x.metadata.forms_found.includes('schedule_8'));
});

test('both layouts give the same answers for what carries forward', () => {
  for (const [name, pages] of [['facsimile', FACSIMILE], ['condensed', CONDENSED]] as const) {
    const found = parsePriorReturn(pages, name === 'facsimile' ? 'UFile.ca v2026' : undefined);
    assert.equal(found.legalName?.value, 'NORTHLINE CONSULTING INC.', name);
    assert.equal(found.businessNumber?.value, '123456782', name);
    assert.equal(found.province?.value, 'ON', name);
    assert.equal(found.yearStart?.value, '2025-02-01', name);
    assert.equal(found.yearEnd?.value, '2026-01-31', name);
    assert.equal(found.signerName?.value, 'Sam Sample', name);
    assert.equal(found.signerTitle?.value, 'Director', name);
    assert.equal(found.netIncomeForTax?.value, -8250, name);
    assert.equal(found.retainedEarnings?.value, 12400, name);
    assert.equal(found.lossesCarriedForward?.value, 8250, name);
    assert.equal(found.shareCapital, undefined, `${name}: not stated is not zero`);
    assert.equal(looksLikeReturn(found), true, name);
  }
  assert.equal(parsePriorReturn(FACSIMILE, 'UFile.ca v2026').software, 'UFile');
  assert.equal(parsePriorReturn(FACSIMILE).isCcpc?.value, true);
  assert.equal(parsePriorReturn(CONDENSED).hasEquipmentSchedule, true);
});

test('a PDF that is not a tax return is turned away', () => {
  assert.equal(looksLikeReturn(parsePriorReturn([['Invoice 1042', 'Total due  |  1,250']])), false);
  assert.equal(looksLikeReturn(parsePriorReturn([])), false);
});

test('the next tax year follows the uploaded one, month ends included', () => {
  assert.deepEqual(nextTaxYear('2026-01-31'), { yearStart: '2026-02-01', yearEnd: '2027-01-31' });
  assert.deepEqual(nextTaxYear('2025-12-31'), { yearStart: '2026-01-01', yearEnd: '2026-12-31' });
  assert.deepEqual(nextTaxYear('2024-02-29'), { yearStart: '2024-03-01', yearEnd: '2025-02-28' });
});

test('applying a prior return sets up this year and feeds the calculation', () => {
  const started = { ...EMPTY_RETURN, owner: { name: 'Typed Earlier', title: 'Owner' } };
  const d = applyPriorReturn(started, parsePriorReturn(FACSIMILE));
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
