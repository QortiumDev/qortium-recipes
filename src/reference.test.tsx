import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Reference, RECIPE_REFERENCE_EXAMPLES } from './Reference';
import { RECIPE_IDENTIFIER_PREFIX, RECIPE_SCHEMA } from './recipe';
import {
  RECIPE_FILENAME,
  RECIPE_MAX_BYTES,
  RECIPE_METADATA_DESCRIPTION_BYTES,
  RECIPE_METADATA_TAG_BYTES,
  RECIPE_METADATA_TAG_LIMIT,
  RECIPE_METADATA_TITLE_BYTES,
  RECIPE_SERVICE,
} from './qdnRecipes';

describe('Recipes developer reference', () => {
  const html = renderToStaticMarkup(<Reference />);

  it('renders the live schema, tuple, filename, and limits', () => {
    for (const value of [
      RECIPE_SCHEMA,
      RECIPE_SERVICE,
      RECIPE_FILENAME,
      RECIPE_IDENTIFIER_PREFIX,
      String(RECIPE_MAX_BYTES),
      String(RECIPE_METADATA_TITLE_BYTES),
      String(RECIPE_METADATA_DESCRIPTION_BYTES),
      String(RECIPE_METADATA_TAG_LIMIT),
      String(RECIPE_METADATA_TAG_BYTES),
    ]) {
      expect(html).toContain(value);
    }
    expect(html).toContain('64-byte');
  });

  it('documents free-text preservation and conservative scaling', () => {
    expect(html).toContain('Original text survives');
    expect(html).toContain('salt to taste');
    expect(html).toContain('scalable');
    expect(html).toContain('baseServings');
    expect(html).toContain('singular and plural');
  });

  it('documents bridge actions, exact READY confirmation, and public semantics', () => {
    for (const action of [
      'SHOW_ACTIONS',
      'GET_SELECTED_ACCOUNT',
      'GET_ACCOUNT_NAMES',
      'SEARCH_QDN_RESOURCES',
      'FETCH_QDN_RESOURCE',
      'PUBLISH_QDN_RESOURCE',
    ]) {
      expect(html).toContain(action);
    }
    expect(html).toContain('transaction signature');
    expect(html).toContain('No delete contract');
    expect(html).toContain('Every published recipe is public and durable');
  });

  it('exposes semantic section navigation and accessible copy feedback', () => {
    expect(html).toContain('aria-label="Developer reference sections"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-label="Copy Complete recipe.json example"');
    expect(html).toContain('reference-example-recipe');
  });

  it('exports the expected copyable protocol examples', () => {
    expect(Object.keys(RECIPE_REFERENCE_EXAMPLES)).toEqual([
      'recipe', 'capabilities', 'search', 'fetch', 'publish', 'ready', 'jsonLd',
    ]);
    expect(RECIPE_REFERENCE_EXAMPLES.publish).toContain(`service: '${RECIPE_SERVICE}'`);
    expect(RECIPE_REFERENCE_EXAMPLES.publish).toContain(`filename: '${RECIPE_FILENAME}'`);
    expect(RECIPE_REFERENCE_EXAMPLES.publish).toContain(RECIPE_IDENTIFIER_PREFIX);
    expect(RECIPE_REFERENCE_EXAMPLES.publish).toContain(String(RECIPE_MAX_BYTES));
    expect(RECIPE_REFERENCE_EXAMPLES.fetch).toContain(String(RECIPE_MAX_BYTES));
  });
});
