'use client';

import React from 'react';
import type { StepProps } from '../TaxApp';
import type { Company, Province } from '@/lib/tax-engine/types';
import { PROVINCES, PROVINCE_ORDER } from '@/lib/tax-engine/rates';
import { daysInclusive, isFirstYear } from '@/lib/tax-engine/calculator';
import { formatBusinessNumber } from '@/lib/format';
import { Callout, DateField, Section, SelectField, StepFooter, StepHeader, TextField } from '../ui';

export function CompanyStep({ data, issues, update, next, back }: StepProps) {
  const c = data.company;
  const set = <K extends keyof Company>(key: K, value: Company[K]) =>
    update(d => ({ ...d, company: { ...d.company, [key]: value } }));

  const days = daysInclusive(c.yearStart, c.yearEnd);
  const yearProblem = issues.find(i =>
    ['year-order', 'year-long', 'year-early', 'incorporation-late', 'year-before-incorporation'].includes(i.id));
  const provinceProblem = issues.find(i => i.id === 'province-unsupported');

  return (
    <>
      <StepHeader title="About the company">
        These details identify the company to CRA. They’re on your incorporation documents and on
        any letter CRA has sent the company.
      </StepHeader>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Legal name"
          hint="Exactly as registered, including Inc., Ltd. or Corp."
          value={c.legalName}
          onChange={v => set('legalName', v)}
          autoComplete="organization"
          fieldClassName="sm:col-span-2"
        />
        <TextField
          label="Business number"
          hint="The 9 digits before RC0001."
          value={formatBusinessNumber(c.businessNumber)}
          onChange={v => set('businessNumber', v.replace(/\D/g, '').slice(0, 9))}
          inputMode="numeric"
          placeholder="12345 6789"
          autoComplete="off"
        />
        <SelectField
          label="Province or territory"
          hint="Where the company does its work."
          value={c.province}
          onChange={v => set('province', v as Province | '')}
        >
          <option value="">Choose one</option>
          {PROVINCE_ORDER.map(p => <option key={p} value={p}>{PROVINCES[p].name}</option>)}
        </SelectField>
      </div>
      {provinceProblem && (
        <div className="mt-5">
          <Callout tone="bad" title={provinceProblem.title}>{provinceProblem.detail}</Callout>
        </div>
      )}

      <Section
        title="Tax year"
        hint="A company picks its own tax year. It’s often the calendar year, but check last year’s return if you’re unsure."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <DateField
            label="Incorporation date"
            value={c.incorporationDate}
            onChange={v => set('incorporationDate', v)}
            fieldClassName="sm:col-span-2 sm:max-w-[calc(50%-0.625rem)]"
          />
          <DateField
            label="First day of the tax year"
            hint="For a brand-new company, the incorporation date."
            value={c.yearStart}
            onChange={v => set('yearStart', v)}
          />
          <DateField
            label="Last day of the tax year"
            value={c.yearEnd}
            onChange={v => set('yearEnd', v)}
          />
        </div>
        {yearProblem ? (
          <div className="mt-5">
            <Callout tone="bad" title={yearProblem.title}>{yearProblem.detail}</Callout>
          </div>
        ) : days > 0 && (isFirstYear(data) || days < 365) && (
          <p className="mt-4 text-sm text-sub">
            {days} days.{' '}
            {isFirstYear(data)
              ? 'This is the company’s first tax year, so nothing carries in from last year.'
              : 'A short year. Limits and write-offs are scaled to match.'}
          </p>
        )}
      </Section>

      <Section title="Head office address">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <TextField
            label="Street address"
            value={c.street}
            onChange={v => set('street', v)}
            autoComplete="address-line1"
            fieldClassName="sm:col-span-2"
          />
          <TextField label="City" value={c.city} onChange={v => set('city', v)} autoComplete="address-level2" />
          <TextField
            label="Postal code"
            value={c.postalCode}
            onChange={v => set('postalCode', v.toUpperCase().slice(0, 7))}
            placeholder="A1A 1A1"
            autoComplete="postal-code"
          />
        </div>
      </Section>

      <StepFooter onBack={back} onNext={next} />
    </>
  );
}
