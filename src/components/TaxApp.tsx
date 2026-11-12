'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { DEMO_FILING, PRODUCT_NAME } from '@/lib/brand';
import { dateLong, money } from '@/lib/format';
import { calculate, isDate } from '@/lib/tax-engine/calculator';
import { findIssues, stepStatus, type Issue, type StepId, type StepStatus } from '@/lib/tax-engine/checks';
import { EMPTY_RETURN, SAMPLE_RETURN } from '@/lib/tax-engine/sample';
import type { Calculation, ReturnData } from '@/lib/tax-engine/types';
import { cx } from './ui';
import { Summary } from './Summary';
import { StartStep } from './steps/StartStep';
import { CompanyStep } from './steps/CompanyStep';
import { IncomeStep } from './steps/IncomeStep';
import { ExpensesStep } from './steps/ExpensesStep';
import { EquipmentStep } from './steps/EquipmentStep';
import { BalancesStep } from './steps/BalancesStep';
import { ReviewStep } from './steps/ReviewStep';
import { FileStep } from './steps/FileStep';

export interface DemoFiling {
  reference: string;
  filedOn: string;
}

export interface StepProps {
  data: ReturnData;
  calc: Calculation;
  issues: Issue[];
  update: (change: (d: ReturnData) => ReturnData) => void;
  /** Opens a step. With an anchor, brings that field into view and puts the cursor in it. */
  go: (step: StepId, anchor?: string) => void;
  next?: () => void;
  back?: () => void;
}

const STEP_LABELS: Record<StepId, string> = {
  start: 'Eligibility',
  company: 'Company',
  income: 'Income',
  expenses: 'Expenses',
  equipment: 'Equipment',
  balances: 'Year-end balances',
  review: 'Review',
  file: 'File',
};

const ALL_STEPS = Object.keys(STEP_LABELS) as StepId[];
const STORAGE_KEY = 'corporate-tax.return.v1';

interface Saved {
  data: ReturnData;
  visited: StepId[];
  filing: DemoFiling | null;
}

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function stepFromHash(): StepId {
  const h = window.location.hash.replace('#', '') as StepId;
  return ALL_STEPS.includes(h) ? h : 'start';
}

