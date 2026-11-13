/**
 * Vendor-agnostic reader for a printed Canadian T2 return (the "client copy" PDF that
 * UFile, Taxprep, ProFile, TurboTax and others produce).
 *
 * Two stages:
 *   1. Segmentation: each page is assigned to the form it belongs to (T2 jacket, Schedule 4,
 *      Schedule 100 ...). Line numbers repeat across forms, so nothing is read before this.
 *   2. Extraction: inside a form, values are picked up by their official identifier only:
 *      4-digit GIFI codes on Schedules 100 and 125, CRA line numbers everywhere else.
 *      Descriptions are ignored, because every vendor words them differently.
 *
 * No coordinates, bounding boxes or per-vendor templates are used. The only use of position
 * is rebuilding reading order from the PDF's loose text (`itemsToLines`), which every text
 * PDF needs. Everything runs on plain strings, so it works in the browser and in tests.
 *
 * Checked against a real UFile printout and an invented condensed layout. Other vendors
 * are expected to work but have not been tried.
 */

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

/** One piece of text from a PDF page, with where it sits. Matches what pdf.js reports. */
export interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

/** Marks a column break inside a line. */
export const COLUMN = '  |  ';

/** Rebuilds the reading-order lines of one page. Wide gaps become column breaks. */
export function itemsToLines(items: TextItem[]): string[] {
  const sorted = items.filter(i => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: { y: number; items: TextItem[] }[] = [];
  for (const item of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - item.y) < 3) last.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  return rows.map(row => {
    const cells: string[] = [''];
    let end: number | null = null;
    for (const item of row.items.sort((a, b) => a.x - b.x)) {
      const gap: number = end === null ? 0 : item.x - end;
      if (gap > 12) cells.push('');
      else if (gap > 1.5) cells[cells.length - 1] += ' ';
      cells[cells.length - 1] += item.str;
      end = item.x + item.width;
    }
    return cells.map(cleanCell).filter(Boolean).join(COLUMN);
  });
}

