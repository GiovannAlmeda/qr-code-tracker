/**
 * Healthy Walk — client.
 *
 * Small enough to read top to bottom. State lives in one object, the DOM is
 * built by functions that take data and return elements, and nothing
 * re-renders that didn't change.
 */

import {
  defaultCriteria, sanitizeCriteria, describeCriteria,
  PERSISTED_CRITERIA_FIELDS, walkMinutesToMeters, metersToMiles,
} from '../shared/criteria.js';
import { macroSplit } from '../shared/schema.js';
import { directionsUrl } from '../shared/directions.js';
import { scoreLabel, explainScore } from '../shared/scoring.js';
import { ALLERGEN_DISCLAIMER_SHORT } from '../shared/nutrition.js';

const $ = (id) => document.getElementById(id);

const state = {
  config: null,
  criteria: defaultCriteria(),
  dishes: [],
  savedIds: new Set(),
  searching: false,
  abort: null,
};

const PROFILE_KEY = 'healthy-walk:profile';
const THEME_KEY = 'healthy-walk:theme';

/* ══════════════════════════════════════════════════════════════════════
   Boot
   ══════════════════════════════════════════════════════════════════════ */

async function boot() {
  restoreTheme();

  try {
    state.config = await fetchJson('/api/config');
  } catch {
    showToast('Could not reach the server.');
    return;
  }

  restoreProfile();
  buildChips();
  bindControls();
  renderMode();
  syncControlsFromCriteria();
  await refreshSaved();

  registerServiceWorker();
}

/* ══════════════════════════════════════════════════════════════════════
   Criteria form
   ══════════════════════════════════════════════════════════════════════ */

function buildChips() {
  const { vocab } = state.config;

  renderChipSet($('protein-chips'), vocab.proteins, {
    isOn: (item) => state.criteria.proteins.includes(item.id),
    toggle: (item) => toggleIn(state.criteria.proteins, item.id),
    emoji: true,
  });

  renderChipSet($('diet-chips'), vocab.diets, {
    isOn: (item) => state.criteria.diets.includes(item.id),
    toggle: (item) => toggleIn(state.criteria.diets, item.id),
  });

  renderChipSet($('allergen-chips'), vocab.allergens, {
    isOn: (item) => state.criteria.allergens.includes(item.id),
    toggle: (item) => toggleIn(state.criteria.allergens, item.id),
    danger: true,
    onAfter: renderAllergenNotice,
  });

  renderChipSet($('price-chips'), vocab.priceLevels, {
    isOn: (item) => state.criteria.priceLevels.includes(item.id),
    toggle: (item) => toggleIn(state.criteria.priceLevels, item.id),
  });

  // Oil preference is single-select, so it behaves as a radio group.
  renderChipSet($('oil-chips'), vocab.oilPreferences, {
    isOn: (item) => state.criteria.oilPreference === item.id,
    toggle: (item) => { state.criteria.oilPreference = item.id; },
    radio: true,
    onAfter: renderOilHint,
  });

  renderAllergenNotice();
  renderOilHint();
}

function renderChipSet(container, items, { isOn, toggle, emoji, danger, radio, onAfter }) {
  container.replaceChildren();

  for (const item of items) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `chip${danger ? ' chip--danger' : ''}`;
    chip.setAttribute(radio ? 'role' : 'aria-pressed', radio ? 'radio' : String(isOn(item)));
    if (radio) chip.setAttribute('aria-checked', String(isOn(item)));

    if (emoji && item.emoji) {
      const span = document.createElement('span');
      span.className = 'chip__emoji';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = item.emoji;
      chip.append(span);
    }
    chip.append(document.createTextNode(item.label));

    chip.addEventListener('click', () => {
      toggle(item);
      for (const [index, sibling] of [...container.children].entries()) {
        const on = String(isOn(items[index]));
        sibling.setAttribute(radio ? 'aria-checked' : 'aria-pressed', on);
      }
      persistProfile();
      onAfter?.();
    });

    container.append(chip);
  }
}

