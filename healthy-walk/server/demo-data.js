/**
 * Demo mode.
 *
 * With no API keys the app still has to be worth looking at, so this is a
 * hand-built neighbourhood: eight invented restaurants with realistic menus,
 * realistic macros (drawn from the USDA figures in shared/nutrition.js) and a
 * deliberate spread of confidence levels, so every state the results UI can
 * reach is visible without spending a cent.
 *
 * The restaurants are fictional on purpose. Publishing invented menus and
 * macros under the name of a real restaurant would be exactly the kind of
 * confident-sounding fabrication this app exists to avoid.
 */

const DEMO_RESTAURANTS = [
  {
    placeId: 'demo-greenhouse',
    name: 'The Greenhouse Kitchen',
    address: '114 Aldergrove St',
    rating: 4.7,
    reviewCount: 1842,
    priceLevel: 'PRICE_LEVEL_MODERATE',
    offsetMeters: [320, 180],
    cuisines: ['american', 'health food'],
    summary: 'Seasonal bowls and plates. Cooks exclusively in avocado and olive oil.',
    statedFat: 'avocado oil',
  },
  {
    placeId: 'demo-cedar',
    name: 'Cedar & Ash',
    address: '2 Marlow Lane',
    rating: 4.6,
    reviewCount: 934,
    priceLevel: 'PRICE_LEVEL_EXPENSIVE',
    offsetMeters: [-540, 610],
    cuisines: ['steakhouse', 'american'],
    summary: 'Wood-fired grill. Dry-aged beef and whole fish.',
    statedFat: 'beef tallow',
  },
  {
    placeId: 'demo-lantern',
    name: 'Blue Lantern',
    address: '77 Kessler Ave',
    rating: 4.4,
    reviewCount: 2610,
    priceLevel: 'PRICE_LEVEL_MODERATE',
    offsetMeters: [880, -240],
    cuisines: ['thai', 'asian'],
    summary: 'Family-run Thai kitchen, open since 1994.',
    statedFat: null,
  },
  {
    placeId: 'demo-portside',
    name: 'Portside Fish Co.',
    address: '9 Harbour Walk',
    rating: 4.8,
    reviewCount: 412,
    priceLevel: 'PRICE_LEVEL_EXPENSIVE',
    offsetMeters: [-1200, -450],
    cuisines: ['seafood'],
    summary: 'Day-boat fish, simply grilled.',
    statedFat: 'olive oil',
  },
  {
    placeId: 'demo-masa',
    name: 'Masa Verde',
    address: '318 Foundry Rd',
    rating: 4.5,
    reviewCount: 1187,
    priceLevel: 'PRICE_LEVEL_INEXPENSIVE',
    offsetMeters: [410, 720],
    cuisines: ['mexican'],
    summary: 'Nixtamal tortillas made in house.',
    statedFat: null,
  },
  {
    placeId: 'demo-olive',
    name: 'Olive & Thyme',
    address: '45 Bellamy Sq',
    rating: 4.3,
    reviewCount: 668,
    priceLevel: 'PRICE_LEVEL_MODERATE',
    offsetMeters: [-260, 340],
    cuisines: ['mediterranean', 'greek'],
    summary: 'Mezze, grilled meats, and a lot of olive oil.',
    statedFat: 'extra virgin olive oil',
  },
  {
    placeId: 'demo-ironworks',
    name: 'Ironworks Burgers',
    address: '600 Dunmore St',
    rating: 4.9,
    reviewCount: 88,
    priceLevel: 'PRICE_LEVEL_INEXPENSIVE',
    offsetMeters: [150, -90],
    cuisines: ['burger', 'american'],
    // High rating, tiny sample — exists to show the Bayesian adjustment
    // doing its job and not putting this at the top.
    summary: 'Smash burgers and fries. Newly opened.',
    statedFat: null,
  },
  {
    placeId: 'demo-sunfeather',
    name: 'Sunfeather Rotisserie',
    address: '23 Pell St',
    rating: 4.6,
    reviewCount: 1503,
    priceLevel: 'PRICE_LEVEL_MODERATE',
    offsetMeters: [-700, 120],
    cuisines: ['peruvian', 'chicken'],
    summary: 'Charcoal rotisserie chicken, sides, and green sauce.',
    statedFat: null,
  },
];

