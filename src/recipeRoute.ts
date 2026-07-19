export type RecipeRouteView = 'browse' | 'developers' | 'editor';

type RecipeRouteTarget = {
  location: { search: string };
  addEventListener: (type: 'popstate', listener: () => void) => void;
  removeEventListener: (type: 'popstate', listener: () => void) => void;
};

const DEVELOPER_ALIASES = new Set(['developer', 'developers', 'reference']);

export function parseRecipeRoute(search: string): RecipeRouteView {
  const routeSearch = search.startsWith('?') || !search.includes('?')
    ? search
    : new URL(search, 'http://localhost').search;
  const value = new URLSearchParams(routeSearch).get('view')?.trim().toLowerCase();
  if (value === 'editor') {
    return 'editor';
  }
  return value && DEVELOPER_ALIASES.has(value) ? 'developers' : 'browse';
}

export function buildRecipeRoute(view: RecipeRouteView, href: string) {
  const url = new URL(href, 'http://localhost');
  if (view === 'browse') {
    url.searchParams.delete('view');
  } else {
    url.searchParams.set('view', view);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function navigateRecipeRoute(view: RecipeRouteView, replace = false) {
  const href = buildRecipeRoute(view, window.location.href);
  window.history[replace ? 'replaceState' : 'pushState']({ view }, '', href);
}

export function subscribeToRecipeRoute(
  onRoute: (view: RecipeRouteView) => void,
  target: RecipeRouteTarget = window,
) {
  const onPopState = () => onRoute(parseRecipeRoute(target.location.search));
  target.addEventListener('popstate', onPopState);
  return () => target.removeEventListener('popstate', onPopState);
}
