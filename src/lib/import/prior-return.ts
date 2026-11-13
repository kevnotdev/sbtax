import { addMonths, isDate } from '../tax-engine/calculator';
import type { Province, ReturnData } from '../tax-engine/types';
import { PROVINCES } from '../tax-engine/rates';
import { extractT2, type T2Extraction } from './t2-extract';

/**
 * Turns an extracted prior-year T2 (see t2-extract.ts) into the few values that carry
 * into this year's return. Each value keeps the form line it came from, so the person
 * can check it against their copy before using it.
 */

export interface Found<T> {
  value: T;
  /** Where on the return it was read from. */
  source: string;
}

export interface PriorReturn {
  /** The program that produced the PDF, when it can be told. */
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
  /** That year's profit or loss for tax, shown so the person can confirm it is the right return. */
  netIncomeForTax?: Found<number>;
  /** The return has a Schedule 8, so there are equipment balances this reader does not pick up yet. */
  hasEquipmentSchedule: boolean;
}

const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function fromExtraction(x: T2Extraction): PriorReturn {
  const out: PriorReturn = { hasEquipmentSchedule: x.metadata.forms_found.includes('schedule_8') };
  const j = x.t2_jacket;
  const gifi = (x.schedules.schedule_100 as { gifi_items?: Record<string, number | null> } | undefined)?.gifi_items ?? {};
  const s4 = (x.schedules.schedule_4 ?? {}) as Record<string, number | null>;

  if (x.metadata.detected_software_vendor !== 'Unknown') out.software = x.metadata.detected_software_vendor;

  const bn = x.metadata.business_number;
  if (bn) out.businessNumber = { value: bn.slice(0, 9), source: 'T2 line 001' };
  const name = str(j.line_002);
  if (name) out.legalName = { value: name, source: 'T2 line 002' };

  const { tax_year_start: start, tax_year_end: end } = x.metadata;
  if (start && end && isDate(start) && isDate(end)) {
    out.yearStart = { value: start, source: 'T2 line 060' };
    out.yearEnd = { value: end, source: 'T2 line 061' };
  }

  const province = str(j.line_750) as Province | null;
  if (province && province in PROVINCES) out.province = { value: province, source: 'T2 line 750' };
  if (j.line_040 === 1) out.isCcpc = { value: true, source: 'T2 line 040' };

  const last = str(j.line_950);
  const first = str(j.line_951);
  if (last || first) out.signerName = { value: [first, last].filter(Boolean).join(' '), source: 'T2 lines 950 and 951' };
  const title = str(j.line_954);
  if (title) out.signerTitle = { value: title, source: 'T2 line 954' };

  const income = num(j.line_300);
  if (income !== null) out.netIncomeForTax = { value: income, source: 'T2 line 300' };

  // 3849 is retained earnings at the end of the year; 3600 is the same figure on the balance sheet.
  const reCode = num(gifi['3849']) !== null ? '3849' : '3600';
  const re = num(gifi[reCode]);
  if (re !== null) out.retainedEarnings = { value: re, source: `Schedule 100, GIFI ${reCode}` };
  const shares = num(gifi['3500']);
  if (shares !== null) out.shareCapital = { value: shares, source: 'Schedule 100, GIFI 3500' };

  const losses = num(s4.line_180);
  if (losses !== null) out.lossesCarriedForward = { value: Math.abs(losses), source: 'Schedule 4, line 180' };

  return out;
}

/** Reads a prior-year return from the text of its pages. */
export function parsePriorReturn(pages: string[][], creator?: string): PriorReturn {
  return fromExtraction(extractT2(pages, creator));
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