export default function TaxApp() {
  const [data, setData] = useState<ReturnData>(EMPTY_RETURN);
  const [visited, setVisited] = useState<StepId[]>([]);
  const [filing, setFiling] = useState<DemoFiling | null>(null);
  const [step, setStep] = useState<StepId>('start');
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  // The field a fix link asked for. `n` makes a repeat request for the same field count as new.
  const [wanted, setWanted] = useState<{ anchor: string; n: number } | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  /* Load whatever was saved on this device, then follow the address bar. */
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).has('sample')) {
        setData(SAMPLE_RETURN);
        setVisited(ALL_STEPS.filter(s => s !== 'file'));
      } else {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<Saved>;
          if (saved.data) {
            setData({
              ...EMPTY_RETURN,
              ...saved.data,
              screening: { ...EMPTY_RETURN.screening, ...saved.data.screening },
              company: { ...EMPTY_RETURN.company, ...saved.data.company },
              openingUcc: { ...EMPTY_RETURN.openingUcc, ...saved.data.openingUcc },
              balances: { ...EMPTY_RETURN.balances, ...saved.data.balances },
              owner: { ...EMPTY_RETURN.owner, ...saved.data.owner },
            });
          }
          if (Array.isArray(saved.visited)) setVisited(saved.visited.filter(s => ALL_STEPS.includes(s)));
          if (saved.filing) setFiling(saved.filing);
        }
      }
    } catch {
      // Storage can be blocked or hold something unreadable; start fresh.
    }
    setStep(stepFromHash());
    setLoaded(true);
    const onHash = () => setStep(stepFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, visited, filing } satisfies Saved));
    } catch {
      // Private windows may refuse storage. The return still works for this visit.
    }
  }, [data, visited, filing, loaded]);

  const calc = useMemo(() => calculate(data), [data]);
  const issues = useMemo(() => findIssues(data, calc, today()), [data, calc]);

  const steps = useMemo(
    () => ALL_STEPS.filter(s => !(calc.isNil && (s === 'expenses' || s === 'equipment'))),
    [calc.isNil],
  );
  const current: StepId = steps.includes(step) ? step : 'income';
  const index = steps.indexOf(current);

  useEffect(() => {
    if (loaded) setVisited(v => (v.includes(current) ? v : [...v, current]));
  }, [current, loaded]);

  const go = useCallback((s: StepId, anchor?: string) => {
    setMenuOpen(false);
    setStep(s);
    if (window.location.hash !== `#${s}`) window.history.pushState(null, '', `#${s}`);
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
    setWanted(w => (anchor ? { anchor, n: (w?.n ?? 0) + 1 } : null));
  }, []);

  /* After a fix link: show the field it pointed at, mark it briefly, and start typing there. */
  useEffect(() => {
    if (!wanted) return;
    const el = mainRef.current?.querySelector<HTMLElement>(`[data-anchor="${CSS.escape(wanted.anchor)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    // On a row with a note and an amount, the amount is the thing to fix.
    (el.querySelector<HTMLElement>('input[inputmode="decimal"]')
      ?? el.querySelector<HTMLElement>('input:not([type="radio"]), select'))?.focus({ preventScroll: true });
    el.classList.remove('anchor-flash');
    void el.offsetWidth; // restart the animation when the same field is asked for twice
    el.classList.add('anchor-flash');
    const t = window.setTimeout(() => el.classList.remove('anchor-flash'), 2400);
    return () => window.clearTimeout(t);
  }, [wanted, current]);

  const update = useCallback((change: (d: ReturnData) => ReturnData) => {
    setData(change);
    // Any edit after a demo filing means that filing no longer describes the return.
    setFiling(null);
  }, []);

  const reset = () => {
    setData(EMPTY_RETURN);
    setVisited([]);
    setFiling(null);
    setConfirmReset(false);
    go('start');
  };

  const loadSample = () => {
    setData(SAMPLE_RETURN);
    setVisited(ALL_STEPS.filter(s => s !== 'file'));
    setFiling(null);
    go('company');
  };

  const props: StepProps = {
    data, calc, issues, update, go,
    next: index < steps.length - 1 ? () => go(steps[index + 1]) : undefined,
    back: index > 0 ? () => go(steps[index - 1]) : undefined,
  };

  const company = data.company.legalName.trim();
  const yearLabel = isDate(data.company.yearEnd) ? `Year ending ${dateLong(data.company.yearEnd)}` : 'New return';
  const started = JSON.stringify(data) !== JSON.stringify(EMPTY_RETURN);

  const nav = (
    <ol className="space-y-0.5">
      {steps.map(s => {
        const status = filing && s === 'file' ? 'done' : stepStatus(s, issues, visited);
        const active = s === current;
        return (
          <li key={s}>
            <button
              type="button"
              onClick={() => go(s)}
              aria-current={active ? 'step' : undefined}
              className={cx(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[0.9375rem] transition-colors duration-150',
                'focus-visible:outline-spruce-300',
                active ? 'bg-white/[0.12] font-semibold text-white' : 'text-spruce-100/85 hover:bg-white/[0.06] hover:text-white',
              )}
            >
              <StatusMark status={status} />
              <span className="flex-1">{STEP_LABELS[s]}</span>
              {status === 'partial' && !active && <span className="sr-only">, needs attention</span>}
              {status === 'done' && <span className="sr-only">, complete</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-lift"
      >
        Skip to the form
      </a>

      {/* Rail: full height on desktop, a collapsing bar on small screens. */}
      <aside className="bg-spruce-900 text-spruce-100 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-3 px-5 py-4 lg:block lg:px-6 lg:pb-6 lg:pt-7">
          <div className="min-w-0">
            <p className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-white">{PRODUCT_NAME}</p>
            {company && <p className="mt-1 truncate text-sm text-spruce-100">{company}</p>}
            <p className="truncate text-sm text-spruce-300">{yearLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            aria-expanded={menuOpen}
            aria-controls="steps"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-white/[0.1] px-3 text-sm font-medium text-white focus-visible:outline-spruce-300 lg:hidden"
          >
            {index + 1} of {steps.length}
            <ChevronDown className={cx('h-4 w-4 transition-transform duration-200', menuOpen && 'rotate-180')} aria-hidden />
          </button>
        </div>

        <nav id="steps" aria-label="Steps" className={cx('px-3 pb-4 lg:block lg:flex-1', !menuOpen && 'hidden')}>
          {nav}
        </nav>

        <div className={cx('border-t border-white/10 px-6 py-5 text-sm text-spruce-300 lg:block', !menuOpen && 'hidden')}>
          {DEMO_FILING && <p className="mb-3 leading-snug">Preview build. Returns can’t be sent to CRA yet.</p>}
          {started && !confirmReset && (
            <>
              <p className="leading-snug">Saved on this device as you type.</p>
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="mt-2 rounded underline decoration-spruce-300/50 underline-offset-4 hover:text-white focus-visible:outline-spruce-300"
              >
                Start over
              </button>
            </>
          )}
          {confirmReset && (
            <div>
              <p className="leading-snug text-white">Erase everything you’ve entered?</p>
              <div className="mt-2 flex gap-4">
                <button type="button" onClick={reset} className="rounded font-semibold text-white underline underline-offset-4 focus-visible:outline-spruce-300">
                  Erase
                </button>
                <button type="button" onClick={() => setConfirmReset(false)} className="rounded underline decoration-spruce-300/50 underline-offset-4 hover:text-white focus-visible:outline-spruce-300">
                  Keep it
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      <div className="min-w-0">
        <div className="mx-auto grid max-w-[68rem] gap-x-14 px-5 pb-32 pt-8 sm:px-8 lg:px-12 lg:pt-14 xl:grid-cols-[minmax(0,1fr)_19rem] xl:pb-20">
          <main id="main" ref={mainRef} tabIndex={-1} className="min-w-0 max-w-[40rem] outline-none">
            {!loaded ? (
              <div aria-busy="true" className="space-y-4 pt-2">
                <div className="h-8 w-2/3 rounded-lg bg-ground" />
                <div className="h-5 w-full rounded bg-ground" />
                <div className="h-5 w-4/5 rounded bg-ground" />
              </div>
            ) : (
              <>
                {current === 'start' && <StartStep {...props} onLoadSample={loadSample} started={started} />}
                {current === 'company' && <CompanyStep {...props} />}
                {current === 'income' && <IncomeStep {...props} />}
                {current === 'expenses' && <ExpensesStep {...props} />}
                {current === 'equipment' && <EquipmentStep {...props} />}
                {current === 'balances' && <BalancesStep {...props} />}
                {current === 'review' && <ReviewStep {...props} />}
                {current === 'file' && <FileStep {...props} filing={filing} onFiled={setFiling} />}
              </>
            )}
          </main>

          <aside aria-label="Tax summary" className="hidden xl:block">
            <div className="sticky top-14">
              {loaded && <Summary data={data} calc={calc} go={go} />}
            </div>
          </aside>
        </div>
      </div>

      {/* Small screens keep the running total in reach. */}
      {loaded && data.hadActivity !== null && current !== 'review' && current !== 'file' && (
        <button
          type="button"
          onClick={() => go('review')}
          className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-4 border-t border-line bg-white/95 px-5 py-3.5 text-left backdrop-blur xl:hidden"
        >
          <span className="text-sm text-sub">
            {calc.balanceOwing < 0 ? 'Refund so far' : 'Tax owing so far'}
            <span className="block text-xs text-faint">Tap for the full breakdown</span>
          </span>
          <span className="text-xl font-semibold tabular-nums tracking-[-0.01em]">{money(Math.abs(calc.balanceOwing))}</span>
        </button>
      )}
    </div>
  );
}

function StatusMark({ status }: { status: StepStatus }) {
  if (status === 'done') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-spruce-300 text-spruce-950" aria-hidden>
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cx(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px]',
        status === 'partial' ? 'border-[#f0c35a]' : 'border-spruce-300/50',
      )}
    >
      {status === 'partial' && <span className="h-2 w-2 rounded-full bg-[#f0c35a]" />}
    </span>
  );
}
