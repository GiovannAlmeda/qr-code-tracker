/**
 * Turn a raw dish — however we got it — into a scored, chip-annotated result.
 *
 * Both the AI path and the demo path come through here, so a dish read off a
 * real menu and a dish from the sample data are judged by exactly the same
 * rules. That's the only way the demo is worth anything as a preview.
 */

import {
  PROTEIN_BY_ID, DIET_BY_ID, ALLERGEN_BY_ID, OIL_PREFERENCE_BY_ID,
} from '../shared/criteria.js';
import {
  analyseCookingFat, analyseAllergens, ALLERGEN_UNKNOWN_NOTE,
  ERROR_MARGIN_BY_SOURCE, findMenuTerms,
} from '../shared/nutrition.js';
import { reconcileMacros, emptyMacros } from '../shared/schema.js';

/** Which fat family each oil preference is actually asking for. */
const PREFERENCE_TARGET = {
  prefer_avocado: 'avocado',
  prefer_olive: 'olive',
  prefer_animal_fat: 'animal',
};

/* ── Protein ───────────────────────────────────────────────────────────── */

function proteinMatches(dish, criteria) {
  if (!criteria.proteins?.length) return [];

  const text = `${dish.name} ${dish.description ?? ''}`.toLowerCase();
  const declared = new Set(dish.proteins ?? []);

  return criteria.proteins.map((proteinId) => {
    const protein = PROTEIN_BY_ID[proteinId];
    const label = protein?.label ?? proteinId;

    if (declared.has(proteinId)) {
      return { id: proteinId, label, status: 'confirmed', evidence: `${label} is the dish's protein.` };
    }

    const alias = protein?.aliases?.find((word) => text.includes(word));
    if (alias) {
      return { id: proteinId, label, status: 'likely', evidence: `Menu mentions "${alias}".` };
    }

    // The dish states a protein, and it isn't this one. That's a real miss —
    // but only a miss for this chip, not necessarily for the dish, since the
    // user may have ticked several proteins.
    if (declared.size) {
      return { id: proteinId, label, status: 'failed', evidence: `This dish is ${[...declared].join(', ')}.` };
    }

    return { id: proteinId, label, status: 'unknown', evidence: 'Protein not clear from the menu.' };
  });
}

/**
 * The user ticking three proteins means "any of these", not "all of these".
 * So the protein chips collapse to a single pass/fail before scoring: if any
 * one is confirmed or likely, the dish qualifies.
 */
function collapseProteinMatches(matches) {
  if (!matches.length) return [];

  const best = matches.find((match) => match.status === 'confirmed')
    ?? matches.find((match) => match.status === 'likely')
    ?? matches.find((match) => match.status === 'unknown');

  // Nothing matched at all — every requested protein came back `failed`.
  if (!best) {
    return [{
      id: matches[0].id,
      label: matches.map((match) => match.label).join(' or '),
      status: 'failed',
      evidence: matches[0].evidence,
    }];
  }

  return [best];
}

/* ── Diets ─────────────────────────────────────────────────────────────── */

function dietMatches(dish, criteria) {
  if (!criteria.diets?.length) return [];

  const claimed = new Set(dish.dietClaims ?? []);
  const text = `${dish.name} ${dish.description ?? ''}`.toLowerCase();

  return criteria.diets.map((dietId) => {
    const label = DIET_BY_ID[dietId]?.label ?? dietId;

    if (claimed.has(dietId)) {
      return {
        id: dietId,
        label,
        status: dish.provenance === 'menu' ? 'confirmed' : 'likely',
        evidence: dish.provenance === 'menu'
          ? `Marked ${label.toLowerCase()} on the menu.`
          : `Reads as ${label.toLowerCase()} from the description.`,
      };
    }

    // Specific, checkable contradictions. A gluten-free request against a
    // dish served on a bun isn't "unknown", it's a no.
    const [contradiction] = findMenuTerms(
      text,
      DIET_CONTRADICTIONS[dietId] ?? [],
      DIET_SAFE_COMPOUNDS[dietId] ?? [],
    );
    if (contradiction) {
      return { id: dietId, label, status: 'failed', evidence: `Contains "${contradiction}".` };
    }

    return { id: dietId, label, status: 'unknown', evidence: 'Not stated on the menu.' };
  });
}

/**
 * Phrases that defuse a contradiction. Without these, "cauliflower rice"
 * fails keto, "rice noodles" fail gluten free, and "vegan cheese" fails
 * dairy free — each one quietly hiding a dish that was actually a good
 * answer.
 */
