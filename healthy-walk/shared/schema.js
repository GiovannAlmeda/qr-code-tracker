/**
 * The shape of a result.
 *
 * A Healthy Walk result is a DISH, not a restaurant. The restaurant is an
 * attribute of the dish, the same way its calorie count is. Everything in the
 * app — the AI prompt, the scorer, the card, the saved list — agrees on the
 * shapes below.
 */

/**
 * @typedef {Object} Restaurant
 * @property {string}  placeId        Google place id, or a synthetic id in demo mode.
 * @property {string}  name
 * @property {string}  address
 * @property {{lat:number, lng:number}} location
 * @property {number|null} rating          0-5.
 * @property {number}  reviewCount
 * @property {string|null} priceLevel      A PRICE_LEVELS id.
 * @property {boolean|null} openNow
 * @property {string|null} website
 * @property {string|null} mapsUrl
 * @property {string|null} photoName       Google photo resource name, for /api/photo.
 * @property {string|null} logoUrl         Restaurant logo, when we found one.
 * @property {number}  distanceMeters      Walking distance if known, else crow-flies × detour.
 * @property {number}  walkMinutes
 * @property {boolean} walkIsEstimated     True when it came from the haversine fallback.
 * @property {string[]} cuisines
 */

/**
 * @typedef {Object} Macros
 * @property {number|null} calories
 * @property {number|null} protein   grams
 * @property {number|null} carbs     grams
 * @property {number|null} fat       grams
 * @property {number|null} fiber     grams
 * @property {number|null} sodium    milligrams
 * @property {'published'|'estimated'|'unknown'} source
 *           `published` means the restaurant states these numbers. `estimated`
 *           means we worked them out from the description. The card must show
 *           the difference — a guess dressed as a fact is the one thing this
 *           app must never do.
 * @property {number|null} errorMarginPercent  Plus-or-minus, for estimates.
 */

/**
 * A single criterion the user asked for, and how the dish did against it.
 *
 * @typedef {Object} CriterionMatch
 * @property {string} id          e.g. 'gluten_free', 'chicken', 'avoid_seed_oils'
 * @property {string} label       Display text for the chip.
 * @property {'confirmed'|'likely'|'unknown'|'failed'} status
 *           confirmed — the menu, or the restaurant, says so outright.
 *           likely    — inferred from the dish description with good reason.
 *           unknown   — we could not tell. Shown grey; never counted as a pass.
 *           failed    — the dish violates this. Soft criteria only; a failed
 *                       hard criterion means the dish never appears at all.
 * @property {string} [evidence]  The sentence that justifies the status.
 */

/**
 * @typedef {Object} Dish
 * @property {string}  name
 * @property {string}  description        As printed on the menu, where possible.
 * @property {string|null} price
 * @property {string|null} photoUrl       The dish photo. Null falls back to the logo.
 * @property {'menu'|'ai_web'|'inferred'|'demo'} provenance
 *           Where this dish came from. `inferred` means we did not find a
 *           real menu and are suggesting something the cuisine usually has —
 *           it must be labelled as such in the UI.
 * @property {string|null} sourceUrl      The page the menu was read from.
 * @property {Restaurant} restaurant
 * @property {Macros}  macros
 * @property {CriterionMatch[]} criteria
 * @property {string[]} allergenFlags     Allergen ids this dish may contain.
 * @property {string|null} cookingFat     What it is cooked in, when stated.
 * @property {'seed_oil'|'preferred'|'neutral'|'unknown'} fatVerdict
 * @property {number}  score              0-100, from scoring.js.
 * @property {Object}  scoreBreakdown     Component parts, so the badge is explainable.
 * @property {string}  whyItFits          One sentence, written for a human.
 * @property {number}  confidence         0-1. How much we trust this row.
 */

/** A dish we can't score is a dish we shouldn't show. */
export function isRenderableDish(dish) {
  return Boolean(dish && dish.name && dish.restaurant?.name);
}

/** Every field the card needs, with nulls where data is missing. */
export function emptyMacros() {
  return {
    calories: null,
    protein: null,
    carbs: null,
    fat: null,
    fiber: null,
    sodium: null,
    source: 'unknown',
    errorMarginPercent: null,
  };
}

/**
 * Calories implied by the macros, using Atwater factors (4/4/9).
 *
 * Used two ways: to fill in a missing calorie count, and to sanity-check a
 * stated one. Menus and AI estimates both get this wrong often enough that
 * the check is worth having.
 */
export function caloriesFromMacros({ protein, carbs, fat }) {
  if (protein == null && carbs == null && fat == null) return null;
  return Math.round((protein ?? 0) * 4 + (carbs ?? 0) * 4 + (fat ?? 0) * 9);
}

/**
 * Share of calories from each macro, for the chart.
 * Returns percentages that sum to 100, or null when there's nothing to draw.
 */
export function macroSplit(macros) {
  const p = (macros.protein ?? 0) * 4;
  const c = (macros.carbs ?? 0) * 4;
  const f = (macros.fat ?? 0) * 9;
  const total = p + c + f;
  if (total <= 0) return null;

  // Largest-remainder rounding, so the three bars always add up to exactly
  // 100% and the stacked bar never shows a one-pixel gap.
  const raw = [
    { key: 'protein', exact: (p / total) * 100 },
    { key: 'carbs', exact: (c / total) * 100 },
    { key: 'fat', exact: (f / total) * 100 },
  ];
  const floored = raw.map((item) => ({ ...item, value: Math.floor(item.exact) }));
  let remainder = 100 - floored.reduce((sum, item) => sum + item.value, 0);

  floored
    .slice()
    .sort((a, b) => (b.exact - b.value) - (a.exact - a.value))
    .forEach((item) => {
      if (remainder > 0) {
        item.value += 1;
        remainder -= 1;
      }
    });

  return Object.fromEntries(floored.map((item) => [item.key, item.value]));
}

/**
 * Reconcile a stated calorie count with what the macros imply.
 * Where they disagree by more than 20% we trust the macros, because a dish
 * whose parts don't add up is usually a typo'd calorie figure.
 */
export function reconcileMacros(macros) {
  const implied = caloriesFromMacros(macros);
  if (implied == null) return macros;

  if (macros.calories == null) {
    return { ...macros, calories: implied };
  }

  const drift = Math.abs(macros.calories - implied) / Math.max(implied, 1);
  if (drift > 0.2 && macros.source !== 'published') {
    return { ...macros, calories: implied, reconciled: true };
  }
  return macros;
}