/**
 * Dishes. `criteriaHints` carries the facts the analyser would otherwise dig
 * out of a live menu, so demo results exercise the same scoring path as real
 * ones rather than a parallel fake one.
 */
const DEMO_DISHES = [
  {
    placeId: 'demo-greenhouse',
    name: 'Avocado Oil Chicken Power Bowl',
    description: 'Grilled chicken breast, cauliflower rice, roasted broccoli, avocado, pumpkin seeds, lemon-herb dressing. Everything cooked in avocado oil.',
    price: '$17',
    macros: { calories: 610, protein: 52, carbs: 24, fat: 34, fiber: 11, sodium: 720, source: 'published' },
    proteins: ['chicken'],
    diets: ['gluten_free', 'dairy_free', 'paleo', 'low_carb', 'high_protein', 'whole30'],
    cookingFat: 'avocado oil',
    allergenRisk: [],
    confidence: 0.95,
  },
  {
    placeId: 'demo-greenhouse',
    name: 'Wild Salmon & Greens',
    description: 'Seared wild salmon over massaged kale, shaved fennel, olive oil and lemon.',
    price: '$23',
    macros: { calories: 520, protein: 41, carbs: 12, fat: 34, fiber: 6, sodium: 540, source: 'published' },
    proteins: ['salmon'],
    diets: ['gluten_free', 'dairy_free', 'paleo', 'keto', 'low_carb', 'high_protein', 'pescatarian'],
    cookingFat: 'olive oil',
    allergenRisk: [],
    confidence: 0.95,
  },
  {
    placeId: 'demo-cedar',
    name: 'Grass-Fed Sirloin, Tallow-Basted',
    description: '10 oz sirloin basted in beef tallow, charred broccolini, sea salt.',
    price: '$38',
    macros: { calories: 740, protein: 68, carbs: 9, fat: 48, fiber: 4, sodium: 880, source: 'estimated' },
    proteins: ['beef'],
    diets: ['gluten_free', 'paleo', 'keto', 'low_carb', 'high_protein'],
    cookingFat: 'beef tallow',
    allergenRisk: [],
    confidence: 0.8,
  },
  {
    placeId: 'demo-cedar',
    name: 'Whole Roasted Branzino',
    description: 'Whole branzino, olive oil, herbs, grilled lemon. Served with seasonal greens.',
    price: '$34',
    macros: { calories: 480, protein: 46, carbs: 6, fat: 30, fiber: 3, sodium: 620, source: 'estimated' },
    proteins: ['whitefish'],
    diets: ['gluten_free', 'dairy_free', 'paleo', 'keto', 'low_carb', 'high_protein', 'pescatarian'],
    cookingFat: 'olive oil',
    allergenRisk: ['fish'],
    confidence: 0.8,
  },
  {
    placeId: 'demo-lantern',
    name: 'Grilled Chicken Larb Salad',
    description: 'Grilled chicken, mint, lime, shallot, toasted rice powder, chilli. Served with cabbage.',
    price: '$16',
    macros: { calories: 430, protein: 38, carbs: 18, fat: 22, fiber: 5, sodium: 1120, source: 'estimated' },
    proteins: ['chicken'],
    diets: ['dairy_free', 'low_carb', 'high_protein'],
    // Fish sauce is near-universal in Thai cooking and rarely written down.
    allergenRisk: ['fish'],
    cookingFat: null,
    confidence: 0.55,
  },
  {
    placeId: 'demo-lantern',
    name: 'Pad Thai with Shrimp',
    description: 'Rice noodles, shrimp, egg, bean sprout, crushed peanut, tamarind.',
    price: '$18',
    macros: { calories: 810, protein: 31, carbs: 96, fat: 32, fiber: 4, sodium: 1480, source: 'estimated' },
    proteins: ['shrimp'],
    diets: ['dairy_free'],
    allergenRisk: ['peanut', 'shellfish', 'egg', 'fish', 'soy'],
    cookingFat: null,
    confidence: 0.6,
  },
  {
    placeId: 'demo-portside',
    name: 'Grilled Day-Boat Cod',
    description: 'Line-caught cod, olive oil, capers, parsley, grilled asparagus.',
    price: '$29',
    macros: { calories: 390, protein: 44, carbs: 8, fat: 19, fiber: 4, sodium: 580, source: 'estimated' },
    proteins: ['whitefish'],
    diets: ['gluten_free', 'dairy_free', 'paleo', 'keto', 'low_carb', 'high_protein', 'pescatarian'],
    cookingFat: 'olive oil',
    allergenRisk: ['fish'],
    confidence: 0.85,
  },
  {
    placeId: 'demo-portside',
    name: 'Ahi Poke Bowl',
    description: 'Raw ahi tuna, brown rice, cucumber, avocado, sesame, soy-ginger dressing.',
    price: '$21',
    macros: { calories: 620, protein: 40, carbs: 58, fat: 22, fiber: 8, sodium: 980, source: 'estimated' },
    proteins: ['tuna'],
    diets: ['dairy_free', 'pescatarian', 'high_protein'],
    // Soy sauce means wheat, and sesame is right there in the description.
    allergenRisk: ['soy', 'sesame', 'gluten', 'fish'],
    cookingFat: null,
    confidence: 0.75,
  },
  {
    placeId: 'demo-masa',
    name: 'Carne Asada Plate',
    description: 'Grilled skirt steak, two corn tortillas, black beans, pico de gallo, guacamole.',
    price: '$15',
    macros: { calories: 680, protein: 46, carbs: 52, fat: 32, fiber: 13, sodium: 940, source: 'estimated' },
    proteins: ['beef'],
    diets: ['gluten_free', 'dairy_free'],
    allergenRisk: ['corn'],
    cookingFat: null,
    confidence: 0.65,
  },
  {
    placeId: 'demo-masa',
    name: 'Pollo Asado Salad',
    description: 'Charcoal-grilled chicken thigh, romaine, black beans, pepitas, salsa verde, lime.',
    price: '$14',
    macros: { calories: 470, protein: 40, carbs: 26, fat: 22, fiber: 10, sodium: 810, source: 'estimated' },
    proteins: ['chicken'],
    diets: ['gluten_free', 'dairy_free', 'high_protein'],
    allergenRisk: ['nightshade'],
    cookingFat: null,
    confidence: 0.65,
  },
  {
    placeId: 'demo-olive',
    name: 'Chicken Souvlaki Plate',
    description: 'Marinated chicken skewers in extra virgin olive oil, Greek salad, tzatziki. Pita on the side.',
    price: '$19',
    macros: { calories: 590, protein: 48, carbs: 30, fat: 31, fiber: 6, sodium: 1050, source: 'estimated' },
    proteins: ['chicken'],
    diets: ['high_protein'],
    allergenRisk: ['dairy', 'gluten'],
    cookingFat: 'extra virgin olive oil',
    confidence: 0.75,
  },
  {
    placeId: 'demo-olive',
    name: 'Lamb Kofta, No Pita',
    description: 'Spiced lamb kofta grilled over charcoal, olive oil, herb salad, lemon.',
    price: '$22',
    macros: { calories: 560, protein: 42, carbs: 11, fat: 39, fiber: 3, sodium: 890, source: 'estimated' },
    proteins: ['lamb'],
    diets: ['gluten_free', 'dairy_free', 'low_carb', 'keto', 'high_protein'],
    allergenRisk: ['nightshade'],
    cookingFat: 'olive oil',
    confidence: 0.7,
  },
  {
    placeId: 'demo-ironworks',
    name: 'Double Smash Burger',
    description: 'Two beef patties, American cheese, pickles, house sauce, toasted bun. Fries included.',
    price: '$13',
    macros: { calories: 1140, protein: 54, carbs: 78, fat: 68, fiber: 5, sodium: 1690, source: 'estimated' },
    proteins: ['beef'],
    diets: [],
    allergenRisk: ['gluten', 'dairy', 'egg', 'sesame', 'soy'],
    // Deep-fried in unnamed oil: the case the seed-oil filter exists for.
    cookingFat: null,
    friedRisk: 'high',
    confidence: 0.6,
  },
  {
    placeId: 'demo-sunfeather',
    name: 'Quarter Charcoal Chicken + Two Sides',
    description: 'Charcoal rotisserie chicken, no marinade oil listed. Choice of two sides.',
    price: '$16',
    macros: { calories: 540, protein: 49, carbs: 28, fat: 26, fiber: 6, sodium: 1010, source: 'estimated' },
    proteins: ['chicken'],
    diets: ['gluten_free', 'dairy_free', 'high_protein'],
    allergenRisk: [],
    cookingFat: null,
    confidence: 0.6,
  },
  {
    placeId: 'demo-sunfeather',
    name: 'Half Chicken, Greens & Avocado',
    description: 'Half charcoal chicken, garden salad, half an avocado, lime vinaigrette.',
    price: '$21',
    macros: { calories: 720, protein: 72, carbs: 16, fat: 42, fiber: 9, sodium: 1120, source: 'estimated' },
    proteins: ['chicken'],
    diets: ['gluten_free', 'dairy_free', 'paleo', 'low_carb', 'high_protein'],
    allergenRisk: [],
    cookingFat: null,
    confidence: 0.6,
  },
];

