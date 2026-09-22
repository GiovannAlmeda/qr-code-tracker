/**
 * Nutrition knowledge: what the words on a menu actually mean.
 *
 * Two jobs. First, read a dish description and work out what's in it — which
 * fat it was cooked in, which allergens it's likely to carry. Second, be
 * honest about the limits of doing that, because menu descriptions are
 * marketing copy, not ingredient lists.
 */

/* ── Disclaimers ───────────────────────────────────────────────────────── */

/**
 * Shown wherever an allergen filter is in play. The owner asked for this
 * explicitly, and they're right: restaurants do not list every ingredient,
 * so "no gluten found in the description" is not "this dish is gluten free".
 */
export const ALLERGEN_DISCLAIMER =
  'Menus rarely list every ingredient. Healthy Walk can only read what the ' +
  'restaurant publishes, so a dish may contain allergens that never appear in ' +
  'its description — and shared fryers, grills and prep surfaces are almost ' +
  'never mentioned at all. Treat these results as a shortlist to ask about, ' +
  'not an answer. Always confirm with the restaurant before you order.';

/** The short form, for tight spaces like a results header. */
export const ALLERGEN_DISCLAIMER_SHORT =
  'Menus don\'t list every ingredient. Confirm allergens with the restaurant before ordering.';

/** The one-liner used on a card where an allergen could not be ruled out. */
export const ALLERGEN_UNKNOWN_NOTE =
  'Not listed on the menu — ask before ordering.';

export const MACRO_DISCLAIMER =
  'Calories and macros are estimates unless the card says "published by the ' +
  'restaurant". They\'re worked out from the dish description and typical ' +
  'restaurant portions, so treat them as ±25% — useful for choosing between ' +
  'dishes, not for precise tracking.';

export const OIL_DISCLAIMER =
  'Very few restaurants state their cooking oil. Where a card says a fat is ' +
  'confirmed, we found it published by the restaurant; otherwise it is ' +
  'inferred from the cuisine and cooking method, and worth a quick ask.';

/* ── Fats and oils ─────────────────────────────────────────────────────── */

/**
 * "Seed oil" is a colloquial category, not a botanical one. This is the list
 * as the people avoiding them use it — industrially refined, high-omega-6
 * oils extracted from seeds.
 */
export const SEED_OILS = [
  'canola oil', 'canola', 'rapeseed oil', 'rapeseed',
  'soybean oil', 'soy oil', 'soybean',
  'corn oil',
  'cottonseed oil', 'cottonseed',
  'sunflower oil', 'sunflower seed oil',
  'safflower oil',
  'grapeseed oil', 'grape seed oil',
  'rice bran oil',
  // The catch-all on a fryer label. In practice it is a seed oil blend.
  'vegetable oil', 'veg oil', 'salad oil', 'frying oil', 'fryer oil',
  'blended oil', 'oil blend', 'shortening', 'margarine',
  'partially hydrogenated',
];

/**
 * Peanut oil is genuinely contested: it's a legume oil, high in omega-6, and
 * some seed-oil avoiders accept it while others don't. We flag it separately
 * rather than picking a side, and the card says why.
 */
export const CONTESTED_OILS = [
  'peanut oil', 'groundnut oil',
  // Sesame oil splits the room. It's a seed oil by botany, but it's used by
  // the teaspoon as a finishing flavour rather than by the litre in a fryer,
  // and plenty of people avoiding seed oils still cook with it. Hard-listing
  // it would strike out most of an Asian menu over a quarter-teaspoon.
  'sesame oil', 'toasted sesame oil', 'chili oil',
];

export const PREFERRED_FATS = {
  avocado: ['avocado oil'],
  olive: ['olive oil', 'extra virgin olive oil', 'evoo', 'extra-virgin olive oil'],
  coconut: ['coconut oil', 'mct oil'],
  animal: [
    'beef tallow', 'tallow', 'butter', 'clarified butter', 'ghee',
    'duck fat', 'lard', 'bacon fat', 'schmaltz', 'suet',
  ],
};

export const ALL_PREFERRED_FATS = Object.values(PREFERRED_FATS).flat();

