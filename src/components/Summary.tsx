'use client';

import React from 'react';
import { dateLong, money, percent } from '@/lib/format';
import type { StepId } from '@/lib/tax-engine/checks';
import { PROVINCES } from '@/lib/tax-engine/rates';
import type { Calculation, ReturnData } from '@/lib/tax-engine/types';
import { cx } from './ui';

/** The running return: every figure links to the step that produced it. */
export function Summary({
  data, calc, go,
}: { data: ReturnData; calc: Calculation; go: (s: StepId) => void }) {
  const hasNumbers = data.hadActivity !== null;
  const refund = calc.balanceOwing < 0;
  const province = data.company.province ? PROVINCES[data.company.province].name : 'Provincial';

  if (!hasNumbers) {
    return (
      <div className="rounded-2xl bg-ground p-6">
        <p className="text-sm font-medium text-sub">Tax owing</p>
        <p className="mt-1 text-[2rem] font-semibold leading-none tracking-[-0.03em] text-line-strong tabular-nums">$0.00</p>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-sub">
          Your tax is worked out here as you enter numbers, so there are no surprises at the end.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-ground p-6">
      <p className="text-sm font-medium text-sub">{refund ? 'Refund' : 'Tax owing'}</p>
      <p className="mt-1 text-[2rem] font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums">
        {money(Math.abs(calc.balanceOwing))}
      </p>
      {calc.isNil ? (
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-sub">
          A nil return. The company had no activity, so there’s no tax.
        </p>
      ) : (
        <dl className="mt-5 text-[0.9375rem]">
          <Line label="Revenue" value={money(calc.revenue)} onClick={() => go('income')} />
          <Line label="Expenses" value={money(-calc.operatingExpenses)} onClick={() => go('expenses')} />
          {calc.cca.total > 0 && (
            <Line label="Equipment write-off" value={money(-calc.cca.total)} onClick={() => go('equipment')} />
          )}
          {calc.mealsNonDeductible > 0 && (
            <Line label="Half of meals" value={money(calc.mealsNonDeductible)} onClick={() => go('expenses')} />
          )}
          <Line label="Taxable income" value={money(calc.taxableIncome)} total />
          <Line label={`Federal tax, ${percent(calc.federalRate)}`} value={money(calc.federalTax)} />
          <Line label={`${province} tax, ${percent(calc.provincialRate)}`} value={money(calc.provincialTax)} />
          {calc.instalmentsPaid > 0 && (
            <Line label="Instalments paid" value={money(-calc.instalmentsPaid)} onClick={() => go('balances')} />
          )}
        </dl>
      )}
      {calc.balanceDue && calc.filingDue && (
        <div className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-sub">
          {!calc.isNil && calc.balanceOwing > 0 && (
            <p>Pay CRA by <span className="font-medium text-ink">{dateLong(calc.balanceDue)}</span></p>
          )}
          <p>File by <span className="font-medium text-ink">{dateLong(calc.filingDue)}</span></p>
        </div>
      )}
    </div>
  );
}

function Line({
  label, value, onClick, total,
}: { label: string; value: string; onClick?: () => void; total?: boolean }) {
  const body = (
    <>
      <dt className={cx('min-w-0 text-left', total ? 'font-semibold text-ink' : 'text-sub')}>{label}</dt>
      <dd className={cx('shrink-0 tabular-nums', total ? 'font-semibold text-ink' : 'text-ink')}>{value}</dd>
    </>
  );
  const layout = cx(
    'flex items-baseline justify-between gap-3 py-1.5',
    total && 'mb-1.5 mt-1.5 border-y border-line py-2.5',
  );
  if (!onClick) return <div className={layout}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(layout, '-mx-2 w-[calc(100%+1rem)] rounded-md px-2 transition-colors duration-150 hover:bg-mint')}
    >
      {body}
    </button>
  );
}
