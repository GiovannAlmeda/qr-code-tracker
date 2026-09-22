/**
 * "Save For Later".
 *
 * Kept on the server as a single JSON file rather than in the browser, so a
 * dish saved on the phone at lunchtime is still there on the laptop that
 * evening — and survives clearing the browser.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT } from './config.js';

const FILE = path.join(ROOT, 'data', 'saved.json');

function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  // Write-then-rename: a crash mid-write can't leave a truncated list behind.
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2));
  fs.renameSync(tmp, FILE);
}

/**
 * Stable identity for a dish, so saving the same thing twice from two
 * different searches updates one entry instead of creating a duplicate.
 */
export function dishKey(dish) {
  const place = dish.restaurant?.placeId ?? dish.restaurant?.name ?? '';
  return crypto
    .createHash('sha1')
    .update(`${place}::${(dish.name ?? '').toLowerCase().trim()}`)
    .digest('hex')
    .slice(0, 16);
}

export function listSaved() {
  return readAll().sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
}

export function saveDish(dish) {
  const id = dishKey(dish);
  const items = readAll();
  const existing = items.findIndex((item) => item.id === id);

  const entry = {
    ...dish,
    id,
    savedAt: existing === -1 ? Date.now() : items[existing].savedAt,
    updatedAt: Date.now(),
  };

  if (existing === -1) items.push(entry);
  else items[existing] = entry;

  writeAll(items);
  return entry;
}

export function removeSaved(id) {
  const items = readAll();
  const next = items.filter((item) => item.id !== id);
  const removed = next.length !== items.length;
  if (removed) writeAll(next);
  return removed;
}

export function isSaved(dish) {
  const id = dishKey(dish);
  return readAll().some((item) => item.id === id);
}
