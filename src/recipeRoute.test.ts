import { describe, expect, it } from 'vitest';
import { buildRecipeRoute, parseRecipeRoute, subscribeToRecipeRoute } from './recipeRoute';

describe('Recipes routes', () => {
  it('accepts developer aliases and serializes the canonical route', () => {
    expect(parseRecipeRoute('?view=developer')).toBe('developers');
    expect(parseRecipeRoute('?view=reference')).toBe('developers');
    expect(parseRecipeRoute('?view=developers')).toBe('developers');
    expect(buildRecipeRoute('developers', 'https://node/render/APP/Recipes/Recipes?view=reference'))
      .toBe('/render/APP/Recipes/Recipes?view=developers');
  });

  it('round-trips browse and editor routes', () => {
    expect(parseRecipeRoute(buildRecipeRoute('editor', 'https://node/app'))).toBe('editor');
    expect(parseRecipeRoute(buildRecipeRoute('browse', 'https://node/app?view=editor'))).toBe('browse');
  });

  it('changes only the app-owned view and preserves Home, future, repeated, and hash values', () => {
    const href = 'https://node/render/APP/Recipes/Recipes?theme=dark&accent=blue&accent=yellow&textSize=huge&uiStyle=fun&lang=he&qdnHomeBridge=token&future=kept&view=editor#schema';
    expect(buildRecipeRoute('developers', href)).toBe(
      '/render/APP/Recipes/Recipes?theme=dark&accent=blue&accent=yellow&textSize=huge&uiStyle=fun&lang=he&qdnHomeBridge=token&future=kept&view=developers#schema',
    );
  });

  it('rehydrates the workspace on Back and Forward popstate events', () => {
    const listeners = new Set<() => void>();
    const target = {
      location: { search: '?view=developers' },
      addEventListener: (_type: 'popstate', listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: 'popstate', listener: () => void) => listeners.delete(listener),
    };
    const routes: string[] = [];
    const unsubscribe = subscribeToRecipeRoute((route) => routes.push(route), target);

    listeners.forEach((listener) => listener());
    target.location.search = '?view=editor';
    listeners.forEach((listener) => listener());
    unsubscribe();
    target.location.search = '';
    listeners.forEach((listener) => listener());

    expect(routes).toEqual(['developers', 'editor']);
    expect(listeners.size).toBe(0);
  });
});
