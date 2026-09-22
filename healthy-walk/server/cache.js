/**
 * A small two-tier cache: memory in front, JSON files behind.
 *
 * This exists for one reason — every menu analysis is a paid AI call with a
 * web search inside it. Searching the same block twice in an afternoon
 * should cost nothing the second time.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

const memory = new Map();

function keyToFile(namespace, key) {
  const hash = crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
  return path.join(config.cacheDir, namespace, `${hash}.json`);
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

export function cacheGet(namespace, key, maxAgeMs = config.cacheHours * 3600_000) {
  const memKey = `${namespace}:${key}`;
  const hit = memory.get(memKey);
  if (hit && Date.now() - hit.storedAt < maxAgeMs) return hit.value;

  const file = keyToFile(namespace, key);
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Date.now() - raw.storedAt >= maxAgeMs) return null;
    memory.set(memKey, raw);
    return raw.value;
  } catch {
    return null;
  }
}

export function cacheSet(namespace, key, value) {
  const entry = { storedAt: Date.now(), value };
  memory.set(`${namespace}:${key}`, entry);

  const file = keyToFile(namespace, key);
  try {
    ensureDir(file);
    fs.writeFileSync(file, JSON.stringify(entry));
  } catch (err) {
    // A cache that can't write is a slow cache, not a broken app.
    console.warn(`[cache] could not persist ${namespace}: ${err.message}`);
  }
  return value;
}

/** Run `fn` only on a miss. */
export async function cached(namespace, key, fn, maxAgeMs) {
  const hit = cacheGet(namespace, key, maxAgeMs);
  if (hit !== null) return hit;

  const value = await fn();
  return cacheSet(namespace, key, value);
}

export function cacheStats() {
  let files = 0;
  let bytes = 0;
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        files += 1;
        try {
          bytes += fs.statSync(full).size;
        } catch {
          /* raced with a delete; ignore */
        }
      }
    }
  };
  walk(config.cacheDir);
  return { files, bytes, inMemory: memory.size };
}

export function cacheClear() {
  memory.clear();
  fs.rmSync(config.cacheDir, { recursive: true, force: true });
}
