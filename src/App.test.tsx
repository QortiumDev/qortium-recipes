import { describe, expect, it } from 'vitest';
import { copyLinkStatusText } from './App';
import { createBlankRecipe } from './recipe';
import type { PublishedRecipe } from './types';

const selected: PublishedRecipe = {
  recipe: createBlankRecipe(),
  resource: { identifier: 'qrecipes.v1.r.lentils1', name: 'Cook', service: 'JSON' },
};

describe('Copy link status', () => {
  it('describes the idle, copied, and manual-copy states for the selected recipe only', () => {
    expect(copyLinkStatusText(null, selected)).toContain('shareable qdn:// address');
    expect(copyLinkStatusText({ identifier: 'qrecipes.v1.r.lentils1', link: 'qdn://x', name: 'Cook', state: 'copied' }, selected))
      .toBe('Recipe link copied.');
    expect(copyLinkStatusText({ identifier: 'qrecipes.v1.r.lentils1', link: 'qdn://APP/Recipes/Recipes?recipe=a&author=Cook', name: 'Cook', state: 'unavailable' }, selected))
      .toBe('Clipboard unavailable. Copy this link manually: qdn://APP/Recipes/Recipes?recipe=a&author=Cook');
    // A result for a different recipe must not leak onto the one now open.
    expect(copyLinkStatusText({ identifier: 'qrecipes.v1.r.other', link: 'qdn://x', name: 'Cook', state: 'copied' }, selected))
      .toContain('shareable qdn:// address');
  });
});
