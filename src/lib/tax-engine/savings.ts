import type { Calculation, ReturnData } from './types';
import { ASSET_KINDS, FEDERAL_GENERAL_RATE, PROVINCES } from './rates';
import { round2 } from './calculator';
import { money, percent } from '../format';

/**
 * What the tax rules took off this return, in dollars, so the person can see it.
 *
 * Every figure is measured against a stated baseline and says what that baseline is.
 * Nothing here is a claim that another preparer would have missed it; it is the value
 * of rules the return applies, worked out from the return's own numbers.
 */
export interface SavingsItem {
  id: string;
  /**
   * saved: less tax this year.
   * sooner: a deduction taken earlier than the standard schedule. It lowers this year's tax
   *   and raises later years' by the same total, so it is never added to "saved".
   * banked: worth something in a future year, nothing this year.
   */
  kind: 'saved' | 'sooner' | 'banked';
  title: string;
  amount: number;
  detail: string;
}

export interface Savings {
  items: SavingsItem[];
  /** Total of the "saved" items only. */
  saved: number;
  sooner: number;
  banked: number;
}

export function findSavings(data: ReturnData, calc: Calculation): Savings {
  const items: SavingsItem[] = [];
  const rate = calc.federalRate + calc.provincialRate;
  const province = data.company.province ? PROVINCES[data.company.province].name : null;

  if (!calc.isNil) {
    /* Small business rate. Only the federal part is counted until provincial general rates are added. */
    if (calc.taxableIncome > 0 && !calc.overBusinessLimit) {
      items.push({
        id: 'small-business-rate',
        kind: 'saved',
        title: 'Small business rate',
        amount: round2(calc.taxableIncome * (FEDERAL_GENERAL_RATE - calc.federalRate)),
        detail: `Federal tax at ${percent(calc.federalRate)} instead of the general ${percent(FEDERAL_GENERAL_RATE)}, `
          + 'because the company qualifies for the small business deduction.'
          + (province ? ` ${province}’s small business rate is lower than its general rate too, which isn’t counted here.` : ''),
      });
    }

    /* Losses from earlier years, used against this year's income. */
    if (calc.lossApplied > 0) {
      items.push({
        id: 'losses-used',
        kind: 'saved',
        title: 'Earlier losses used',
        amount: round2(calc.lossApplied * rate),
        detail: `${money(calc.lossApplied)} of losses from earlier years came off this year’s income before tax was worked out.`,
      });
    }

    /* Equipment written off faster than the standard half-year rule. A loss year gets no tax effect from it. */
    if (calc.taxLoss === 0 && calc.taxableIncome > 0) {
      const yearFraction = calc.daysInYear ? Math.min(1, calc.daysInYear / 365) : 1;
      let extra = 0;
      for (const asset of calc.cca.assets) {
        if (asset.kind === 'software') continue; // Class 12 is 100% by its own rule, not by an incentive.
        const standard = round2(asset.cost * (ASSET_KINDS[asset.kind].rate / 2) * yearFraction);
        extra += Math.max(0, asset.claim - standard);
      }
      extra = round2(Math.min(extra, calc.taxableIncome + extra));
      if (extra > 0) {
        items.push({
          id: 'faster-write-off',
          kind: 'sooner',
          title: 'Equipment deducted sooner',
          amount: round2(extra * rate),
          detail: `${money(extra)} more of this year’s equipment was deducted now than the standard first-year rule allows. `
            + 'The same amount is deducted either way; this brings it forward.',
        });
      }
    }
  }

  /* Losses still unused, valued at today's rate. */
  if (calc.lossClosing > 0) {
    items.push({
      id: 'losses-banked',
      kind: 'banked',
      title: 'Losses carried forward',
      amount: round2(calc.lossClosing * rate),
      detail: `${money(calc.lossClosing)} of losses is saved for future years. At today’s ${percent(rate)} rate, `
        + `the company’s next ${money(calc.lossClosing)} of profit would be tax-free.`,
    });
  }

  const total = (kind: SavingsItem['kind']) => round2(items.filter(i => i.kind === kind).reduce((s, i) => s + i.amount, 0));
  return { items, saved: total('saved'), sooner: total('sooner'), banked: total('banked') };
}
