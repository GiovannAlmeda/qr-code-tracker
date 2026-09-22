# 🥑 Healthy Walk

**"Where should we eat" → "What should we eat."**

Tell it where you are and what you need — chicken, gluten free, no seed oils,
under 700 calories, 40g+ protein, fifteen minute walk — and it comes back with
*specific dishes* from nearby restaurants, each with a macro chart, a match
score, directions, and a save button.

The unit of a result is a **dish**, not a restaurant. The restaurant is just
one of the dish's attributes, like its calorie count.

---

## Quick start

```bash
cd healthy-walk
npm install
npm start          # → http://localhost:8787
```

It runs straight away with **no API keys at all**, using a hand-built sample
neighbourhood, so you can see exactly what it does before spending anything.

To search for real, copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

---

## The three modes

The app tells you which one it's in, in a banner at the top. It never
silently degrades.

| Mode | Keys | What you get |
|---|---|---|
| **Demo** | none | Eight invented restaurants with invented menus. Every feature works; nothing is real. |
| **Places** | Google only | Real restaurants, real ratings, real walking times — but no menu reading, so no dishes. |
| **Full** | Google + Anthropic | The real thing. Actual menu items read off the restaurants' own sites, with macros. |

---

## Getting the keys

### Google Maps Platform — finds the restaurants