function toggleIn(list, id) {
  const index = list.indexOf(id);
  if (index === -1) list.push(id);
  else list.splice(index, 1);
}

/**
 * The allergen caveat. It appears the instant an allergen is selected, in
 * the form, before any search happens — the owner asked for the warning to
 * ride with the search itself, and the honest moment to say "menus don't
 * list every ingredient" is while they're still choosing.
 */
function renderAllergenNotice() {
  const notice = $('allergen-notice');
  const selected = state.criteria.allergens.length;

  notice.hidden = selected === 0;
  if (!selected) return;

  const names = state.criteria.allergens
    .map((id) => state.config.vocab.allergens.find((a) => a.id === id))
    .filter(Boolean);

  const specific = names
    .map((allergen) => allergen.severityNote)
    .filter(Boolean)
    .slice(0, 2)
    .join(' ');

  $('allergen-notice-text').textContent =
    `${state.config.disclaimers.allergens} ${specific}`.trim();
}

function renderOilHint() {
  const chosen = state.config.vocab.oilPreferences
    .find((option) => option.id === state.criteria.oilPreference);
  $('oil-hint').textContent = chosen?.blurb ?? '';
}

function bindControls() {
  $('walk-slider').addEventListener('input', (event) => {
    state.criteria.walkMinutes = Number(event.target.value);
    renderWalk();
    persistProfile();
  });

  $('rating-slider').addEventListener('input', (event) => {
    state.criteria.minRating = Number(event.target.value);
    $('rating-value').textContent = `${state.criteria.minRating.toFixed(1)}★`;
    persistProfile();
  });

  $('reviews-slider').addEventListener('input', (event) => {
    state.criteria.minReviews = Number(event.target.value);
    $('reviews-value').textContent = String(state.criteria.minReviews);
    persistProfile();
  });

  for (const [id, key] of [['max-calories', 'maxCalories'], ['min-protein', 'minProtein'], ['max-carbs', 'maxCarbs']]) {
    $(id).addEventListener('change', (event) => {
      const value = event.target.value.trim();
      state.criteria[key] = value === '' ? null : Number(value);
      persistProfile();
    });
  }

  $('open-now').addEventListener('change', (event) => {
    state.criteria.openNow = event.target.checked;
    persistProfile();
  });

  $('notes-input').addEventListener('change', (event) => {
    state.criteria.notes = event.target.value;
    persistProfile();
  });

  $('location-btn').addEventListener('click', requestLocation);
  $('address-btn').addEventListener('click', lookupAddress);
  $('address-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') lookupAddress();
  });

  $('search-btn').addEventListener('click', runSearch);
  $('back-btn').addEventListener('click', () => showView('search'));

  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => showView(tab.dataset.view));
  }

  $('theme-toggle').addEventListener('click', cycleTheme);
}

function renderWalk() {
  const minutes = state.criteria.walkMinutes;
  $('walk-value').textContent = `${minutes} min`;

  const miles = metersToMiles(walkMinutesToMeters(minutes));
  $('walk-hint').textContent = `Roughly ${miles.toFixed(miles < 1 ? 1 : 1)} miles out`;
}

function syncControlsFromCriteria() {
  $('walk-slider').value = String(state.criteria.walkMinutes);
  $('rating-slider').value = String(state.criteria.minRating);
  $('reviews-slider').value = String(state.criteria.minReviews);
  $('rating-value').textContent = `${Number(state.criteria.minRating).toFixed(1)}★`;
  $('reviews-value').textContent = String(state.criteria.minReviews);
  $('max-calories').value = state.criteria.maxCalories ?? '';
  $('min-protein').value = state.criteria.minProtein ?? '';
  $('max-carbs').value = state.criteria.maxCarbs ?? '';
  $('open-now').checked = state.criteria.openNow;
  $('notes-input').value = state.criteria.notes ?? '';
  renderWalk();
  renderLocation();
}

/* ══════════════════════════════════════════════════════════════════════
   Location
   ══════════════════════════════════════════════════════════════════════ */

