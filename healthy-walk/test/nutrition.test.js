/**
 * The menu-reading tests.
 *
 * Every case below is a real mistake the matcher made at some point. A false
 * positive here isn't cosmetic: it silently drops a dish the diner would have
 * wanted, and they never find out it existed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyseAllergen, analyseCookingFat, findMenuTerms,
} from '../shared/nutrition.js';

/* ── Allergens: things that look like gluten but aren't ────────────────── */

test('plain grilled fish is not flagged for gluten', () => {
  const result = analyseAllergen(
    'Seared wild salmon over massaged kale, shaved fennel, olive oil and lemon.',
    'gluten',
  );
  assert.equal(result.status, 'unknown', 'no keyword should match — "massaged" is not "wheat"');
});

test('"No Pita" means no pita', () => {
  const result = analyseAllergen('Lamb Kofta, No Pita. Grilled over charcoal, olive oil.', 'gluten');
  assert.equal(result.status, 'unknown');
});

test('corn tortillas are gluten free', () => {
  const result = analyseAllergen('Grilled skirt steak, two corn tortillas, black beans.', 'gluten');
  assert.equal(result.status, 'unknown');
});

test('rice noodles are gluten free', () => {
  const result = analyseAllergen('Rice noodles, shrimp, egg, bean sprout, tamarind.', 'gluten');
  assert.equal(result.status, 'unknown');
});

test('tamari is the wheat-free soy sauce', () => {
  assert.equal(analyseAllergen('Seared tuna with tamari and ginger.', 'gluten').status, 'unknown');
  // ...but it is still very much soy.
  assert.equal(analyseAllergen('Seared tuna with tamari and ginger.', 'soy').status, 'present');
});

/* ── Allergens: things that are gluten ─────────────────────────────────── */

test('a bun is gluten', () => {
  const result = analyseAllergen('Two beef patties, American cheese, toasted bun.', 'gluten');
  assert.equal(result.status, 'present');
});

test('soy sauce is a hidden gluten source', () => {
  const result = analyseAllergen('Grilled chicken with a soy sauce glaze.', 'gluten');
  assert.equal(result.status, 'likely_present');
});

test('Caesar dressing hides both fish and egg', () => {
  assert.equal(analyseAllergen('Chicken Caesar salad.', 'fish').status, 'likely_present');
  assert.equal(analyseAllergen('Chicken Caesar salad.', 'egg').status, 'likely_present');
});

test('an allergen that cannot be ruled out is never reported as absent', () => {
  const result = analyseAllergen('Grilled chicken breast with seasonal vegetables.', 'dairy');
  // The one invariant that matters: "we found nothing" must never render as safe.
  assert.equal(result.status, 'unknown');
  assert.notEqual(result.status, 'absent');
  assert.match(result.evidence, /ask before ordering/i);
});

/* ── Cooking fats ──────────────────────────────────────────────────────── */

test('a named seed oil is a confirmed seed oil', () => {
  const result = analyseCookingFat('Chicken tossed in canola oil.');
  assert.equal(result.verdict, 'seed_oil');
  assert.equal(result.status, 'confirmed');
});

test('"vegetable oil" counts as a seed oil', () => {
  assert.equal(analyseCookingFat('Fried in vegetable oil.').verdict, 'seed_oil');
});

test('avocado oil is recognised and attributed to its family', () => {
  const result = analyseCookingFat('Everything cooked in avocado oil.');
  assert.equal(result.verdict, 'preferred');
  assert.equal(result.family, 'avocado');
});

test('beef tallow lands in the animal-fat family', () => {
  assert.equal(analyseCookingFat('Basted in beef tallow.').family, 'animal');
});

test('deep frying with no named oil is flagged as a risk, not as fine', () => {
  const result = analyseCookingFat('Crispy beer battered cod and fries.');
  assert.equal(result.verdict, 'unknown');
  assert.equal(result.friedRisk, 'high');
});

test('grilling reads as low fryer-oil risk', () => {
  const result = analyseCookingFat('Charcoal grilled chicken thigh with herbs.');
  assert.equal(result.verdict, 'neutral');
  assert.equal(result.friedRisk, 'low');
});

test('an unstated fat stays unstated', () => {
  assert.equal(analyseCookingFat('Half chicken with two sides.').verdict, 'unknown');
});

/* ── The term matcher itself ───────────────────────────────────────────── */

test('matching respects word boundaries', () => {
  // "massaged" contains no whole word from the list; the old substring scan
  // disagreed and cost a good salmon dish.
  assert.deepEqual(findMenuTerms('massaged kale and fennel', ['rye', 'ale', 'sage']), []);
});

test('matching tolerates plurals', () => {
  assert.deepEqual(findMenuTerms('served with two buns', ['bun']), ['bun']);
});

test('safe compounds defuse their keyword, plural included', () => {
  assert.deepEqual(findMenuTerms('cauliflower rice bowl', ['rice'], ['cauliflower rice']), []);
  assert.deepEqual(findMenuTerms('rice noodles with shrimp', ['noodle'], ['rice noodle']), []);
});

test('a safe compound does not mask a genuine separate mention', () => {
  const found = findMenuTerms('cauliflower rice and a side of white rice', ['rice'], ['cauliflower rice']);
  assert.deepEqual(found, ['rice']);
});

test('negations are stripped', () => {
  assert.deepEqual(findMenuTerms('burger without bun', ['bun']), []);
  assert.deepEqual(findMenuTerms('salad, hold the cheese', ['cheese']), []);
});
