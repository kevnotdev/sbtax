'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { DEMO_FILING, PRODUCT_NAME, TAGLINE, WELCOME_IMAGE } from '@/lib/brand';
import { Logo } from './Logo';
import { Button, cx } from './ui';

/**
 * Shown while the app starts. It is in the first paint, so nothing flashes before it.
 * When `play` turns true it finishes its entrance, then lifts away and calls `onDone`.
 * It plays on every load, including reloads, over whichever screen comes next.
 */
export function Splash({ play, onDone }: { play: boolean; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const tagline = useRef<HTMLParagraphElement>(null);

  // Leave once the entrance has actually been seen: the cue is the last animation finishing,
  // not a clock, so a tab opened in the background still plays the whole thing when looked at.
  useEffect(() => {
    if (!play) return;
    const timers: number[] = [];
    let left = false;
    const leave = () => {
      if (left) return;
      left = true;
      timers.push(window.setTimeout(() => setLeaving(true), 400));
      timers.push(window.setTimeout(onDone, 950));
    };
    const el = tagline.current;
    const running = el?.getAnimations?.().some(a => a.playState !== 'finished') ?? false;
    if (!el || !running) {
      leave();
    } else {
      el.addEventListener('animationend', leave, { once: true });
      // If the animation never reports back, don't strand anyone behind the splash.
      timers.push(window.setTimeout(leave, 6000));
    }
    return () => {
      el?.removeEventListener('animationend', leave);
      timers.forEach(t => window.clearTimeout(t));
    };
  }, [play, onDone]);

  return (
    <div
      aria-hidden
      className={cx(
        'fixed inset-0 z-50 flex flex-col items-center justify-center bg-spruce-900 px-6 text-white',
        'transition-[opacity,transform] duration-500 ease-out',
        leaving && 'pointer-events-none -translate-y-4 opacity-0',
      )}
    >
      <Logo animate tone="dark" className="h-16 w-16" />
      <p className="mt-5 text-center text-[2.25rem] font-semibold leading-none tracking-[-0.03em] sm:text-[3rem]">
        {[...PRODUCT_NAME].map((letter, i) => (
          <span
            key={i}
            className="splash-letter inline-block whitespace-pre"
            style={{ animationDelay: `${250 + i * 45}ms` }}
          >
            {letter}
          </span>
        ))}
      </p>
      <span className="splash-rule mt-5 block h-0.5 w-24 rounded-full bg-spruce-300" />
      <p ref={tagline} className="splash-tagline mt-4 text-center text-[0.9375rem] text-spruce-100/80">{TAGLINE}</p>
    </div>
  );
}

const POINTS = [
  'About 15 minutes if your numbers are ready',
  'Shows what the tax rules saved you, in dollars',
  'Switching? Bring in last year’s return from a PDF',
];

/** The front door: who this is for, and one obvious way in. */
export function Welcome({
  onStart, onSample, onImport,
}: { onStart: () => void; onSample: () => void; onImport: () => void }) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="relative h-64 overflow-hidden bg-spruce-900 sm:h-80 lg:h-auto lg:min-h-screen">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={WELCOME_IMAGE.src} alt={WELCOME_IMAGE.alt} className="absolute inset-0 h-full w-full object-cover object-[center_60%] lg:object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-spruce-950/80 via-spruce-950/10 to-transparent" aria-hidden />
        <p className="absolute inset-x-0 bottom-0 hidden p-10 text-lg font-medium leading-snug text-white lg:block xl:p-14">
          The return your accountant would prepare,
          <span className="block text-spruce-100/85">explained the way you’d explain it to a friend.</span>
        </p>
      </div>

      <main className="flex items-center px-6 py-10 sm:px-10 lg:px-14 xl:px-20">
        <div className="welcome-rise mx-auto w-full max-w-[28rem]">
          <p className="flex items-center gap-2.5 font-semibold tracking-[-0.01em] text-spruce-900">
            <Logo className="h-8 w-8" /> {PRODUCT_NAME}
          </p>
          <h1 className="mt-8 text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[2.5rem]">
            Corporate tax, on autopilot.
          </h1>
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-sub">
            Plug in your numbers for the year. {PRODUCT_NAME} does the tax accounting, fills in the CRA
            forms and makes sure the books add up, so your T2 return comes out finished. Built for small
            businesses and corporations in Canada.
          </p>

          <ul className="mt-7 space-y-3 text-[0.9375rem] text-ink">
            {POINTS.map(point => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint text-spruce-700">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                </span>
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button onClick={onStart} className="h-[3.25rem] px-7 text-base">
              Get started <ArrowRight className="h-[1.125rem] w-[1.125rem]" aria-hidden />
            </Button>
            <Button variant="ghost" onClick={onSample} className="h-[3.25rem]">Try a sample company</Button>
          </div>
          <p className="mt-4 text-sm text-sub">
            Used other tax software last year?{' '}
            <button type="button" onClick={onImport} className="font-medium text-spruce-700 underline underline-offset-4">
              Import that return
            </button>
          </p>

          {DEMO_FILING && (
            <p className="mt-10 border-t border-line pt-5 text-sm leading-relaxed text-faint">
              Preview build. You can prepare a full return, but it can’t be sent to CRA yet.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