function renderLocation() {
  const pill = $('location-btn');
  const location = state.criteria.location;

  if (location) {
    pill.classList.add('location-pill--set');
    $('location-text').textContent = location.label;
    $('location-action').textContent = 'Change';
  } else {
    pill.classList.remove('location-pill--set');
    $('location-text').textContent = 'Use my current location';
    $('location-action').textContent = 'Locate';
  }
}

function requestLocation() {
  if (!navigator.geolocation) {
    revealAddressFallback('This browser has no location support — type an address instead.');
    return;
  }

  $('location-text').textContent = 'Finding you…';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.criteria.location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        label: 'Current location',
      };
      $('location-fallback').hidden = true;
      renderLocation();
    },
    (error) => {
      const reason = error.code === error.PERMISSION_DENIED
        ? 'Location is blocked for this site.'
        : 'Could not get a location fix.';
      revealAddressFallback(`${reason} Type an address instead.`);
      renderLocation();
    },
    { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
  );
}

function revealAddressFallback(message) {
  $('location-fallback').hidden = false;
  $('address-input').focus();
  showToast(message);
}

async function lookupAddress() {
  const query = $('address-input').value.trim();
  if (!query) return;

  if (!state.config.capabilities.places) {
    // Demo mode has no geocoder. Drop a pin somewhere plausible so the
    // sample neighbourhood has a centre and the app still demonstrates.
    state.criteria.location = { lat: 37.7937, lng: -122.3965, label: `${query} (demo)` };
    renderLocation();
    return;
  }

  try {
    const result = await fetchJson('/api/geocode', { method: 'POST', body: { query } });
    state.criteria.location = result;
    renderLocation();
  } catch (err) {
    showToast(err.message ?? 'Could not find that address.');
  }
}

/* ══════════════════════════════════════════════════════════════════════
   Search
   ══════════════════════════════════════════════════════════════════════ */

async function runSearch() {
  if (state.searching) return;

  if (!state.criteria.location) {
    if (!state.config.capabilities.places) {
      // Demo mode shouldn't make you hunt for a location first.
      state.criteria.location = { lat: 37.7937, lng: -122.3965, label: 'Demo neighbourhood' };
      renderLocation();
    } else {
      showToast('Set your location first.');
      requestLocation();
      return;
    }
  }

  state.searching = true;
  state.dishes = [];
  state.abort = new AbortController();

  $('search-btn').disabled = true;
  $('dish-list').replaceChildren();
  $('results-empty').hidden = true;
  $('dropped-disclosure').hidden = true;
  $('results-criteria').textContent = describeCriteria(state.criteria);
  renderNotices([]);
  showProgress(0, 'Looking around…');
  showView('results');

  try {
    await streamSearch(state.criteria, state.abort.signal, handleEvent);
  } catch (err) {
    if (err.name !== 'AbortError') {
      showProgress(null);
      renderEmpty('Something went wrong', err.message ?? 'The search failed.');
    }
  } finally {
    state.searching = false;
    state.abort = null;
    $('search-btn').disabled = false;
  }
}

function handleEvent(event, data) {
  switch (event) {
    case 'status':
      showProgress(data.stage === 'reading' ? 10 : 4, data.message);
      break;

    case 'progress': {
      const pct = 10 + (data.completed / data.total) * 85;
      showProgress(pct, `Read ${data.completed} of ${data.total} menus…`);
      break;
    }

    case 'dish':
      insertDish(data);
      break;

    case 'done':
      showProgress(null);
      finishSearch(data);
      break;

    case 'error':
      showProgress(null);
      showToast(data.message);
      break;
  }
}

/**
 * Dishes arrive out of order, so each one is spliced into its ranked
 * position as it lands rather than appended and re-sorted at the end.
 */
function insertDish(dish) {
  state.dishes.push(dish);
  state.dishes.sort((a, b) => b.score - a.score);

  const index = state.dishes.indexOf(dish);
  const card = renderDish(dish, index);
  const list = $('dish-list');
  const before = list.children[index] ?? null;

  list.insertBefore(card, before);
  retagRanks();
}

