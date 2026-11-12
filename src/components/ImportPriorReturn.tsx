'use client';

import React, { useId, useState } from 'react';
import { CircleCheck, FileUp } from 'lucide-react';
import type { StepProps } from './TaxApp';
import {
  applyPriorReturn, looksLikeReturn, nextTaxYear, parsePriorReturn, type PriorReturn,
} from '@/lib/import/prior-return';
import { PROVINCES } from '@/lib/tax-engine/rates';
import { dateLong, formatBusinessNumber, money } from '@/lib/format';
import { Button, Callout, Section } from './ui';

type State =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'error'; message: string }
  | { kind: 'found'; found: PriorReturn; fileName: string }
  | { kind: 'applied'; missing: string[] };

interface Line { label: string; value: string; source: string; amount?: boolean }

/** What was read, in the order the person will recognise from the return. */
function describe(found: PriorReturn): Line[] {
  const lines: Line[] = [];
  const add = (label: string, item: { source: string; value: unknown } | undefined, value: string) => {
    if (item) lines.push({ label, value, source: item.source, amount: typeof item.value === 'number' });
  };
  add('Legal name', found.legalName, found.legalName?.value ?? '');
  add('Business number', found.businessNumber, formatBusinessNumber(found.businessNumber?.value ?? ''));
  add('Province', found.province, found.province ? PROVINCES[found.province.value].name : '');
  add('Signing officer', found.signerName, [found.signerName?.value, found.signerTitle?.value].filter(Boolean).join(', '));
  add('Retained earnings to start this year', found.retainedEarnings, money(found.retainedEarnings?.value ?? 0));
  add('Paid for the company’s shares', found.shareCapital, money(found.shareCapital?.value ?? 0));
  add('Unused losses carried forward', found.lossesCarriedForward, money(found.lossesCarriedForward?.value ?? 0));
  return lines;
}

/** What the return does not show, or this reader does not pick up yet. */
function stillNeeded(found: PriorReturn): string[] {
  const out = ['Incorporation date', 'Head office address'];
  if (!found.shareCapital) out.push('Amount paid for the company’s shares');
  out.push('Equipment balances from Schedule 8, if the company has any');
  return out;
}

/** Lets someone switching from other tax software start from last year's return instead of a blank form. */
export function ImportPriorReturn({ update, go }: Pick<StepProps, 'update' | 'go'>) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const inputId = useId();

  const read = async (file: File | undefined) => {
    if (!file) return;
    setState({ kind: 'reading' });
    try {
      const { readPdfLines } = await import('@/lib/import/read-pdf');
      const { lines, creator } = await readPdfLines(file);
      const found = parsePriorReturn(lines, creator);
      if (lines.length === 0) {
        setState({ kind: 'error', message: 'That PDF has no readable text. It may be a scan. Use the copy your tax software saved, not a photo or scan of a printout.' });
      } else if (!looksLikeReturn(found)) {
        setState({ kind: 'error', message: 'We couldn’t find a T2 return in that file. Choose the full copy of the return your tax software saved as a PDF.' });
      } else {
        setState({ kind: 'found', found, fileName: file.name });
      }
    } catch {
      setState({ kind: 'error', message: 'That file couldn’t be opened. Check that it’s a PDF and isn’t password-protected.' });
    }
  };

  const picker = (label: string, variant: 'secondary' | 'ghost' = 'secondary') => (
    <>
      <input
        id={inputId}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={e => { void read(e.target.files?.[0]); e.target.value = ''; }}
      />
      <Button variant={variant} onClick={() => document.getElementById(inputId)?.click()}>
        <FileUp className="h-4 w-4" aria-hidden /> {label}
      </Button>
    </>
  );

  return (
    <Section
      title="Switching from other tax software?"
      hint="Choose the PDF copy of last year’s return and we’ll fill in what carries over to this year. The file is read on this device. It isn’t uploaded anywhere."
    >
      <div data-anchor="import">
        {state.kind === 'idle' && picker('Choose last year’s return (PDF)')}

        {state.kind === 'reading' && <p className="text-[0.9375rem] text-sub" role="status">Reading the return…</p>}

        {state.kind === 'error' && (
          <Callout tone="warn" title="We couldn’t read that" action={picker('Try another file')}>
            {state.message}
          </Callout>
        )}

        {state.kind === 'found' && (() => {
          const { found } = state;
          const year = nextTaxYear(found.yearEnd!.value);
          return (
            <div className="rounded-2xl border border-line p-5">
              <p className="font-semibold text-ink">
                Found a return for the year ending {dateLong(found.yearEnd!.value)}
                {found.software ? `, prepared with ${found.software}` : ''}
              </p>
              <p className="mt-1 text-[0.9375rem] leading-relaxed text-sub">
                Check these against the return. Using them sets up the next tax year,{' '}
                <span className="font-medium text-ink">{dateLong(year.yearStart)} to {dateLong(year.yearEnd)}</span>,
                and replaces anything already entered in these fields.
              </p>
              <dl className="mt-4 divide-y divide-line border-y border-line text-[0.9375rem]">
                {describe(found).map(l => (
                  <div key={l.label} className="flex items-baseline justify-between gap-4 py-2.5">
                    <dt className="min-w-0 text-sub">
                      {l.label}
                      <span className="block text-sm text-faint">{l.source}</span>
                    </dt>
                    <dd
                      className={
                        'text-right font-medium tabular-nums text-ink ' +
                        (l.amount ? 'shrink-0 whitespace-nowrap' : 'max-w-[55%] [overflow-wrap:anywhere]')
                      }
                    >
                      {l.value}
                    </dd>
                  </div>
                ))}
              </dl>
              {found.netIncomeForTax && found.netIncomeForTax.value < 0 && (
                <p className="mt-3 text-sm leading-relaxed text-sub">
                  That year was a loss of {money(-found.netIncomeForTax.value)} for tax. It’s included in the
                  unused losses above.
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    update(d => applyPriorReturn(d, found));
                    setState({ kind: 'applied', missing: stillNeeded(found) });
                  }}
                >
                  Use these details
                </Button>
                <Button variant="ghost" onClick={() => setState({ kind: 'idle' })}>Cancel</Button>
              </div>
            </div>
          );
        })()}

        {state.kind === 'applied' && (
          <div className="rounded-2xl bg-mint p-5 text-spruce-950">
            <p className="flex items-center gap-2.5 font-semibold">
              <CircleCheck className="h-5 w-5 shrink-0" aria-hidden /> Last year’s details are filled in
            </p>
            <p className="mt-2 text-[0.9375rem] leading-relaxed">The return doesn’t show these, so they’re still yours to add:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[0.9375rem] leading-relaxed">
              {state.missing.map(m => <li key={m}>{m}</li>)}
            </ul>
            <div className="mt-4">
              <Button variant="secondary" size="sm" onClick={() => go('company', 'incorporationDate')}>
                Add the incorporation date
              </Button>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
