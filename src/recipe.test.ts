import { describe, expect, it } from 'vitest';
import type { RecipeV1 } from './types';
import {
  buildRecipeIdentifier,
  composeIngredientText,
  createBlankRecipe,
  formatAmount,
  parseIngredientLine,
  parseIngredientLines,
  recipeImages,
  recipeImageUrl,
  toSchemaOrgRecipe,
  validateRecipe,
} from './recipe';

describe('ingredient parsing', () => {
  it.each([
    ['4 Tablespoons olive oil', 4, null, 'Tablespoons', 'olive oil'],
    ['1/2 teaspoon turmeric', 0.5, null, 'teaspoon', 'turmeric'],
    ['1 1/2 cups water', 1.5, null, 'cups', 'water'],
    ['1½ cups lentils', 1.5, null, 'cups', 'lentils'],
    ['2–3 cloves garlic', 2, 3, 'cloves', 'garlic'],
    ['1 (28 oz) can diced tomatoes', 1, null, '', '(28 oz) can diced tomatoes'],
    ['2 onions', 2, null, '', 'onions'],
  ])('parses %s conservatively', (line, amount, amountMax, unit, item) => {
    const ingredient = parseIngredientLine(line, 'ingredient-id');
    expect(ingredient).toMatchObject({ amount, amountMax, unit, item, scalable: true, text: line });
  });

  it('keeps nonnumeric lines intact and unscaled', () => {
    const ingredient = parseIngredientLine('salt to taste', 'ingredient-id');
    expect(ingredient).toEqual({
      id: 'ingredient-id',
      text: 'salt to taste',
      amount: null,
      amountMax: null,
      unit: '',
      item: 'salt to taste',
      scalable: false,
    });
  });

  it('accepts pasted bullets and ignores blank lines', () => {
    const ingredients = parseIngredientLines('- 1 cup oats\n\n* cinnamon to taste');
    expect(ingredients.map((ingredient) => ingredient.text)).toEqual(['1 cup oats', 'cinnamon to taste']);
  });
});

describe('ingredient scaling', () => {
  it('formats common fractions for cooking', () => {
    expect(formatAmount(0.5)).toBe('½');
    expect(formatAmount(1.5)).toBe('1 ½');
    expect(formatAmount(2.333)).toBe('2 ⅓');
  });

  it('scales confirmed numeric quantities and preserves nonnumeric lines', () => {
    const numeric = parseIngredientLine('1 1/2 cups water', 'water');
    const textual = parseIngredientLine('salt to taste', 'salt');
    expect(numeric && composeIngredientText(numeric, 2)).toBe('3 cups water');
    expect(textual && composeIngredientText(textual, 2)).toBe('salt to taste');
  });

  it('scales both ends of a range', () => {
    const ingredient = parseIngredientLine('2–3 cloves garlic', 'garlic');
    expect(ingredient && composeIngredientText(ingredient, 0.5)).toBe('1–1 ½ cloves garlic');
  });

  it('uses singular and plural forms for known scaled units', () => {
    const teaspoon = parseIngredientLine('1 teaspoon cumin', 'cumin');
    const tablespoons = parseIngredientLine('4 Tablespoons olive oil', 'oil');
    const can = {
      ...parseIngredientLine('1 can tomatoes', 'tomatoes')!,
      item: 'diced tomatoes (28 oz)',
    };

    expect(teaspoon && composeIngredientText(teaspoon, 2)).toBe('2 teaspoons cumin');
    expect(tablespoons && composeIngredientText(tablespoons, 0.25)).toBe('1 Tablespoon olive oil');
    expect(composeIngredientText(can, 0.5)).toBe('½ can diced tomatoes (28 oz)');
    expect(composeIngredientText(can, 2)).toBe('2 cans diced tomatoes (28 oz)');
  });

  it('keeps unknown and abbreviated unit labels stable', () => {
    const custom = parseIngredientLine('1 scoop protein powder', 'protein');
    const abbreviated = parseIngredientLine('1 tbsp paprika', 'paprika');

    expect(custom && composeIngredientText(custom, 2)).toBe('2 scoop protein powder');
    expect(abbreviated && composeIngredientText(abbreviated, 2)).toBe('2 tbsp paprika');
  });
});