1. Go to the [Google Cloud console](https://console.cloud.google.com/google/maps-apis/credentials) and create a project.
2. Enable exactly two APIs: **Places API (New)** and **Geocoding API**.
   *(You do not need the Routes API — walking times come back inside the
   Places call.)*
3. Create an API key, and restrict it to those two APIs.
4. Put it in `.env` as `GOOGLE_MAPS_API_KEY`.

### Anthropic — reads the menus

1. Get a key at [console.anthropic.com](https://console.anthropic.com/settings/keys).
2. Put it in `.env` as `ANTHROPIC_API_KEY`.

---

## What it costs, and the cap that stops it

This is the part worth reading twice.

Every real search spends money: Google bills per place lookup, Anthropic bills
per token and per web search. At the defaults (6 restaurants, Claude Opus 5)
a search costs **roughly $1.25**, so about **19 searches per $25**.

**There is a hard monthly cap, set to $25 by default.** The app refuses to
start a search that would cross it — it's a wall, not a warning:

```bash
HW_MONTHLY_BUDGET_USD=25     # or "off" for no cap
```

The running total is on the search screen, under the button, before you press
it. `GET /api/budget` has the ledger; `DELETE /api/budget` resets the count
(it does not refund anything — it just zeroes the counter).

### Making it cheaper

The two dials that matter, in order:

```bash
HW_MAX_RESTAURANTS=4          # fewer menus read per search — biggest lever
HW_MODEL=claude-sonnet-5      # about half the price of Opus 5
HW_EFFORT=low                 # less reasoning per menu
```

Rough cost per search, 6 restaurants:

| Model | Per search | Searches per $25 |
|---|---|---|
| `claude-opus-5` (default) | ~$1.25 | ~19 |
| `claude-sonnet-5` | ~$0.64 | ~39 |
| `claude-haiku-4-5` | ~$0.42 | ~58 |

**Repeat searches are free.** Menu analyses are cached for 72 hours and place
lookups for 24, so searching the same block twice in an afternoon costs
nothing the second time.

> The dollar figures are estimates from published list prices, for your own
> visibility. Your Google Cloud and Anthropic consoles are the authority on
> what you actually owe.

---

## How it actually works

The thing that shapes the whole design: **the Google Places API has no menu
data.** None. Not a menu field, not dish names, not nutrition —
`menuForChildren` is a boolean meaning "has a kids' menu". Google shows menus
on some Maps listings, but that's licensed third-party data and it isn't
exposed through any Maps Platform endpoint.

So the work splits in two:

```
   Google Places  ──►  WHERE      open, well-rated, walkable restaurants
                                  + ratings, photos, walking times

   Claude + web   ──►  WHAT       reads each restaurant's own website,
        search                    pulls the dishes that fit, estimates macros

   scoring.js     ──►  ORDER      blends review quality with criteria fit
```

One AI request per restaurant, run six at a time, streamed back to the browser
so dishes appear one by one and slot into their ranked position as they land.

---

## How it ranks

The brief was *"top having positive reviews on Google, and also a place that
fits my criteria's the best"* — so both, weighted, and neither allowed to
dominate:

| Weight | Component |
|---|---|
| 40% | how well the dish matches what you asked for |
| 30% | how good the restaurant is |
| 15% | how close it hits your macro targets |
| 15% | how short the walk is |

Weights renormalise over whatever you actually asked for, so leaving the macro
fields blank doesn't quietly cost every dish 15 points.

**Google ratings are shrunk toward a prior** before use, so a 5.0 from four
people cannot beat a 4.7 from two thousand. (It scores 0.50 against 0.82.)

**Confidence is a discount.** A dish read off a retrieved menu outranks one
the model inferred, because an unverified guess that happens to match
perfectly should not beat something real that matches well.

---

## Honesty rules

Most of the design serves these. They're the difference between a useful
shortlist and a confident liar.

**Allergens can only ever exclude, never reassure.** Finding a keyword means
"present". *Not* finding one means **"unknown — ask before ordering"**. It
never means safe. Menus do not list every ingredient, shared fryers are never
mentioned, and an app that turned silence into a green tick would be
dangerous. The warning appears in three places: when you pick an allergen,
above the results, and on every card where a specific allergen couldn't be
ruled out.

**Estimated macros are labelled apart from published ones.** A dish from a
chain that publishes its nutrition says "Published by the restaurant"; an
estimate says "Estimated ±25%".

**The model is told never to invent a dish.** If it can't find the real menu
it reports zero dishes and the card says "Menu not confirmed". An empty
result is a useful answer; a plausible fabricated one sends you walking to a
restaurant that doesn't serve it.

**Demo data is labelled as invented, on every card.** The sample restaurants
are fictional on purpose — publishing made-up menus and macros under a real
restaurant's name would be exactly the failure this app exists to avoid.

---

## Reading menu prose

Menu descriptions are adversarial in a specific way: the words that signal an
allergen also appear in the phrases that rule it out. The matcher handles
this in three passes — strip negations, neutralise safe compounds, match on
word boundaries — because the naive version silently deleted good dishes:

| Menu text | Naive | Correct |
|---|---|---|
| "Lamb kofta, **no pita**" | gluten | clear |
| "two **corn tortillas**" | gluten | clear |
| "**rice noodles** with shrimp" | gluten | clear |
| "**cauliflower rice** bowl" | not keto | keto |
| "massaged kale" | gluten (!) | clear |
| "seared tuna with **tamari**" | gluten | soy, not gluten |
| "fried in **beef shortening**" | seed oil | beef tallow |

Those cases are all in `test/nutrition.test.js`, because every one of them
was a real bug first.

---

## The seed-oil bit

This is the axis nothing else covers. Every macro app ignores cooking fat
entirely; the seed-oil directories track fat but no nutrition.

- Named seed oils (canola, soybean, corn, cottonseed, sunflower, safflower,
  grapeseed, rice bran) and the fryer catch-alls ("vegetable oil",
  "shortening") are a confirmed fail.
- Avocado oil, olive oil, coconut, tallow, butter, ghee, duck fat are a
  confirmed pass, with the specific one named on the card.
- **Sesame and peanut oil are treated as contested**, not as hard fails —
  they're flavour oils used by the teaspoon, and hard-listing them strikes out
  most of an Asian menu over a quarter-teaspoon.
- Deep-fried anything with no oil named is flagged amber, not green: a fryer
  is a seed oil unless the restaurant says otherwise.

Most restaurants don't state their oil, so this is usually amber. The card
says so rather than guessing.

---

## Layout

```
healthy-walk/
├── server/
│   ├── index.js       routes, static serving
│   ├── config.js      env, capability detection, the three modes
│   ├── places.js      Google: nearby, photos, geocoding, walking times
│   ├── menu-ai.js     Claude: reads a menu, returns structured dishes
│   ├── analyse.js     raw dish → criteria chips + allergen findings
│   ├── search.js      orchestration, streaming, the budget gate
│   ├── budget.js      the spend ledger and the cap
│   ├── saved.js       "Save for later", one JSON file
│   ├── cache.js       two-tier cache in front of every paid call
│   └── demo-data.js   the invented neighbourhood
├── shared/            imported by BOTH the server and the browser
│   ├── criteria.js    the app's whole vocabulary
│   ├── nutrition.js   allergen + cooking-fat knowledge, disclaimers
│   ├── scoring.js     the ranking formula
│   ├── schema.js      the dish shape, macro maths
│   └── directions.js  Google/Apple Maps walking links
├── public/            the PWA — no build step, no framework
└── test/              47 tests, `npm test`
```

`shared/` is served to the browser as ES modules, so the scoring formula and
the allergen rules exist in exactly one place.

---

## On your phone

It's a PWA. Open it on your phone and use "Add to Home Screen" — it installs
with an icon, opens full-screen, and the shell works offline (searches don't,
for obvious reasons).

For that to work away from your laptop the server needs to be reachable: run
it on the same wifi and use your machine's LAN address, or deploy it anywhere
that runs Node 20+.

---

## Notes

- Zero runtime dependencies beyond the Anthropic SDK. The HTTP server, the
  router, the SSE stream and the `.env` parser are all standard library, so
  `npm install` can't be the reason it won't start.
- Your API keys never reach the browser. Restaurant photos are proxied
  through `/api/photo` rather than linked directly.
- Google requires visible attribution wherever Places data is shown; it's at
  the bottom of the results.
- Google's terms cap caching of geocoded results at 30 days — the cache is
  set to 25.

---

## Things worth knowing before you rely on it

- **Menu coverage is the hard limit.** Chains with 20+ US locations are
  required to publish nutrition, so those are accurate. Independents mostly
  publish a menu but no numbers, so those macros are estimates. Some
  restaurants publish no usable menu at all, and for those it honestly
  reports nothing.
- **Nothing here is medical advice**, and the allergen handling is a
  shortlist to ask about, not a clearance.
