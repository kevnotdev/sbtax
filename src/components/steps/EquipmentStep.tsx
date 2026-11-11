'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { StepProps } from '../TaxApp';
import type { Asset, AssetKind } from '@/lib/tax-engine/types';
import { ASSET_KINDS } from '@/lib/tax-engine/rates';
import { isFirstYear } from '@/lib/tax-engine/calculator';
import { money } from '@/lib/format';
import { Button, Callout, DateField, Field, MoneyField, MoneyInput, Row, Section, SelectField, StepFooter, StepHeader, TextField } from '../ui';

export function EquipmentStep({ data, calc, issues, update, next, back }: StepProps) {
  const firstYear = isFirstYear(data);
  const setAssets = (change: (a: Asset[]) => Asset[]) => update(d => ({ ...d, assets: change(d.assets) }));
  const patch = (id: string, change: Partial<Asset>) =>
    setAssets(list => list.map(a => (a.id === id ? { ...a, ...change } : a)));
  const add = () =>
    setAssets(list => [...list, { id: `a${Date.now().toString(36)}`, description: '', kind: 'computer', date: '', cost: null }]);

  return (
    <>
      <StepHeader title="Equipment the company bought">
        Things that last more than a year, like a laptop or a desk, aren’t deducted all at once.
        Tax rules spread the cost over several years. Add what you bought and we’ll work out this
        year’s share.
      </StepHeader>

      {data.assets.length === 0 ? (
        <p className="text-[0.9375rem] leading-relaxed text-sub">
          Nothing added. If the company didn’t buy any equipment this year, continue to the next step.
        </p>
      ) : (
        <ul className="space-y-4">
          {data.assets.map((asset, i) => {
            const result = calc.cca.assets.find(r => r.id === asset.id);
            const dateIssue = issues.find(x => x.id === `asset-date-${asset.id}`);
            const costId = `cost-${asset.id}`;
            return (
              <li key={asset.id} className="rounded-2xl border border-line p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="What was it?"
                    value={asset.description}
                    onChange={v => patch(asset.id, { description: v })}
                    placeholder="For example, laptop"
                  />
                  <SelectField label="Type" value={asset.kind} onChange={v => patch(asset.id, { kind: v as AssetKind })}>
                    {(Object.keys(ASSET_KINDS) as AssetKind[]).map(k => (
                      <option key={k} value={k}>{ASSET_KINDS[k].label}</option>
                    ))}
                  </SelectField>
                  <DateField label="Date bought" value={asset.date} onChange={v => patch(asset.id, { date: v })} />
                  <Field label="Cost" htmlFor={costId} hint="Before GST/HST, if the company claims it back.">
                    <MoneyInput id={costId} value={asset.cost} onChange={v => patch(asset.id, { cost: v })} />
                  </Field>
                </div>
                {dateIssue && (
                  <div className="mt-4"><Callout tone="bad" title={dateIssue.title}>{dateIssue.detail}</Callout></div>
                )}
                <div className="mt-4 flex items-center justify-between gap-4 border-t border-line pt-3">
                  <p className="min-w-0 text-sm leading-snug text-sub">
                    {result && !dateIssue ? (
                      <>
                        <span className="font-medium text-ink">{money(result.claim)} deducted this year.</span>{' '}
                        {result.rule}.
                      </>
                    ) : (
                      ASSET_KINDS[asset.kind].examples
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setAssets(list => list.filter(a => a.id !== asset.id))}
                    aria-label={`Remove ${asset.description || `item ${i + 1}`}`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-faint transition-colors duration-150 hover:bg-bad-bg hover:text-bad-ink"
                  >
                    <Trash2 className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Button variant="secondary" className="mt-5" onClick={add}>
        <Plus className="h-4 w-4" aria-hidden /> Add equipment
      </Button>

      {!firstYear && (
        <Section
          title="Still being written off from earlier years"
          hint="On last year’s return, find Schedule 8 and copy the closing balance for each class (the “undepreciated capital cost at the end of the year”). Leave these at zero if there’s nothing."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <MoneyField
              label="Computers and hardware"
              hint="Class 50"
              value={data.openingUcc.computer}
              onChange={v => update(d => ({ ...d, openingUcc: { ...d.openingUcc, computer: v } }))}
            />
            <MoneyField
              label="Furniture and equipment"
              hint="Class 8"
              value={data.openingUcc.equipment}
              onChange={v => update(d => ({ ...d, openingUcc: { ...d.openingUcc, equipment: v } }))}
            />
          </div>
        </Section>
      )}

      {calc.cca.total > 0 && (
        <div className="mt-10 border-t border-line pt-2 text-[0.9375rem]">
          {calc.cca.classes.filter(c => c.claim > 0 || c.closing > 0).map(c => (
            <Row
              key={c.kind}
              muted
              label={ASSET_KINDS[c.kind].label}
              sub={c.closing > 0 ? `${money(c.closing)} left for future years` : 'Nothing left for future years'}
              value={money(c.claim)}
            />
          ))}
          <div className="border-t border-line">
            <Row strong label="Deducted this year" value={money(calc.cca.total)} />
          </div>
        </div>
      )}

      <StepFooter onBack={back} onNext={next} />
    </>
  );
}
