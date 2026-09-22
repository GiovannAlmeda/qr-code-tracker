/**
 * Google Maps Platform: which restaurants are near me, how good are they,
 * and how long would it take to walk there.
 *
 * What Google can and cannot do for this app, stated plainly, because it
 * shapes everything downstream: the Places API has NO menu data. Not a menu
 * field, not dish names, not prices, not nutrition. `menuForChildren` is a
 * boolean meaning "has a kids' menu". Google shows menus on some Maps
 * listings, but that's licensed third-party data and it is not exposed
 * through any Maps Platform endpoint.
 *
 * So Google answers WHERE. The WHAT — the actual dishes — comes from
 * menu-ai.js reading the restaurant's own website. Don't come back here
 * looking for dishes; they aren't here and they never will be.
 *
 * Every call is server-side. The key never reaches the browser — dish photos
 * come back through /api/photo rather than a direct Google URL.
 */

import { config, capabilities } from './config.js';
import { cached } from './cache.js';
import { record, PRICES } from './budget.js';
import {
  walkMinutesToMeters, metersToWalkMinutes, STREET_DETOUR_FACTOR,
} from '../shared/criteria.js';

const PLACES_ROOT = 'https://places.googleapis.com/v1';
const GEOCODE_ROOT = 'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * The field mask decides the price of every call: Google bills at the
 * highest tier any requested field belongs to, and the free monthly
 * allowance drops with it (Essentials 10k, Pro 5k, Enterprise 1k).
 *
 *   Essentials — id, displayName, formattedAddress, location, types
 *   Pro        — photos, websiteUri, googleMapsUri
 *   Enterprise — rating, userRatingCount, priceLevel, currentOpeningHours
 *
 * `rating` is Enterprise and the whole ranking depends on it, so Enterprise
 * is the floor. What we deliberately DON'T ask for is `editorialSummary`,
 * `reviews`, `dineIn` or the `serves*` booleans — those are Atmosphere tier,
 * the most expensive band, and none of them is worth the surcharge here.
 */
const NEARBY_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.primaryTypeDisplayName',
  'places.photos',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.currentOpeningHours.openNow',
  // Walking distance and duration, in this same call. Asking for it here
  // saves an entire Routes API round trip, and means the Routes API never
  // has to be enabled on the key at all.
  'routingSummaries',
].join(',');

export class PlacesError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = 'PlacesError';
    this.statusCode = status;
    this.detail = detail;
  }
}

async function googleFetch(url, options = {}) {
  const res = await fetch(url, options);

  let payload;
  const text = await res.text();
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  // The older maps.googleapis.com endpoints answer HTTP 200 and put the
  // failure in the body, so checking res.ok alone silently swallows them.
  const legacyStatus = payload?.status;
  const legacyFailed = typeof legacyStatus === 'string' && !['OK', 'ZERO_RESULTS'].includes(legacyStatus);

  if (res.ok && !legacyFailed) return payload;

  const message =
    payload?.error?.message ??
    payload?.error_message ??
    (legacyFailed ? legacyStatus : `Google returned ${res.status}`);

  if (res.status === 403 || res.status === 401 || /not enabled|API_KEY|REQUEST_DENIED|PERMISSION_DENIED/i.test(String(message))) {
    throw new PlacesError(
      `Google rejected the request (${message}). Check the key is valid and that ` +
      'both "Places API (New)" and "Geocoding API" are enabled for its project.',
      403,
      payload,
    );
  }
  if (res.status === 429 || /RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT/i.test(String(message))) {
    throw new PlacesError('Google rate limit or quota reached. Try again shortly.', 429, payload);
  }
  throw new PlacesError(message, res.status || 500, payload);
}

/* ── Nearby restaurants ────────────────────────────────────────────────── */

/**
 * Masked fields with no value are omitted entirely rather than returned as
 * null, so every read here needs a guard.
 */
function normalisePlace(raw, routingSummary, origin) {
  const location = {
    lat: raw.location?.latitude,
    lng: raw.location?.longitude,
  };

  // Walking numbers straight from Google when routingSummaries came back,
  // otherwise crow-flies with a detour factor. `walkIsEstimated` drives the
  // "~" the UI shows, so the difference stays visible.
  const leg = routingSummary?.legs?.[0];
  const routedMeters = leg?.distanceMeters;
  const routedSeconds = Number.parseInt(String(leg?.duration ?? ''), 10);
  const hasRoute = Number.isFinite(routedMeters) && Number.isFinite(routedSeconds);

  const crowFlies = haversineMeters(origin, location);

  return {
    placeId: raw.id,
    name: raw.displayName?.text ?? 'Unnamed',
    address: raw.formattedAddress ?? '',
    location,
    rating: raw.rating ?? null,
    reviewCount: raw.userRatingCount ?? 0,
    priceLevel: raw.priceLevel ?? null,
    openNow: raw.currentOpeningHours?.openNow ?? null,
    website: raw.websiteUri ?? null,
    mapsUrl: raw.googleMapsUri ?? null,
    photoName: raw.photos?.[0]?.name ?? null,
    photoAttribution: raw.photos?.[0]?.authorAttributions?.[0]?.displayName ?? null,
    logoUrl: null,
    primaryType: raw.primaryTypeDisplayName?.text ?? null,
    cuisines: (raw.types ?? [])
      .filter((type) => type.endsWith('_restaurant') || ['cafe', 'bakery', 'bar', 'meal_takeaway', 'meal_delivery'].includes(type))
      .map((type) => type.replace(/_restaurant$/, '').replace(/_/g, ' ')),
    distanceMeters: hasRoute ? routedMeters : Math.round(crowFlies * STREET_DETOUR_FACTOR),
    walkMinutes: hasRoute ? Math.max(1, Math.round(routedSeconds / 60)) : metersToWalkMinutes(crowFlies),
    walkIsEstimated: !hasRoute,
  };
}

