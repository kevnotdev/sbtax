'use client';

import React from 'react';
import type { StepProps } from '../TaxApp';
import type { Screening } from '@/lib/tax-engine/types';
import { Button, Callout, Section, StepFooter, StepHeader, YesNo } from '../ui';

const QUESTIONS: { key: keyof Screening; legend: string; hint?: string }[] = [
  {
    key: 'canadianPrivate',
    legend: 'Is the company privately owned by people who live in Canada?',
    hint: 'Not publicly traded, and not controlled by a non-resident or by another corporation.',
  },
  {
    key: 'otherCorporations',
    legend: 'Do you or a family member control any other corporation?',
  },
  {
    key: 'investments',
    legend: 'Does the company hold investments or rental property?',
    hint: 'Stocks, GICs, crypto or real estate. Interest on the business chequing account doesn’t count.',
  },
  {
    key: 'soldEquipment',
    legend: 'Did the company sell or scrap any equipment this year?',
  },
];

export function StartStep({
  data, issues, update, next, onLoadSample, started,
}: StepProps & { onLoadSample: () => void; started: boolean }) {
  const s = data.screening;
  const answered = Object.values(s).every(v => v !== null);
  const problems = issues.filter(i => i.step === 'start' && i.id !== 'screening-open');

  return (
    <>
      <StepHeader title="First, let’s check this fits your company">
        This is built for one-person companies with simple books. Four questions make sure the
        return we prepare for you will be right.
      </StepHeader>

      <div data-anchor="screening" className="divide-y divide-line border-y border-line">
        {QUESTIONS.map(q => (
          <div key={q.key} className="py-5">
            <YesNo
              legend={q.legend}
              hint={q.hint}
              value={s[q.key]}
              onChange={v => update(d => ({ ...d, screening: { ...d.screening, [q.key]: v } }))}
            />
          </div>
        ))}
      </div>

      {answered && (
        <div className="mt-6">
          {problems.length === 0 ? (
            <Callout title="This is a good fit">
              Your company is the kind this was built for. Next, a few details about the company.
            </Callout>
          ) : (
            <Callout tone="bad" title="This isn’t the right tool for your company yet">
              <ul className="mt-1 space-y-2">
                {problems.map(p => (
                  <li key={p.id}>
                    <span className="font-medium">{p.title}.</span> {p.detail}
                  </li>
                ))}
              </ul>
              <p className="mt-3">An accountant is the safer choice for this year’s return.</p>
            </Callout>
          )}
        </div>
      )}

      <Section title="What to have nearby" hint="About 15 minutes if your numbers are ready.">
        <ul className="space-y-2.5 text-[0.9375rem] leading-relaxed text-sub">
          <li><span className="font-medium text-ink">Bank statement</span> for the last day of the company’s tax year</li>
          <li><span className="font-medium text-ink">Total invoiced</span> for the year, before GST/HST</li>
          <li><span className="font-medium text-ink">Expense totals</span> by type, from your bookkeeping or a spreadsheet</li>
          <li><span className="font-medium text-ink">Last year’s T2 return</span>, unless this is the company’s first year</li>
        </ul>
        {!started && (
          <p className="mt-6 text-[0.9375rem] text-sub">
            Just looking?{' '}
            <Button variant="secondary" size="sm" onClick={onLoadSample} className="ml-1">
              Explore with a sample company
            </Button>
          </p>
        )}
      </Section>

      <StepFooter onNext={next} nextDisabled={!answered || problems.length > 0} />
    </>
  );
}
