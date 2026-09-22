/**
 * Ranking tests.
 *
 * The brief was "top having positive reviews on Google, and also a place
 * that fits my criteria's the best". These are the properties that has to
 * mean in practice.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  scoreDish, rankDishes, reviewQualityScore, bayesianRating,
  criteriaFitScore, macroFitScore, proximityScore, hardConstraintViolation,
} from '../shared/scoring.js';

const place = (rating, reviewCount, walkMinutes = 8) => ({ rating, reviewCount, walkMinutes });
const baseCriteria = { walkMinutes: 15 };

/* ── Review quality ────────────────────────────────────────────────────── */

test('a 5.0 from three people does not beat a 4.7 from two thousand', () => {
  // The owner called this out by name. It's the whole reason the rating is
  // shrunk toward a prior instead of used raw.
  assert.ok(
    reviewQualityScore(5.0, 3) < reviewQualityScore(4.7, 2000),
    'small-sample perfection must lose to a large, near-perfect sample',
  );
});

test('the Bayesian prior pulls thin samples toward the average restaurant', () => {
  assert.ok(bayesianRating(5.0, 3) < 4.5, 'three reviews should barely move off the prior');
  assert.ok(bayesianRating(4.7, 5000) > 4.65, 'five thousand reviews should nearly be taken at face value');
});

test('a missing rating does not crash or win', () => {
  assert.ok(reviewQualityScore(null, 0) < reviewQualityScore(4.5, 500));
});

/* ── Criteria fit ──────────────────────────────────────────────────────── */

test('unknown earns far less credit than confirmed', () => {
  const confirmed = criteriaFitScore([{ status: 'confirmed' }, { status: 'confirmed' }]);
  const unknown = criteriaFitScore([{ status: 'unknown' }, { status: 'unknown' }]);
  assert.ok(unknown < confirmed / 2, 'a shrug is not a match');
});

test('asking for nothing is satisfied by anything', () => {
  assert.equal(criteriaFitScore([]), 1);
});

/* ── Macro fit ─────────────────────────────────────────────────────────── */

test('macro targets nobody set do not move the score', () => {
  assert.equal(macroFitScore({ calories: 2000 }, baseCriteria), 1);
});

test('going slightly over a ceiling degrades rather than fails', () => {
  const criteria = { ...baseCriteria, maxCalories: 700 };
  const slightly = macroFitScore({ calories: 740 }, criteria);
  assert.ok(slightly > 0.5 && slightly < 1, `720-ish should be a near miss, got ${slightly}`);
  assert.equal(macroFitScore({ calories: 1200 }, criteria), 0, 'way over is a zero');
});

test('missing macros are neutral, not a failure', () => {
  assert.equal(macroFitScore({}, { ...baseCriteria, maxCalories: 700 }), 0.5);
});

/* ── Confidence ────────────────────────────────────────────────────────── */

test('confidence does not penalise criteria the diner never set', () => {
  // The bug this test exists for: an unverified dish used to lose a third of
  // its score against an empty requirement list.
  const dish = { restaurant: place(4.6, 900), macros: {}, criteria: [] };
  const sure = scoreDish({ ...dish, confidence: 1 }, baseCriteria).score;
  const unsure = scoreDish({ ...dish, confidence: 0.4 }, baseCriteria).score;
  assert.equal(sure, unsure, 'with nothing asked for, confidence has nothing to discount');
});

test('a verified partial match outranks a guessed perfect one', () => {
  const criteria = { ...baseCriteria, maxCalories: 700, minProtein: 40 };

  const verified = scoreDish({
    restaurant: place(4.5, 800, 9),
    confidence: 0.92,
    macros: { calories: 650, protein: 45, carbs: 30, fat: 30 },
    criteria: [{ status: 'confirmed' }, { status: 'unknown' }],
  }, criteria).score;

  const guessed = scoreDish({
    restaurant: place(4.5, 800, 9),
    confidence: 0.35,
    macros: { calories: 600, protein: 50, carbs: 20, fat: 25 },
    criteria: [{ status: 'confirmed' }, { status: 'confirmed' }],
  }, criteria).score;

  assert.ok(verified > guessed, `something we read (${verified}) must beat something we guessed (${guessed})`);
});

test('the score breakdown adds up to the score', () => {
  const result = scoreDish({
    restaurant: place(4.4, 600, 10),
    confidence: 0.8,
    macros: { calories: 600, protein: 40, carbs: 30, fat: 25 },
    criteria: [{ status: 'confirmed' }],
  }, { ...baseCriteria, maxCalories: 700 });

  const summed = Object.values(result.breakdown.contribution).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(summed - result.score) < 1, `${summed} should equal ${result.score}`);
});

/* ── Proximity ─────────────────────────────────────────────────────────── */

test('closer is better, and the far edge is still worth something', () => {
  assert.ok(proximityScore(2, 20) > proximityScore(18, 20));
  assert.ok(proximityScore(20, 20) > 0.25, 'the edge of the radius is not worthless');
});

/* ── Hard constraints ──────────────────────────────────────────────────── */

test('a detected allergen excludes the dish', () => {
  const dish = {
    restaurant: place(4.8, 900),
    allergenFindings: [{ allergenId: 'gluten', status: 'present' }],
  };
  assert.match(
    hardConstraintViolation(dish, { ...baseCriteria, allergens: ['gluten'] }) ?? '',
    /gluten/i,
  );
});

test('an allergen we merely could not confirm does NOT exclude the dish', () => {
  // This is the load-bearing one. Menus don't list ingredients, so "unknown"
  // is the common case — dropping those would leave almost nothing, and
  // would imply the survivors had been cleared, which they haven't.
  const dish = {
    restaurant: place(4.8, 900),
    allergenFindings: [{ allergenId: 'gluten', status: 'unknown' }],
  };
  assert.equal(hardConstraintViolation(dish, { ...baseCriteria, allergens: ['gluten'] }), null);
});

test('a dish beyond the walking budget is excluded', () => {
  const dish = { restaurant: place(4.9, 5000, 40) };
  assert.match(hardConstraintViolation(dish, baseCriteria) ?? '', /walk/i);
});

test('a place below the rating floor is excluded', () => {
  const dish = { restaurant: place(3.2, 500, 5) };
  assert.match(hardConstraintViolation(dish, { ...baseCriteria, minRating: 4 }) ?? '', /3\.2/);
});

/* ── The whole ranking ─────────────────────────────────────────────────── */

test('ranking sorts by score and reports what it dropped', () => {
  const criteria = { ...baseCriteria, allergens: ['gluten'] };

  const dishes = [
    {
      name: 'Mediocre but close',
      restaurant: place(4.0, 200, 3),
      confidence: 0.8, macros: {}, criteria: [{ status: 'unknown' }],
      allergenFindings: [],
    },
    {
      name: 'Excellent match',
      restaurant: place(4.8, 2400, 6),
      confidence: 0.9, macros: {}, criteria: [{ status: 'confirmed' }],
      allergenFindings: [],
    },
    {
      name: 'Has gluten',
      restaurant: place(4.9, 3000, 2),
      confidence: 0.9, macros: {}, criteria: [{ status: 'confirmed' }],
      allergenFindings: [{ allergenId: 'gluten', status: 'present' }],
    },
  ];

  const { dishes: ranked, dropped } = rankDishes(dishes, criteria);

  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].name, 'Excellent match');
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].name, 'Has gluten');
  // Scores must descend.
  assert.ok(ranked[0].score >= ranked[1].score);
});
