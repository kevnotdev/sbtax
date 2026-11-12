'use client';

import React from 'react';
import { CircleCheck } from 'lucide-react';
import type { StepProps } from '../TaxApp';
import type { YearEndBalances } from '@/lib/tax-engine/types';
import { diagnoseImbalance } from '@/lib/tax-engine/advice';
import { isDate, isFirstYear } from '@/lib/tax-engine/calculator';
import { dateLong, money } from '@/lib/format';
import { Callout, MoneyField, Section, StepFooter, StepHeader, Suggestions, cx } from '../ui';

export function BalancesStep({ data, calc, update, go, next, back }: StepProps) {
  const b = data.balances;
  const bs = calc.balanceSheet;
  const firstYear = isFirstYear(data);
  const yearEnd = isDate(data.company.yearEnd) ? dateLong(data.company.yearEnd) : 'the last day of the tax year';
  const set = (key: keyof YearEndBalances) => (v: number | null) =>
    update(d => ({ ...d, balances: { ...d.balances, [key]: v } }));

  const enoughToCheck = b.cash !== null && b.shareCapital !== null;
  const diagnosis = enoughToCheck ? diagnoseImbalance(data, calc) : null;

  return (
    <>
      <StepHeader title="Where the company stood at year end">
        CRA asks for a snapshot of what the company had and what it owed on {yearEnd}. Your bank
        statement for that day covers most of it.
      </StepHeader>

      <Section title="What the company had">
        <div className="grid gap-5 sm:grid-cols-2">
          <MoneyField
            anchor="cash"
            label="Bank balance"
            hint="All company accounts, added together."
            value={b.cash}
            onChange={set('cash')}
            allowNegative
          />
          <MoneyField
            anchor="receivables"
            label="Unpaid invoices"
            hint="Invoices you’d sent that clients hadn’t paid yet."
            value={b.receivables}
            onChange={set('receivables')}
          />
        </div>
      </Section>

      <Section title="What the company owed">
        <div className="grid gap-5 sm:grid-cols-2">
          <MoneyField
            anchor="payables"
            label="Unpaid bills and credit card"
            hint="The card balance plus any bills not yet paid."
            value={b.payables}
            onChange={set('payables')}
          />
          <MoneyField
            anchor="salesTaxOwing"
            label="GST/HST not yet sent to CRA"
            hint="Collected from clients, less what you’d claimed. Negative if a refund was coming."
            value={b.salesTaxOwing}
            onChange={set('salesTaxOwing')}
            allowNegative
          />
          <MoneyField
            anchor="shareholderLoan"
            label="Owed to you"
            hint="Expenses you paid personally or money you lent the company, not yet repaid. Negative if you owed the company."
            value={b.shareholderLoan}
            onChange={set('shareholderLoan')}
            allowNegative
          />
        </div>
      </Section>

      {!calc.isNil && (
        <Section title="Paid out during the year">
          <div className="grid gap-5 sm:grid-cols-2">
            <MoneyField
              anchor="dividends"
            label="Dividends paid to you"
              hint="Not salary. Salary goes under Expenses."
              value={data.dividendsPaid}
              onChange={v => update(d => ({ ...d, dividendsPaid: v }))}
            />
            <MoneyField
              anchor="instalments"
            label="Tax instalments paid to CRA"
              hint="Payments toward this year’s corporate tax. Most small companies paid none."
              value={data.instalmentsPaid}
              onChange={v => update(d => ({ ...d, instalmentsPaid: v }))}
            />
          </div>
        </Section>
      )}

      <Section title={firstYear ? 'From when the company started' : 'Carried from earlier'}>
        <div className="grid gap-5 sm:grid-cols-2">
          <MoneyField
            anchor="shareCapital"
            label="Paid for the company’s shares"
            hint="Often $1 or $100. It’s on your incorporation documents."
            value={b.shareCapital}
            onChange={set('shareCapital')}
          />
          {!firstYear && (
            <MoneyField
              anchor="openingRetainedEarnings"
            label="Retained earnings, end of last year"
              hint="Last year’s return, Schedule 100, line 3600. Negative if it was a deficit."
              value={b.openingRetainedEarnings}
              onChange={set('openingRetainedEarnings')}
              allowNegative
            />
          )}
          {!firstYear && (
            <MoneyField
              anchor="priorLosses"
              label="Unused losses from earlier years"
              hint="Last year’s return, Schedule 4, closing balance of non-capital losses. Leave empty if the company has never had a loss. Losses older than 20 years no longer count."
              value={data.priorLosses}
              onChange={v => update(d => ({ ...d, priorLosses: v }))}
            />
          )}
        </div>
        {calc.lossApplied > 0 && (
          <p className="mt-4 text-sm text-sub">
            {money(calc.lossApplied)} of those losses comes off this year’s income.{' '}
            {calc.lossClosing > 0 ? `${money(calc.lossClosing)} is left for future years.` : 'None is left for future years.'}
          </p>
        )}
      </Section>

      <Section
        title="Do the books tie?"
        hint="What the company has must equal what it owes plus what belongs to you. CRA rejects a return where the two sides differ."
      >
        <div className="grid gap-x-10 gap-y-6 text-[0.9375rem] sm:grid-cols-2">
          <Statement
            title="Has"
            rows={[
              ['Bank', bs.cash],
              ['Unpaid invoices', bs.receivables],
              bs.equipment > 0 && ['Equipment, after write-offs', bs.equipment, true],
              bs.taxesReceivable > 0 && ['Tax refunds coming', bs.taxesReceivable, true],
              bs.dueFromShareholder > 0 && ['Owed by you', bs.dueFromShareholder],
            ]}
            total={bs.totalAssets}
          />
          <Statement
            title="Owes, plus what’s yours"
            rows={[
              ['Bills and credit card', bs.payables],
              bs.taxesPayable > 0 && ['Taxes owing', bs.taxesPayable, true],
              bs.dueToShareholder > 0 && ['Owed to you', bs.dueToShareholder],
              ['Shares', bs.shareCapital],
              ['Retained earnings', bs.retainedEarnings, true],
            ]}
            total={bs.totalLiabilitiesAndEquity}
          />
        </div>
        <p className="mt-3 text-sm text-faint">Figures in italics are calculated from your other answers.</p>

        <div className="mt-5" data-anchor="books-check">
          {!enoughToCheck ? (
            <Callout>Add the bank balance and the amount paid for shares, and we’ll check the two sides.</Callout>
          ) : bs.balanced ? (
            <p className="flex items-center gap-2.5 font-medium text-spruce-700">
              <CircleCheck className="h-5 w-5" aria-hidden /> Both sides match.
            </p>
          ) : diagnosis && (
            <Callout tone="warn" title={diagnosis.title}>
              <p>{diagnosis.why}</p>
              <p className="mt-2">
                Check each number against your statements first. Only use a one-tap fix if it
                describes what really happened.
              </p>
              <div className="mt-4">
                <Suggestions items={diagnosis.suggestions} update={update} go={go} />
              </div>
            </Callout>
          )}
        </div>
      </Section>

      <StepFooter onBack={back} onNext={next} nextLabel="Review the return" />
    </>
  );
}

type StatementRow = [label: string, amount: number, calculated?: boolean] | false;

function Statement({ title, rows, total }: { title: string; rows: StatementRow[]; total: number }) {
  return (
    <div>
      <h3 className="border-b border-line pb-2 text-sm font-semibold text-sub">{title}</h3>
      <dl>
        {rows.filter((r): r is Exclude<StatementRow, false> => Boolean(r)).map(([label, amount, calculated]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className={cx('text-sub', calculated && 'italic')}>{label}</dt>
            <dd className={cx('tabular-nums', calculated && 'italic')}>{money(amount)}</dd>
          </div>
        ))}
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-line pt-2.5 font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{money(total)}</dd>
        </div>
      </dl>
    </div>
  );
}