function retagRanks() {
  for (const [index, card] of [...$('dish-list').children].entries()) {
    const badge = card.querySelector('.dish__rank');
    if (badge) badge.hidden = index !== 0;
  }
}

function finishSearch(data) {
  renderNotices(data.disclaimers ?? [], data.notice);

  if (data.budget && state.config.mode === 'full') {
    state.config.budget = data.budget;
    renderCost(data.budget);
  }

  if (!data.count) {
    renderEmpty(...emptyCopy(data));
  }

  if (data.dropped?.length) {
    $('dropped-disclosure').hidden = false;
    $('dropped-summary').textContent =
      `${data.dropped.length} ${data.dropped.length === 1 ? 'dish was' : 'dishes were'} filtered out`;

    const list = $('dropped-list');
    list.replaceChildren();
    for (const item of data.dropped) {
      const li = document.createElement('li');
      const name = document.createElement('strong');
      name.textContent = item.name;
      li.append(name, document.createTextNode(` — ${item.reason}`));
      list.append(li);
    }
  }

  if (state.config.capabilities.places) $('attribution').hidden = false;
}

function emptyCopy(data) {
  switch (data.empty) {
    case 'nothing_nearby':
      return ['Nothing within walking distance', 'Try a longer walk, or lower the rating and review minimums.'];
    case 'no_menu_ai':
      return [
        `Found ${data.restaurantsSearched} places, but no menu reader`,
        'Add an ANTHROPIC_API_KEY to .env and restart, and it will read their menus for the dishes that fit.',
      ];
    case 'over_budget':
      return ['Stopped before spending', data.budgetMessage];
    default:
      return [
        'No dishes matched',
        'Every nearby menu was read, but nothing fit all your criteria. Loosen one — the macro targets are usually the tightest.',
      ];
  }
}

function renderEmpty(title, text) {
  const empty = $('results-empty');
  empty.hidden = false;
  empty.replaceChildren();

  const heading = document.createElement('p');
  heading.className = 'empty__title';
  heading.textContent = title;

  const body = document.createElement('p');
  body.className = 'empty__text';
  body.textContent = text;

  empty.append(heading, body);
}

function renderNotices(disclaimers, notice) {
  const container = $('results-notices');
  container.replaceChildren();

  if (notice) container.append(buildNotice(notice, 'info'));

  for (const item of disclaimers) {
    container.append(buildNotice(item.text, item.severity === 'high' ? 'warn' : 'info'));
  }
}

function buildNotice(text, kind) {
  const box = document.createElement('div');
  box.className = `notice notice--${kind}`;

  const icon = document.createElement('span');
  icon.className = 'notice__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = kind === 'warn' ? '⚠' : 'ℹ';

  const body = document.createElement('p');
  body.className = 'notice__text';
  body.textContent = text;

  box.append(icon, body);
  return box;
}

function showProgress(percent, message) {
  const progress = $('progress');
  if (percent === null) {
    progress.hidden = true;
    return;
  }
  progress.hidden = false;
  $('progress-fill').style.width = `${percent}%`;
  if (message) $('progress-text').textContent = message;
}

/* ── SSE over fetch ───────────────────────────────────────────────────── */

/**
 * EventSource can't POST, and the criteria object is too big and too
 * structured to push through a query string — so the stream is parsed by
 * hand off a normal fetch body.
 */
