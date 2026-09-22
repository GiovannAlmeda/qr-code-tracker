/**
 * Money.
 *
 * Every real search spends: Google bills per place lookup, Anthropic bills
 * per token and per web search. Left alone that's an open tab, and an app
 * that quietly runs up a bill is a bad app to own.
 *
 * So this module keeps a running ledger per calendar month, refuses to start
 * a search that would go over the cap, and shows what's left. The cap is a
 * hard stop, not a warning — the point is that it cannot be exceeded by
 * forgetting about it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, config } from './config.js';

const LEDGER = path.join(ROOT, 'data', 'spend.json');

/**
 * Published list prices, US dollars.
 *
 * These are estimates for your own visibility — the authority on what you
 * actually owe is your Google Cloud and Anthropic console. They're here so
 * the app can stop itself, not so it can do your accounting.
 */
export const PRICES = {
  anthropic: {
    // Per million tokens.
    'claude-opus-5':   { input: 5, output: 25 },
    'claude-fable-5-1':{ input: 10, output: 50 },
    'claude-sonnet-5': { input: 2, output: 10 },
    'claude-haiku-4-5':{ input: 1, output: 5 },
    // Cache writes cost a little more than fresh input; reads cost a tenth.
    cacheWriteMultiplier: 1.25,
    cacheReadMultiplier: 0.1,
    // Per web search performed by the server-side tool.
    perWebSearch: 0.01,
  },
  google: {
    // Nearby Search billed at the Enterprise tier, because `rating` is an
    // Enterprise field and the whole ranking depends on it.
    nearbySearch: 0.035,
    geocode: 0.005,
    photo: 0.007,
  },
};

const DEFAULT_MODEL_PRICE = { input: 5, output: 25 };

function currentMonth() {
  // Deliberately not `toISOString().slice(0,7)` on a Date built from nothing —
  // the ledger should roll over in the owner's own timezone.
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function readLedger() {
  try {
    const parsed = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
    if (parsed?.month === currentMonth()) return parsed;
  } catch {
    /* no ledger yet, or last month's */
  }
  return { month: currentMonth(), total: 0, anthropic: 0, google: 0, searches: 0, entries: [] };
}

function writeLedger(ledger) {
  try {
    fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
    const tmp = `${LEDGER}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(ledger, null, 2));
    fs.renameSync(tmp, LEDGER);
  } catch (err) {
    console.warn(`[budget] could not write the ledger: ${err.message}`);
  }
}

/** What a single Anthropic response cost, from its own usage report. */
export function priceAnthropicUsage(usage, model = config.model) {
  if (!usage) return 0;

  const rate = PRICES.anthropic[model] ?? DEFAULT_MODEL_PRICE;
  const { cacheWriteMultiplier, cacheReadMultiplier, perWebSearch } = PRICES.anthropic;

  const input = (usage.input_tokens ?? 0) / 1e6 * rate.input;
  const cacheWrite = (usage.cache_creation_input_tokens ?? 0) / 1e6 * rate.input * cacheWriteMultiplier;
  const cacheRead = (usage.cache_read_input_tokens ?? 0) / 1e6 * rate.input * cacheReadMultiplier;
  const output = (usage.output_tokens ?? 0) / 1e6 * rate.output;
  const searches = (usage.server_tool_use?.web_search_requests ?? 0) * perWebSearch;

  return input + cacheWrite + cacheRead + output + searches;
}

/** Record a spend. Returns the updated ledger. */
export function record(vendor, amount, label) {
  if (!Number.isFinite(amount) || amount <= 0) return readLedger();

  const ledger = readLedger();
  ledger.total += amount;
  ledger[vendor] = (ledger[vendor] ?? 0) + amount;

  // Keep a short tail so "where did the money go" is answerable without
  // letting the file grow forever.
  ledger.entries.unshift({ at: Date.now(), vendor, amount: round4(amount), label });
  ledger.entries = ledger.entries.slice(0, 200);

  writeLedger(ledger);
  return ledger;
}

export function countSearch() {
  const ledger = readLedger();
  ledger.searches += 1;
  writeLedger(ledger);
  return ledger;
}

export function status() {
  const ledger = readLedger();
  const cap = config.monthlyBudget;

  return {
    month: ledger.month,
    cap,
    spent: round4(ledger.total),
    remaining: cap === null ? null : Math.max(0, round4(cap - ledger.total)),
    anthropic: round4(ledger.anthropic ?? 0),
    google: round4(ledger.google ?? 0),
    searches: ledger.searches ?? 0,
    exhausted: cap !== null && ledger.total >= cap,
  };
}

/**
 * What a search is likely to cost before running it, so the cap can be
 * checked up front rather than discovered halfway through.
 *
 * Reading a menu means several web searches and a page fetch or two, so the
 * per-restaurant figure is dominated by input tokens rather than output.
 * This is a deliberately generous estimate — better to stop one search early
 * than to sail past the cap.
 */
export function estimateSearchCost(restaurantCount, model = config.model) {
  const rate = PRICES.anthropic[model] ?? DEFAULT_MODEL_PRICE;

  // Roughly: 25k input tokens of fetched menu, 2k output, 3 web searches.
  const perRestaurant =
    (25_000 / 1e6) * rate.input +
    (2_000 / 1e6) * rate.output +
    3 * PRICES.anthropic.perWebSearch;

  return round4(PRICES.google.nearbySearch + perRestaurant * restaurantCount);
}

/**
 * The gate. Called before a search starts.
 * Returns null to proceed, or a message explaining why not.
 */
export function checkBudget(estimatedCost) {
  const cap = config.monthlyBudget;
  if (cap === null) return null;

  const { spent } = status();

  if (spent >= cap) {
    return `You've hit your $${cap.toFixed(2)} monthly cap for ${currentMonth()} ` +
      `($${spent.toFixed(2)} spent). Raise HW_MONTHLY_BUDGET_USD in .env, or wait for next month.`;
  }

  if (spent + estimatedCost > cap) {
    return `This search would cost about $${estimatedCost.toFixed(2)} and you have ` +
      `$${(cap - spent).toFixed(2)} left of your $${cap.toFixed(2)} monthly cap. ` +
      'Lower HW_MAX_RESTAURANTS to make it cheaper, or raise the cap in .env.';
  }

  return null;
}

export function resetLedger() {
  writeLedger({ month: currentMonth(), total: 0, anthropic: 0, google: 0, searches: 0, entries: [] });
}

function round4(value) {
  return Math.round(value * 10_000) / 10_000;
}
