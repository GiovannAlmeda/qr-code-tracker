/**
 * Configuration and capability detection.
 *
 * Healthy Walk is designed to run at three levels, and to tell you honestly
 * which one you're on:
 *
 *   demo   — no keys. Hand-built sample data so you can see the app work.
 *   places — Google key only. Real restaurants, real ratings, real walk
 *            times, but dishes are inferred from the restaurant's cuisine
 *            rather than read off its menu.
 *   full   — both keys. The real thing: actual menu items, read from the
 *            restaurant's own site, with macros estimated per dish.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');

/**
 * Minimal .env reader. A dependency for this would be silly — we need
 * KEY=value and nothing else.
 */
function loadDotEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;

  for (const rawLine of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Real environment variables always win over the file.
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const int = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

/** A cap of 0 or "off" means no cap; anything else is a hard dollar ceiling. */
const budget = (value, fallback) => {
  const raw = (value ?? '').trim().toLowerCase();
  if (raw === 'off' || raw === 'none' || raw === 'unlimited') return null;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return n <= 0 ? null : n;
};

export const config = {
  port: int(process.env.PORT, 8787),

  googleKey: process.env.GOOGLE_MAPS_API_KEY?.trim() || null,
  anthropicKey: process.env.ANTHROPIC_API_KEY?.trim() || null,

  model: process.env.HW_MODEL?.trim() || 'claude-opus-5',
  // Reasoning depth per menu lookup. 'medium' reads a menu well and costs
  // noticeably less than the 'high' default; raise it if results feel thin.
  effort: process.env.HW_EFFORT?.trim() || 'medium',
  // Six is the sweet spot: roughly 18 candidate dishes, which is more than
  // anyone scrolls, at about half the cost of ten. Raise it if you're in a
  // dense area and want a wider net.
  maxRestaurants: int(process.env.HW_MAX_RESTAURANTS, 6),
  cacheHours: int(process.env.HW_CACHE_HOURS, 72),

  // A hard monthly ceiling on API spend. The app refuses to start a search
  // that would cross it rather than warning after the fact.
  monthlyBudget: budget(process.env.HW_MONTHLY_BUDGET_USD, 25),

  cacheDir: path.join(ROOT, 'data', 'cache'),
  publicDir: path.join(ROOT, 'public'),
};

export const capabilities = {
  places: Boolean(config.googleKey),
  menuAI: Boolean(config.anthropicKey),
  get mode() {
    if (this.places && this.menuAI) return 'full';
    if (this.places) return 'places';
    return 'demo';
  },
};

/** One line the UI can show so the owner always knows what they're looking at. */
export function modeDescription() {
  switch (capabilities.mode) {
    case 'full':
      return 'Live: real restaurants near you, with menus read by AI.';
    case 'places':
      return 'Partial: real restaurants near you, but dish suggestions are inferred — add an Anthropic key to read actual menus.';
    default:
      return 'Demo: sample data only. Add your API keys in .env to search for real.';
  }
}