/** Dotted leaders and runs of spaces carry no information and make lines hard to match. */
function cleanCell(cell: string): string {
  return cell.replace(/( ?\.){3,}/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

const cells = (line: string) => line.split('|').map(c => c.trim()).filter(Boolean);

const AMOUNT = String.raw`\(?\s*\$?\s*\(?\s*-?\s*\$?\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*\)?`;

/**
 * Normalises a printed amount to a signed number.
 * "5,449" -> 5449, "(21,639 )" -> -21639, "$(1,250.00)" -> -1250, "-1,250.00" -> -1250.
 * null when the text is not an amount.
 */
export function parseAmount(text: string): number | null {
  const t = text.trim();
  if (!new RegExp(`^${AMOUNT}$`).test(t)) return null;
  const digits = t.replace(/[^\d.]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n)) return null;
  const negative = /[(-]/.test(t);
  return negative && n !== 0 ? -n : n;
}

/* ------------------------------------------------------------------ */
/* Stage 1: which form is each page?                                   */
/* ------------------------------------------------------------------ */

/** "t2_jacket", "schedule_100", or "other" for covers, summaries and anything unrecognised. */
export type FormId = string;

export interface Segment {
  form: FormId;
  /** 1-based page numbers, in order. */
  pages: number[];
  lines: string[];
}

const scheduleId = (n: string) => `schedule_${Number(n)}`;

/** Pages a tax program adds around the return. They repeat figures without their line numbers. */
const NOT_A_FORM = /summary|diagnostic|bar ?code|carry ?forward schedule|assembly|instructions|T183|engagement|letter|invoice/i;

function classifyPage(lines: string[]): FormId | null {
  const top = lines.slice(0, 8);
  const bottom = lines.slice(-4);

  // 1. CRA form identifiers, printed in the footer of facsimile pages ("T2 SCH 4 E (25)", "T2 E (26)").
  for (const line of [...bottom, ...top]) {
    const sch = /\bT2\s?SCH\s?(\d{1,3})\b/i.exec(line);
    if (sch) return scheduleId(sch[1]);
    if (/\bT2 E \(\d{2}\)/.test(line)) return 't2_jacket';
    if (/\bT183\b/.test(line)) return 'other';
  }
  // 2. The program's own pages. Checked before schedule headings because a summary page
  //    lists schedule names in its rows.
  if (lines.slice(0, 4).some(line => NOT_A_FORM.test(line))) return 'other';
  // 3. A heading that is the schedule's name: "Schedule 4", "SCHEDULE 100", "Schedule 100 - Balance Sheet".
  for (const line of top) {
    for (const cell of cells(line)) {
      const m = /^schedule\s+(\d{1,3})(?:\s*[–—:-]\s*\S.*)?$/i.exec(cell);
      if (m) return scheduleId(m[1]);
    }
  }
  // 4. Official form titles.
  for (const line of top) {
    if (/\bT2 Corporation Income Tax Return\b/i.test(line)) return 't2_jacket';
    if (/BALANCE SHEET INFORMATION/i.test(line)) return 'schedule_100';
    if (/INCOME STATEMENT INFORMATION/i.test(line)) return 'schedule_125';
  }
  return null;
}

/** Groups pages under the form they belong to. A page with no heading continues the form before it. */
export function segmentDocument(pages: string[][]): Segment[] {
  const byForm = new Map<FormId, Segment>();
  let current: FormId = 'other';
  pages.forEach((lines, index) => {
    current = classifyPage(lines) ?? current;
    const segment = byForm.get(current) ?? { form: current, pages: [], lines: [] };
    segment.pages.push(index + 1);
    segment.lines.push(...lines);
    byForm.set(current, segment);
  });
  return [...byForm.values()];
}

/* ------------------------------------------------------------------ */
/* Stage 2: values by official identifier                              */
/* ------------------------------------------------------------------ */

type Values = Record<string, number | null>;

/**
 * GIFI statements: every 4-digit code and the amount on its line. A code printed with no
 * amount is null (not stated), which is different from a printed zero.
 */
export function extractGifi(lines: string[]): Values {
  const out: Values = {};
  const set = (code: string, value: number | null) => {
    if (!(code in out) || (out[code] === null && value !== null)) out[code] = value;
  };
  const trailing = new RegExp(`(?:^|[\\s|])([1-9]\\d{3})\\s*(?:\\|\\s*)?(${AMOUNT})\\s*$`);
  const lastToken = new RegExp(`\\s(${AMOUNT})\\s*$`);
  for (const line of lines) {
    // Usual layout: the code leads the line.
    const lead = /^([1-9]\d{3})\b(?![-/.,\d])/.exec(line);
    if (lead) {
      const rest = line.slice(4);
      if (rest.includes('|')) {
        // The amount has its own column. Anything else there ("-", "+=") means nothing was entered.
        set(lead[1], parseAmount(cells(rest).pop() ?? ''));
      } else {
        // Condensed layout: the amount, if any, is the last thing after the description.
        const m = lastToken.exec(rest);
        set(lead[1], m && /[A-Za-z)]/.test(rest.slice(0, m.index)) ? parseAmount(m[1]) : null);
      }
      continue;
    }
    // Some programs print the code after the description: "Cash and deposits 1000 25,000".
    const trail = trailing.exec(line);
    if (trail) set(trail[1], parseAmount(trail[2]));
  }
  return out;
}

/**
 * CRA line numbers that hold amounts, for the forms this reader has been checked against.
 * On these forms only these lines are read, and each one is always present in the output:
 * a number when the return states one, null when it does not.
 */
export const LINE_CATALOGUE: Record<FormId, string[]> = {
  // 300 net income for tax, 331 losses applied, 360 taxable income, 400 active business income,
  // 410 business limit, 430 small business deduction, 550 base Part I tax, 608 abatement,
  // 700 Part I tax, 760 provincial tax, 770 total tax, 840 instalments.
  t2_jacket: ['300', '331', '360', '400', '410', '430', '550', '608', '700', '760', '770', '840'],
  // Non-capital loss continuity: 102 opening, 110 this year's loss, 130 applied, 180 closing,
  // 901 to 903 carried back to each of the three previous years.
  schedule_4: ['100', '102', '105', '110', '130', '135', '140', '150', '180', '901', '902', '903'],
};

/**
 * Tax forms: CRA line numbers that are followed by an amount.
 * References in running text ("enter the amount from line 130") are skipped.
 *
 * With a catalogue, only those lines are read. Without one, the form is one this reader has
 * not been checked against: every line-and-amount pair is taken, except where the "amount"
 * is a bare number under 1,000, because forms print line numbers side by side ("600 | 602")
 * and a small plain number cannot be told apart from one.
 */
export function extractLines(lines: string[], catalogue?: string[]): Values {
  const out: Values = {};
  const wanted = catalogue ? new Set(catalogue) : null;
  for (const line of catalogue ?? []) out[line] = null;
  const pair = new RegExp(
    `(^|[^\\d,.$(\\w/-])(\\d{3})(?:\\s*\\|\\s*|\\s+)(${AMOUNT})(?:\\s?\\d?[A-Z])?(?=\\s*(?:\\||$))`, 'g',
  );
  for (const line of lines) {
    for (const m of line.matchAll(pair)) {
      const code = m[2];
      if (wanted && !wanted.has(code)) continue;
      const before = line.slice(0, m.index + m[1].length);
      if (/\b(?:lines?|to|and|or|page|pages|of|plus|minus)\s*$/i.test(before)) continue;
      const value = parseAmount(m[3]);
      if (value === null) continue;
      if (!wanted && value !== 0 && Math.abs(value) < 1000 && /^\d+$/.test(m[3].trim())) continue;
      if (out[code] === undefined || out[code] === null) out[code] = value;
    }
  }
  return out;
}

/** Text fields on the T2 jacket, each tied to its line number. */
function extractJacketText(lines: string[]) {
  const text = lines.join('\n');
  const iso = (y: string, m: string, d: string) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const date = (line: string) => {
    const m = new RegExp(`\\b${line}\\s*\\|?\\s*(\\d{4})[\\s/-]+(\\d{1,2})[\\s/-]+(\\d{1,2})\\b`).exec(text);
    return m ? iso(m[1], m[2], m[3]) : null;
  };
  const bn = /\b001\s*\|?\s*(\d{5})\s?(\d{4})\s?(RC)\s?(\d{4})\b/.exec(text) ?? /\b(\d{5})\s?(\d{4})\s?(RC)\s?(\d{4})\b/.exec(text);
  const name = lines.map(l => /^002\s*\|?\s*(\S.*)$/.exec(l)?.[1]).find(Boolean);
  const province = /\b750\s*\|?\s*([A-Z]{2})\b/.exec(text)?.[1] ?? null;
  const ccpc = /^X\s*\|?\s*1\s+Canadian-controlled private corporation/m.test(text)
    || /\b040\b[^\n]*\b1\b[^\n]*Canadian-controlled/i.test(text) && !/^X\s+[2-5]\s/m.test(text);
  const one = (line: string) => new RegExp(`\\b${line}\\s+([^|\\n,]+?)\\s*(?:\\||,|$)`, 'm').exec(text)?.[1].trim() ?? null;
  return {
    line_001: bn ? `${bn[1]}${bn[2]}${bn[3]}${bn[4]}` : null,
    line_002: name ? cells(name)[0] : null,
    line_040: ccpc ? 1 : null,
    line_060: date('060'),
    line_061: date('061'),
    line_750: province,
    line_950: one('950'),
    line_951: one('951'),
    line_954: one('954'),
  };
}

/* ------------------------------------------------------------------ */
/* Output                                                              */
/* ------------------------------------------------------------------ */

export interface T2Extraction {
  metadata: {
    /** The calendar year the tax year ends in, which is how CRA names a tax year. */
    tax_year: string | null;
    tax_year_start: string | null;
    tax_year_end: string | null;
    /** Nine digits plus the program account, for example 123456789RC0001. */
    business_number: string | null;
    detected_software_vendor: string;
    /** Every form found, including ones whose values are not extracted. */
    forms_found: string[];
  };
  t2_jacket: Record<string, string | number | null>;
  schedules: Record<string, { gifi_items: Values } | Values>;
}

const VENDORS: [RegExp, string][] = [
  [/ufile/i, 'UFile'], [/taxprep/i, 'Taxprep'], [/profile/i, 'ProFile'], [/turbotax/i, 'TurboTax'],
  [/futuretax/i, 'FutureTax'], [/taxcycle/i, 'TaxCycle'], [/cantax/i, 'Cantax'],
];

export function detectVendor(creator: string | undefined, pages: string[][]): string {
  const haystack = `${creator ?? ''}\n${pages.slice(0, 3).flat().join('\n')}`;
  return VENDORS.find(([test]) => test.test(haystack))?.[1] ?? 'Unknown';
}

const GIFI_FORMS = new Set(['schedule_100', 'schedule_125']);

/** Runs both stages. `pages` is the text of each page, one string per line. */
export function extractT2(pages: string[][], creator?: string): T2Extraction {
  const segments = segmentDocument(pages);
  const jacketLines = segments.find(s => s.form === 't2_jacket')?.lines ?? [];
  const text = extractJacketText(jacketLines);
  const numeric = extractLines(jacketLines, LINE_CATALOGUE.t2_jacket);

  const t2_jacket: T2Extraction['t2_jacket'] = { ...text };
  for (const [line, value] of Object.entries(numeric)) t2_jacket[`line_${line}`] = value;

  const schedules: T2Extraction['schedules'] = {};
  for (const segment of segments) {
    if (!segment.form.startsWith('schedule_')) continue;
    if (GIFI_FORMS.has(segment.form)) {
      schedules[segment.form] = { gifi_items: extractGifi(segment.lines) };
    } else {
      const values: Values = {};
      const found = extractLines(segment.lines, LINE_CATALOGUE[segment.form]);
      for (const [line, value] of Object.entries(found)) values[`line_${line}`] = value;
      schedules[segment.form] = values;
    }
  }

  // Programs that print no jacket page still put the year and business number on a cover page.
  const all = pages.flat().join('\n');
  const range = /(\d{4}-\d{2}-\d{2})\s*\|?\s*(?:to|To:?)\s*\|?\s*(\d{4}-\d{2}-\d{2})/.exec(all);
  const start = text.line_060 ?? range?.[1] ?? null;
  const end = text.line_061 ?? range?.[2] ?? null;
  const anyBn = /\b(\d{5})\s?(\d{4})\s?RC\s?(\d{4})\b/.exec(all);

  return {
    metadata: {
      tax_year: end ? end.slice(0, 4) : null,
      tax_year_start: start,
      tax_year_end: end,
      business_number: text.line_001 ?? (anyBn ? `${anyBn[1]}${anyBn[2]}RC${anyBn[3]}` : null),
      detected_software_vendor: detectVendor(creator, pages),
      forms_found: segments.map(s => s.form).filter(f => f !== 'other'),
    },
    t2_jacket,
    schedules,
  };
}
