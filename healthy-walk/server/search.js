/**
 * The search: location and criteria in, ranked dishes out.
 *
 * Results stream. Reading ten menus takes half a minute, and watching dishes
 * appear one at a time — each slotting into its ranked position — is a much
 * better thirty seconds than a spinner. The client re-sorts on every arrival,
 * and the final `done` event carries the authoritative ranking.
 */

import { config, capabilities } from './config.js';
import { findNearbyRestaurants } from './places.js';
import { analyseRestaurant } from './menu-ai.js';
import { analyseDish } from './analyse.js';
import { demoDishes, DEMO_NOTICE } from './demo-data.js';
import { rankDishes, scoreDish } from '../shared/scoring.js';
import { checkBudget, estimateSearchCost, countSearch, status as budgetStatus } from './budget.js';
import { describeCriteria } from '../shared/criteria.js';
import { MACRO_DISCLAIMER, ALLERGEN_DISCLAIMER } from '../shared/nutrition.js';

/** How many menus to read at once. Enough to be quick, not enough to rate-limit. */
const AI_CONCURRENCY = 4;

/** Dishes to ask for per restaurant. */
const DISHES_PER_RESTAURANT = 3;

/**
 * Run tasks with a fixed number in flight, calling `onResult` as each lands
 * rather than at the end.
 */
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

export async function runSearch(criteria, { emit, signal }) {
  const started = Date.now();

  emit('status', {
    stage: 'searching',
    message: capabilities.places ? 'Finding places you can walk to…' : 'Building your sample neighbourhood…',
    criteria: describeCriteria(criteria),
    mode: capabilities.mode,
  });

  /* ── Demo mode ─────────────────────────────────────────────────────── */

  if (!capabilities.places) {
    const analysed = demoDishes(criteria.location).map((dish) => analyseDish(dish, criteria));
    const { dishes, dropped } = rankDishes(analysed, criteria);

    for (const dish of dishes) emit('dish', dish);
    emit('done', {
      count: dishes.length,
      dropped,
      restaurantsSearched: 8,
      elapsedMs: Date.now() - started,
      notice: DEMO_NOTICE,
      disclaimers: disclaimersFor(criteria),
      dishes,
    });
    return;
  }

  /* ── Who's nearby ──────────────────────────────────────────────────── */

  const restaurants = await findNearbyRestaurants(criteria);

  if (!restaurants.length) {
    emit('done', {
      count: 0,
      dropped: [],
      restaurantsSearched: 0,
      elapsedMs: Date.now() - started,
      empty: 'nothing_nearby',
      disclaimers: disclaimersFor(criteria),
      dishes: [],
    });
    return;
  }

  // Best-reviewed first, so the restaurants worth reading get read even if
  // the search is cut short. This is the only place review quality is used
  // on its own — the final ranking weighs it against criteria fit.
  const shortlist = restaurants
    .slice()
    .sort((a, b) => (b.rating ?? 0) * Math.log10(10 + (b.reviewCount ?? 0)) - (a.rating ?? 0) * Math.log10(10 + (a.reviewCount ?? 0)))
    .slice(0, config.maxRestaurants);

  // The gate. Check before spending on menus, not after — and only once the
  // shortlist is known, so the estimate reflects this search rather than a
  // worst case.
  if (capabilities.menuAI) {
    const estimate = estimateSearchCost(shortlist.length, config.model);
    const blocked = checkBudget(estimate);

    if (blocked) {
      emit('done', {
        count: 0,
        dropped: [],
        restaurantsSearched: 0,
        elapsedMs: Date.now() - started,
        empty: 'over_budget',
        budgetMessage: blocked,
        budget: budgetStatus(),
        restaurants: shortlist,
        disclaimers: disclaimersFor(criteria),
        dishes: [],
      });
      return;
    }
    countSearch();
  }

  emit('status', {
    stage: 'reading',
    message: capabilities.menuAI
      ? `Reading ${shortlist.length} menus…`
      : `Found ${shortlist.length} places. Add an Anthropic key to read their menus.`,
    restaurantCount: restaurants.length,
    shortlisted: shortlist.length,
    restaurants: shortlist.map((place) => ({
      placeId: place.placeId,
      name: place.name,
      rating: place.rating,
      reviewCount: place.reviewCount,
      walkMinutes: place.walkMinutes,
      photoName: place.photoName,
    })),
  });

  /* ── Places-only mode ──────────────────────────────────────────────── */

  // A Google key without an Anthropic key gets real restaurants but no menu
  // reading. Rather than invent dishes, say so and show the places — the
  // owner can still decide where to walk.
  if (!capabilities.menuAI) {
    emit('done', {
      count: 0,
      dropped: [],
      restaurantsSearched: shortlist.length,
      elapsedMs: Date.now() - started,
      empty: 'no_menu_ai',
      restaurants: shortlist,
      disclaimers: disclaimersFor(criteria),
      dishes: [],
    });
    return;
  }

  /* ── Read the menus ────────────────────────────────────────────────── */

  const collected = [];
  let completed = 0;
  const failures = [];

  await mapWithConcurrency(shortlist, AI_CONCURRENCY, async (restaurant) => {
    if (signal?.aborted) return null;

    const result = await analyseRestaurant(restaurant, criteria, DISHES_PER_RESTAURANT, signal);
    completed += 1;

    if (result.failed) failures.push({ restaurant: restaurant.name, reason: result.notes });

    emit('progress', {
      completed,
      total: shortlist.length,
      restaurant: restaurant.name,
      found: result.dishes.length,
      menuFound: result.menuFound,
    });

    for (const raw of result.dishes) {
      const analysed = analyseDish({ ...raw, menuNotes: result.notes }, criteria);

      // Score it now so the card can show its badge the moment it appears,
      // even though the list keeps re-sorting as siblings arrive.
      const { score, breakdown } = scoreDish(analysed, criteria);
      const dish = { ...analysed, score, scoreBreakdown: breakdown };

      collected.push(analysed);
      emit('dish', dish);
    }

    return result;
  });

  /* ── Final ranking ─────────────────────────────────────────────────── */

  const { dishes, dropped } = rankDishes(collected, criteria);

  emit('done', {
    count: dishes.length,
    dropped,
    failures,
    restaurantsSearched: shortlist.length,
    elapsedMs: Date.now() - started,
    empty: dishes.length ? null : 'no_matching_dishes',
    budget: budgetStatus(),
    disclaimers: disclaimersFor(criteria),
    dishes,
  });
}

/**
 * Which warnings this particular search has earned. The allergen one is
 * unconditional whenever an allergen was part of the query — menus don't
 * list every ingredient, and the results must never imply otherwise.
 */
function disclaimersFor(criteria) {
  const list = [{ id: 'macros', text: MACRO_DISCLAIMER }];

  if (criteria.allergens?.length) {
    list.unshift({ id: 'allergens', text: ALLERGEN_DISCLAIMER, severity: 'high' });
  }
  return list;
}
