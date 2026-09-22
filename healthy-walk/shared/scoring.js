/**
 * Ranking.
 *
 * The brief was: "the list should go from top to bottom, top having positive
 * reviews on Google, and also a place that fits my criteria's the best."
 *
 * So two things decide the order, and neither is allowed to dominate: how
 * good the restaurant is, and how well the dish matches what was asked for.
 * Distance and macro fit are tie-breakers. Confidence is a discount — a dish
 * we're guessing at should not outrank one we actually read off a menu.
 */

import { PROTEIN_BY_ID, ALLERGEN_BY_ID, DIET_BY_ID, OIL_PREFERENCE_BY_ID } from './criteria.js';

export const WEIGHTS = {
  criteriaFit: 0.40,   // does this dish do what I asked
  reviewQuality: 0.30, // is this place any good
  macroFit: 0.15,      // does it hit my numbers
  proximity: 0.15,     // how far do I have to walk
};

/** How much credit each match status earns. `unknown` is deliberately low. */
export const STATUS_CREDIT = {
  confirmed: 1.0,
  likely: 0.65,
  unknown: 0.2,
  failed: 0,
};

/* ── Review quality ────────────────────────────────────────────────────── */

/**
 * Google's raw star average is unusable on its own: a 5.0 from four people
 * is not better than a 4.6 from two thousand. This pulls small samples back
 * toward the average restaurant until they've earned their rating.
 *
 * C is roughly the mean Google restaurant rating; m is how many reviews it
 * takes for a place's own average to outweigh that prior.
 */
export const RATING_PRIOR_MEAN = 4.3;
export const RATING_PRIOR_WEIGHT = 50;

export function bayesianRating(rating, reviewCount) {
  if (rating == null) return RATING_PRIOR_MEAN;
  const v = Math.max(0, reviewCount ?? 0);
  return (
    (v / (v + RATING_PRIOR_WEIGHT)) * rating +
    (RATING_PRIOR_WEIGHT / (v + RATING_PRIOR_WEIGHT)) * RATING_PRIOR_MEAN
  );
}

/**
 * Map an adjusted rating onto 0-1. Below 3.5 nobody wants to eat there, so
 * that's the floor; 5.0 is the ceiling. A small bonus for places with a lot
 * of reviews, because volume is its own signal of consistency.
 */
export function reviewQualityScore(rating, reviewCount) {
  const adjusted = bayesianRating(rating, reviewCount);
  const base = clamp01((adjusted - 3.5) / 1.5);

  // log10(2000)/log10(2000) = 1. Caps out around two thousand reviews.
  const volume = clamp01(Math.log10(Math.max(1, reviewCount ?? 0)) / Math.log10(2000));

  return clamp01(base * 0.85 + volume * 0.15);
}

/* ── Criteria fit ──────────────────────────────────────────────────────── */

/**
 * Average the credit across everything the user actually asked for.
 * Criteria they didn't ask for don't count either way.
 */
export function criteriaFitScore(matches = []) {
  if (!matches.length) return 1;

  const total = matches.reduce((sum, match) => sum + (STATUS_CREDIT[match.status] ?? 0), 0);
  return clamp01(total / matches.length);
}

/* ── Macro fit ─────────────────────────────────────────────────────────── */

/**
 * Score against whichever targets were set. Going over a ceiling degrades
 * rather than fails — 720 calories against a 700 ceiling is a fine dinner,
 * and pretending otherwise would hide good results.
 */
