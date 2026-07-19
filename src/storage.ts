import type { RecipeV1 } from './types';
import { RECIPE_SCHEMA } from './recipe';

const DRAFTS_KEY = 'qortium-recipes:drafts:v1';
const FAVORITES_KEY = 'qortium-recipes:favorites:v1';

function readJson(key: string): unknown {
  try {
    const value = globalThis.localStorage?.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Drafts and favorites are conveniences. The app remains usable when storage is blocked.
  }
}

export function loadDrafts(): RecipeV1[] {
  const value = readJson(DRAFTS_KEY);
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (candidate): candidate is RecipeV1 =>
        !!candidate &&
        typeof candidate === 'object' &&
        !Array.isArray(candidate) &&
        (candidate as { schema?: unknown }).schema === RECIPE_SCHEMA &&
        typeof (candidate as { id?: unknown }).id === 'string' &&
        Array.isArray((candidate as { ingredients?: unknown }).ingredients) &&
        Array.isArray((candidate as { instructions?: unknown }).instructions),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveDraft(recipe: RecipeV1) {
  const drafts = loadDrafts();
  writeJson(DRAFTS_KEY, [recipe, ...drafts.filter((draft) => draft.id !== recipe.id)]);
}

export function deleteDraft(recipeId: string) {
  writeJson(DRAFTS_KEY, loadDrafts().filter((draft) => draft.id !== recipeId));
}

export function loadFavorites() {
  const value = readJson(FAVORITES_KEY);
  return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
}

export function saveFavorites(favorites: Set<string>) {
  writeJson(FAVORITES_KEY, [...favorites]);
}

export function resourceFavoriteKey(name: string, identifier: string) {
  return `${name}\u0000${identifier}`;
}
