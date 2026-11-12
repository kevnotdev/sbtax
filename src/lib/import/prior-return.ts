import { addMonths, isDate } from '../tax-engine/calculator';
import type { Province, ReturnData } from '../tax-engine/types';
import { PROVINCES } from '../tax-engine/rates';

/**
 * Reads last year's T2 return, as printed to PDF by another tax program, and pulls out
 * the handful of values that carry into this year. Everything here works on plain text
 * lines, so it runs in the browser and the return never leaves the device.
 *
 * Checked against a UFile T2 "copy of tax return" PDF. The patterns key on CRA line
 * numbers and GIFI codes rather than on UFile's layout, so other programs' printouts
 * should mostly work, but each one needs trying before it is promised.
 */

/** One piece of text from a PDF page, with where it sits. Matches what pdf.js reports. */
export interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

/** Text that sits further apart than this on one line is treated as a separate column. */
const COLUMN_GAP = 12;
export const COLUMN = '  |  ';

/** Rebuilds the reading-order lines of a page from loose text items. */
export function itemsToLines(items: TextItem[]): string[] {
  const sorted = items.filter(i => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: { y: number; items: TextItem[] }[] = [];
  for (const item of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - item.y) < 3) last.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  return rows.map(row => {
    let text = '';
    let end: number | null = null;
    for (const item of row.items.sort((a, b) => a.x - b.x)) {
      if (end !== null && item.x - end > 1.5) text += item.x - end > COLUMN_GAP ? COLUMN : ' ';
      text += item.str;
      end = item.x + item.width;
    }
    // Dotted leaders carry no information and make lines hard to match.
    return text.replace(/( ?\.){3,}/g, ' ').replace(/(?<!\|) {2,}(?!\|)/g, ' ').trim();
  });
}

export interface Found<T> {
  value: T;
  /** Where on the return it was read from, shown to the person so they can check it. */
  source: string;
}

export interface PriorReturn {
  /** The program that produced the PDF, when it says. */
  software?: string;
  legalName?: Found<string>;
  businessNumber?: Found<string>;
  province?: Found<Province>;
  /** The year the uploaded return covers. */
  yearStart?: Found<string>;
  yearEnd?: Found<string>;
  isCcpc?: Found<boolean>;
  signerName?: Found<string>;
  signerTitle?: Found<string>;
  /** Closing retained earnings, which open this year. Negative for a deficit. */
  retainedEarnings?: Found<number>;
  shareCapital?: Found<number>;
  /** Non-capital losses still unused at the end of that year. */
  lossesCarriedForward?: Found<number>;
  /** Owed to the shareholder at that year end. Shown for reference; this year's figure is entered fresh. */
  dueToShareholder?: Found<number>;
  /** That year's profit or loss for tax, shown so the person can confirm it is the right return. */
  netIncomeForTax?: Found<number>;
}

/** "5,449" -> 5449, "(21,639 )" -> -21639. null when the text is not an amount. */
export function parseAmount(text: string): number | null {
  const t = text.trim();
  const m = /^(\()?\s*\$?\s*(-)?\s*(\d{1,3}(?:,\d{3})*|\d+)(\.\d+)?\s*(\))?$/.exec(t);
  if (!m) return null;
  const n = Number(m[3].replace(/,/g, '') + (m[4] ?? ''));
  return m[1] || m[5] || m[2] ? -n : n;
}

/** Splits a line into its columns. */
const cols = (line: string) => line.split('|').map(c => c.trim()).filter(Boolean);

/** The last amount on the first line that starts with a GIFI code or contains a T2 line label. */
function amountOn(lines: string[], test: RegExp): number | null {
  for (const line of lines) {
    if (!test.test(line)) continue;
    const parts = cols(line);
    for (let i = parts.length - 1; i >= 1; i--) {
      // An amount can be followed by a row letter such as "1R" or "A".
      const n = parseAmount(parts[i].replace(/\s*\d?[A-Z]$/, ''));
      if (n !== null) return n;
    }
  }
  return null;
}

const iso = (y: string, m: string, d: string) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