const DIET_SAFE_COMPOUNDS = {
  gluten_free: ['rice noodle', 'glass noodle', 'shirataki', 'kelp noodle', 'zucchini noodle', 'corn tortilla', 'lettuce wrap', 'chickpea pasta', 'lentil pasta', 'gluten free', 'cauliflower crust', 'almond flour', 'rice paper'],
  dairy_free: ['vegan cheese', 'cashew cream', 'coconut cream', 'coconut milk', 'oat milk', 'almond milk', 'vegan butter', 'nut cheese', 'dairy free'],
  keto: ['cauliflower rice', 'zucchini noodle', 'shirataki', 'lettuce wrap', 'sweet potato fries'],
  paleo: ['cauliflower rice', 'coconut flour', 'almond flour', 'sweet potato', 'coconut milk'],
  whole30: ['cauliflower rice', 'coconut aminos', 'almond flour', 'sweet potato'],
  vegan: ['vegan cheese', 'vegan butter', 'beyond beef', 'impossible beef', 'plant-based chicken', 'jackfruit'],
  vegetarian: ['vegan cheese', 'beyond beef', 'impossible beef', 'plant-based chicken'],
  pescatarian: [],
};

const DIET_CONTRADICTIONS = {
  gluten_free: ['bun', 'bread', 'pasta', 'noodle', 'panko', 'breaded', 'battered', 'pita', 'naan', 'crouton', 'dumpling', 'flour tortilla', 'wonton', 'orzo', 'couscous'],
  dairy_free: ['cheese', 'cream', 'butter', 'yogurt', 'alfredo', 'queso', 'mozzarella', 'parmesan', 'tzatziki'],
  vegan: ['chicken', 'beef', 'pork', 'fish', 'shrimp', 'cheese', 'egg', 'butter', 'cream', 'bacon', 'lamb'],
  vegetarian: ['chicken', 'beef', 'pork', 'fish', 'shrimp', 'bacon', 'lamb', 'anchovy'],
  pescatarian: ['chicken', 'beef', 'pork', 'bacon', 'lamb'],
  keto: ['rice', 'pasta', 'noodle', 'bun', 'tortilla', 'potato', 'fries', 'bread'],
  paleo: ['cheese', 'rice', 'beans', 'bread', 'pasta', 'corn', 'peanut'],
  whole30: ['cheese', 'bread', 'pasta', 'rice', 'beans', 'sugar', 'wine', 'peanut'],
};

/* ── Cooking fat ───────────────────────────────────────────────────────── */

function fatMatch(dish, criteria) {
  const preference = criteria.oilPreference;
  if (!preference || preference === 'none') return { matches: [], verdict: 'unknown', fat: dish.cookingFat ?? null };

  const label = OIL_PREFERENCE_BY_ID[preference]?.label ?? preference;

  // A fat stated by the restaurant beats anything we could infer from prose.
  const stated = dish.cookingFat;
  const analysis = stated
    ? analyseCookingFat(`cooked in ${stated}`)
    : analyseCookingFat(`${dish.name} ${dish.description ?? ''}`);

  // The dish is deep-fried in an oil nobody named. For someone avoiding seed
  // oils that's the single most likely way to get one, so say so plainly
  // rather than hiding it behind a neutral "unknown".
  if (analysis.friedRisk === 'high') {
    return {
      matches: [{
        id: preference,
        label,
        status: 'unknown',
        evidence: analysis.evidence,
      }],
      verdict: 'unknown',
      fat: null,
      friedRisk: 'high',
    };
  }

  if (analysis.verdict === 'seed_oil') {
    return {
      matches: [{ id: preference, label, status: 'failed', evidence: analysis.evidence }],
      verdict: 'seed_oil',
      fat: analysis.fat,
    };
  }

  if (analysis.verdict === 'preferred') {
    const wanted = PREFERENCE_TARGET[preference];
    // "Avoid seed oils" is satisfied by any non-seed fat. The three
    // prefer-X options want their specific fat, and settle for another
    // acceptable one.
    const isExactly = !wanted || analysis.family === wanted;

    return {
      matches: [{
        id: preference,
        label,
        status: isExactly ? 'confirmed' : 'likely',
        evidence: isExactly
          ? analysis.evidence
          : `${analysis.evidence} Not ${wanted} oil, but not a seed oil either.`,
      }],
      verdict: 'preferred',
      fat: analysis.fat,
      family: analysis.family,
    };
  }

  if (analysis.verdict === 'neutral') {
    return {
      matches: [{ id: preference, label, status: 'likely', evidence: analysis.evidence }],
      verdict: 'neutral',
      fat: null,
    };
  }

  return {
    matches: [{ id: preference, label, status: 'unknown', evidence: analysis.evidence }],
    verdict: 'unknown',
    fat: null,
  };
}

/* ── Allergens ─────────────────────────────────────────────────────────── */

/**
 * Allergen findings are NOT criteria chips. They never earn score — the most
 * a dish can do on an allergen is fail to trip it, and "didn't trip" is not
 * an achievement worth points. They exist to exclude dishes and to warn.
 */