export function macroFitScore(macros, criteria) {
  const parts = [];

  const underCeiling = (value, ceiling) => {
    if (value == null) return null;
    if (value <= ceiling) return 1;
    // Zero once you're 50% over.
    return clamp01(1 - (value - ceiling) / (ceiling * 0.5));
  };

  const overFloor = (value, floor) => {
    if (value == null) return null;
    if (value >= floor) return 1;
    // Zero at half the target.
    return clamp01((value - floor * 0.5) / (floor * 0.5));
  };

  if (criteria.maxCalories) parts.push(underCeiling(macros.calories, criteria.maxCalories));
  if (criteria.maxCarbs) parts.push(underCeiling(macros.carbs, criteria.maxCarbs));
  if (criteria.minProtein) parts.push(overFloor(macros.protein, criteria.minProtein));

  const known = parts.filter((part) => part !== null);

  // No targets set: macros shouldn't move the ranking at all.
  if (!criteria.maxCalories && !criteria.maxCarbs && !criteria.minProtein) return 1;

  // Targets set but we have no numbers. Neither reward nor punish — the
  // confidence discount already handles not knowing.
  if (!known.length) return 0.5;

  return clamp01(known.reduce((sum, part) => sum + part, 0) / known.length);
}

/* ── Proximity ─────────────────────────────────────────────────────────── */

/**
 * Exponential decay across the walking budget. A place at the far edge of a
 * 20-minute radius still scores 0.30 — worth walking to for the right dish,
 * just not for a mediocre one.
 */
export function proximityScore(walkMinutes, maxWalkMinutes) {
  if (!Number.isFinite(walkMinutes) || !maxWalkMinutes) return 0.5;
  return clamp01(Math.exp(-1.2 * (walkMinutes / maxWalkMinutes)));
}

/* ── The score ─────────────────────────────────────────────────────────── */

/**
 * Confidence discounts the two dish-specific components only. How good the
 * restaurant is, and how far away it is, are facts we're sure of regardless
 * of how well we read the menu.
 */
export function scoreDish(dish, criteria) {
  const restaurant = dish.restaurant ?? {};
  const confidence = clamp01(dish.confidence ?? 0.5);

  const components = {
    criteriaFit: criteriaFitScore(dish.criteria),
    reviewQuality: reviewQualityScore(restaurant.rating, restaurant.reviewCount),
    macroFit: macroFitScore(dish.macros ?? {}, criteria),
    proximity: proximityScore(restaurant.walkMinutes, criteria.walkMinutes),
  };

  const weighted =
    WEIGHTS.criteriaFit * components.criteriaFit * confidence +
    WEIGHTS.reviewQuality * components.reviewQuality +
    WEIGHTS.macroFit * components.macroFit * confidence +
    WEIGHTS.proximity * components.proximity;

  return {
    score: Math.round(clamp01(weighted) * 100),
    breakdown: {
      ...components,
      confidence,
      weights: WEIGHTS,
      contribution: {
        criteriaFit: round2(WEIGHTS.criteriaFit * components.criteriaFit * confidence * 100),
        reviewQuality: round2(WEIGHTS.reviewQuality * components.reviewQuality * 100),
        macroFit: round2(WEIGHTS.macroFit * components.macroFit * confidence * 100),
        proximity: round2(WEIGHTS.proximity * components.proximity * 100),
      },
    },
  };
}

/* ── Hard constraints ──────────────────────────────────────────────────── */

/**
 * The difference between filtering and scoring is the difference between
 * "I'd rather not" and "I can't eat that".
 *
 * Returns a reason string when the dish must be dropped, or null to keep it.
 *
 * One rule matters more than the rest: an allergen we merely *couldn't find*
 * is not an allergen we ruled out. Only a positive detection excludes. The
 * unknowns stay in the list, flagged amber, with the standing warning to ask
 * the restaurant — because silently dropping them would imply a certainty
 * about the rest that a menu description can't support.
 */
