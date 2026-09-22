/**
 * Reading a restaurant's menu.
 *
 * This is the part Google can't do. Given a restaurant — its name, address
 * and website — Claude searches the web for the actual current menu, pulls
 * out the dishes that fit the criteria, and estimates macros for each.
 *
 * The one rule that matters: never invent a dish. A wrong calorie estimate
 * is a nuisance; a dish that doesn't exist, or a gluten-free claim about a
 * dish that isn't, is the failure this whole app has to avoid. Every prompt
 * and every schema field below is shaped around making the model say "I
 * couldn't find it" instead of filling the gap with something plausible.
 */

import Anthropic from '@anthropic-ai/sdk';
import { config, capabilities } from './config.js';
import { cached } from './cache.js';
import { record, priceAnthropicUsage } from './budget.js';
import {
  PROTEINS, DIETS, ALLERGENS, describeCriteria, OIL_PREFERENCE_BY_ID,
} from '../shared/criteria.js';

let client = null;
function anthropic() {
  if (!client) client = new Anthropic({ apiKey: config.anthropicKey });
  return client;
}

/* ── The contract ──────────────────────────────────────────────────────── */

const PROTEIN_IDS = PROTEINS.map((protein) => protein.id);
const DIET_IDS = DIETS.map((diet) => diet.id);
const ALLERGEN_IDS = ALLERGENS.map((allergen) => allergen.id);

/**
 * `strict: true` guarantees the arguments validate against this exactly, so
 * every field is listed in `required` and anything optional is nullable
 * rather than absent. That means no defensive parsing on the way out.
 */
const REPORT_DISHES_TOOL = {
  name: 'report_dishes',
  description:
    'Report the dishes you found on this restaurant\'s real menu that fit the ' +
    'diner\'s criteria. Call this exactly once, after you have searched. If you ' +
    'could not find the restaurant\'s actual menu, call it with menuFound=false ' +
    'and an empty dishes array rather than guessing at what they might serve.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['menuFound', 'menuSourceUrl', 'dishes', 'notes'],
    properties: {
      menuFound: {
        type: 'boolean',
        description: 'True only if you found this specific restaurant\'s actual menu.',
      },
      menuSourceUrl: {
        type: ['string', 'null'],
        description: 'The URL the menu was read from. Null if no menu was found.',
      },
      notes: {
        type: 'string',
        description:
          'One short sentence for the diner about the quality of this data — ' +
          'e.g. "Menu from their website, updated this year" or "Only a PDF ' +
          'from 2023 was available".',
      },
      dishes: {
        type: 'array',
        description: 'Dishes that fit the criteria. Empty if none do.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'name', 'description', 'price', 'proteins', 'dietClaims',
            'allergenRisk', 'cookingFat', 'cookingFatConfirmed', 'macros',
            'confidence', 'verified', 'sourceUrl', 'whyItFits',
          ],
          properties: {
            name: { type: 'string', description: 'The dish name exactly as the menu prints it.' },
            description: { type: 'string', description: 'The menu description, quoted or lightly trimmed. Do not embellish.' },
            price: { type: ['string', 'null'], description: 'As printed, e.g. "$18". Null if not listed.' },
            proteins: {
              type: 'array',
              description: 'The main protein(s) in this dish.',
              items: { type: 'string', enum: PROTEIN_IDS },
            },
            dietClaims: {
              type: 'array',
              description:
                'Diets this dish satisfies. Include one only if the menu says so ' +
                'or the ingredients make it unambiguous. When unsure, leave it out.',
              items: { type: 'string', enum: DIET_IDS },
            },
            allergenRisk: {
              type: 'array',
              description:
                'Allergens this dish contains or plausibly contains, including ' +
                'hidden sources (soy sauce means gluten and soy; Caesar dressing ' +
                'means fish and egg). Err toward flagging.',
              items: { type: 'string', enum: ALLERGEN_IDS },
            },
            cookingFat: {
              type: ['string', 'null'],
              description: 'The fat it is cooked in, e.g. "avocado oil", "beef tallow". Null if unstated.',
            },
            cookingFatConfirmed: {
              type: 'boolean',
              description: 'True only if the restaurant publicly states this. False if you inferred it.',
            },
            macros: {
              type: 'object',
              additionalProperties: false,
              required: ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium', 'source'],
              properties: {
                calories: { type: ['number', 'null'] },
                protein: { type: ['number', 'null'], description: 'grams' },
                carbs: { type: ['number', 'null'], description: 'grams' },
                fat: { type: ['number', 'null'], description: 'grams' },
                fiber: { type: ['number', 'null'], description: 'grams' },
                sodium: { type: ['number', 'null'], description: 'milligrams' },
                source: {
                  type: 'string',
                  enum: ['published', 'estimated', 'unknown'],
                  description:
                    'published — the restaurant publishes these exact numbers. ' +
                    'estimated — you worked them out from the description and ' +
                    'typical portions. unknown — you could not estimate.',
                },
              },
            },
            confidence: {
              type: 'number',
              description:
                '0 to 1. How sure you are this dish is real, currently served, and ' +
                'described accurately. Below 0.5 if the menu source was old or indirect.',
            },
            verified: {
              type: 'boolean',
              description: 'True only if you read this dish on a menu you actually retrieved.',
            },
            sourceUrl: { type: ['string', 'null'], description: 'Where this specific dish was found.' },
            whyItFits: {
              type: 'string',
              description: 'One sentence, written to the diner, on why this dish matches what they asked for.',
            },
          },
        },
      },
    },
  },
};