function allergenFindings(dish, criteria) {
  if (!criteria.allergens?.length) return [];

  const text = `${dish.name} ${dish.description ?? ''}`;
  const fromText = analyseAllergens(text, criteria.allergens);

  // Anything the AI or the sample data flagged directly outranks our
  // keyword scan, which can only see the words on the menu.
  const declared = new Set(dish.allergenRisk ?? []);

  return fromText.map((finding) => {
    if (declared.has(finding.allergenId)) {
      return {
        ...finding,
        status: finding.status === 'unknown' ? 'likely_present' : finding.status,
        evidence: finding.status === 'unknown'
          ? 'Flagged as a likely ingredient for this dish.'
          : finding.evidence,
      };
    }
    return finding;
  });
}

/* ── Macros ────────────────────────────────────────────────────────────── */

function normaliseMacros(raw) {
  if (!raw) return emptyMacros();

  const source = ['published', 'estimated'].includes(raw.source) ? raw.source : 'unknown';
  const macros = {
    ...emptyMacros(),
    ...raw,
    source,
    errorMarginPercent: raw.errorMarginPercent ?? ERROR_MARGIN_BY_SOURCE[source],
  };

  return reconcileMacros(macros);
}

/* ── Putting it together ───────────────────────────────────────────────── */

/**
 * Confidence is what stops a plausible guess from outranking a real menu
 * item. It starts from where the dish came from, then drops further for
 * anything we had to infer.
 */
function computeConfidence(dish, { fat, macros, criteria }) {
  const base = {
    menu: 0.9,
    ai_web: 0.75,
    demo: 0.7,
    inferred: 0.4,
  }[dish.provenance] ?? 0.5;

  let confidence = dish.confidence ?? base;

  if (macros.source === 'published') confidence += 0.05;
  else if (macros.source === 'unknown') confidence -= 0.15;

  // Unknown chips are the honest signal that we're guessing.
  const unknowns = criteria.filter((match) => match.status === 'unknown').length;
  confidence -= unknowns * 0.05;

  if (fat.friedRisk === 'high') confidence -= 0.05;

  // Only a dish actually read off a retrieved menu gets to look certain.
  const ceiling = dish.provenance === 'menu' ? 1 : 0.9;

  return Math.min(ceiling, Math.max(0.15, confidence));
}

/** One sentence a person would actually say about why this came up. */
function writeWhyItFits(dish, matches, fat, macros) {
  const confirmed = matches.filter((match) => match.status === 'confirmed').map((match) => match.label.toLowerCase());
  const bits = [];

  if (confirmed.length) bits.push(confirmed.slice(0, 3).join(', '));
  if (macros.protein) bits.push(`${Math.round(macros.protein)}g protein`);
  if (macros.calories) {
    bits.push(macros.source === 'published' ? `${macros.calories} cal` : `about ${macros.calories} cal`);
  }
  if (fat.verdict === 'preferred' && fat.fat) bits.push(`cooked in ${fat.fat}`);

  if (!bits.length) return dish.description?.slice(0, 120) ?? '';
  return `${bits.join(' · ')}.`;
}

/**
 * The single entry point. Raw dish in, renderable dish out.
 */
export function analyseDish(rawDish, criteria) {
  const macros = normaliseMacros(rawDish.macros);
  const fat = fatMatch(rawDish, criteria);

  const matches = [
    ...collapseProteinMatches(proteinMatches(rawDish, criteria)),
    ...dietMatches(rawDish, criteria),
    ...fat.matches,
  ];

  const findings = allergenFindings(rawDish, criteria);
  const confidence = computeConfidence(rawDish, { fat, macros, criteria: matches });

  return {
    name: rawDish.name,
    description: rawDish.description ?? '',
    price: rawDish.price ?? null,
    photoUrl: rawDish.photoUrl ?? null,
    provenance: rawDish.provenance ?? 'inferred',
    sourceUrl: rawDish.sourceUrl ?? null,
    restaurant: rawDish.restaurant,
    macros,
    criteria: matches,
    allergenFindings: findings,
    // Every allergen we were asked about but couldn't rule out. The card
    // turns this into the amber "ask before ordering" line — the owner asked
    // for that warning specifically, and this is the data behind it.
    allergenUnknowns: findings
      .filter((finding) => finding.status === 'unknown')
      .map((finding) => ({
        id: finding.allergenId,
        label: ALLERGEN_BY_ID[finding.allergenId]?.label ?? finding.allergenId,
        note: ALLERGEN_UNKNOWN_NOTE,
      })),
    allergenFlags: findings
      .filter((finding) => finding.status !== 'unknown')
      .map((finding) => finding.allergenId),
    cookingFat: fat.fat,
    fatVerdict: fat.verdict,
    friedRisk: fat.friedRisk ?? null,
    confidence,
    whyItFits: writeWhyItFits(rawDish, matches, fat, macros),
  };
}