/** The phrasings that mean "this dish was cooked in X". */
export const COOKING_VERB_PATTERNS = [
  'cooked in', 'fried in', 'sauteed in', 'sautéed in', 'seared in',
  'roasted in', 'grilled in', 'tossed in', 'finished with', 'drizzled with',
  'dressed with', 'basted in', 'confit in', 'we cook', 'we fry', 'we use',
  'prepared with', 'brushed with',
];

/** Cooking methods that usually mean a lot of fryer oil, whatever it is. */
export const DEEP_FRIED_MARKERS = [
  'deep fried', 'deep-fried', 'crispy fried', 'fried chicken', 'tempura',
  'battered', 'beer battered', 'breaded', 'panko', 'katsu', 'schnitzel',
  'french fries', 'fries', 'tots', 'hush puppies', 'calamari', 'wings',
  'chips', 'croquette', 'egg roll', 'spring roll', 'churro', 'donut',
];

/** Methods that usually mean no added fryer oil at all. */
export const CLEAN_COOKING_MARKERS = [
  'grilled', 'roasted', 'baked', 'steamed', 'poached', 'braised',
  'raw', 'seared', 'smoked', 'sous vide', 'charred', 'broiled', 'sashimi',
];

/* ── Allergens ─────────────────────────────────────────────────────────── */

/**
 * For each allergen: the obvious words, and — more useful — the ones people
 * miss. Soy sauce is wheat. Worcestershire is fish. Most restaurant fries
 * are dusted with flour.
 */
