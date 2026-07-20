import { describe, expect, it } from 'vitest';
import {
  buildRecipeLink,
  buildRecipeRoute,
  getAppBaseAddress,
  parseOpenAppTargetMessage,
  parseRecipeRoute,
  subscribeToRecipeRoute,
} from './recipeRoute';

describe('Recipes routes', () => {
  it('accepts developer aliases and serializes the canonical route', () => {
    expect(parseRecipeRoute('?view=developer')).toEqual({ view: 'developers' });
    expect(parseRecipeRoute('?view=reference')).toEqual({ view: 'developers' });
    expect(parseRecipeRoute('?view=developers')).toEqual({ view: 'developers' });
    expect(buildRecipeRoute({ view: 'developers' }, 'https://node/render/APP/Recipes/Recipes?view=reference'))
      .toBe('/render/APP/Recipes/Recipes?view=developers');
  });

  it('round-trips browse and editor routes', () => {
    expect(parseRecipeRoute(buildRecipeRoute({ view: 'editor' }, 'https://node/app'))).toEqual({ view: 'editor' });
    expect(parseRecipeRoute(buildRecipeRoute({ view: 'browse' }, 'https://node/app?view=editor'))).toEqual({ view: 'browse' });
  });

  it('round-trips a recipe deep link and drops it when leaving the recipe', () => {
    const route = { view: 'recipe', identifier: 'qrecipes.v1.r.abc123', name: 'Alice' } as const;
    const href = buildRecipeRoute(route, 'https://node/render/APP/Recipes/Recipes');

    expect(href).toBe('/render/APP/Recipes/Recipes?recipe=qrecipes.v1.r.abc123&author=Alice');
    expect(parseRecipeRoute(href)).toEqual(route);
    expect(buildRecipeRoute({ view: 'browse' }, `https://node${href}`)).toBe('/render/APP/Recipes/Recipes');
    expect(buildRecipeRoute({ view: 'editor' }, `https://node${href}`))
      .toBe('/render/APP/Recipes/Recipes?view=editor');
  });

  it('encodes names needing escaping and ignores half-specified targets', () => {
    expect(buildRecipeRoute({ view: 'recipe', identifier: 'qrecipes.v1.r.a b', name: 'A&B' }, 'https://node/app'))
      .toBe('/app?recipe=qrecipes.v1.r.a+b&author=A%26B');
    expect(parseRecipeRoute('?recipe=qrecipes.v1.r.abc')).toEqual({ view: 'browse' });
    expect(parseRecipeRoute('?author=Alice')).toEqual({ view: 'browse' });
  });

  it('lets a recipe target win over a stale view value', () => {
    expect(parseRecipeRoute('?view=editor&recipe=qrecipes.v1.r.abc&author=Alice'))
      .toEqual({ view: 'recipe', identifier: 'qrecipes.v1.r.abc', name: 'Alice' });
  });

  it('changes only the app-owned view and preserves Home, future, repeated, and hash values', () => {
    const href = 'https://node/render/APP/Recipes/Recipes?theme=dark&accent=blue&accent=yellow&textSize=huge&uiStyle=fun&lang=he&qdnHomeBridge=token&future=kept&view=editor#schema';
    expect(buildRecipeRoute({ view: 'developers' }, href)).toBe(
      '/render/APP/Recipes/Recipes?theme=dark&accent=blue&accent=yellow&textSize=huge&uiStyle=fun&lang=he&qdnHomeBridge=token&future=kept&view=developers#schema',
    );
  });

  it('derives the app address from Core globals, then the render path, then defaults', () => {
    expect(getAppBaseAddress({ pathname: '/render/APP/Recipes/Recipes' }, {})).toBe('qdn://APP/Recipes/Recipes');
    expect(getAppBaseAddress({ pathname: '/' }, {})).toBe('qdn://APP/Recipes/Recipes');
    // Precedence is per field: an injected global overrides only its own segment.
    expect(getAppBaseAddress({ pathname: '/render/APP/FromPath/FromPath' }, { _qdnName: 'RecipesTest' }))
      .toBe('qdn://APP/RecipesTest/FromPath');
  });

  it('builds a shareable qdn address for one recipe', () => {
    expect(buildRecipeLink('Alice', 'qrecipes.v1.r.abc123', { pathname: '/render/APP/Recipes/Recipes' }, {}))
      .toBe('qdn://APP/Recipes/Recipes?recipe=qrecipes.v1.r.abc123&author=Alice');
  });

  it('accepts a well-formed OPEN_APP_TARGET message from Home', () => {
    expect(parseOpenAppTargetMessage({
      action: 'OPEN_APP_TARGET',
      requestedHandler: 'UI',
      query: { recipe: 'qrecipes.v1.r.abc', author: 'Alice' },
    })).toEqual({ view: 'recipe', identifier: 'qrecipes.v1.r.abc', name: 'Alice' });
  });

  it('rejects host messages that are malformed, misrouted, or not recipe targets', () => {
    const valid = { recipe: 'qrecipes.v1.r.abc', author: 'Alice' };
    const cases: unknown[] = [
      null,
      'OPEN_APP_TARGET',
      { action: 'DISPLAY_SETTINGS_CHANGED', requestedHandler: 'UI', query: valid },
      { action: 'OPEN_APP_TARGET', requestedHandler: 'API', query: valid },
      { action: 'OPEN_APP_TARGET', requestedHandler: 'UI' },
      { action: 'OPEN_APP_TARGET', requestedHandler: 'UI', query: 'nope' },
      { action: 'OPEN_APP_TARGET', requestedHandler: 'UI', query: { recipe: 'qrecipes.v1.r.abc' } },
      { action: 'OPEN_APP_TARGET', requestedHandler: 'UI', query: { author: 'Alice' } },
      { action: 'OPEN_APP_TARGET', requestedHandler: 'UI', query: { recipe: valid.recipe, author: '   ' } },
      // Must not become an arbitrary QDN fetch outside the recipe namespace.
      { action: 'OPEN_APP_TARGET', requestedHandler: 'UI', query: { recipe: 'qortium.wallet.keys', author: 'Alice' } },
      { action: 'OPEN_APP_TARGET', requestedHandler: 'UI', query: { recipe: 42, author: 'Alice' } },
    ];

    for (const value of cases) {
      expect(parseOpenAppTargetMessage(value)).toBeNull();
    }
  });

  it('rehydrates the workspace on Back and Forward popstate events', () => {
    const listeners = new Set<() => void>();
    const target = {
      location: { search: '?view=developers' },
      addEventListener: (_type: 'popstate', listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: 'popstate', listener: () => void) => listeners.delete(listener),
    };
    const routes: unknown[] = [];
    const unsubscribe = subscribeToRecipeRoute((route) => routes.push(route), target);

    listeners.forEach((listener) => listener());
    target.location.search = '?recipe=qrecipes.v1.r.abc&author=Alice';
    listeners.forEach((listener) => listener());
    target.location.search = '?view=editor';
    listeners.forEach((listener) => listener());
    unsubscribe();
    target.location.search = '';
    listeners.forEach((listener) => listener());

    expect(routes).toEqual([
      { view: 'developers' },
      { view: 'recipe', identifier: 'qrecipes.v1.r.abc', name: 'Alice' },
      { view: 'editor' },
    ]);
    expect(listeners.size).toBe(0);
  });
});
