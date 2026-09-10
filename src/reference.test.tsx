import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { copyStatusText, Reference, RECIPE_REFERENCE_EXAMPLES } from './Reference';
import { REFERENCE_SECTIONS } from './ReferenceNavigation';
import {
  RECIPE_CATEGORY_MAX_CHARS,
  RECIPE_DESCRIPTION_MAX_CHARS,
  RECIPE_ID_MAX_LENGTH,
  RECIPE_ID_MIN_LENGTH,
  RECIPE_IDENTIFIER_PREFIX,
  RECIPE_INSTRUCTION_LIMIT,
  RECIPE_MEDIA_ALT_MAX_CHARS,
  RECIPE_MEDIA_CAPTION_MAX_CHARS,
  RECIPE_MEDIA_LIMIT,
  RECIPE_MEDIA_URI_MAX_CHARS,
  RECIPE_NAME_MAX_BYTES,
  RECIPE_NOTE_LIMIT,
  RECIPE_SCHEMA,
  RECIPE_SOURCE_NAME_MAX_CHARS,
  RECIPE_SOURCE_URL_MAX_CHARS,
  RECIPE_TAG_LIMIT,
  RECIPE_YIELD_MAX_CHARS,
  validateRecipe,
} from './recipe';
import {
  RECIPE_FILENAME,
  RECIPE_MAX_BYTES,
  RECIPE_METADATA_DESCRIPTION_BYTES,
  RECIPE_METADATA_TAG_BYTES,
  RECIPE_METADATA_TAG_LIMIT,
  RECIPE_METADATA_TITLE_BYTES,
  RECIPE_SEARCH_PAGE_SIZE,
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
      String(RECIPE_MEDIA_LIMIT),
    ]) {
      expect(html).toContain(value);
    }
    expect(html).toContain('64-byte');
    expect(html).toContain('all unique media URIs');
    expect(RECIPE_REFERENCE_EXAMPLES.recipe).toContain('"images"');
    expect(RECIPE_REFERENCE_EXAMPLES.recipe).toContain('"media"');
    expect(RECIPE_REFERENCE_EXAMPLES.recipe).toContain('"instructionIndex": 1');
  });

  it('binds every documented validation limit to the implementation constants', () => {
    expect(html).toContain(`${RECIPE_ID_MIN_LENGTH}–${RECIPE_ID_MAX_LENGTH} ASCII letters`);
    expect(html).toContain(`maximum ${RECIPE_ID_MAX_LENGTH}-character id`);
    expect(html).toContain(`at most ${RECIPE_NAME_MAX_BYTES} UTF-8 bytes`);
    expect(html).toContain(`truncated to ${RECIPE_DESCRIPTION_MAX_CHARS.toLocaleString()} characters`);
    expect(html).toContain(`at most ${RECIPE_INSTRUCTION_LIMIT} retained`);
    expect(html).toContain(`at most ${RECIPE_TAG_LIMIT} retained`);
    expect(html).toContain(`at most ${RECIPE_NOTE_LIMIT} non-empty entries retained`);
    expect(html).toContain(`truncated to ${RECIPE_YIELD_MAX_CHARS}, ${RECIPE_CATEGORY_MAX_CHARS}, and ${RECIPE_CATEGORY_MAX_CHARS} characters`);
    expect(html).toContain(`<code>uri</code> (${RECIPE_MEDIA_URI_MAX_CHARS} characters), <code>alt</code> (${RECIPE_MEDIA_ALT_MAX_CHARS}), <code>caption</code> (${RECIPE_MEDIA_CAPTION_MAX_CHARS.toLocaleString()})`);
    expect(html).toContain(`<code>name</code> (${RECIPE_SOURCE_NAME_MAX_CHARS} characters) and <code>url</code> (${RECIPE_SOURCE_URL_MAX_CHARS.toLocaleString()})`);
  });

  it('documents the search page size as its own constant, not the media limit', () => {
    expect(html).toContain(`requests pages of ${RECIPE_SEARCH_PAGE_SIZE} with an explicit`);
    expect(RECIPE_REFERENCE_EXAMPLES.search).toContain(`limit: ${RECIPE_SEARCH_PAGE_SIZE},`);
    expect(html).toContain(`at most ${RECIPE_MEDIA_LIMIT} media objects`);
  });

  it('publishes a recipe example that the real reader accepts unchanged', () => {
    const parsed = JSON.parse(RECIPE_REFERENCE_EXAMPLES.recipe) as Record<string, unknown>;
    const validation = validateRecipe(parsed);
    expect(validation.errors).toEqual([]);
    expect(validation.recipe).toEqual(parsed);
    expect(validation.recipe?.media).toHaveLength(3);
    expect(validation.recipe?.media[2].placement).toEqual({ type: 'instruction', instructionIndex: 1, position: 'after' });
  });

  it('documents placement-aware media and backward compatibility', () => {
    expect(html).toContain('Media placement and compatibility');
    expect(html).toContain('zero-based instruction index');
    expect(html).toContain('Invalid placements normalize');
    expect(html).toContain('older v1 readers still show every unique URI');
    expect(RECIPE_REFERENCE_EXAMPLES.jsonLd).toContain("entry.placement.type === 'instruction'");
    expect(RECIPE_REFERENCE_EXAMPLES.jsonLd).toContain('instructionIndex');
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

  it('stays English left-to-right regardless of the Home shell language', () => {
    expect(html).toContain('<article class="developer-reference" dir="ltr" lang="en">');
    expect(html).toContain('Always-English public contract');
  });

  it('exposes semantic section navigation with focusable section targets', () => {
    expect(html).toContain('aria-label="Developer reference sections"');
    expect(html).not.toContain('href="#');
    for (const [id] of REFERENCE_SECTIONS) {
      expect(html).toContain(`href="/?view=developers#${id}"`);
      expect(html).toContain(`<section class="reference-section" tabindex="-1" id="${id}">`);
    }
  });

  it('shows visible, announced copy feedback and keeps the code block keyboard reachable', () => {
    expect(html).toContain('aria-label="Copy Complete recipe.json example"');
    expect(html).toContain('reference-example-recipe');
    expect(html).toContain('<p aria-live="polite" class="reference-copy-status" role="status">Code can be selected for manual copying.</p>');
    expect(html).toContain('<pre aria-label="Complete recipe.json example" tabindex="0">');
    expect(copyStatusText('copied', 'Fetch and validate a recipe')).toBe('Copied Fetch and validate a recipe.');
    expect(copyStatusText('unavailable', 'x')).toBe('Clipboard unavailable. Select the code and copy it manually.');
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