export const ALLERGEN_KEYWORDS = {
  gluten: {
    obvious: ['bread', 'bun', 'roll', 'pasta', 'noodle', 'flour', 'wheat', 'barley', 'rye', 'couscous', 'orzo', 'pita', 'naan', 'tortilla', 'wrap', 'crouton', 'panko', 'breaded', 'battered', 'crusted', 'dumpling', 'wonton', 'gnocchi', 'farro', 'seitan', 'pastry', 'biscuit', 'waffle', 'pancake'],
    hidden: ['soy sauce', 'teriyaki', 'hoisin', 'ponzu', 'malt', 'malt vinegar', 'beer', 'ale', 'brewer', 'seasoned fries', 'gravy', 'roux', 'bisque', 'imitation crab', 'surimi', 'oyster sauce', 'miso', 'seasoning blend', 'modified food starch'],
    note: 'Soy sauce, most gravies and many seasoned fries contain wheat. Shared fryers are the biggest risk and are almost never listed.',
  },
  dairy: {
    obvious: ['cheese', 'milk', 'cream', 'butter', 'yogurt', 'yoghurt', 'mozzarella', 'parmesan', 'cheddar', 'feta', 'ricotta', 'queso', 'crema', 'alfredo', 'gelato', 'ice cream', 'burrata', 'mascarpone', 'halloumi'],
    hidden: ['ranch', 'caesar', 'aioli', 'pesto', 'mashed', 'bisque', 'chowder', 'au gratin', 'creamy', 'buttermilk', 'ghee', 'whey', 'casein', 'brioche', 'naan', 'tzatziki', 'raita', 'horchata'],
    note: 'Steaks and vegetables are very often finished with butter without it being mentioned.',
  },
  egg: {
    obvious: ['egg', 'omelet', 'omelette', 'frittata', 'quiche', 'benedict', 'scrambled', 'poached egg', 'fried egg'],
    hidden: ['aioli', 'mayo', 'mayonnaise', 'caesar', 'hollandaise', 'remoulade', 'tartar sauce', 'meringue', 'custard', 'brioche', 'challah', 'pasta', 'noodle', 'tempura', 'batter', 'breaded', 'meatball', 'meatloaf', 'key lime'],
    note: 'Almost every creamy white sauce is egg-based. So is fresh pasta.',
  },
  peanut: {
    obvious: ['peanut', 'groundnut', 'satay', 'pad thai'],
    hidden: ['peanut oil', 'thai', 'szechuan', 'kung pao', 'mole', 'african', 'chili crisp', 'granola', 'trail mix'],
    note: 'Some kitchens fry in peanut oil without saying so. Thai, Szechuan and West African dishes are the usual risk.',
  },
  treenut: {
    obvious: ['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'pine nut', 'nut'],
    hidden: ['pesto', 'marzipan', 'praline', 'nutella', 'amaretto', 'frangipane', 'romesco', 'dukkah', 'baklava', 'almond milk', 'nut milk', 'gluten free crust', 'gluten-free crust'],
    note: 'Pesto is usually pine nut or cashew. Many gluten-free crusts are almond flour.',
  },
  soy: {
    obvious: ['soy', 'soybean', 'tofu', 'edamame', 'tempeh', 'miso', 'soy sauce', 'tamari'],
    hidden: ['teriyaki', 'hoisin', 'ponzu', 'vegetable oil', 'vegan cheese', 'vegan butter', 'worcestershire', 'bouillon', 'lecithin', 'textured vegetable protein', 'seitan marinade'],
    note: 'Soybean oil is the default frying and dressing oil across American restaurants.',
  },
  fish: {
    obvious: ['fish', 'salmon', 'tuna', 'cod', 'halibut', 'anchovy', 'sardine', 'branzino', 'snapper', 'trout', 'mahi', 'sea bass', 'tilapia'],
    hidden: ['caesar', 'worcestershire', 'fish sauce', 'nuoc cham', 'nam pla', 'xo sauce', 'puttanesca', 'bagna cauda', 'kimchi', 'dashi', 'bonito', 'furikake'],
    note: 'Caesar dressing and Worcestershire both contain anchovy. Most Thai and Vietnamese dishes use fish sauce.',
  },
  shellfish: {
    obvious: ['shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'mussel', 'clam', 'oyster', 'crawfish', 'langoustine', 'calamari', 'squid', 'octopus'],
    hidden: ['seafood stock', 'bouillabaisse', 'paella', 'gumbo', 'xo sauce', 'oyster sauce', 'kimchi', 'fish stock', 'surimi', 'imitation crab'],
    note: 'Shared fryers are the main risk. Oyster sauce appears throughout Chinese menus.',
  },
  sesame: {
    obvious: ['sesame', 'tahini', 'hummus', 'halva', 'benne'],
    hidden: ['burger bun', 'brioche bun', 'za\'atar', 'everything bagel', 'falafel', 'baba ganoush', 'gomashio', 'furikake', 'chili crisp', 'hummus', 'dukkah'],
    note: 'Sesame became a labelled allergen only recently. Many buns and spice blends carry it.',
  },
  corn: {
    obvious: ['corn', 'tortilla', 'polenta', 'grits', 'hominy', 'masa', 'elote', 'cornbread', 'popcorn'],
    hidden: ['corn syrup', 'cornstarch', 'modified food starch', 'dextrose', 'maltodextrin', 'xanthan', 'baking powder', 'caramel color', 'corn oil'],
    note: 'Cornstarch thickens most sauces and coats most fried food.',
  },
  nightshade: {
    obvious: ['tomato', 'potato', 'pepper', 'bell pepper', 'eggplant', 'aubergine', 'chili', 'jalapeno', 'jalapeño', 'poblano', 'salsa', 'marinara', 'pomodoro'],
    hidden: ['paprika', 'cayenne', 'chipotle', 'harissa', 'romesco', 'ketchup', 'sriracha', 'gochujang', 'curry', 'bbq sauce', 'steak seasoning', 'blackened'],
    note: 'Paprika is in almost every spice rub, including "blackened" and most steak seasonings.',
  },
};

/* ── Text analysis ─────────────────────────────────────────────────────── */

/**
 * Menu prose is adversarial in a specific way: the words that signal an
 * allergen also appear in the phrases that rule it out. "Corn tortilla" is
 * gluten free. "Rice noodles" are gluten free. "No pita" means no pita. A
 * naive substring scan flags all three and quietly buries good dishes —
 * which is worse than useless, because the diner never learns what they
 * missed.
 *
 * So matching happens in three passes: strip negations, neutralise the safe
 * compounds, then scan on word boundaries.
 */

/**
 * Phrases that mean something other than their parts. Rewritten before any
 * matching so the specific reading always wins over the generic one.
 */
const CANONICAL_PHRASES = [
  [/\bbeef shortening\b/g, 'beef tallow'],
  [/\banimal shortening\b/g, 'beef tallow'],
  [/\bclarified butter\b/g, 'ghee'],
  [/\bextra[- ]virgin olive oil\b/g, 'olive oil'],
  [/\bcold[- ]pressed avocado oil\b/g, 'avocado oil'],
];

function canonicalise(text) {
  let out = text;
  for (const [pattern, replacement] of CANONICAL_PHRASES) out = out.replace(pattern, replacement);
  return out;
}

const normalise = (text) =>
  ` ${String(text ?? '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;

const prepare = (text) => canonicalise(normalise(text));

/** "no bun", "without cheese", "hold the pita", "served without rice". */
const NEGATION = /\b(?:no|without|hold the|minus|free of|free from|skip the|sans)\s+(?:the\s+)?([a-z-]+(?:\s+[a-z-]+)?)/g;

function stripNegations(haystack) {
  return haystack.replace(NEGATION, ' ');
}

/**
 * Phrases where the allergen keyword is present but the allergen is not.
 * Neutralised before scanning so the keyword inside them never fires.
 */
const SAFE_COMPOUNDS = {
  gluten: [
    'gluten free', 'gluten-free', 'glutenfree',
    'corn tortilla', 'corn tortillas', 'nixtamal',
    'rice noodle', 'rice noodles', 'glass noodle', 'glass noodles',
    'sweet potato noodle', 'zucchini noodle', 'kelp noodle', 'shirataki',
    'rice paper', 'lettuce wrap', 'lettuce wraps', 'collard wrap',
    'cauliflower crust', 'almond flour', 'coconut flour', 'chickpea pasta',
    'lentil pasta', 'rice flour', 'cassava flour', 'grain free', 'grain-free',
    // Tamari is the wheat-free soy sauce; coconut aminos likewise.
    'tamari', 'coconut aminos',
  ],
  dairy: [
    'dairy free', 'dairy-free', 'non-dairy', 'nondairy',
    'vegan cheese', 'cashew cream', 'coconut cream', 'coconut milk',
    'oat milk', 'almond milk', 'soy milk', 'vegan butter', 'nut cheese',
    'coconut yogurt', 'olive oil butter',
  ],
  egg: ['egg free', 'egg-free', 'eggless', 'vegan mayo', 'eggplant'],
  peanut: ['peanut free', 'peanut-free'],
  treenut: ['nut free', 'nut-free', 'nutmeg', 'water chestnut', 'coconut', 'butternut', 'nutritional yeast'],
  soy: ['soy free', 'soy-free', 'coconut aminos'],
  fish: ['fish free', 'shellfish', 'fish-free'],
  shellfish: ['shellfish free', 'shellfish-free'],
  sesame: ['sesame free', 'sesame-free'],
  corn: ['corn free', 'corn-free', 'cornichon', 'peppercorn', 'peppercorns'],
  nightshade: ['nightshade free', 'sweet potato', 'white pepper', 'black pepper', 'peppercorn'],
};

function neutralise(haystack, allergenId) {
  return stripPhrases(haystack, SAFE_COMPOUNDS[allergenId] ?? []);
}

/**
 * Remove whole phrases, tolerating a plural on the final word — "rice
 * noodles" has to defuse just as reliably as "rice noodle", and it was the
 * plural that slipped through first time.
 */
function stripPhrases(haystack, phrases) {
  let text = haystack;
  for (const phrase of phrases) {
    text = text.replace(new RegExp(`\\b${escapeRegex(phrase)}(?:s|es)?\\b`, 'g'), ' ');
  }
  return text;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Word-boundary match that also accepts a plural "s". Substring matching is
 * what turned "massaged" into a hit and cost us a perfectly good salmon.
 */
function matchTerm(haystack, term) {
  const pattern = new RegExp(`\\b${escapeRegex(term)}(?:s|es)?\\b`);
  return pattern.test(haystack) ? term : null;
}

function containsAny(haystack, needles) {
  return needles.map((needle) => matchTerm(haystack, needle)).filter(Boolean);
}

/**
 * The same careful matching, exported for anything outside this module that
 * needs to ask "does this menu text really mention X?" — negations stripped,
 * safe compounds neutralised, word boundaries respected.
 *
 * Pass the phrases that make a term harmless in `safeCompounds`, e.g.
 * ['cauliflower rice'] when looking for 'rice'.
 */
export function findMenuTerms(text, terms, safeCompounds = []) {
  const haystack = stripPhrases(stripNegations(prepare(text)), safeCompounds);
  return containsAny(haystack, terms);
}

/**
 * Work out what a dish is cooked in from its description.
 *
 * Returns `confirmed` only when the text actually names a fat. Anything else
 * is `unknown` — and unknown must never be presented as a pass.
 */
export function analyseCookingFat(text) {
  const haystack = stripNegations(prepare(text));

  const seed = containsAny(haystack, SEED_OILS);
  const preferred = containsAny(haystack, ALL_PREFERRED_FATS);
  const contested = containsAny(haystack, CONTESTED_OILS);

  if (seed.length) {
    return { verdict: 'seed_oil', fat: seed[0], status: 'confirmed', evidence: `Menu names ${seed[0]}.` };
  }
  if (preferred.length) {
    const fat = preferred[0];
    const family = Object.entries(PREFERRED_FATS).find(([, list]) => list.includes(fat))?.[0];
    return { verdict: 'preferred', fat, family, status: 'confirmed', evidence: `Menu names ${fat}.` };
  }
  if (contested.length) {
    return { verdict: 'unknown', fat: contested[0], status: 'confirmed', evidence: `Cooked in ${contested[0]} — a legume oil some seed-oil avoiders accept and others don't.` };
  }

  // Nothing named. Fall back to the cooking method, which tells us how much
  // it would matter if the oil is a seed oil.
  const fried = containsAny(haystack, DEEP_FRIED_MARKERS);
  if (fried.length) {
    return {
      verdict: 'unknown',
      fat: null,
      status: 'unknown',
      friedRisk: 'high',
      evidence: `"${fried[0]}" means fryer oil, which is a seed oil blend unless the restaurant says otherwise.`,
    };
  }

  const clean = containsAny(haystack, CLEAN_COOKING_MARKERS);
  if (clean.length) {
    return {
      verdict: 'neutral',
      fat: null,
      status: 'likely',
      friedRisk: 'low',
      evidence: `${clean[0][0].toUpperCase()}${clean[0].slice(1)} — little or no added frying oil, though the pan fat is unstated.`,
    };
  }

  return { verdict: 'unknown', fat: null, status: 'unknown', evidence: 'Cooking fat not stated on the menu.' };
}

