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
        onCopyLink={vi.fn()}
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

  it('renders section and instruction media at their requested positions', () => {
    const published = publishedRecipe();
    published.recipe.notes = ['Keeps for five days.'];
    published.recipe.media = [
      {
        id: 'finished-soup',
        uri: 'qdn://IMAGE/Recipes/cover',
        alt: 'A bowl of lentil soup',
        caption: 'Ready to serve.',
        placement: { type: 'cover' },
      },
      {
        id: 'ingredients',
        uri: 'qdn://IMAGE/Recipes/ingredients',
        alt: 'Ingredients arranged on a counter',
        caption: 'Gather the ingredients.',
        placement: { type: 'section', section: 'ingredients', position: 'before' },
      },
      {
        id: 'simmering',
        uri: 'qdn://IMAGE/Recipes/simmering',
        alt: 'Soup simmering in a pot',
        caption: 'Simmer until tender.',
        placement: { type: 'instruction', instructionIndex: 0, position: 'after' },
      },
      {
        id: 'storage',
        uri: 'qdn://IMAGE/Recipes/storage',
        alt: 'Soup in a storage container',
        caption: 'Cool before storing.',
        placement: { type: 'section', section: 'notes', position: 'after' },
      },
    ];

    const html = renderToStaticMarkup(
      <RecipeDetail
        canEdit={false}
        favorite={false}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onToggleFavorite={vi.fn()}
        published={published}
      />,
    );

    expect(html).toContain('alt="A bowl of lentil soup"');
    expect(html).toContain('Ready to serve.');
    expect(html).toContain('alt="Ingredients arranged on a counter"');
    expect(html).toContain('Gather the ingredients.');
    expect(html).toContain('alt="Soup simmering in a pot"');
    expect(html).toContain('Simmer until tender.');
    expect(html).toContain('alt="Soup in a storage container"');
    expect(html).toContain('Cool before storing.');
    expect(html).not.toContain('Show photo 2 of');

    expect(html.indexOf('Gather the ingredients.')).toBeLessThan(html.indexOf('<h2>Ingredients</h2>'));
    expect(html.indexOf('Simmer.')).toBeLessThan(html.indexOf('Simmer until tender.'));
    expect(html.indexOf('Keeps for five days.')).toBeLessThan(html.indexOf('Cool before storing.'));
  });
});
