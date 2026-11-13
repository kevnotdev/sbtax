'use client';

import React, { useId, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import type { DemoFiling, StepProps } from '../TaxApp';
import { DEMO_FILING, FILING_FEE } from '@/lib/brand';
import { readyToFile, yearStillOpen } from '@/lib/tax-engine/checks';
import { dateLong, formatBusinessNumber, money } from '@/lib/format';
import { Button, Callout, Row, Section, StepFooter, StepHeader, TextField } from '../ui';

export function FileStep({
  data, calc, issues, update, go, back, filing, onFiled,
}: StepProps & { filing: DemoFiling | null; onFiled: (f: DemoFiling | null) => void }) {
  const [certified, setCertified] = useState(false);
  const certifyId = useId();
  const tooEarly = yearStillOpen(issues);
  const ready = readyToFile(issues) && !tooEarly;
  const signed = data.owner.name.trim() !== '' && data.owner.title.trim() !== '';
  const notes = issues.filter(i => i.level === 'note');

  const file = () => {
    const now = new Date();
    const stamp = now.toISOString().slice(0, 10);
    onFiled({ reference: `DEMO-${stamp.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`, filedOn: stamp });
    window.scrollTo({ top: 0 });
  };

  if (filing) {
    return (
      <>
        <StepHeader title="Demo filing complete">
          This was a practice run. Nothing was sent to CRA and nothing was charged.
        </StepHeader>

        <div className="rounded-2xl bg-mint p-6">
          <p className="flex items-center gap-2.5 font-semibold text-spruce-950">
            <CircleCheck className="h-5 w-5" aria-hidden /> The return passed every check
          </p>
          <dl className="mt-4 text-[0.9375rem] text-spruce-950">
            <Row label="Company" value={data.company.legalName} />
            <Row label="Tax year ending" value={dateLong(data.company.yearEnd)} />
            <Row label={calc.balanceOwing < 0 ? 'Refund' : 'Balance owing'} value={money(Math.abs(calc.balanceOwing))} />
            <Row label="Demo reference" value={filing.reference} />
          </dl>
        </div>

        <Section title="What would happen next, once filing is live">
          <ol className="space-y-4 text-[0.9375rem] leading-relaxed text-sub">
            <li>
              <span className="font-medium text-ink">CRA confirms receipt.</span> You’d get a confirmation number
              right away, and a notice of assessment a few weeks later.
            </li>
            {calc.balanceOwing > 0 && calc.balanceDue && (
              <li>
                <span className="font-medium text-ink">Pay {money(calc.balanceOwing)} by {dateLong(calc.balanceDue)}.</span>{' '}
                Pay through your bank’s business tax payment service or CRA My Business Account.
              </li>
            )}
            {notes.map(n => (
              <li key={n.id}><span className="font-medium text-ink">{n.title}.</span> {n.detail}</li>
            ))}
          </ol>
        </Section>

        <div className="mt-12 border-t border-line pt-6">
          <Button variant="secondary" onClick={() => { onFiled(null); go('review'); }}>Back to the return</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <StepHeader title="File the return">
        The last step: confirm who is signing, then send the return to CRA.
      </StepHeader>

      {DEMO_FILING && (
        <Callout tone="warn" title="This is a demo. Nothing will be sent to CRA.">
          Sending returns needs CRA software certification, which this product doesn’t have yet.
          You can run the whole step to see how it works. No return is filed and no card is charged.
        </Callout>
      )}

      {tooEarly && (
        <div className="mt-5">
          <Callout tone="bad" title="This tax year hasn’t ended yet">
            CRA only accepts a return once the year is over. Everything you’ve entered is saved, so come back
            after {dateLong(data.company.yearEnd)} to file.
          </Callout>
        </div>
      )}

      {!ready && !tooEarly && (
        <div className="mt-5">
          <Callout
            tone="bad"
            title="The return isn’t ready yet"
            action={<Button variant="secondary" size="sm" onClick={() => go('review')}>See what to fix</Button>}
          >
            A few things need fixing before it can be filed.
          </Callout>
        </div>
      )}

      <Section
        title="Who is signing"
        hint="A director or officer of the company certifies the return. In an owner-run company, that’s usually you."
      >
        <div data-anchor="signer" className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Full name"
            value={data.owner.name}
            onChange={v => update(d => ({ ...d, owner: { ...d.owner, name: v } }))}
            autoComplete="name"
          />
          <TextField
            label="Position"
            value={data.owner.title}
            onChange={v => update(d => ({ ...d, owner: { ...d.owner, title: v } }))}
            placeholder="Director"
            autoComplete="organization-title"
          />
        </div>
      </Section>

      <Section title="What you’re filing">
        <div className="divide-y divide-line border-y border-line text-[0.9375rem]">
          <Row label="Company" value={data.company.legalName || 'Not entered'} />
          <Row
            label="Business number"
            value={data.company.businessNumber ? `${formatBusinessNumber(data.company.businessNumber)} RC0001` : 'Not entered'}
          />
          <Row label="Tax year ending" value={data.company.yearEnd ? dateLong(data.company.yearEnd) : 'Not entered'} />
          <Row label={calc.balanceOwing < 0 ? 'Refund from CRA' : 'Balance owing to CRA'} value={money(Math.abs(calc.balanceOwing))} />
          <Row
            strong
            label="Filing fee"
            sub={DEMO_FILING ? 'Planned price. Not charged in the demo.' : undefined}
            value={money(FILING_FEE, 0)}
          />
        </div>
      </Section>

      <div className="mt-8 flex items-start gap-3">
        <input
          id={certifyId}
          type="checkbox"
          checked={certified}
          onChange={e => setCertified(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded accent-spruce-900"
        />
        <label htmlFor={certifyId} className="cursor-pointer text-[0.9375rem] leading-relaxed text-ink">
          I certify that the information in this return is correct and complete, and that I’m
          authorized to sign for the company.
        </label>
      </div>

      <StepFooter
        onBack={back}
        onNext={file}
        nextLabel={DEMO_FILING ? 'Run the demo filing' : `Pay ${money(FILING_FEE, 0)} and file`}
        nextDisabled={!ready || !signed || !certified}
      />
      {ready && (!signed || !certified) && (
        <p className="mt-3 text-right text-sm text-faint">
          {!signed ? 'Add the signer’s name and position to continue.' : 'Tick the box above to continue.'}
        </p>
      )}
    </>
  );
}