/**
 * Scan a dish for one allergen.
 *
 * The asymmetry here is deliberate and load-bearing. Finding a keyword is
 * strong evidence the allergen is PRESENT. Not finding one is weak evidence
 * of anything at all, so the best we ever return is `unknown` — which the UI
 * renders grey with "ask before ordering", never green.
 */
export function analyseAllergen(text, allergenId) {
  const rules = ALLERGEN_KEYWORDS[allergenId];
  if (!rules) return { allergenId, status: 'unknown' };

  const haystack = neutralise(stripNegations(prepare(text)), allergenId);

  const obvious = containsAny(haystack, rules.obvious);
  if (obvious.length) {
    return { allergenId, status: 'present', matched: obvious, evidence: `Contains ${obvious[0]}.`, note: rules.note };
  }

  const hidden = containsAny(haystack, rules.hidden);
  if (hidden.length) {
    return { allergenId, status: 'likely_present', matched: hidden, evidence: `"${hidden[0]}" usually contains it.`, note: rules.note };
  }

  return {
    allergenId,
    status: 'unknown',
    evidence: ALLERGEN_UNKNOWN_NOTE,
    note: rules.note,
  };
}

/** Scan for every allergen the user is avoiding. */
export function analyseAllergens(text, allergenIds = []) {
  return allergenIds.map((id) => analyseAllergen(text, id));
}

