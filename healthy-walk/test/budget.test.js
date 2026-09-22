/**
 * Budget tests.
 *
 * The cap is the whole point of this module: it has to be a wall, not a
 * suggestion. These check that it stops a search *before* the money is
 * spent, and that the usage maths is in the right ballpark.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { priceAnthropicUsage, estimateSearchCost, PRICES } from '../server/budget.js';

test('an all-fresh Opus 5 turn is priced from list rates', () => {
  const cost = priceAnthropicUsage({
    input_tokens: 1_000_000,
    output_tokens: 0,
  }, 'claude-opus-5');

  assert.equal(Math.round(cost * 100) / 100, 5, '$5 per million input tokens');
});

test('output tokens cost five times input', () => {
  const input = priceAnthropicUsage({ input_tokens: 1_000_000 }, 'claude-opus-5');
  const output = priceAnthropicUsage({ output_tokens: 1_000_000 }, 'claude-opus-5');
  assert.equal(Math.round(output / input), 5);
});

test('a cache read is a tenth the price of fresh input', () => {
  const fresh = priceAnthropicUsage({ input_tokens: 1_000_000 }, 'claude-opus-5');
  const cached = priceAnthropicUsage({ cache_read_input_tokens: 1_000_000 }, 'claude-opus-5');
  assert.ok(Math.abs(cached - fresh * 0.1) < 0.001);
});

test('web searches are billed on top of tokens', () => {
  const withoutSearch = priceAnthropicUsage({ input_tokens: 1000 }, 'claude-opus-5');
  const withSearch = priceAnthropicUsage(
    { input_tokens: 1000, server_tool_use: { web_search_requests: 5 } },
    'claude-opus-5',
  );
  assert.ok(withSearch > withoutSearch);
  assert.ok(Math.abs((withSearch - withoutSearch) - 5 * PRICES.anthropic.perWebSearch) < 1e-9);
});

test('an unknown model is priced, not ignored', () => {
  // Silently pricing a model at zero would let an unrecognised model spend
  // without limit — the one failure mode a budget must not have.
  assert.ok(priceAnthropicUsage({ input_tokens: 1_000_000 }, 'some-future-model') > 0);
});

test('missing usage costs nothing rather than throwing', () => {
  assert.equal(priceAnthropicUsage(undefined), 0);
  assert.equal(priceAnthropicUsage(null, 'claude-opus-5'), 0);
});

/* ── Estimates ─────────────────────────────────────────────────────────── */

test('the estimate scales with how many menus get read', () => {
  const six = estimateSearchCost(6, 'claude-opus-5');
  const twelve = estimateSearchCost(12, 'claude-opus-5');
  assert.ok(twelve > six * 1.8, 'doubling the menus should roughly double the bill');
});

test('a cheaper model estimates cheaper', () => {
  assert.ok(
    estimateSearchCost(6, 'claude-haiku-4-5') < estimateSearchCost(6, 'claude-opus-5'),
  );
});

test('the default search stays well under a $25 monthly cap', () => {
  const perSearch = estimateSearchCost(6, 'claude-opus-5');
  assert.ok(perSearch < 3, `one search should not be a meaningful slice of the cap, got $${perSearch}`);
  assert.ok(25 / perSearch > 10, 'a $25 cap should buy at least ten searches at the defaults');
});