/* ── The prompt ────────────────────────────────────────────────────────── */

/**
 * Kept byte-stable so it caches. Everything that varies per restaurant lives
 * in the user turn, after the cache breakpoint.
 */
const SYSTEM_PROMPT = `You research restaurant menus for a diner with specific health requirements. You are given one restaurant and a set of criteria. You find what that restaurant actually serves that fits, and you report it through the report_dishes tool.

HOW TO WORK

1. Search the web for this restaurant's current menu. Try the restaurant's own website first — that is the only truly authoritative source. Then menu aggregators, delivery platforms, and recent reviews that quote the menu.
2. Prefer the restaurant's own domain over any aggregator. Aggregator menus go stale and often list items the restaurant dropped years ago.
3. Read the menu. Find the dishes that fit the diner's criteria. Report up to the requested number, best fit first.
4. Call report_dishes exactly once when you are done.

THE RULES THAT MATTER

Never invent a dish. If you cannot find this restaurant's real menu, call report_dishes with menuFound=false and an empty dishes array. An empty result is a useful answer. A plausible-sounding fabricated one is worse than no answer at all, because the diner will walk there.

Never upgrade a guess into a fact. \`verified\` is true only for a dish you read on a menu you actually retrieved. \`cookingFatConfirmed\` is true only when the restaurant publicly states the fat — which is rare, and inferring "they probably use olive oil because it's Italian" is exactly what that flag exists to prevent.

Distinguish published macros from your own estimates. Set macros.source to "published" only when the restaurant publishes those exact numbers — chains with 20+ US locations are required to, independents essentially never do. Otherwise "estimated", and estimate honestly from the described ingredients and a typical restaurant portion. Prefer a clearly-labelled estimate over a null; the diner can work with "about 600 calories, ±25%".

Flag allergens generously. Menus do not list ingredients, so reason about what the dish almost certainly contains: soy sauce means gluten and soy; Caesar dressing means fish and egg; most restaurant fries are cooked in shared fryers; pesto usually means tree nuts; "blackened" means paprika. A missed allergen is a health risk and a spurious one costs only a suggestion.

On cooking fats: most restaurants do not state them. "vegetable oil" means a seed oil blend. Deep-fried anything is a seed oil unless the restaurant says otherwise. Restaurants that use avocado oil, beef tallow or ghee usually advertise it loudly — if they do, that is a confirmed fact worth reporting; if they say nothing, leave cookingFat null rather than guessing.

Respect the hard limits. If the diner is avoiding an allergen, do not report dishes that contain it — not even with a warning. If they asked for a specific protein, only report dishes with that protein.

Quote the menu's own description rather than writing your own. The diner is going to read this and then order it.`;

function buildUserPrompt(restaurant, criteria, maxDishes) {
  const oil = OIL_PREFERENCE_BY_ID[criteria.oilPreference];

  const lines = [
    'RESTAURANT',
    `Name: ${restaurant.name}`,
    `Address: ${restaurant.address}`,
    restaurant.website ? `Website: ${restaurant.website}` : 'Website: not listed on their Google profile',
    restaurant.cuisines?.length ? `Cuisine: ${restaurant.cuisines.join(', ')}` : null,
    restaurant.primaryType ? `Type: ${restaurant.primaryType}` : null,
    restaurant.rating ? `Google rating: ${restaurant.rating} from ${restaurant.reviewCount} reviews` : null,
    '',
    'WHAT THE DINER WANTS',
    describeCriteria(criteria),
    '',
  ];

  if (criteria.proteins?.length) {
    lines.push(`Protein — must be one of: ${criteria.proteins.join(', ')}`);
  }
  if (criteria.diets?.length) {
    lines.push(`Diets: ${criteria.diets.join(', ')}`);
  }
  if (criteria.allergens?.length) {
    lines.push(`AVOIDING (hard exclusion, do not report dishes containing these): ${criteria.allergens.join(', ')}`);
  }
  if (oil && oil.id !== 'none') {
    lines.push(`Cooking fat: ${oil.label} — ${oil.blurb}`);
  }
  if (criteria.maxCalories) lines.push(`Calorie ceiling: ${criteria.maxCalories} kcal`);
  if (criteria.minProtein) lines.push(`Protein floor: ${criteria.minProtein} g`);
  if (criteria.maxCarbs) lines.push(`Carb ceiling: ${criteria.maxCarbs} g`);
  if (criteria.notes) lines.push(`In their own words: "${criteria.notes}"`);

  lines.push(
    '',
    `Report up to ${maxDishes} dishes. If nothing on the menu fits, report zero dishes — do not stretch to fill the list.`,
  );

  return lines.filter((line) => line !== null).join('\n');
}

