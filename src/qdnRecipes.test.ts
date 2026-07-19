import { describe, expect, it } from 'vitest';
import { createBlankRecipe, parseIngredientLine } from './recipe';
import {
  buildWritableNames,
  publishRecipe,
  RECIPE_MAX_BYTES,
  requireTransactionSignature,
  truncateUtf8,
} from './qdnRecipes';

describe('QDN recipe helpers', () => {
  it('collects writable names case-insensitively while preserving display case', () => {
    expect(
      buildWritableNames('Cook', ['cook', { name: 'Baker' }, { name: '' }, 'SecondName']),
    ).toEqual(['Cook', 'Baker', 'SecondName']);
  });

  it('truncates metadata by UTF-8 bytes without splitting characters', () => {
    expect(truncateUtf8('Soup 🍲 recipe', 9)).toBe('Soup 🍲');
    expect(new TextEncoder().encode(truncateUtf8('éééé', 5)).byteLength).toBeLessThanOrEqual(5);
  });

  it('requires an exact publish transaction signature before READY confirmation', () => {
    expect(requireTransactionSignature({ transactionSignature: ' signature ' })).toBe('signature');
    expect(() => requireTransactionSignature({ accepted: true })).toThrow('cannot be confirmed exactly');
  });

  it('rejects payloads above the documented app fetch ceiling before publishing', async () => {
    const recipe = createBlankRecipe();
    recipe.name = 'Too large';
    recipe.ingredients = [
      {
        ...parseIngredientLine('1 cup lentils', 'lentils')!,
        text: 'x'.repeat(RECIPE_MAX_BYTES),
      },
    ];
    recipe.instructions = ['Cook.'];

    await expect(publishRecipe('Cook', recipe)).rejects.toThrow('byte app limit');
  });
});