async function streamSearch(criteria, signal, onEvent) {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ criteria }),
    signal,
  });

  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new Error(problem.error ?? `Search failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Events are separated by a blank line; a partial tail stays buffered.
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      let name = 'message';
      const dataLines = [];

      for (const line of chunk.split('\n')) {
        if (line.startsWith('event: ')) name = line.slice(7).trim();
        else if (line.startsWith('data: ')) dataLines.push(line.slice(6));
        // ':' comment lines are keepalives — ignore them.
      }

      if (!dataLines.length) continue;
      try {
        onEvent(name, JSON.parse(dataLines.join('\n')));
      } catch {
        /* a malformed frame shouldn't kill the stream */
      }
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════
   The dish card
   ══════════════════════════════════════════════════════════════════════ */

function renderDish(dish, index) {
  const card = document.createElement('article');
  card.className = 'dish';
  card.dataset.dishName = dish.name;

  card.append(renderMedia(dish, index), renderBody(dish));
  return card;
}

function renderMedia(dish, index) {
  const media = document.createElement('div');
  media.className = 'dish__media';

  // Dish photo first. Failing that the restaurant's logo. Failing that a
  // monogram — exactly the fallback chain the owner asked for.
  if (dish.photoUrl) {
    media.append(buildImage(dish.photoUrl, `${dish.name} at ${dish.restaurant.name}`, 'dish__photo'));
  } else if (dish.restaurant.photoName) {
    media.append(buildImage(
      `/api/photo?name=${encodeURIComponent(dish.restaurant.photoName)}&w=800`,
      `${dish.restaurant.name}`,
      'dish__photo',
    ));
  } else if (dish.restaurant.logoUrl) {
    const wrap = document.createElement('div');
    wrap.className = 'dish__logo-wrap';
    wrap.append(buildImage(dish.restaurant.logoUrl, dish.restaurant.name, 'dish__logo'));
    media.append(wrap);
  } else {
    media.classList.add('dish__media--bare');
    media.append(buildMonogram(dish.restaurant.name));
  }

  if (index === 0) {
    const rank = document.createElement('span');
    rank.className = 'dish__rank';
    rank.textContent = 'Best match';
    media.append(rank);
  }

  const score = document.createElement('div');
  score.className = 'dish__score';
  score.title = explainScore(dish, state.criteria);
  score.setAttribute('aria-label', `${scoreLabel(dish.score)}, ${dish.score} out of 100`);

  const num = document.createElement('span');
  num.className = 'dish__score-num';
  num.textContent = String(dish.score);

  const max = document.createElement('span');
  max.className = 'dish__score-max';
  max.textContent = '/100';

  score.append(num, max);
  media.append(score);

  return media;
}

function buildImage(src, alt, className) {
  const img = document.createElement('img');
  img.className = className;
  img.src = src;
  img.alt = alt;
  img.loading = 'lazy';
  img.decoding = 'async';
  // A broken photo shouldn't leave a grey hole — swap in the monogram.
  img.addEventListener('error', () => {
    img.replaceWith(buildMonogram(alt));
  }, { once: true });
  return img;
}

function buildMonogram(name) {
  const tile = document.createElement('div');
  tile.className = 'dish__monogram';
  tile.setAttribute('aria-hidden', 'true');
  tile.textContent = String(name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase();
  return tile;
}

function renderBody(dish) {
  const body = document.createElement('div');
  body.className = 'dish__body';

  const name = document.createElement('h3');
  name.className = 'dish__name';
  name.textContent = dish.name;

  const where = document.createElement('p');
  where.className = 'dish__where';
  const restaurant = document.createElement('span');
  restaurant.className = 'dish__restaurant';
  restaurant.textContent = dish.restaurant.name;
  where.append(restaurant);
  if (dish.price) where.append(document.createTextNode(` · ${dish.price}`));

  body.append(name, where, renderMeta(dish));

  if (dish.description) {
    const desc = document.createElement('p');
    desc.className = 'dish__desc';
    desc.textContent = dish.description;
    body.append(desc);
  }

  const chips = renderCriteriaChips(dish);
  if (chips) body.append(chips);

  body.append(renderMacros(dish));

  const warning = renderAllergenWarning(dish);
  if (warning) body.append(warning);

  body.append(renderActions(dish));
  return body;
}

function renderMeta(dish) {
  const meta = document.createElement('p');
  meta.className = 'dish__meta';

  const { restaurant } = dish;
  const bits = [];

  if (restaurant.rating != null) {
    bits.push(`★ ${restaurant.rating.toFixed(1)} (${formatCount(restaurant.reviewCount)})`);
  }

  const tilde = restaurant.walkIsEstimated ? '~' : '';
  bits.push(`🚶 ${tilde}${restaurant.walkMinutes} min`);
  bits.push(`${metersToMiles(restaurant.distanceMeters).toFixed(1)} mi`);

  for (const text of bits) {
    const span = document.createElement('span');
    span.className = 'dish__meta-item';
    span.textContent = text;
    meta.append(span);
  }

  return meta;
}

function formatCount(count) {
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace('.0', '')}k`;
  return String(count ?? 0);
}

