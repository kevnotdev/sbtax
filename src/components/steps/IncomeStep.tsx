'use client';

import React from 'react';
import type { StepProps } from '../TaxApp';
import { Callout, MoneyField, StepFooter, StepHeader, YesNo } from '../ui';

export function IncomeStep({ data, update, next, back }: StepProps) {
  return (
    <>
      <StepHeader title="What the company earned">
        Start with whether anything happened this year. A company with no activity still has to
        file, and that return is much shorter.
      </StepHeader>

      <div className="border-y border-line py-5">
        <YesNo
          legend="Did the company earn or spend any money this year?"
          hint="Count invoices, expenses and anything that moved through the bank account."
          value={data.hadActivity}
          onChange={v => update(d => ({ ...d, hadActivity: v }))}
        />
      </div>

      {data.hadActivity === true && (
        <div className="mt-8">
          <MoneyField
            label="Total revenue"
            hint="Everything you invoiced for work done this year, before GST/HST. Include invoices that haven’t been paid yet."
            value={data.revenue}
            onChange={v => update(d => ({ ...d, revenue: v }))}
          />
        </div>
      )}

      {data.hadActivity === false && (
        <div className="mt-6">
          <Callout title="You’ll file a nil return">
            There’s no tax to pay. CRA still needs the company’s year-end balances, so that’s the
            only part left.
          </Callout>
        </div>
      )}

      <StepFooter onBack={back} onNext={next} />
    </>
  );
}