/* ── Macro estimation ──────────────────────────────────────────────────── */

/**
 * Per-ounce cooked values for common restaurant proteins, from USDA
 * FoodData Central. Used only when nothing better exists — a published
 * number from the restaurant always wins.
 *
 * @type {Record<string, {kcal:number, protein:number, fat:number, carbs:number}>}
 */
export const PROTEIN_PER_OZ = {
  chicken_breast: { kcal: 47, protein: 8.8, fat: 1.0, carbs: 0 },
  chicken_thigh: { kcal: 60, protein: 7.4, fat: 3.2, carbs: 0 },
  chicken_fried: { kcal: 82, protein: 6.8, fat: 4.6, carbs: 3.4 },
  beef_lean: { kcal: 61, protein: 8.6, fat: 2.8, carbs: 0 },
  beef_ribeye: { kcal: 82, protein: 7.4, fat: 5.7, carbs: 0 },
  ground_beef_85: { kcal: 72, protein: 7.4, fat: 4.6, carbs: 0 },
  pork_loin: { kcal: 58, protein: 8.7, fat: 2.3, carbs: 0 },
  bacon: { kcal: 152, protein: 10.6, fat: 11.8, carbs: 0.4 },
  lamb: { kcal: 71, protein: 8.3, fat: 4.0, carbs: 0 },
  turkey_breast: { kcal: 44, protein: 8.4, fat: 0.9, carbs: 0 },
  salmon: { kcal: 58, protein: 6.3, fat: 3.5, carbs: 0 },
  whitefish: { kcal: 33, protein: 7.1, fat: 0.3, carbs: 0 },
  tuna_raw: { kcal: 31, protein: 6.8, fat: 0.3, carbs: 0 },
  shrimp: { kcal: 28, protein: 6.0, fat: 0.3, carbs: 0.2 },
  egg_each: { kcal: 72, protein: 6.3, fat: 4.8, carbs: 0.4 },
  tofu: { kcal: 40, protein: 4.3, fat: 2.4, carbs: 1.0 },
  beans: { kcal: 37, protein: 2.5, fat: 0.2, carbs: 6.7 },
};

