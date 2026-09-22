/**
 * "Get Directions" — walking directions, on whichever map app the phone has.
 *
 * Both links open in the native app when one is installed and fall back to
 * the web map when it isn't, so there is no app-store detection to do.
 */

/**
 * Google Maps universal cross-platform URL.
 *
 * `destination` must be human-readable text even when a place id is supplied —
 * Google uses the text when it can't resolve the id, and silently drops the
 * whole request when the text is missing.
 */
export function googleMapsWalkingUrl({ destination, placeId, origin }) {
  const params = new URLSearchParams({
    api: '1',
    destination,
    travelmode: 'walking',
  });
  if (placeId) params.set('destination_place_id', placeId);
  // Omitting origin lets Maps use the phone's live GPS, which is fresher than
  // whatever we captured when the search ran. Only pin it if asked.
  if (origin) params.set('origin', `${origin.lat},${origin.lng}`);

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Apple Maps. `dirflg=w` is the walking flag. */
export function appleMapsWalkingUrl({ destination, coords, origin }) {
  const params = new URLSearchParams({ dirflg: 'w' });
  // Apple resolves coordinates reliably and free-text only sometimes, so
  // prefer coordinates and keep the name as the label.
  params.set('daddr', coords ? `${coords.lat},${coords.lng}` : destination);
  if (origin) params.set('saddr', `${origin.lat},${origin.lng}`);
  params.set('q', destination);

  return `https://maps.apple.com/?${params.toString()}`;
}

/** True on iPhone/iPad, including iPadOS masquerading as a Mac. */
export function isAppleDevice(nav = globalThis.navigator) {
  if (!nav) return false;
  const ua = nav.userAgent ?? '';
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return ua.includes('Macintosh') && (nav.maxTouchPoints ?? 0) > 1;
}

/** Pick the right map for the device the owner is holding. */
export function directionsUrl(place, origin, nav) {
  const destination = place.address ? `${place.name}, ${place.address}` : place.name;

  if (isAppleDevice(nav)) {
    return appleMapsWalkingUrl({ destination, coords: place.location, origin });
  }
  return googleMapsWalkingUrl({ destination, placeId: place.placeId, origin });
}
