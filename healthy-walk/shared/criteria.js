/**
 * The vocabulary of the app.
 *
 * Everything the user can ask for lives here, and both the browser and the
 * server import this same file. If a term isn't in this module, it doesn't
 * exist anywhere else in Healthy Walk.
 */

/* ── Proteins ──────────────────────────────────────────────────────────── */

export const PROTEINS = [
  { id: 'chicken', label: 'Chicken', emoji: '🍗', aliases: ['chicken', 'poultry', 'hen'] },
  { id: 'beef', label: 'Beef', emoji: '🥩', aliases: ['beef', 'steak', 'sirloin', 'ribeye', 'filet', 'brisket', 'burger patty'] },
  { id: 'turkey', label: 'Turkey', emoji: '🦃', aliases: ['turkey'] },
  { id: 'pork', label: 'Pork', emoji: '🥓', aliases: ['pork', 'bacon', 'ham', 'carnitas', 'al pastor', 'chorizo'] },
  { id: 'lamb', label: 'Lamb', emoji: '🐑', aliases: ['lamb', 'mutton', 'gyro'] },
  { id: 'bison', label: 'Bison', emoji: '🦬', aliases: ['bison', 'buffalo'] },
  { id: 'salmon', label: 'Salmon', emoji: '🐟', aliases: ['salmon', 'lox'] },
  { id: 'whitefish', label: 'White fish', emoji: '🐠', aliases: ['cod', 'halibut', 'mahi', 'snapper', 'branzino', 'tilapia', 'sea bass', 'trout'] },
  { id: 'tuna', label: 'Tuna', emoji: '🍣', aliases: ['tuna', 'ahi', 'poke'] },
  { id: 'shrimp', label: 'Shrimp', emoji: '🦐', aliases: ['shrimp', 'prawn'] },
  { id: 'shellfish', label: 'Other shellfish', emoji: '🦀', aliases: ['crab', 'lobster', 'scallop', 'mussel', 'clam', 'oyster'] },
  { id: 'eggs', label: 'Eggs', emoji: '🥚', aliases: ['egg', 'eggs', 'omelet', 'omelette', 'frittata'] },
  { id: 'tofu', label: 'Tofu / tempeh', emoji: '🧈', aliases: ['tofu', 'tempeh', 'seitan'] },
  { id: 'legume', label: 'Beans / lentils', emoji: '🫘', aliases: ['beans', 'lentil', 'chickpea', 'garbanzo', 'falafel', 'edamame'] },
];

/* ── Allergens ─────────────────────────────────────────────────────────── */
/* The FDA "big 9", plus the two the app's owner is most likely to need. */

export const ALLERGENS = [
  { id: 'gluten', label: 'Gluten / wheat', severityNote: 'Ask about shared fryers and soy sauce.' },
  { id: 'dairy', label: 'Dairy', severityNote: 'Butter finishes are often unlisted.' },
  { id: 'egg', label: 'Egg', severityNote: 'Hides in aioli, batters and glazes.' },
  { id: 'peanut', label: 'Peanut', severityNote: 'Common in Thai, Vietnamese and some fryer oils.' },
  { id: 'treenut', label: 'Tree nuts', severityNote: 'Pesto, crusts, desserts, nut milks.' },
  { id: 'soy', label: 'Soy', severityNote: 'Soy oil and soy sauce are nearly everywhere.' },
  { id: 'fish', label: 'Fish', severityNote: 'Fish sauce and Worcestershire count.' },
  { id: 'shellfish', label: 'Shellfish', severityNote: 'Shared fryers and stocks are the risk.' },
  { id: 'sesame', label: 'Sesame', severityNote: 'Buns, tahini, hummus, za\'atar.' },
  { id: 'corn', label: 'Corn', severityNote: 'Tortillas, starch thickeners, corn oil.' },
  { id: 'nightshade', label: 'Nightshades', severityNote: 'Tomato, pepper, potato, eggplant, paprika.' },
];