/** Typical restaurant portions, in ounces of cooked protein. */
export const TYPICAL_PORTION_OZ = {
  entree_protein: 6,
  bowl_protein: 4,
  salad_protein: 4,
  taco_protein: 2,
  sandwich_protein: 4,
  steak_entree: 10,
};

/** Common sides and bases, per typical serving. */
export const BASE_PORTIONS = {
  white_rice: { kcal: 205, protein: 4.3, fat: 0.4, carbs: 45 },
  brown_rice: { kcal: 218, protein: 4.5, fat: 1.6, carbs: 46 },
  cauliflower_rice: { kcal: 40, protein: 3.0, fat: 1.5, carbs: 5 },
  mixed_greens: { kcal: 20, protein: 1.5, fat: 0.2, carbs: 4 },
  french_fries: { kcal: 365, protein: 4.0, fat: 17, carbs: 48 },
  sweet_potato: { kcal: 180, protein: 2.0, fat: 0.2, carbs: 41 },
  flour_tortilla: { kcal: 150, protein: 4.0, fat: 4.0, carbs: 24 },
  corn_tortilla: { kcal: 52, protein: 1.4, fat: 0.7, carbs: 11 },
  burger_bun: { kcal: 150, protein: 5.0, fat: 2.0, carbs: 28 },
  quinoa: { kcal: 222, protein: 8.0, fat: 3.6, carbs: 39 },
  avocado_half: { kcal: 160, protein: 2.0, fat: 15, carbs: 9 },
  dressing_oil: { kcal: 120, protein: 0, fat: 14, carbs: 0 },
  creamy_dressing: { kcal: 145, protein: 1.0, fat: 15, carbs: 2 },
  cheese_slice: { kcal: 110, protein: 7.0, fat: 9, carbs: 1 },
};

/**
 * How much to trust an estimate. Published numbers are near-exact; a guess
 * from a one-line menu description is not, and the card says so.
 */
export const ERROR_MARGIN_BY_SOURCE = {
  // Published numbers are right on average, but the misses skew high: about
  // a fifth of restaurant items measure 100+ kcal above the stated figure.
  // ±10% is honest; ±5% was flattering the label.
  published: 10,
  estimated: 25,
  unknown: null,
};
