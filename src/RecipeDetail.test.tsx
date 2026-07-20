import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RecipeDetail } from './RecipeDetail';
import { createBlankRecipe, parseIngredientLines } from './recipe';
import type { PublishedRecipe } from './types';

function publishedRecipe(): PublishedRecipe {
  const recipe = createBlankRecipe();
  recipe.name = 'Lentil soup';
  recipe.image = 'qdn://IMAGE/Recipes/cover';
  recipe.images = [
    'qdn://IMAGE/Recipes/cover',
    'qdn://IMAGE/Recipes/ingredients',
    'qdn://IMAGE/Recipes/simmering',
  ];
  recipe.ingredients = parseIngredientLines('1 cup lentils');
  recipe.instructions = ['Simmer.'];

  return {
    recipe,
    resource: {
      identifier: 'qrecipes.v1.r.lentils1',
      name: 'Recipes',
      service: 'JSON',
    },
  };
}

describe('RecipeDetail image gallery', () => {
  it('renders the cover and accessible controls for every image', () => {
    const html = renderToStaticMarkup(
      <RecipeDetail
        canEdit={false}
        favorite={false}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onToggleFavorite={vi.fn()}
        published={publishedRecipe()}
      />,
    );

    expect(html).toContain('aria-label="Lentil soup photos"');
    expect(html).toContain('alt="Lentil soup, photo 1 of 3"');
    expect(html).toContain('aria-label="Show photo 3 of 3"');
    expect(html.match(/class="recipe-gallery__thumbnail"/g)).toHaveLength(3);
    expect(html).toContain('/arbitrary/IMAGE/Recipes/cover');
  });
});
