'use client';

import React, { useEffect, useId, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Info, TriangleAlert } from 'lucide-react';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */
/* Page furniture                                                      */
/* ------------------------------------------------------------------ */

export function StepHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-8">
      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
      {children && <p className="mt-2 max-w-[60ch] text-[1.0625rem] leading-relaxed text-sub">{children}</p>}
    </header>
  );
}

export function Section({
  title, hint, children,
}: { title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      {hint && <p className="mt-1 max-w-[62ch] text-[0.9375rem] leading-relaxed text-sub">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function StepFooter({
  onBack, onNext, nextLabel = 'Continue', nextDisabled,
}: { onBack?: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean }) {
  return (
    <div className="mt-12 flex items-center justify-between gap-3 border-t border-line pt-6">
      {onBack ? (
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
      ) : <span />}
      {onNext && (
        <Button onClick={onNext} disabled={nextDisabled}>
          {nextLabel} <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'sm';
};

export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 rounded-[10px] font-medium transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-45',
        size === 'md' ? 'h-11 px-5 text-[0.9375rem]' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-spruce-900 text-white hover:bg-spruce-800 active:bg-spruce-950',
        variant === 'secondary' && 'border border-line-strong bg-white text-ink hover:border-spruce-700 hover:bg-ground active:bg-mint',
        variant === 'ghost' && 'text-sub hover:bg-ground hover:text-ink active:bg-mint',
        className,
      )}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Fields                                                              */
/* ------------------------------------------------------------------ */

const inputBase =
  'h-11 w-full rounded-[10px] border border-line-strong bg-white px-3.5 text-base text-ink transition-colors duration-150 ' +
  'placeholder:text-faint hover:border-spruce-700 focus:border-spruce-700 focus:outline-none focus:ring-2 focus:ring-spruce-500/35 ' +
  'disabled:bg-ground disabled:text-faint';

export function Field({
  label, hint, htmlFor, children, className,
}: { label: string; hint?: React.ReactNode; htmlFor: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[0.9375rem] font-medium text-ink">{label}</label>
      {children}
      {hint && <p id={`${htmlFor}-hint`} className="mt-1.5 text-sm leading-snug text-faint">{hint}</p>}
    </div>
  );
}

type TextProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  label: string; hint?: React.ReactNode; value: string; onChange: (v: string) => void; fieldClassName?: string;
};

export function TextField({ label, hint, value, onChange, fieldClassName, className, ...rest }: TextProps) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id} className={fieldClassName}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={cx(inputBase, className)}
        {...rest}
      />
    </Field>
  );
}

export function DateField(props: Omit<TextProps, 'type'>) {
  return <TextField {...props} type="date" />;
}

export function SelectField({
  label, hint, value, onChange, children, fieldClassName,
}: {
  label: string; hint?: React.ReactNode; value: string; onChange: (v: string) => void;
  children: React.ReactNode; fieldClassName?: string;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id} className={fieldClassName}>
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={cx(inputBase, 'appearance-none bg-[length:16px] bg-[right_0.85rem_center] bg-no-repeat pr-10', !value && 'text-faint')}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%2346554e' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")",
        }}
      >
        {children}
      </select>
    </Field>
  );
}

const plain = new Intl.NumberFormat('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function parseAmount(raw: string, allowNegative: boolean): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1').replace('−', '-');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  return allowNegative ? rounded : Math.abs(rounded);
}

/**
 * Dollar amount. Shows grouped digits at rest and the raw number while editing,
 * and reports null when empty so "not entered" stays distinct from zero.
 */