/**
 * Nearby Search (New). Google caps this at 20 results and a 50km radius,
 * which is plenty — only the top handful ever go to the AI.
 */
export async function findNearbyRestaurants(criteria) {
  if (!capabilities.places) return [];

  const radius = Math.min(50_000, Math.max(50, walkMinutesToMeters(criteria.walkMinutes)));
  const origin = criteria.location;

  // Round the coordinates into the cache key so standing still — or pacing
  // up the street — reuses the same result instead of re-billing.
  const cacheKey = JSON.stringify({
    lat: origin.lat.toFixed(3),
    lng: origin.lng.toFixed(3),
    radius,
  });

  const raw = await cached(
    'places',
    cacheKey,
    () => {
      // Only a cache miss costs anything, so the ledger is written here
      // rather than around the cached() call.
      record('google', PRICES.google.nearbySearch, 'Nearby Search');
      return googleFetch(`${PLACES_ROOT}/places:searchNearby`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': config.googleKey,
          'X-Goog-FieldMask': NEARBY_FIELD_MASK,
        },
        body: JSON.stringify({
          includedTypes: ['restaurant'],
          maxResultCount: 20,
          rankPreference: 'DISTANCE',
          locationRestriction: {
            circle: {
              center: { latitude: origin.lat, longitude: origin.lng },
              radius,
            },
          },
          routingParameters: {
            origin: { latitude: origin.lat, longitude: origin.lng },
            travelMode: 'WALK',
          },
        }),
      });
    },
    // Restaurants don't move. Opening hours do, but that's filtered below
    // against a fresh read every time rather than against the cache.
    24 * 3600_000,
  );

  const summaries = raw.routingSummaries ?? [];
  const places = (raw.places ?? []).map((place, index) =>
    normalisePlace(place, summaries[index], origin),
  );

  return places.filter((place) => {
    if (criteria.openNow && place.openNow === false) return false;
    if (criteria.minRating && (place.rating ?? 0) < criteria.minRating) return false;
    if (criteria.minReviews && place.reviewCount < criteria.minReviews) return false;
    if (criteria.priceLevels?.length && place.priceLevel && !criteria.priceLevels.includes(place.priceLevel)) return false;
    // Google's radius is crow-flies; the walking route can still be longer
    // than the budget. Allow a little slack so a 16-minute walk isn't
    // dropped from a 15-minute search.
    if (place.walkMinutes > criteria.walkMinutes * 1.25) return false;
    return true;
  });
}

/* ── Distance ──────────────────────────────────────────────────────────── */

export function haversineMeters(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return 0;

  const R = 6_371_000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ── Photos ────────────────────────────────────────────────────────────── */

/**
 * Resolve a Google photo resource name to a real image URL.
 *
 * `skipHttpRedirect=true` makes Google answer with JSON instead of a 302,
 * which lets us cache the resolved URL and keeps the API key out of anything
 * the browser ever sees.
 *
 * Worth knowing: these are PLACE photos, not dish photos. They carry no
 * labels, so there is no way to know which one shows the dish we matched.
 * The card treats them as restaurant imagery, never as "here is your meal".
 */
export async function photoRedirectUrl(photoName, maxPx = 800) {
  if (!capabilities.places) throw new PlacesError('No Google key configured', 501);

  const safeName = String(photoName).replace(/^\/+/, '');
  if (!/^places\/[\w-]+\/photos\/[\w-]+$/.test(safeName)) {
    throw new PlacesError('Not a photo resource name', 400);
  }

  return cached(
    'photo',
    `${safeName}@${maxPx}`,
    async () => {
      record('google', PRICES.google.photo, 'Place photo');
      const url = new URL(`${PLACES_ROOT}/${safeName}/media`);
      url.searchParams.set('maxHeightPx', String(maxPx));
      url.searchParams.set('skipHttpRedirect', 'true');
      url.searchParams.set('key', config.googleKey);

      const data = await googleFetch(url.toString());
      return data.photoUri;
    },
    // Google's signed photo URLs are long-lived but not permanent.
    6 * 3600_000,
  );
}

/* ── Geocoding ─────────────────────────────────────────────────────────── */

/** Turn a typed address into coordinates, for when GPS is denied. */
export async function geocodeAddress(query) {
  if (!capabilities.places) {
    throw new PlacesError('Add a Google Maps key to look up addresses.', 501);
  }

  return cached(
    'geocode',
    query.toLowerCase(),
    async () => {
      record('google', PRICES.google.geocode, 'Geocode');
      const url = new URL(GEOCODE_ROOT);
      url.searchParams.set('address', query);
      url.searchParams.set('key', config.googleKey);

      const data = await googleFetch(url.toString());
      if (!data.results?.length) {
        throw new PlacesError(`Couldn't find "${query}".`, 404, data.status);
      }

      const best = data.results[0];
      return {
        lat: best.geometry.location.lat,
        lng: best.geometry.location.lng,
        label: best.formatted_address,
      };
    },
    // Google's terms cap caching of geocoded results at 30 days.
    25 * 24 * 3600_000,
  );
}