describe('recipe validation and interchange', () => {
  it('validates a complete v1 recipe and rejects an empty one', () => {
    const recipe = createBlankRecipe();
    expect(validateRecipe(recipe).errors).toContain('Recipe name is required.');

    recipe.name = 'Oatmeal';
    recipe.ingredients = parseIngredientLines('1 cup oats\n2 cups water');
    recipe.instructions = ['Combine.', 'Simmer until tender.'];
    const validation = validateRecipe(recipe);
    expect(validation.errors).toEqual([]);
    expect(validation.recipe?.ingredients).toHaveLength(2);
  });

  it('preserves a count noun in unit when the structured item is intentionally empty', () => {
    const recipe = createBlankRecipe();
    recipe.name = 'Onion soup';
    recipe.ingredients = [{
      id: 'onions', text: '2 onions', amount: 2, amountMax: null,
      unit: 'onion', item: '', scalable: true,
    }];
    recipe.instructions = ['Cook.'];

    const validation = validateRecipe(recipe);
    expect(validation.recipe?.ingredients[0].item).toBe('');
    expect(validation.recipe && composeIngredientText(validation.recipe.ingredients[0], 0.5)).toBe('1 onion');
    expect(validation.recipe && composeIngredientText(validation.recipe.ingredients[0], 2)).toBe('4 onions');
  });

  it('creates stable resource identifiers', () => {
    expect(buildRecipeIdentifier('abcDEF12')).toBe('qrecipes.v1.r.abcDEF12');
  });

  it('exports a Schema.org-compatible recipe without losing ingredient text', () => {
    const recipe = createBlankRecipe();
    recipe.name = 'Oatmeal';
    recipe.baseServings = 2;
    recipe.prepMinutes = 5;
    recipe.cookMinutes = 10;
    recipe.ingredients = parseIngredientLines('1 cup oats');
    recipe.instructions = ['Cook the oats.'];
    const exported = toSchemaOrgRecipe(recipe, 'Baker');

    expect(exported).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      author: { '@type': 'Person', name: 'Baker' },
      prepTime: 'PT5M',
      cookTime: 'PT10M',
      totalTime: 'PT15M',
      recipeYield: '2 servings',
      recipeIngredient: ['1 cup oats'],
    });
  });

  it('normalizes a backward-compatible cover into an ordered image gallery', () => {
    const recipe = createBlankRecipe();
    recipe.name = 'Oatmeal';
    recipe.image = 'qdn://IMAGE/Cook/cover';
    recipe.images = ['qdn://IMAGE/Cook/step-1', 'qdn://IMAGE/Cook/cover'];
    recipe.ingredients = parseIngredientLines('1 cup oats');
    recipe.instructions = ['Cook.'];

    const validation = validateRecipe(recipe);
    expect(validation.recipe?.image).toBe('qdn://IMAGE/Cook/cover');
    expect(validation.recipe?.images).toEqual([
      'qdn://IMAGE/Cook/cover',
      'qdn://IMAGE/Cook/step-1',
    ]);
    expect(validation.recipe && recipeImages(validation.recipe)).toEqual(validation.recipe?.images);
    expect(validation.recipe && toSchemaOrgRecipe(validation.recipe).image).toEqual(validation.recipe?.images);
  });

  it('upgrades an image-only v1 recipe without rejecting it', () => {
    const recipe = createBlankRecipe();
    recipe.name = 'Oatmeal';
    recipe.image = 'qdn://IMAGE/Cook/cover';
    recipe.ingredients = parseIngredientLines('1 cup oats');
    recipe.instructions = ['Cook.'];
    delete (recipe as Partial<RecipeV1>).images;

    expect(validateRecipe(recipe).recipe?.images).toEqual(['qdn://IMAGE/Cook/cover']);
  });

  it('maps QDN image URIs to the active node resource route', () => {
    expect(recipeImageUrl('qdn://IMAGE/Cook/cover')).toBe('/arbitrary/IMAGE/Cook/cover');
    expect(recipeImageUrl('/arbitrary/IMAGE/Cook/cover')).toBe('/arbitrary/IMAGE/Cook/cover');
  });
});
