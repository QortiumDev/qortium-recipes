import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createBlankRecipe } from './recipe';
import { RecipeEditor } from './RecipeEditor';

describe('RecipeEditor media controls', () => {
  it('offers general, section, and current-step placements for each image', () => {
    const recipe = createBlankRecipe();
    recipe.name = 'Lentil soup';
    recipe.instructions = ['Chop the vegetables.', '', 'Simmer until tender.'];
    recipe.media = [{
      id: 'vegetables',
      uri: 'qdn://IMAGE/Recipes/vegetables',
      alt: 'Chopped vegetables',
      caption: 'Ready for the pot.',
      placement: { type: 'instruction', instructionIndex: 0, position: 'after' },
    }];

    const html = renderToStaticMarkup(
      <RecipeEditor
        canPublish
        initialRecipe={recipe}
        isPublishing={false}
        onCancel={vi.fn()}
        onPublish={vi.fn()}
        onSaveDraft={vi.fn()}
        publishName="Recipes"
      />,
    );

    expect(html).toContain('<h2>Images</h2>');
    expect(html).toContain('Add QDN image URIs');
    expect(html).toContain('General gallery');
    expect(html).toContain('Before Ingredients');
    expect(html).toContain('After step 1');
    expect(html).toContain('Before step 2');
    expect(html).not.toContain('Before step 3');
    expect(html).toContain('After Notes');
    expect(html).toContain('value="qdn://IMAGE/Recipes/vegetables"');
    expect(html).toContain('value="Chopped vegetables"');
    expect(html).toContain('value="Ready for the pot."');
  });
});