function renderCriteriaChips(dish) {
  const tags = [];

  for (const match of dish.criteria ?? []) {
    if (match.status === 'failed') continue;
    tags.push(buildTag(match.label, match.status, match.evidence));
  }

  // Where the dish came from is a claim about trust, so it sits with the
  // other claims rather than buried in a detail view.
  if (dish.provenance === 'inferred') {
    tags.push(buildTag('Menu not confirmed', 'unknown', 'We could not retrieve this restaurant\'s menu — treat this as a suggestion.'));
  } else if (dish.provenance === 'demo') {
    tags.push(buildTag('Sample data', 'unknown', 'An invented dish, shown so you can see the app work.'));
  }

  if (!tags.length) return null;

  const wrap = document.createElement('div');
  wrap.className = 'dish__chips';
  wrap.append(...tags);
  return wrap;
}

function buildTag(label, status, title) {
  const tag = document.createElement('span');
  tag.className = `tag tag--${status}`;
  if (title) tag.title = title;

  const mark = document.createElement('span');
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = { confirmed: '✓', likely: '≈', unknown: '?' }[status] ?? '';

  tag.append(mark, document.createTextNode(label));
  // Status is carried by the glyph and the text, not by colour alone.
  tag.setAttribute('aria-label',
    `${label}: ${{ confirmed: 'confirmed', likely: 'likely', unknown: 'not stated' }[status] ?? status}`);
  return tag;
}

/* ── Macro chart ──────────────────────────────────────────────────────── */

const MACRO_ORDER = [
  { key: 'protein', label: 'Protein' },
  { key: 'carbs', label: 'Carbs' },
  { key: 'fat', label: 'Fat' },
];

function renderMacros(dish) {
  const box = document.createElement('div');
  box.className = 'macros';

  const { macros } = dish;
  const split = macroSplit(macros);

  const head = document.createElement('div');
  head.className = 'macros__head';

  const calories = document.createElement('p');
  calories.className = 'macros__calories';
  if (macros.calories != null) {
    const num = document.createElement('span');
    num.className = 'macros__cal-num';
    num.textContent = String(Math.round(macros.calories));
    const unit = document.createElement('span');
    unit.className = 'macros__cal-unit';
    unit.textContent = 'cal';
    calories.append(num, unit);
  } else {
    calories.textContent = 'Calories unknown';
    calories.className = 'macros__calories macros__empty';
  }

  // The single most important honesty signal on the card: whether these
  // numbers came from the restaurant or from an estimate.
  const source = document.createElement('p');
  source.className = `macros__source${macros.source === 'published' ? ' macros__source--published' : ''}`;
  source.textContent = macros.source === 'published'
    ? 'Published by the restaurant'
    : macros.source === 'estimated'
      ? `Estimated ±${macros.errorMarginPercent ?? 25}%`
      : 'Not published';

  head.append(calories, source);
  box.append(head);

  if (!split) {
    const empty = document.createElement('p');
    empty.className = 'macros__empty';
    empty.textContent = 'No macro breakdown available for this dish.';
    box.append(empty);
    return box;
  }

  const bar = document.createElement('div');
  bar.className = 'macros__bar';
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', macroAriaLabel(macros, split));

  for (const { key, label } of MACRO_ORDER) {
    const segment = document.createElement('div');
    segment.className = `macros__seg macros__seg--${key}`;
    segment.style.flexGrow = String(split[key]);
    segment.title = `${label}: ${Math.round(macros[key] ?? 0)}g, ${split[key]}% of calories`;
    bar.append(segment);
  }
  box.append(bar);

  const legend = document.createElement('div');
  legend.className = 'macros__legend';

  for (const { key, label } of MACRO_ORDER) {
    const item = document.createElement('div');
    item.className = 'macros__item';

    const labelRow = document.createElement('p');
    labelRow.className = 'macros__label';
    const swatch = document.createElement('span');
    swatch.className = `macros__swatch macros__swatch--${key}`;
    swatch.setAttribute('aria-hidden', 'true');
    labelRow.append(swatch, document.createTextNode(label));

    const grams = document.createElement('p');
    grams.className = 'macros__grams';
    grams.textContent = `${Math.round(macros[key] ?? 0)}g`;

    const pct = document.createElement('p');
    pct.className = 'macros__pct';
    pct.textContent = `${split[key]}% of cal`;

    item.append(labelRow, grams, pct);
    legend.append(item);
  }

  box.append(legend);
  return box;
}

