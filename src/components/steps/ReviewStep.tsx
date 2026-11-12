'use client';

import React from 'react';
import { ChevronRight, CircleCheck } from 'lucide-react';
import type { StepProps } from '../TaxApp';
import type { Calculation, ReturnData } from '@/lib/tax-engine/types';
import { issueTarget, readyToFile, type Issue } from '@/lib/tax-engine/checks';
import {
  ASSET_KINDS, EXPENSE_CATEGORY_BY_ID, FEDERAL_ABATEMENT, FEDERAL_BASE_RATE, PROVINCES, SMALL_BUSINESS_DEDUCTION,
} from '@/lib/tax-engine/rates';
import { dateLong, formatBusinessNumber, money, percent } from '@/lib/format';
import { Row, Section, StepFooter, StepHeader, Suggestions } from '../ui';

export function ReviewStep({ data, calc, issues, update, go, next, back }: StepProps) {
  const blockers = issues.filter(i => i.level === 'blocker' && i.step !== 'file');
  const warnings = issues.filter(i => i.level === 'warning');
  const notes = issues.filter(i => i.level === 'note');
  const ready = readyToFile(issues);
  const province = data.company.province ? PROVINCES[data.company.province].name : 'Provincial';

  return (
    <>
      <StepHeader title="Review the return">
        Everything you’ve entered, checked and added up. Look it over the way you’d read a bank
        statement before filing.
      </StepHeader>

      {ready ? (
        <p className="flex items-center gap-2.5 text-[1.0625rem] font-medium text-spruce-700">
          <CircleCheck className="h-5 w-5" aria-hidden /> Everything checks out. The return is ready to file.
        </p>
      ) : (
        <div className="rounded-2xl border border-bad-line bg-bad-bg p-2">
          <h2 className="px-3 pb-1 pt-2 font-semibold text-bad-ink">
            {blockers.length === 1 ? 'One thing to fix before filing' : `${blockers.length} things to fix before filing`}
          </h2>
          <IssueList items={blockers} go={go} update={update} tone="bad" />
        </div>
      )}

      {warnings.length > 0 && (
        <Section title="Worth a second look">
          <div className="-mx-3"><IssueList items={warnings} go={go} update={update} /></div>
        </Section>
      )}

      <Section title="How the tax was worked out">
        <div className="divide-y divide-line border-y border-line text-[0.9375rem]">
          {calc.isNil ? (
            <Row label="No activity this year" value={money(0)} />
          ) : (
            <>
              <Row label="Revenue" value={money(calc.revenue)} />
              <Row label="Expenses" value={money(-calc.operatingExpenses)} />
              {calc.cca.total > 0 && <Row label="Equipment write-off" value={money(-calc.cca.total)} />}
              <Row strong label="Profit before tax" value={money(calc.incomeBeforeTax)} />
              {calc.mealsNonDeductible > 0 && (
                <Row
                  label="Half of meals, added back"
                  sub="Only 50% of meals and entertainment is deductible"
                  value={money(calc.mealsNonDeductible)}
                />
              )}
              <Row strong label="Taxable income" value={money(calc.taxableIncome)} />
              <Row
                label={`Federal tax at ${percent(calc.federalRate)}`}
                sub="The small business rate for Canadian-controlled private companies"
                value={money(calc.federalTax)}
              />
              <Row label={`${province} tax at ${percent(calc.provincialRate)}`} value={money(calc.provincialTax)} />
              <Row strong label="Total tax for the year" value={money(calc.totalTax)} />
              {calc.instalmentsPaid > 0 && <Row label="Instalments already paid" value={money(-calc.instalmentsPaid)} />}
            </>
          )}
          <div className="py-1 text-base">
            <Row strong label={calc.balanceOwing < 0 ? 'Refund' : 'Balance owing'} value={money(Math.abs(calc.balanceOwing))} />
          </div>
        </div>
        {calc.filingDue && calc.balanceDue && (
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-sub">
            {calc.balanceOwing > 0 && (
              <>Pay CRA by <span className="font-medium text-ink">{dateLong(calc.balanceDue)}</span> to avoid interest. </>
            )}
            The return is due by <span className="font-medium text-ink">{dateLong(calc.filingDue)}</span>.
          </p>
        )}
      </Section>

      {notes.length > 0 && (
        <Section title="Also on your list" hint="These are separate from the T2 return, so they’re easy to miss.">
          <ul className="space-y-4">
            {notes.map(n => (
              <li key={n.id}>
                <p className="font-medium text-ink">{n.title}</p>
                <p className="mt-0.5 text-[0.9375rem] leading-relaxed text-sub">{n.detail}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="The forms in this return"
        hint="Your answers, placed on the CRA forms and line numbers they belong to. Open any form to see its lines."
      >
        <div className="divide-y divide-line border-y border-line">
          {buildForms(data, calc).map(form => (
            <details key={form.code} className="group">
              <summary className="flex items-center gap-3 rounded-lg py-3.5 transition-colors duration-150 hover:bg-ground">
                <ChevronRight className="h-4 w-4 shrink-0 text-faint transition-transform duration-200 group-open:rotate-90" aria-hidden />
                <span className="w-[6.5rem] shrink-0 font-medium text-ink">{form.code}</span>
                <span className="min-w-0 text-[0.9375rem] text-sub">{form.name}</span>
              </summary>
              <table className="mb-4 ml-7 w-[calc(100%-1.75rem)] text-sm">
                <thead className="sr-only">
                  <tr><th>Line</th><th>Description</th><th>Value</th></tr>
                </thead>
                <tbody>
                  {form.lines.map((l, i) => (
                    <tr key={`${l.line}-${i}`} className="border-t border-line first:border-0">
                      <td className="w-14 py-1.5 align-baseline tabular-nums text-faint">{l.line}</td>
                      <td className="py-1.5 pr-3 align-baseline text-sub">{l.label}</td>
                      <td className="py-1.5 text-right align-baseline tabular-nums text-ink">{l.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
        </div>
      </Section>

      <StepFooter onBack={back} onNext={next} nextLabel="Continue to filing" nextDisabled={!ready} />
    </>
  );
}

/**
 * Each problem opens the screen and field where it gets fixed. Problems with known
 * causes also list their fixes right here, so the likely one is a single tap.
 */
function IssueList({
  items, go, update, tone,
}: { items: Issue[]; go: StepProps['go']; update: StepProps['update']; tone?: 'bad' }) {
  const bad = tone === 'bad';
  return (
    <ul className={bad ? 'divide-y divide-bad-line/60' : undefined}>
      {items.map(i => {
        const target = issueTarget(i);
        return (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => go(target.step, target.anchor)}
              className={
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 ' +
                (bad ? 'hover:bg-white/70' : 'hover:bg-ground')
              }
            >
              <span className="min-w-0 flex-1">
                <span className={'block font-medium ' + (bad ? 'text-bad-ink' : 'text-ink')}>{i.title}</span>
                {i.detail && (
                  <span className={'block text-[0.9375rem] leading-relaxed ' + (bad ? 'text-bad-ink/90' : 'text-sub')}>
                    {i.detail}
                  </span>
                )}
              </span>
              <span
                className={
                  'flex shrink-0 items-center gap-1 text-sm font-semibold ' + (bad ? 'text-bad-ink' : 'text-spruce-700')
                }
              >
                {bad ? 'Fix' : 'Check'} <ChevronRight className="h-4 w-4" aria-hidden />
              </span>
            </button>
            {i.suggestions && i.suggestions.length > 0 && (
              <div className={'px-3 pb-3 pt-1 ' + (bad ? 'text-bad-ink' : 'text-ink')}>
                <Suggestions items={i.suggestions} update={update} go={go} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

interface FormLine { line: string; label: string; value: string }
interface Form { code: string; name: string; lines: FormLine[] }

/** Maps the calculation onto CRA form lines and GIFI codes for the person to inspect. */
function buildForms(data: ReturnData, calc: Calculation): Form[] {
  const c = data.company;
  const bs = calc.balanceSheet;
  const m = (n: number) => money(n);
  const sbdBase = Math.min(calc.taxableIncome, calc.businessLimit);

  const forms: Form[] = [
    {
      code: 'T2',
      name: 'Corporation income tax return',
      lines: [
        { line: '001', label: 'Business number', value: c.businessNumber ? `${formatBusinessNumber(c.businessNumber)} RC0001` : '' },
        { line: '002', label: 'Corporation’s name', value: c.legalName },
        { line: '060', label: 'Tax year start', value: c.yearStart },
        { line: '061', label: 'Tax year end', value: c.yearEnd },
        { line: '300', label: 'Net income for income tax purposes', value: m(calc.netIncomeForTax) },
        { line: '360', label: 'Taxable income', value: m(calc.taxableIncome) },
        { line: '400', label: 'Income from active business', value: m(calc.taxableIncome) },
        { line: '410', label: 'Business limit', value: m(calc.businessLimit) },
        { line: '430', label: `Small business deduction (${percent(SMALL_BUSINESS_DEDUCTION)})`, value: m(sbdBase * SMALL_BUSINESS_DEDUCTION) },
        { line: '550', label: `Base amount of Part I tax (${percent(FEDERAL_BASE_RATE)})`, value: m(calc.taxableIncome * FEDERAL_BASE_RATE) },
        { line: '608', label: `Federal tax abatement (${percent(FEDERAL_ABATEMENT)})`, value: m(calc.taxableIncome * FEDERAL_ABATEMENT) },
        { line: '700', label: 'Part I tax payable', value: m(calc.federalTax) },
        { line: '760', label: 'Provincial or territorial tax', value: m(calc.provincialTax) },
        { line: '770', label: 'Total tax payable', value: m(calc.totalTax) },
        { line: '840', label: 'Tax instalments paid', value: m(calc.instalmentsPaid) },
        { line: '', label: calc.balanceOwing < 0 ? 'Refund' : 'Balance owing', value: m(Math.abs(calc.balanceOwing)) },
      ],
    },
  ];

  if (!calc.isNil) {
    forms.push({
      code: 'Schedule 1',
      name: 'Profit on the books, adjusted to profit for tax',
      lines: [
        { line: '', label: 'Net income after tax, from Schedule 125', value: m(calc.netIncomeAfterTax) },
        { line: '101', label: 'Add: provision for income taxes', value: m(calc.totalTax) },
        { line: '104', label: 'Add: amortization of tangible assets', value: m(calc.amortization) },
        { line: '121', label: 'Add: non-deductible meals and entertainment', value: m(calc.mealsNonDeductible) },
        { line: '403', label: 'Deduct: capital cost allowance, from Schedule 8', value: m(calc.cca.total) },
        { line: '', label: 'Net income for income tax purposes', value: m(calc.netIncomeForTax) },
      ],
    });

    const used = calc.cca.classes.filter(k => k.opening > 0 || k.additions > 0);
    if (used.length > 0) {
      forms.push({
        code: 'Schedule 8',
        name: 'Capital cost allowance on equipment',
        lines: used.flatMap(k => [
          { line: `Cl. ${k.classNumber}`, label: `${ASSET_KINDS[k.kind].label}: balance at start of year`, value: m(k.opening) },
          { line: '', label: 'Bought this year', value: m(k.additions) },
          { line: '', label: `Deducted this year (class rate ${percent(k.rate)})`, value: m(k.claim) },
          { line: '', label: 'Balance at end of year', value: m(k.closing) },
        ]),
      });
    }
  }

  forms.push({
    code: 'Schedule 50',
    name: 'Shareholder information',
    lines: [
      { line: '100', label: 'Shareholder', value: data.owner.name || 'Added when you file' },
      { line: '400', label: 'Common shares held', value: '100%' },
    ],
  });

  forms.push({
    code: 'Schedule 100',
    name: 'Balance sheet',
    lines: [
      { line: '1000', label: 'Cash and deposits', value: m(bs.cash) },
      { line: '1060', label: 'Accounts receivable', value: m(bs.receivables) },
      ...(bs.taxesReceivable > 0 ? [{ line: '1066', label: 'Taxes receivable', value: m(bs.taxesReceivable) }] : []),
      ...(bs.dueFromShareholder > 0 ? [{ line: '1301', label: 'Due from shareholder', value: m(bs.dueFromShareholder) }] : []),
      ...(bs.equipment > 0 ? [{ line: '2008', label: 'Tangible capital assets, net of amortization', value: m(bs.equipment) }] : []),
      { line: '2599', label: 'Total assets', value: m(bs.totalAssets) },
      { line: '2620', label: 'Amounts payable and accrued liabilities', value: m(bs.payables) },
      { line: '2680', label: 'Taxes payable', value: m(bs.taxesPayable) },
      ...(bs.dueToShareholder > 0 ? [{ line: '2780', label: 'Due to shareholder', value: m(bs.dueToShareholder) }] : []),
      { line: '3499', label: 'Total liabilities', value: m(bs.totalLiabilities) },
      { line: '3500', label: 'Common shares', value: m(bs.shareCapital) },
      { line: '3660', label: 'Retained earnings, start of year', value: m(bs.openingRetainedEarnings) },
      { line: '3680', label: 'Net income for the year', value: m(calc.netIncomeAfterTax) },
      { line: '3700', label: 'Dividends declared', value: m(-bs.dividends) },
      { line: '3849', label: 'Retained earnings, end of year', value: m(bs.retainedEarnings) },
      { line: '3620', label: 'Total shareholder equity', value: m(bs.totalEquity) },
      { line: '3640', label: 'Total liabilities and shareholder equity', value: m(bs.totalLiabilitiesAndEquity) },
    ],
  });

  // Several plain-language categories can share one GIFI code; CRA sees them combined.
  const byCode = new Map<string, number>();
  for (const e of calc.expensesByCategory) {
    const code = EXPENSE_CATEGORY_BY_ID[e.category].gifi;
    byCode.set(code, (byCode.get(code) ?? 0) + e.amount);
  }
  const GIFI_NAMES: Record<string, string> = {
    '8520': 'Advertising and promotion', '8523': 'Meals and entertainment', '8622': 'Employer’s portion of employee benefits',
    '8690': 'Insurance', '8710': 'Interest and bank charges', '8760': 'Business taxes, licences and memberships',
    '8810': 'Office expenses', '8860': 'Professional fees', '8910': 'Rental', '9060': 'Salaries and wages',
    '9110': 'Sub-contracts', '9150': 'Computer-related expenses', '9200': 'Travel expenses',
    '9225': 'Telephone and telecommunications', '9270': 'Other expenses', '9281': 'Vehicle expenses',
  };
  forms.push({
    code: 'Schedule 125',
    name: 'Income statement',
    lines: [
      { line: '8000', label: 'Trade sales of goods and services', value: m(calc.revenue) },
      { line: '8299', label: 'Total revenue', value: m(calc.revenue) },
      ...(calc.amortization > 0 ? [{ line: '8670', label: 'Amortization of tangible assets', value: m(calc.amortization) }] : []),
      ...[...byCode].sort(([a], [b]) => a.localeCompare(b)).map(([code, amount]) => ({
        line: code, label: GIFI_NAMES[code] ?? 'Expense', value: m(amount),
      })),
      { line: '9368', label: 'Total expenses', value: m(calc.totalExpenses) },
      { line: '9970', label: 'Net income before taxes', value: m(calc.incomeBeforeTax) },
      { line: '9990', label: 'Current income taxes', value: m(calc.totalTax) },
      { line: '9999', label: 'Net income after taxes', value: m(calc.netIncomeAfterTax) },
    ],
  });

  forms.push({
    code: 'Schedule 141',
    name: 'Who prepared the financial information',
    lines: [
      { line: '095', label: 'Prepared by an accountant with a professional designation?', value: 'No' },
      { line: '', label: 'Prepared by', value: 'The corporation' },
    ],
  });

  return forms;
}