export function MoneyInput({
  id, value, onChange, allowNegative = false, align = 'left', placeholder = '0.00', ariaLabel, describedBy, className,
}: {
  id?: string; value: number | null; onChange: (v: number | null) => void; allowNegative?: boolean;
  align?: 'left' | 'right'; placeholder?: string; ariaLabel?: string; describedBy?: string; className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(value === null ? '' : plain.format(value));

  useEffect(() => {
    if (!focused) setText(value === null ? '' : plain.format(value));
  }, [value, focused]);

  return (
    <div className={cx('relative', className)}>
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-faint" aria-hidden>$</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        placeholder={placeholder}
        value={text}
        onFocus={e => {
          setFocused(true);
          setText(value === null ? '' : String(value));
          requestAnimationFrame(() => e.target.select());
        }}
        onBlur={() => setFocused(false)}
        onChange={e => {
          const raw = e.target.value;
          if (!/^[-−(]?[\d,.\s$]*\)?$/.test(raw)) return;
          setText(raw);
          onChange(parseAmount(raw, allowNegative));
        }}
        className={cx(inputBase, 'pl-8', align === 'right' && 'text-right')}
      />
    </div>
  );
}

export function MoneyField({
  label, hint, value, onChange, allowNegative, fieldClassName,
}: {
  label: string; hint?: React.ReactNode; value: number | null; onChange: (v: number | null) => void;
  allowNegative?: boolean; fieldClassName?: string;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id} className={fieldClassName}>
      <MoneyInput
        id={id}
        value={value}
        onChange={onChange}
        allowNegative={allowNegative}
        describedBy={hint ? `${id}-hint` : undefined}
        className="max-w-[16rem]"
      />
    </Field>
  );
}

/** Two-option question rendered as a radio group. */
export function YesNo({
  legend, hint, value, onChange, yes = 'Yes', no = 'No',
}: {
  legend: string; hint?: React.ReactNode; value: boolean | null; onChange: (v: boolean) => void;
  yes?: string; no?: string;
}) {
  const name = useId();
  const option = (v: boolean, label: string) => (
    <label
      className={cx(
        'flex h-11 min-w-[5.5rem] cursor-pointer items-center justify-center rounded-[10px] border px-4 text-[0.9375rem] font-medium transition-colors duration-150',
        'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-spruce-500',
        value === v
          ? 'border-spruce-900 bg-spruce-900 text-white'
          : 'border-line-strong bg-white text-ink hover:border-spruce-700 hover:bg-ground',
      )}
    >
      <input type="radio" name={name} className="sr-only" checked={value === v} onChange={() => onChange(v)} />
      {label}
    </label>
  );
  return (
    <div
      role="radiogroup"
      aria-labelledby={`${name}-q`}
      aria-describedby={hint ? `${name}-h` : undefined}
      className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-8"
    >
      <div className="min-w-0">
        <p id={`${name}-q`} className="text-base font-medium leading-snug text-ink">{legend}</p>
        {hint && <p id={`${name}-h`} className="mt-1 text-sm leading-snug text-faint">{hint}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        {option(true, yes)}
        {option(false, no)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

export function Callout({
  tone = 'info', title, children, action,
}: {
  tone?: 'info' | 'warn' | 'bad'; title?: string; children?: React.ReactNode; action?: React.ReactNode;
}) {
  const Icon = tone === 'info' ? Info : tone === 'warn' ? TriangleAlert : AlertCircle;
  return (
    <div
      role={tone === 'bad' ? 'alert' : undefined}
      className={cx(
        'flex gap-3 rounded-xl border p-4 text-[0.9375rem] leading-relaxed',
        tone === 'info' && 'border-transparent bg-mint text-spruce-950',
        tone === 'warn' && 'border-warn-line bg-warn-bg text-warn-ink',
        tone === 'bad' && 'border-bad-line bg-bad-bg text-bad-ink',
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title && 'mt-0.5')}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

/** A label and amount on one line, for statements and breakdowns. */
export function Row({
  label, value, strong, muted, sub,
}: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; muted?: boolean; sub?: React.ReactNode }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-4 py-2', strong && 'font-semibold text-ink', muted && 'text-sub')}>
      <div className="min-w-0">
        <div>{label}</div>
        {sub && <div className="text-sm font-normal text-faint">{sub}</div>}
      </div>
      <div className="shrink-0 tabular-nums">{value}</div>
    </div>
  );
}
