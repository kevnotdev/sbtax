import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calculator';
import { findSavings } from './savings';
import { EMPTY_RETURN, SAMPLE_RETURN } from './sample';
import type { ReturnData } from './types';

const clone = (d: ReturnData): ReturnData => JSON.parse(JSON.stringify(d));
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);
const savings = (d: ReturnData) => findSavings(d, calculate(d));
const item = (d: ReturnData, id: string) => savings(d).items.find(i => i.id === id);

test('sample company: small business rate and a laptop deducted sooner', () => {
  const s = savings(SAMPLE_RETURN);
  // $131,376 taxed federally at 9% instead of 15%.
  near(item(SAMPLE_RETURN, 'small-business-rate')!.amount, 131376 * 0.06);
  // Laptop: fully deducted ($3,499) instead of the half-year 27.5% ($962.23), at 12.2%.
  near(item(SAMPLE_RETURN, 'faster-write-off')!.amount, (3499 - 962.23) * 0.122);
  near(s.saved, 7882.56);
  // Bringing a deduction forward is not counted as money saved.
  near(s.sooner, 309.49);
  near(s.banked, 0);
});

test('earlier losses used are valued at the rate actually paid', () => {
  const d = clone(SAMPLE_RETURN);
  d.priorLosses = 31376;
  near(item(d, 'losses-used')!.amount, 31376 * 0.122);
  near(item(d, 'small-business-rate')!.amount, 100000 * 0.06);
  assert.equal(item(d, 'losses-banked'), undefined, 'all used, nothing left to bank');
});

test('a loss year saves nothing now but banks the loss', () => {
  const d = clone(SAMPLE_RETURN);
  d.revenue = 1000;
  d.priorLosses = 4417;
  const c = calculate(d);
  const s = findSavings(d, c);
  near(s.saved, 0);
  near(s.sooner, 0);
  assert.deepEqual(s.items.map(i => i.id), ['losses-banked']);
  near(s.banked, (4417 + c.taxLoss) * 0.122);
  assert.match(s.items[0].detail, /tax-free/);
});

test('nothing is claimed where there is nothing to claim', () => {
  assert.deepEqual(savings(EMPTY_RETURN).items, []);

  const nil = clone(SAMPLE_RETURN);
  nil.hadActivity = false;
  assert.deepEqual(savings(nil).items, []);

  // Over the business limit the small business rate does not simply apply, so it is not claimed.
  const big = clone(SAMPLE_RETURN);
  big.revenue = 900000;
  assert.equal(item(big, 'small-business-rate'), undefined);

  // Software is 100% by its class, not by an incentive.
  const software = clone(SAMPLE_RETURN);
  software.assets = [{ id: 's', description: 'Licence', kind: 'software', date: '2025-02-01', cost: 400 }];
  assert.equal(item(software, 'faster-write-off'), undefined);
});