/* ── The call ──────────────────────────────────────────────────────────── */

/**
 * Web search and web fetch both run on Anthropic's side, so a single request
 * covers "go and look it up" without a tool loop of our own.
 *
 * `web_fetch` is the workhorse here and it's the cheap one — it costs only
 * the tokens of what it reads, while each search is billed separately. It
 * will only retrieve URLs already present in the conversation, which is
 * exactly why the restaurant's own website is written into the user prompt
 * verbatim: that one line is what makes fetching the real menu legal.
 */
const TOOL_GENERATIONS = ['20260318', '20260209'];

/**
 * Which generation this account actually accepts. Newest first; if the API
 * rejects it we drop back once and remember, so only the first search of a
 * process ever pays for the discovery.
 */
let toolGeneration = TOOL_GENERATIONS[0];

function buildTools(generation = toolGeneration) {
  return [
    {
      type: `web_search_${generation}`,
      name: 'web_search',
      max_uses: 6,
    },
    {
      type: `web_fetch_${generation}`,
      name: 'web_fetch',
      max_uses: 4,
      // Menu pages carry a lot of boilerplate. This is enough for the menu
      // and not enough for the whole site.
      max_content_tokens: 30_000,
    },
    REPORT_DISHES_TOOL,
  ];
}

/** A 400 that names a tool type means this account is on an older generation. */
function isToolGenerationError(err) {
  if (err?.status !== 400) return false;
  return /web_search_|web_fetch_|tool type|unsupported/i.test(String(err.message ?? ''));
}

function extractToolInput(message) {
  for (const block of message.content ?? []) {
    if (block.type === 'tool_use' && block.name === 'report_dishes') return block.input;
  }
  return null;
}

/**
 * One restaurant, one answer.
 *
 * Returns `{ menuFound, dishes, notes, sourceUrl }` — never throws for an
 * ordinary failure. A restaurant we couldn't read is a restaurant with no
 * dishes, not a broken search.
 */
async function analyseRestaurantUncached(restaurant, criteria, maxDishes, signal) {
  const messages = [
    { role: 'user', content: buildUserPrompt(restaurant, criteria, maxDishes) },
  ];

  const request = {
    model: config.model,
    max_tokens: 16_000,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        // The system prompt and tool definitions are identical for every
        // restaurant in a search, so this turns 9 of every 10 calls into a
        // cache read.
        cache_control: { type: 'ephemeral' },
      },
    ],
    output_config: { effort: config.effort },
    // Deliberately not forced on this first turn: a forced client tool
    // starves the server tools, and the model would answer from the
    // restaurant's name instead of its menu.
    tool_choice: { type: 'auto' },
    messages,
  };

  let message = await sendWithToolFallback(request, signal);

  // `pause_turn` means the server tool run was cut short mid-flight. Hand
  // the partial turn back and let it carry on.
  let continuations = 0;
  while (message.stop_reason === 'pause_turn' && continuations < 3) {
    messages.push({ role: 'assistant', content: message.content });
    message = await streamMessage({ ...request, tools: buildTools(), messages }, signal);
    continuations += 1;
  }

  if (message.stop_reason === 'refusal') {
    return { menuFound: false, dishes: [], notes: 'The model declined to answer for this restaurant.', sourceUrl: null };
  }

  let input = extractToolInput(message);

  // Searched, then answered in prose instead of calling the tool.
  //
  // Now — and only now — it's safe to force the call. Forcing it on the
  // first request would have been the worst possible move: the model can't
  // reach a server tool while a client tool is forced, so it would have
  // skipped the menu entirely and invented dishes from the restaurant's
  // name. By this turn the menu is already in context, so forcing only
  // converts what it found into the schema.
  if (!input && message.stop_reason === 'end_turn') {
    messages.push({ role: 'assistant', content: message.content });
    messages.push({
      role: 'user',
      content:
        'Now call report_dishes with what you found. If you could not find the ' +
        'real menu, call it with menuFound=false and an empty dishes array.',
    });
    message = await streamMessage(
      {
        ...request,
        tools: buildTools(),
        messages,
        tool_choice: { type: 'tool', name: 'report_dishes' },
      },
      signal,
    );
    input = extractToolInput(message);
  }

  if (!input) {
    return { menuFound: false, dishes: [], notes: 'No menu data came back for this restaurant.', sourceUrl: null };
  }

  return {
    menuFound: Boolean(input.menuFound),
    sourceUrl: input.menuSourceUrl ?? null,
    notes: input.notes ?? '',
    dishes: (input.dishes ?? []).map((dish) => normaliseAiDish(dish, restaurant, input)),
    usage: message.usage,
  };
}

