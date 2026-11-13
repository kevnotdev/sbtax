'use client';

import React from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import type { Savings, SavingsItem } from '@/lib/tax-engine/savings';
import { PRODUCT_NAME } from '@/lib/brand';
import { money } from '@/lib/format';
import { cx } from './ui';

const KIND_LABEL: Record<SavingsItem['kind'], string> = {
  saved: 'Less tax this year',
  sooner: 'Deducted sooner',
  banked: 'Banked for later',
};

/** The one figure worth leading with: money off this year if there is any, otherwise what's banked. */
export function savingsHeadline(s: Savings): { amount: number; label: string } | null {
  if (s.saved > 0) return { amount: s.saved, label: 'less tax this year' };
  if (s.banked > 0) return { amount: s.banked, label: 'of future tax already covered' };
  if (s.sooner > 0) return { amount: s.sooner, label: 'of tax relief brought forward' };
  return null;
}

/**
 * Shows what the tax rules took off this return. `compact` is the sidebar version:
 * the headline, with the breakdown one click away.
 */
export function SavingsCard({ savings, compact }: { savings: Savings; compact?: boolean }) {
  const headline = savingsHeadline(savings);
  if (!headline) return null;

  const list = (
    <ul className={cx('divide-y divide-spruce-900/10', compact ? 'mt-3 text-sm' : 'mt-4 text-[0.9375rem]')}>
      {savings.items.map(item => (
        <li key={item.id} className="py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 font-medium text-spruce-950">{item.title}</span>
            <span className="shrink-0 font-semibold tabular-nums text-spruce-950">{money(item.amount)}</span>
          </div>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-spruce-700">{KIND_LABEL[item.kind]}</p>
          <p className={cx('mt-1 leading-relaxed text-spruce-950/80', compact ? 'text-[0.8125rem]' : 'text-sm')}>{item.detail}</p>
        </li>
      ))}
    </ul>
  );

  const top = (
    <>
      <p className="flex items-center gap-2 text-sm font-semibold text-spruce-700">
        <Sparkles className="h-4 w-4" aria-hidden /> {PRODUCT_NAME} put the tax rules to work
      </p>
      <p className={cx('mt-2 font-semibold leading-none tracking-[-0.03em] text-spruce-950 tabular-nums', compact ? 'text-[1.75rem]' : 'text-[2.25rem]')}>
        {money(headline.amount)}
      </p>
      <p className="mt-1.5 text-[0.9375rem] text-spruce-950/80">{headline.label}</p>
    </>
  );

  if (compact) {
    return (
      <details className="group mt-4 rounded-2xl bg-mint p-5">
        <summary className="rounded-lg">
          {top}
          <span className="mt-3 flex items-center gap-1 text-sm font-medium text-spruce-700">
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-open:rotate-90" aria-hidden />
            See how
          </span>
        </summary>
        {list}
      </details>
    );
  }

  return (
    <div className="rounded-2xl bg-mint p-6">
      {top}
      {list}
      <p className="mt-3 text-xs leading-relaxed text-spruce-950/70">
        Each figure compares this return with the same return without that rule. “Deducted sooner” and
        “Banked for later” are not added to the total.
      </p>
    </div>
  );
}
