import { RECIPE_IDENTIFIER_PREFIX } from './recipe';

export type RecipeRouteView = 'browse' | 'developers' | 'editor' | 'recipe';

export type RecipeRoute =
  | { view: 'browse' | 'developers' | 'editor' }
  | { view: 'recipe'; name: string; identifier: string };

export type RecipeRouteTarget = {
  location: { search: string };
  addEventListener: (type: 'popstate', listener: () => void) => void;
  removeEventListener: (type: 'popstate', listener: () => void) => void;
};

export type LocationLike = { pathname?: string; search?: string; hash?: string };

export type QdnHostGlobals = {
  _qdnService?: unknown;
  _qdnName?: unknown;
  _qdnIdentifier?: unknown;
};

const DEVELOPER_ALIASES = new Set(['developer', 'developers', 'reference']);

// Query keys this app owns. Every serializer deletes exactly these and leaves
// Home's display/bridge parameters (theme, lang, qdnHomeBridge, …) untouched.
const VIEW_PARAM = 'view';
const RECIPE_PARAM = 'recipe';
const AUTHOR_PARAM = 'author';
const APP_ROUTE_PARAMS = [VIEW_PARAM, RECIPE_PARAM, AUTHOR_PARAM];

// Published identity of this app, used when Core injects nothing (local dev).
const DEFAULT_SERVICE = 'APP';
const DEFAULT_NAME = 'Recipes';
const DEFAULT_IDENTIFIER = 'Recipes';

function toSearchParams(search: string) {
  const routeSearch = search.startsWith('?') || !search.includes('?')
    ? search
    : new URL(search, 'http://localhost').search;
  return new URLSearchParams(routeSearch);
}

export function parseRecipeRoute(search: string): RecipeRoute {
  const params = toSearchParams(search);
  const identifier = params.get(RECIPE_PARAM)?.trim();
  const name = params.get(AUTHOR_PARAM)?.trim();

  // A recipe target wins over `view`, so a shared link opens the recipe even if
  // a stale `view` value rode along with it.
  if (identifier && name) {
    return { view: 'recipe', identifier, name };
  }

  const value = params.get(VIEW_PARAM)?.trim().toLowerCase();
  if (value === 'editor') {
    return { view: 'editor' };
  }
  return value && DEVELOPER_ALIASES.has(value) ? { view: 'developers' } : { view: 'browse' };
}

export function buildRecipeRoute(route: RecipeRoute, href: string) {
  const url = new URL(href, 'http://localhost');
  for (const parameter of APP_ROUTE_PARAMS) {
    url.searchParams.delete(parameter);
  }

  if (route.view === 'recipe') {
    url.searchParams.set(RECIPE_PARAM, route.identifier);
    url.searchParams.set(AUTHOR_PARAM, route.name);
  } else if (route.view !== 'browse') {
    url.searchParams.set(VIEW_PARAM, route.view);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function navigateRecipeRoute(route: RecipeRoute, replace = false) {
  const href = buildRecipeRoute(route, window.location.href);
  // Pass the existing history state through rather than clobbering it, so
  // Home's own entry state survives an in-app navigation.
  window.history[replace ? 'replaceState' : 'pushState'](window.history.state, '', href);
}

export function subscribeToRecipeRoute(
  onRoute: (route: RecipeRoute) => void,
  target: RecipeRouteTarget = window,
) {
  const onPopState = () => onRoute(parseRecipeRoute(target.location.search));
  target.addEventListener('popstate', onPopState);
  return () => target.removeEventListener('popstate', onPopState);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Recipe targets supplied by Qortium Home when a link re-enters an already-open
// tab. Values are validated here before they reach routing state: a target can
// open a published recipe, but it cannot become an arbitrary QDN fetch.
export function parseOpenAppTargetMessage(value: unknown): RecipeRoute | null {
  if (!isRecord(value) || value.action !== 'OPEN_APP_TARGET' || value.requestedHandler !== 'UI' || !isRecord(value.query)) {
    return null;
  }

  const { author, recipe } = value.query;
  if (typeof author !== 'string' || typeof recipe !== 'string') {
    return null;
  }

  const name = author.trim();
  const identifier = recipe.trim();
  if (!name || !identifier.startsWith(RECIPE_IDENTIFIER_PREFIX)) {
    return null;
  }

  return { view: 'recipe', identifier, name };
}

function resolveLocation(location?: LocationLike): LocationLike {
  if (location) {
    return location;
  }
  return typeof window === 'undefined' ? {} : window.location;
}

function resolveHost(host?: QdnHostGlobals): QdnHostGlobals {
  if (host) {
    return host;
  }
  return typeof window === 'undefined' ? {} : (window as Window & QdnHostGlobals);
}

function cleanGlobal(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function decodeSegment(value: string | undefined) {
  if (!value) {
    return '';
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Derive `qdn://<service>/<name>/<identifier>` for the resource hosting this app.
// Prefer Core's injected globals, fall back to the /render/ path segments, then
// to the published APP/Recipes/Recipes identity.
export function getAppBaseAddress(location?: LocationLike, host?: QdnHostGlobals) {
  const { pathname = '' } = resolveLocation(location);
  const { _qdnService, _qdnName, _qdnIdentifier } = resolveHost(host);
  const renderMatch = pathname.match(/\/render\/([^/]+)\/([^/]+)(?:\/([^/?#]+))?/i);

  const service = cleanGlobal(_qdnService) || decodeSegment(renderMatch?.[1]) || DEFAULT_SERVICE;
  const name = cleanGlobal(_qdnName) || decodeSegment(renderMatch?.[2]) || DEFAULT_NAME;
  const identifier = cleanGlobal(_qdnIdentifier) || decodeSegment(renderMatch?.[3]) || DEFAULT_IDENTIFIER;

  return `qdn://${encodeURIComponent(service)}/${encodeURIComponent(name)}/${encodeURIComponent(identifier)}`;
}

// Shareable `qdn://` address for one published recipe, clickable inside Home
// and inside other apps' post bodies.
export function buildRecipeLink(
  publisher: string,
  identifier: string,
  location?: LocationLike,
  host?: QdnHostGlobals,
) {
  const query = new URLSearchParams({ [RECIPE_PARAM]: identifier, [AUTHOR_PARAM]: publisher });
  return `${getAppBaseAddress(location, host)}?${query.toString()}`;
}
