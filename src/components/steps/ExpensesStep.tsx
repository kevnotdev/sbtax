'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import type { StepProps } from '../TaxApp';
import type { ExpenseCategoryId, ExpenseLine } from '@/lib/tax-engine/types';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_BY_ID } from '@/lib/tax-engine/rates';
import { expenseAnchor } from '@/lib/tax-engine/advice';
import { money } from '@/lib/format';
import { Button, MoneyInput, StepFooter, StepHeader, cx } from '../ui';

export function ExpensesStep({ data, calc, update, next, back }: StepProps) {
  const [picking, setPicking] = useState(data.expenses.length === 0);
  const [query, setQuery] = useState('');
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return EXPENSE_CATEGORIES;
    return EXPENSE_CATEGORIES.filter(c => `${c.label} ${c.hint ?? ''}`.toLowerCase().includes(q));
  }, [query]);

  const setLines = (change: (lines: ExpenseLine[]) => ExpenseLine[]) =>
    update(d => ({ ...d, expenses: change(d.expenses) }));

  const add = (category: ExpenseCategoryId) => {
    const id = `e${Date.now().toString(36)}`;
    setLines(lines => [...lines, { id, category, note: '', amount: null }]);
    setPicking(false);
    setQuery('');
    setJustAdded(id);
  };

  // Once the new line is on screen, put the cursor where the next keystroke belongs: its amount.
  useEffect(() => {
    if (!justAdded) return;
    listRef.current?.querySelector<HTMLInputElement>(`[data-line="${justAdded}"] input[inputmode="decimal"]`)?.focus();
  }, [justAdded]);

  const patch = (id: string, change: Partial<ExpenseLine>) =>
    setLines(lines => lines.map(l => (l.id === id ? { ...l, ...change } : l)));

  return (
    <>
      <StepHeader title="What the company spent">
        Add one total per type of expense for the year. Leave out GST/HST if the company is
        registered and claims it back.
      </StepHeader>

      {data.expenses.length > 0 && (
        <ul ref={listRef} className="divide-y divide-line border-y border-line">
          {data.expenses.map(line => {
            const cat = EXPENSE_CATEGORY_BY_ID[line.category];
            return (
              <li
                key={line.id}
                data-line={line.id}
                data-anchor={expenseAnchor(line.id)}
                className={cx(
                  'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 py-4 sm:grid-cols-[minmax(0,1fr)_11rem_2.75rem]',
                  justAdded === line.id && 'motion-safe:animate-[rise_0.28s_cubic-bezier(0.16,1,0.3,1)]',
                )}
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">{cat.label}</p>
                  <input
                    type="text"
                    value={line.note}
                    onChange={e => patch(line.id, { note: e.target.value })}
                    placeholder="Add a note for your records"
                    aria-label={`Note for ${cat.label}`}
                    className="mt-0.5 w-full rounded bg-transparent text-sm text-sub placeholder:text-faint focus:outline-none focus-visible:outline-none focus:placeholder:text-line-strong"
                  />
                  {cat.halfDeductible && (line.amount ?? 0) > 0 && (
                    <p className="mt-1 text-sm text-faint">
                      Half counts for tax: {money((line.amount ?? 0) / 2)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setLines(lines => lines.filter(l => l.id !== line.id))}
                  aria-label={`Remove ${cat.label}`}
                  className="flex h-11 w-11 items-center justify-center rounded-[10px] text-faint transition-colors duration-150 hover:bg-bad-bg hover:text-bad-ink sm:order-last"
                >
                  <Trash2 className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                </button>
                <MoneyInput
                  value={line.amount}
                  onChange={v => patch(line.id, { amount: v })}
                  align="right"
                  ariaLabel={`${cat.label} amount`}
                  className="col-span-2 sm:col-span-1"
                />
              </li>
            );
          })}
          <li className="flex items-baseline justify-between py-4 font-semibold sm:pr-[3.5rem]">
            <span>Total expenses</span>
            <span className="tabular-nums">{money(calc.operatingExpenses)}</span>
          </li>
        </ul>
      )}

      {data.expenses.length === 0 && (
        <p className="mb-5 text-[0.9375rem] leading-relaxed text-sub">
          Nothing added yet. Pick the types of spending the company had. Every dollar here lowers
          the tax.
        </p>
      )}

      {picking ? (
        <div data-anchor="add-expense" className={cx('rounded-2xl bg-ground p-4 sm:p-5', data.expenses.length > 0 && 'mt-6')}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-faint" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search, for example “stripe” or “flights”"
              aria-label="Search expense types"
              className="h-11 w-full rounded-[10px] border border-line-strong bg-white pl-10 pr-3.5 text-base placeholder:text-faint hover:border-spruce-700 focus:border-spruce-700 focus:outline-none focus:ring-2 focus:ring-spruce-500/35"
            />
          </div>
          {matches.length > 0 ? (
            <ul className="mt-3 grid gap-1 sm:grid-cols-2">
              {matches.map(c => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => add(c.id)}
                    className="h-full w-full rounded-[10px] px-3 py-2.5 text-left transition-colors duration-150 hover:bg-white hover:shadow-lift active:bg-mint"
                  >
                    <span className="block font-medium text-ink">{c.label}</span>
                    {c.hint && <span className="block text-sm leading-snug text-faint">{c.hint}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 pb-1 pt-4 text-[0.9375rem] text-sub">
              No match for “{query.trim()}”.{' '}
              <button type="button" onClick={() => add('other')} className="font-medium text-spruce-700 underline underline-offset-4">
                Add it as “Something else”
              </button>
            </p>
          )}
          {data.expenses.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <Button variant="ghost" size="sm" onClick={() => { setPicking(false); setQuery(''); }}>Done adding</Button>
            </div>
          )}
        </div>
      ) : (
        <div data-anchor="add-expense" className="mt-6 inline-block">
          <Button variant="secondary" onClick={() => setPicking(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Add an expense
          </Button>
        </div>
      )}

      <StepFooter onBack={back} onNext={next} />
    </>
  );
}