/** Streaming keeps a long web-search turn from tripping the request timeout. */
async function streamMessage(request, signal) {
  const stream = anthropic().messages.stream(request, { signal });
  const message = await stream.finalMessage();

  // Bill every turn, including the ones that end without an answer — they
  // cost the same whether or not they were useful.
  record('anthropic', priceAnthropicUsage(message.usage, request.model), 'Menu lookup');

  return message;
}

/**
 * Send, and if the account is on an older server-tool generation, step back
 * one and remember for the rest of the process.
 */
async function sendWithToolFallback(request, signal) {
  try {
    return await streamMessage({ ...request, tools: buildTools() }, signal);
  } catch (err) {
    const next = TOOL_GENERATIONS[TOOL_GENERATIONS.indexOf(toolGeneration) + 1];
    if (!isToolGenerationError(err) || !next) throw err;

    console.warn(`[menu-ai] server tools ${toolGeneration} rejected, falling back to ${next}`);
    toolGeneration = next;
    return streamMessage({ ...request, tools: buildTools() }, signal);
  }
}

/** Map the model's answer onto the shape the rest of the app speaks. */
function normaliseAiDish(dish, restaurant, envelope) {
  const macros = dish.macros ?? {};

  return {
    name: dish.name,
    description: dish.description ?? '',
    price: dish.price ?? null,
    photoUrl: null,
    // `verified` is the model's claim that it read this off a retrieved
    // menu. Anything less becomes `inferred`, which the card labels and the
    // scorer discounts.
    provenance: dish.verified && envelope.menuFound ? 'menu' : 'inferred',
    sourceUrl: dish.sourceUrl ?? envelope.menuSourceUrl ?? null,
    restaurant,
    macros: {
      calories: macros.calories ?? null,
      protein: macros.protein ?? null,
      carbs: macros.carbs ?? null,
      fat: macros.fat ?? null,
      fiber: macros.fiber ?? null,
      sodium: macros.sodium ?? null,
      source: macros.source ?? 'unknown',
    },
    proteins: dish.proteins ?? [],
    dietClaims: dish.dietClaims ?? [],
    allergenRisk: dish.allergenRisk ?? [],
    cookingFat: dish.cookingFat ?? null,
    cookingFatConfirmed: Boolean(dish.cookingFatConfirmed),
    confidence: clamp01(dish.confidence ?? 0.5),
    aiReason: dish.whyItFits ?? '',
  };
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

/**
 * Cached wrapper. A restaurant's menu is stable for days, and every miss is
 * a paid call with several web searches inside it.
 */
export async function analyseRestaurant(restaurant, criteria, maxDishes, signal) {
  if (!capabilities.menuAI) {
    return { menuFound: false, dishes: [], notes: 'No Anthropic key configured.', sourceUrl: null };
  }

  // Only the criteria that change the ANSWER go in the key. Walking distance
  // and minimum rating filter restaurants, not dishes, so including them
  // would fragment the cache for no benefit.
  const key = JSON.stringify({
    place: restaurant.placeId,
    proteins: criteria.proteins,
    diets: criteria.diets,
    allergens: criteria.allergens,
    oil: criteria.oilPreference,
    cal: criteria.maxCalories,
    protein: criteria.minProtein,
    carbs: criteria.maxCarbs,
    notes: criteria.notes,
    maxDishes,
  });

  try {
    return await cached('menu', key, () =>
      analyseRestaurantUncached(restaurant, criteria, maxDishes, signal),
    );
  } catch (err) {
    if (err?.name === 'AbortError' || signal?.aborted) throw err;

    const friendly = describeAnthropicError(err);
    console.warn(`[menu-ai] ${restaurant.name}: ${friendly}`);
    return { menuFound: false, dishes: [], notes: friendly, sourceUrl: null, failed: true };
  }
}

function describeAnthropicError(err) {
  if (err instanceof Anthropic.RateLimitError) return 'Rate limited by the Anthropic API — try again in a moment.';
  if (err instanceof Anthropic.AuthenticationError) return 'The Anthropic API key was rejected.';
  if (err instanceof Anthropic.BadRequestError) return `Anthropic rejected the request: ${err.message}`;
  if (err instanceof Anthropic.APIError) return `Anthropic API error ${err.status}: ${err.message}`;
  return err?.message ?? 'Menu lookup failed.';
}