/** Shift a lat/lng by a metre offset, so demo places sit around the user. */
function offsetLocation(origin, [eastMeters, northMeters]) {
  const metersPerDegLat = 111_320;
  const metersPerDegLng = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  return {
    lat: origin.lat + northMeters / metersPerDegLat,
    lng: origin.lng + eastMeters / (metersPerDegLng || 1),
  };
}

/**
 * Build the demo neighbourhood around wherever the user actually is, so the
 * walking times and the map links are at least internally consistent.
 */
export function demoDishes(origin) {
  const restaurants = new Map();

  for (const spec of DEMO_RESTAURANTS) {
    const location = offsetLocation(origin, spec.offsetMeters);
    const distanceMeters = Math.round(Math.hypot(...spec.offsetMeters) * 1.25);

    restaurants.set(spec.placeId, {
      placeId: spec.placeId,
      name: spec.name,
      address: spec.address,
      location,
      rating: spec.rating,
      reviewCount: spec.reviewCount,
      priceLevel: spec.priceLevel,
      openNow: true,
      website: null,
      mapsUrl: null,
      photoName: null,
      logoUrl: null,
      summary: spec.summary,
      statedFat: spec.statedFat,
      cuisines: spec.cuisines,
      distanceMeters,
      walkMinutes: Math.max(1, Math.round(distanceMeters / 80)),
      walkIsEstimated: true,
    });
  }

  return DEMO_DISHES.map((dish) => ({
    name: dish.name,
    description: dish.description,
    price: dish.price,
    photoUrl: null,
    provenance: 'demo',
    sourceUrl: null,
    restaurant: restaurants.get(dish.placeId),
    macros: {
      fiber: null,
      sodium: null,
      errorMarginPercent: dish.macros.source === 'published' ? 5 : 25,
      ...dish.macros,
    },
    proteins: dish.proteins,
    dietClaims: dish.diets,
    allergenRisk: dish.allergenRisk,
    cookingFat: dish.cookingFat ?? restaurants.get(dish.placeId)?.statedFat ?? null,
    friedRisk: dish.friedRisk ?? null,
    confidence: dish.confidence,
  }));
}

export const DEMO_NOTICE =
  'These are invented restaurants with invented menus, shown so you can see how ' +
  'the app works without an API key. Nothing here is a real place. Add your keys ' +
  'in .env to search for real.';