/* ── Diet tags ─────────────────────────────────────────────────────────── */

export const DIETS = [
  { id: 'gluten_free', label: 'Gluten free' },
  { id: 'dairy_free', label: 'Dairy free' },
  { id: 'keto', label: 'Keto' },
  { id: 'low_carb', label: 'Low carb' },
  { id: 'paleo', label: 'Paleo' },
  { id: 'whole30', label: 'Whole30' },
  { id: 'high_protein', label: 'High protein' },
  { id: 'pescatarian', label: 'Pescatarian' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
];

/* ── Cooking fat preference ────────────────────────────────────────────── */

export const OIL_PREFERENCES = [
  {
    id: 'none',
    label: 'No preference',
    blurb: 'Don\'t factor cooking oil into the ranking.',
  },
  {
    id: 'avoid_seed_oils',
    label: 'Avoid seed oils',
    blurb: 'Penalise canola, soybean, corn, sunflower, safflower, grapeseed, cottonseed, rice bran and generic "vegetable oil".',
  },
  {
    id: 'prefer_avocado',
    label: 'Prefer avocado oil',
    blurb: 'Avoid seed oils, and reward places that cook in avocado oil specifically.',
  },
  {
    id: 'prefer_olive',
    label: 'Prefer olive oil',
    blurb: 'Avoid seed oils, and reward olive oil and extra virgin olive oil.',
  },
  {
    id: 'prefer_animal_fat',
    label: 'Prefer tallow / butter / ghee',
    blurb: 'Avoid seed oils, and reward beef tallow, butter, ghee, duck fat and lard.',
  },
];

/* ── Price levels (mirrors Google's enum) ──────────────────────────────── */

export const PRICE_LEVELS = [
  { id: 'PRICE_LEVEL_INEXPENSIVE', label: '$' },
  { id: 'PRICE_LEVEL_MODERATE', label: '$$' },
  { id: 'PRICE_LEVEL_EXPENSIVE', label: '$$$' },
  { id: 'PRICE_LEVEL_VERY_EXPENSIVE', label: '$$$$' },
];

/* ── Walking ───────────────────────────────────────────────────────────── */

/**
 * 1.33 m/s is the widely cited mean adult walking speed on level ground.
 * We plan in MINUTES because the app is called Healthy Walk — the owner
 * thinks in "how long until I'm eating", not in miles.
 */
export const WALK_METERS_PER_MINUTE = 80;

/** Streets aren't straight lines. Crow-flies × this ≈ real walking distance. */
export const STREET_DETOUR_FACTOR = 1.25;

export const WALK_MINUTE_OPTIONS = [5, 10, 15, 20, 25, 30, 45, 60];

export function walkMinutesToMeters(minutes) {
  return Math.round((minutes * WALK_METERS_PER_MINUTE) / STREET_DETOUR_FACTOR);
}

export function metersToWalkMinutes(meters) {
  return Math.max(1, Math.round((meters * STREET_DETOUR_FACTOR) / WALK_METERS_PER_MINUTE));
}

export function metersToMiles(meters) {
  return meters / 1609.344;
}

/* ── The criteria object ───────────────────────────────────────────────── */

/**
 * One search request. This shape travels from the browser to the server to
 * the AI prompt and back into the scorer, so treat it as a wire format:
 * add fields, don't rename them.
 */
export function defaultCriteria() {
  return {
    // Where
    location: null,          // { lat, lng, label }
    walkMinutes: 15,

    // What
    proteins: [],            // PROTEINS ids — empty means "any"
    diets: [],               // DIETS ids
    allergens: [],           // ALLERGENS ids to EXCLUDE
    oilPreference: 'none',   // OIL_PREFERENCES id

    // Numbers
    maxCalories: null,       // kcal ceiling for the dish
    minProtein: null,        // grams floor
    maxCarbs: null,          // grams ceiling

    // The place itself
    minRating: 4.0,
    minReviews: 25,
    priceLevels: [],         // PRICE_LEVELS ids — empty means "any"
    openNow: true,

    // Free text — the escape hatch for anything the form doesn't cover
    notes: '',
  };
}

/** Fields that persist as the owner's profile so they never retype them. */
export const PERSISTED_CRITERIA_FIELDS = [
  'walkMinutes', 'proteins', 'diets', 'allergens', 'oilPreference',
  'maxCalories', 'minProtein', 'maxCarbs', 'minRating', 'minReviews',
  'priceLevels', 'openNow', 'notes',
];

/* ── Lookup helpers ────────────────────────────────────────────────────── */

const byId = (list) => Object.fromEntries(list.map((item) => [item.id, item]));

export const PROTEIN_BY_ID = byId(PROTEINS);
export const ALLERGEN_BY_ID = byId(ALLERGENS);
export const DIET_BY_ID = byId(DIETS);
export const OIL_PREFERENCE_BY_ID = byId(OIL_PREFERENCES);

export function labelFor(list, id) {
  return byId(list)[id]?.label ?? id;
}

/**
 * Render the criteria as the sentence a person would actually say out loud.
 * Used in the AI prompt and in the results header, so the owner can see
 * exactly what was searched for.
 */
export function describeCriteria(criteria) {
  const parts = [];

  if (criteria.proteins?.length) {
    parts.push(criteria.proteins.map((id) => labelFor(PROTEINS, id).toLowerCase()).join(' or '));
  } else {
    parts.push('anything');
  }

  if (criteria.diets?.length) {
    parts.push(criteria.diets.map((id) => labelFor(DIETS, id).toLowerCase()).join(', '));
  }

  const oil = OIL_PREFERENCE_BY_ID[criteria.oilPreference];
  if (oil && oil.id !== 'none') parts.push(oil.label.toLowerCase());

  if (criteria.maxCalories) parts.push(`under ${criteria.maxCalories} cal`);
  if (criteria.minProtein) parts.push(`${criteria.minProtein}g+ protein`);
  if (criteria.maxCarbs) parts.push(`under ${criteria.maxCarbs}g carbs`);

  if (criteria.allergens?.length) {
    parts.push(`no ${criteria.allergens.map((id) => labelFor(ALLERGENS, id).toLowerCase()).join(', no ')}`);
  }

  parts.push(`within a ${criteria.walkMinutes} minute walk`);

  return parts.join(', ');
}

/**
 * Normalise anything that arrives over the wire. Never trust the client:
 * this both fills in defaults and drops ids we don't recognise.
 */
export function sanitizeCriteria(input = {}) {
  const base = defaultCriteria();
  const keep = (value, list) =>
    Array.isArray(value) ? value.filter((id) => list.some((item) => item.id === id)) : [];
  const num = (value, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.min(max, Math.max(min, n));
  };

  return {
    ...base,
    location: input.location && Number.isFinite(Number(input.location.lat)) && Number.isFinite(Number(input.location.lng))
      ? {
          lat: Number(input.location.lat),
          lng: Number(input.location.lng),
          label: String(input.location.label ?? 'Current location').slice(0, 120),
        }
      : null,
    walkMinutes: num(input.walkMinutes, 1, 120) ?? base.walkMinutes,
    proteins: keep(input.proteins, PROTEINS),
    diets: keep(input.diets, DIETS),
    allergens: keep(input.allergens, ALLERGENS),
    oilPreference: OIL_PREFERENCE_BY_ID[input.oilPreference] ? input.oilPreference : 'none',
    maxCalories: num(input.maxCalories, 100, 5000),
    minProtein: num(input.minProtein, 0, 300),
    maxCarbs: num(input.maxCarbs, 0, 500),
    minRating: num(input.minRating, 0, 5) ?? base.minRating,
    minReviews: num(input.minReviews, 0, 100000) ?? base.minReviews,
    priceLevels: keep(input.priceLevels, PRICE_LEVELS),
    openNow: input.openNow !== false,
    notes: String(input.notes ?? '').slice(0, 500),
  };
}
