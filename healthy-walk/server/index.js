/**
 * Healthy Walk — server entry point.
 *
 * Turns "where should we eat" into "what should we eat": takes your location
 * and your health criteria, finds the restaurants you can walk to, reads
 * their menus, and hands back the specific dishes that fit.
 */

import { config, capabilities, modeDescription } from './config.js';
import { createApp, json, readJsonBody, openEventStream } from './http.js';
import { runSearch } from './search.js';
import { geocodeAddress, photoRedirectUrl } from './places.js';
import { listSaved, saveDish, removeSaved } from './saved.js';
import { cacheStats, cacheClear } from './cache.js';
import {
  PROTEINS, ALLERGENS, DIETS, OIL_PREFERENCES, PRICE_LEVELS,
  WALK_MINUTE_OPTIONS, defaultCriteria, sanitizeCriteria,
} from '../shared/criteria.js';
import { MACRO_DISCLAIMER, ALLERGEN_DISCLAIMER } from '../shared/nutrition.js';

const routes = {
  'GET /api/health': (req, res) => json(res, 200, { ok: true, mode: capabilities.mode }),

  /** Everything the client needs to render the form. One round trip. */
  'GET /api/config': (req, res) =>
    json(res, 200, {
      mode: capabilities.mode,
      modeDescription: modeDescription(),
      capabilities: { places: capabilities.places, menuAI: capabilities.menuAI },
      model: capabilities.menuAI ? config.model : null,
      maxRestaurants: config.maxRestaurants,
      disclaimers: { macros: MACRO_DISCLAIMER, allergens: ALLERGEN_DISCLAIMER },
      vocab: {
        proteins: PROTEINS,
        allergens: ALLERGENS,
        diets: DIETS,
        oilPreferences: OIL_PREFERENCES,
        priceLevels: PRICE_LEVELS,
        walkMinuteOptions: WALK_MINUTE_OPTIONS,
      },
      defaults: defaultCriteria(),
    }),

  /**
   * The search. Streamed, because reading ten menus takes 10-40 seconds and
   * watching dishes arrive one at a time beats staring at a spinner.
   */
  'POST /api/search': async (req, res) => {
    const body = await readJsonBody(req);
    const criteria = sanitizeCriteria(body.criteria ?? body);

    if (!criteria.location) {
      json(res, 400, { error: 'No location. Allow location access, or type an address.' });
      return;
    }

    const stream = openEventStream(req, res);
    const abort = new AbortController();
    req.on('close', () => abort.abort());

    try {
      await runSearch(criteria, {
        signal: abort.signal,
        emit: (event, data) => stream.send(event, data),
      });
    } catch (err) {
      if (!abort.signal.aborted) {
        console.error('[search]', err);
        stream.send('error', { message: err.message ?? 'The search failed.' });
      }
    } finally {
      stream.close();
    }
  },

  /** Address → coordinates, for when the browser won't give up GPS. */
  'POST /api/geocode': async (req, res) => {
    const { query } = await readJsonBody(req);
    if (!query || typeof query !== 'string') {
      json(res, 400, { error: 'Type an address or a neighbourhood.' });
      return;
    }
    json(res, 200, await geocodeAddress(query.trim()));
  },

  /**
   * Photo proxy. Google's photo endpoint needs the API key, and the key does
   * not belong in the browser — so the <img> points here instead.
   */
  'GET /api/photo': async (req, res, url) => {
    const name = url.searchParams.get('name');
    const maxPx = Number(url.searchParams.get('w')) || 800;
    if (!name) {
      json(res, 400, { error: 'Missing photo name' });
      return;
    }

    try {
      const target = await photoRedirectUrl(name, maxPx);
      res.writeHead(302, { Location: target, 'Cache-Control': 'public, max-age=86400' });
      res.end();
    } catch {
      // A missing photo is normal — the card falls back to the logo.
      res.writeHead(404).end();
    }
  },

  'GET /api/saved': (req, res) => json(res, 200, { items: listSaved() }),

  'POST /api/saved': async (req, res) => {
    const dish = await readJsonBody(req);
    if (!dish?.name) {
      json(res, 400, { error: 'Nothing to save.' });
      return;
    }
    json(res, 200, { item: saveDish(dish) });
  },

  'DELETE /api/saved': (req, res, url) => {
    const id = url.searchParams.get('id');
    json(res, 200, { removed: id ? removeSaved(id) : false });
  },

  'GET /api/cache': (req, res) => json(res, 200, cacheStats()),

  'DELETE /api/cache': (req, res) => {
    cacheClear();
    json(res, 200, { cleared: true });
  },
};

const app = createApp({ staticDir: config.publicDir, routes });

app.listen(config.port, () => {
  const url = `http://localhost:${config.port}`;
  console.log('');
  console.log('  🥑  Healthy Walk');
  console.log(`      ${url}`);
  console.log(`      ${modeDescription()}`);
  if (capabilities.mode !== 'full') {
    console.log('      Keys go in healthy-walk/.env — see .env.example.');
  }
  console.log('');
});