export function parsePriorReturn(lines: string[], creator?: string): PriorReturn {
  const out: PriorReturn = {};
  const text = lines.join('\n');

  if (creator) {
    const name = /ufile|taxprep|turbotax|profile|cantax|taxcycle|futuretax/i.exec(creator)?.[0];
    out.software = name ?? creator.split(/[©(-]/)[0].trim().slice(0, 40);
  }

  /* ---- Who the company is (T2 page 1) ---- */
  const bn = /\b(\d{5})\s?(\d{4})\s?RC\s?\d{4}\b/.exec(text);
  if (bn) out.businessNumber = { value: bn[1] + bn[2], source: 'T2 line 001' };

  const name = lines.map(l => /^002\s+(\S.*)$/.exec(l)?.[1]).find(Boolean)
    ?? lines.map(l => /^(?:Corporation|Name:?)\s*\|\s*(\S.*)$/.exec(l)?.[1]).find(Boolean);
  if (name) out.legalName = { value: cols(name)[0], source: 'T2 line 002' };

  const year = /060\s*\|\s*(\d{4})\s+(\d{1,2})\s+(\d{1,2})\s*\|\s*061\s*\|\s*(\d{4})\s+(\d{1,2})\s+(\d{1,2})/.exec(text)
    ?? /From:\s*(\d{4})-(\d{2})-(\d{2})\s*\|\s*To:\s*(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (year) {
    const start = iso(year[1], year[2], year[3]);
    const end = iso(year[4], year[5], year[6]);
    if (isDate(start) && isDate(end)) {
      out.yearStart = { value: start, source: 'T2 line 060' };
      out.yearEnd = { value: end, source: 'T2 line 061' };
    }
  }

  const prov = /jurisdiction[^\n]*?\b750\s+([A-Z]{2})\b/i.exec(text)?.[1] as Province | undefined;
  if (prov && prov in PROVINCES) out.province = { value: prov, source: 'T2 line 750' };

  if (/^X\s+1\s+Canadian-controlled private corporation/m.test(text)) {
    out.isCcpc = { value: true, source: 'T2 line 040' };
  }

  const signer = /\b950\s+([^|\n]+?)\s*\|\s*951\s+([^|\n]+?)\s*\|\s*954\s+([^|\n,]+)/.exec(text);
  if (signer) {
    out.signerName = { value: `${signer[2].trim()} ${signer[1].trim()}`, source: 'T2 lines 950 and 951' };
    out.signerTitle = { value: signer[3].trim(), source: 'T2 line 954' };
  }

  const income = amountOn(lines, /^Net income or \(loss\) for income tax purposes.*\b300\b/);
  if (income !== null) out.netIncomeForTax = { value: income, source: 'T2 line 300' };

  /* ---- Balance sheet (Schedule 100, by GIFI code) ---- */
  const reEnd = amountOn(lines, /^3849\b/);
  const re = reEnd ?? amountOn(lines, /^3600\b/);
  if (re !== null) {
    out.retainedEarnings = { value: re, source: `Schedule 100, line ${reEnd !== null ? '3849' : '3600'}` };
  }
  const shares = amountOn(lines, /^3500\b/);
  if (shares !== null) out.shareCapital = { value: shares, source: 'Schedule 100, line 3500' };
  const loan = amountOn(lines, /^2780\b/);
  if (loan !== null) out.dueToShareholder = { value: loan, source: 'Schedule 100, line 2780' };

  /* ---- Losses (Schedule 4) ---- */
  const losses = amountOn(lines, /^Closing balance of non-capital losses\b.*\b180\b/)
    ?? amountOn(lines, /^Non-capital losses before any request for a carryback/);
  if (losses !== null) out.lossesCarriedForward = { value: Math.abs(losses), source: 'Schedule 4, line 180' };

  return out;
}

/** The tax year that follows the one on the uploaded return. */
export function nextTaxYear(priorYearEnd: string): { yearStart: string; yearEnd: string } {
  const next = new Date(Date.parse(`${priorYearEnd}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return { yearStart: next, yearEnd: addMonths(priorYearEnd, 12) };
}

/** True when the PDF held enough of a T2 return to be worth offering. */
export function looksLikeReturn(found: PriorReturn): boolean {
  return Boolean(found.businessNumber && found.yearEnd);
}

/** Copies what was found into this year's return. Anything not found is left as it was. */
export function applyPriorReturn(data: ReturnData, found: PriorReturn): ReturnData {
  const year = found.yearEnd ? nextTaxYear(found.yearEnd.value) : null;
  return {
    ...data,
    screening: {
      ...data.screening,
      canadianPrivate: found.isCcpc?.value ? true : data.screening.canadianPrivate,
    },
    company: {
      ...data.company,
      legalName: found.legalName?.value ?? data.company.legalName,
      businessNumber: found.businessNumber?.value ?? data.company.businessNumber,
      province: found.province?.value ?? data.company.province,
      yearStart: year?.yearStart ?? data.company.yearStart,
      yearEnd: year?.yearEnd ?? data.company.yearEnd,
    },
    priorLosses: found.lossesCarriedForward?.value ?? data.priorLosses,
    balances: {
      ...data.balances,
      openingRetainedEarnings: found.retainedEarnings?.value ?? data.balances.openingRetainedEarnings,
      shareCapital: found.shareCapital?.value ?? data.balances.shareCapital,
    },
    owner: {
      name: found.signerName?.value ?? data.owner.name,
      title: found.signerTitle?.value ?? data.owner.title,
    },
  };
}