function macroAriaLabel(macros, split) {
  const parts = MACRO_ORDER.map(({ key, label }) =>
    `${label} ${Math.round(macros[key] ?? 0)} grams, ${split[key]} percent of calories`);
  return `Macro breakdown: ${parts.join('. ')}.`;
}

/* ── Allergen warning ─────────────────────────────────────────────────── */

/**
 * Per-card version of the standing caveat. It only appears when this
 * particular dish has an allergen we could not rule out — which is the
 * common case, because menus don't list ingredients.
 */
function renderAllergenWarning(dish) {
  const unknowns = dish.allergenUnknowns ?? [];
  if (!unknowns.length) return null;

  const box = document.createElement('p');
  box.className = 'dish__warn';

  const icon = document.createElement('span');
  icon.className = 'dish__warn-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '⚠';

  const names = unknowns.map((item) => item.label.toLowerCase());
  const list = names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;

  const text = document.createElement('span');
  text.textContent = `Menu doesn't say whether this contains ${list} — ask before ordering.`;
  text.title = ALLERGEN_DISCLAIMER_SHORT;

  box.append(icon, text);
  return box;
}

/* ── Actions ──────────────────────────────────────────────────────────── */

function renderActions(dish) {
  const actions = document.createElement('div');
  actions.className = 'dish__actions';

  const directions = document.createElement('a');
  directions.className = 'btn btn--primary';
  directions.href = directionsUrl(dish.restaurant, state.criteria.location);
  directions.target = '_blank';
  directions.rel = 'noopener noreferrer';
  directions.textContent = 'Get directions';

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'btn save-btn';
  const isSaved = state.savedIds.has(dish.id ?? dishLocalKey(dish));
  paintSaveButton(save, isSaved);

  save.addEventListener('click', () => toggleSave(dish, save));

  actions.append(directions, save);
  return actions;
}

function paintSaveButton(button, saved) {
  button.setAttribute('aria-pressed', String(saved));
  button.replaceChildren();

  const icon = document.createElement('span');
  icon.className = 'save-btn__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = saved ? '🔖' : '🔖';

  button.append(icon, document.createTextNode(saved ? 'Saved' : 'Save for later'));
}

function dishLocalKey(dish) {
  return `${dish.restaurant?.placeId ?? dish.restaurant?.name}::${dish.name}`.toLowerCase();
}

async function toggleSave(dish, button) {
  const key = dish.id ?? dishLocalKey(dish);
  const saved = state.savedIds.has(key);

  try {
    if (saved) {
      await fetchJson(`/api/saved?id=${encodeURIComponent(dish.id ?? key)}`, { method: 'DELETE' });
      state.savedIds.delete(key);
      showToast('Removed');
    } else {
      const { item } = await fetchJson('/api/saved', { method: 'POST', body: dish });
      dish.id = item.id;
      state.savedIds.add(item.id);
      state.savedIds.add(key);
      showToast('Saved for later');
    }
    paintSaveButton(button, !saved);
    await refreshSaved();
  } catch {
    showToast('Could not save that.');
  }
}