export function hardConstraintViolation(dish, criteria) {
  const restaurant = dish.restaurant ?? {};

  if (criteria.walkMinutes && restaurant.walkMinutes > criteria.walkMinutes * 1.15) {
    return `${restaurant.walkMinutes} min walk is past your ${criteria.walkMinutes} min limit`;
  }
  if (criteria.minRating && restaurant.rating != null && restaurant.rating < criteria.minRating) {
    return `Rated ${restaurant.rating}, below your ${criteria.minRating} minimum`;
  }
  if (criteria.minReviews && (restaurant.reviewCount ?? 0) < criteria.minReviews) {
    return `Only ${restaurant.reviewCount} reviews`;
  }
  if (criteria.priceLevels?.length && restaurant.priceLevel && !criteria.priceLevels.includes(restaurant.priceLevel)) {
    return 'Outside your price range';
  }

  // Allergens: a detection excludes; not finding one never means "safe".
  for (const allergenId of criteria.allergens ?? []) {
    const flagged = dish.allergenFindings?.find((finding) => finding.allergenId === allergenId);
    if (flagged && (flagged.status === 'present' || flagged.status === 'likely_present')) {
      return `Contains ${ALLERGEN_BY_ID[allergenId]?.label.toLowerCase() ?? allergenId}`;
    }
  }

  // A diet the dish demonstrably breaks. `unknown` survives; `failed` doesn't.
  for (const match of dish.criteria ?? []) {
    if (match.status !== 'failed') continue;
    if (DIET_BY_ID[match.id]) return `Not ${DIET_BY_ID[match.id].label.toLowerCase()}`;
    if (PROTEIN_BY_ID[match.id]) return `No ${PROTEIN_BY_ID[match.id].label.toLowerCase()}`;
  }

  return null;
}

/**
 * Score, filter and sort a batch of dishes.
 * Returns the ranked list plus what was dropped and why, so the UI can say
 * "8 more were filtered out" instead of silently hiding them.
 */
export function rankDishes(dishes, criteria) {
  const kept = [];
  const dropped = [];

  for (const dish of dishes) {
    const violation = hardConstraintViolation(dish, criteria);
    if (violation) {
      dropped.push({ name: dish.name, restaurant: dish.restaurant?.name, reason: violation });
      continue;
    }
    const { score, breakdown } = scoreDish(dish, criteria);
    kept.push({ ...dish, score, scoreBreakdown: breakdown });
  }

  kept.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Same score: the closer one wins, then the better-reviewed one.
    const walk = (a.restaurant?.walkMinutes ?? 999) - (b.restaurant?.walkMinutes ?? 999);
    if (walk !== 0) return walk;
    return (b.restaurant?.rating ?? 0) - (a.restaurant?.rating ?? 0);
  });

  return { dishes: kept, dropped };
}

/** Plain-English label for the badge. */
export function scoreLabel(score) {
  if (score >= 85) return 'Excellent match';
  if (score >= 70) return 'Strong match';
  if (score >= 55) return 'Good match';
  if (score >= 40) return 'Partial match';
  return 'Loose match';
}

/**
 * One sentence explaining the badge, built from whichever component actually
 * carried the score. Used for the tooltip and the screen-reader label.
 */
export function explainScore(dish, criteria) {
  const breakdown = dish.scoreBreakdown;
  if (!breakdown) return '';

  const ordered = Object.entries(breakdown.contribution).sort((a, b) => b[1] - a[1]);
  const names = {
    criteriaFit: 'matches your criteria',
    reviewQuality: 'strong Google reviews',
    macroFit: 'hits your macro targets',
    proximity: 'a short walk away',
  };

  const top = ordered.slice(0, 2).map(([key]) => names[key]);
  const caveat = breakdown.confidence < 0.6 ? ', though the menu details are unconfirmed' : '';

  const oil = OIL_PREFERENCE_BY_ID[criteria.oilPreference];
  const oilNote = oil && oil.id !== 'none' && dish.fatVerdict === 'preferred'
    ? `, cooked in ${dish.cookingFat}`
    : '';

  return `${scoreLabel(dish.score)}: ${top.join(' and ')}${oilNote}${caveat}.`;
}

/* ── helpers ───────────────────────────────────────────────────────────── */

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}