/* ══════════════════════════════════════════════════════════════════════
   Saved
   ══════════════════════════════════════════════════════════════════════ */

async function refreshSaved() {
  let items = [];
  try {
    ({ items } = await fetchJson('/api/saved'));
  } catch {
    return;
  }

  state.savedIds = new Set(items.flatMap((item) => [item.id, dishLocalKey(item)]));

  const badge = $('saved-count');
  badge.hidden = items.length === 0;
  badge.textContent = String(items.length);

  const list = $('saved-list');
  list.replaceChildren();
  $('saved-empty').hidden = items.length > 0;

  for (const [index, item] of items.entries()) {
    list.append(renderDish(item, index === 0 ? -1 : index));
  }
}

/* ══════════════════════════════════════════════════════════════════════
   Chrome
   ══════════════════════════════════════════════════════════════════════ */

function showView(name) {
  for (const view of ['search', 'results', 'saved']) {
    $(`view-${view}`).hidden = view !== name;
  }
  for (const tab of document.querySelectorAll('.tab')) {
    if (tab.dataset.view === name) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  if (name === 'saved') refreshSaved();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function renderMode() {
  const banner = $('mode-banner');
  const { mode, modeDescription } = state.config;

  banner.hidden = false;
  banner.textContent = modeDescription;
  banner.classList.toggle('mode-banner--live', mode === 'full');

  if (mode === 'full') renderCost();
  else if (mode === 'demo') {
    $('cost-note').textContent = 'Demo mode — invented restaurants, no API calls, nothing to pay.';
  } else {
    $('cost-note').textContent = 'Places only — no menu reading, so no AI cost.';
  }
}

/**
 * What this is about to cost, and what's left in the month. Shown before
 * the button, not after the bill.
 */
function renderCost(budget = state.config.budget) {
  const each = state.config.estimatedSearchCost;
  const parts = [`About $${each.toFixed(2)} a search (${state.config.maxRestaurants} menus). Repeats come from cache and cost nothing.`];

  if (budget?.cap != null) {
    parts.push(`$${budget.spent.toFixed(2)} of $${budget.cap.toFixed(2)} used this month — roughly ${Math.floor(budget.remaining / Math.max(each, 0.01))} searches left.`);
  }

  $('cost-note').textContent = parts.join(' ');
  $('search-btn').disabled = Boolean(budget?.exhausted);
}

let toastTimer = null;
function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

/* ── Theme ────────────────────────────────────────────────────────────── */

function restoreTheme() {
  const stored = safeRead(THEME_KEY);
  if (stored === 'light' || stored === 'dark') {
    document.documentElement.dataset.theme = stored;
  }
}

function cycleTheme() {
  const current = document.documentElement.dataset.theme;
  const next = current === 'dark' ? 'light' : current === 'light' ? '' : 'dark';

  if (next) document.documentElement.dataset.theme = next;
  else delete document.documentElement.dataset.theme;

  safeWrite(THEME_KEY, next);
  showToast(next ? `${next[0].toUpperCase()}${next.slice(1)} theme` : 'Matching your system');
}

/* ── Profile ──────────────────────────────────────────────────────────── */

function persistProfile() {
  const profile = Object.fromEntries(
    PERSISTED_CRITERIA_FIELDS.map((field) => [field, state.criteria[field]]),
  );
  safeWrite(PROFILE_KEY, JSON.stringify(profile));
}

function restoreProfile() {
  const raw = safeRead(PROFILE_KEY);
  if (!raw) return;

  try {
    // Keep the live location; everything else comes from the saved profile.
    const { location } = state.criteria;
    state.criteria = sanitizeCriteria({ ...JSON.parse(raw), location });
  } catch {
    /* a corrupt profile just means defaults */
  }
}

/* ── Utilities ────────────────────────────────────────────────────────── */

async function fetchJson(url, { method = 'GET', body } = {}) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}

function safeRead(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* private mode; preferences just won't persist */
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {
    /* offline shell is a bonus, not a requirement */
  });
}

boot();
