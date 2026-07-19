// Intentionally outside localization: public protocol references stay always-English.
import { useState } from 'react';
import { copyTextToClipboard } from './clipboard';
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

const SAMPLE_ID = 'mexample8recipe';

export const RECIPE_REFERENCE_EXAMPLES = {
  recipe: JSON.stringify({
    schema: RECIPE_SCHEMA,
    id: SAMPLE_ID,
    name: 'Lentil soup',
    description: 'A simple pantry-friendly soup.',
    baseServings: 4,
    yieldText: '4 bowls',
    prepMinutes: 15,
    cookMinutes: 40,
    category: 'Soup',
    cuisine: 'Mediterranean',
    tags: ['lentils', 'vegan'],
    image: 'qdn://IMAGE/Cook/lentil-soup',
    ingredients: [
      { id: 'lentils', text: '1 1/2 cups lentils', amount: 1.5, amountMax: null, unit: 'cups', item: 'lentils', scalable: true },
      { id: 'salt', text: 'salt to taste', amount: null, amountMax: null, unit: '', item: 'salt to taste', scalable: false },
    ],
    instructions: ['Combine the ingredients.', 'Simmer until tender.'],
    notes: ['Add water as needed.'],
    source: { name: 'Family recipe', url: '' },
    createdAt: 1784500000000,
    updatedAt: 1784500000000,
  }, null, 2),
  capabilities: `const actions = await qdnRequest({ action: 'SHOW_ACTIONS' });
const has = (action) => actions.some(
  (available) => available.toUpperCase() === action,
);

const capabilities = {
  selectedAccount: has('GET_SELECTED_ACCOUNT'),
  accountNames: has('GET_ACCOUNT_NAMES'),
  search: has('SEARCH_QDN_RESOURCES'),
  fetch: has('FETCH_QDN_RESOURCE'),
  publish: has('PUBLISH_QDN_RESOURCE'),
};`,
  search: `const resources = await qdnRequest({
  action: 'SEARCH_QDN_RESOURCES',
  service: '${RECIPE_SERVICE}',
  identifier: '${RECIPE_IDENTIFIER_PREFIX}',
  prefix: true,
  mode: 'ALL',
  reverse: true,
  includeMetadata: true,
  includeStatus: true,
  excludeBlocked: true,
  limit: 24,
  offset: 0,
});`,
  fetch: `const payload = await qdnRequest({
  action: 'FETCH_QDN_RESOURCE',
  service: '${RECIPE_SERVICE}',
  name: resource.name,
  identifier: resource.identifier,
  maxBytes: ${RECIPE_MAX_BYTES},
});

const validation = validateRecipe(payload);
if (!validation.recipe) throw new Error(validation.errors.join(' '));`,
  publish: `const bytes = new TextEncoder().encode(JSON.stringify(recipe));
if (bytes.byteLength > ${RECIPE_MAX_BYTES}) throw new Error('Recipe payload is too large');
let binary = '';
for (const byte of bytes) binary += String.fromCharCode(byte);
const base64 = btoa(binary);

const result = await qdnRequest({
  action: 'PUBLISH_QDN_RESOURCE',
  service: '${RECIPE_SERVICE}',
  name: selectedWritableName,
  identifier: '${RECIPE_IDENTIFIER_PREFIX}' + recipe.id,
  filename: '${RECIPE_FILENAME}',
  title: truncateUtf8(recipe.name, ${RECIPE_METADATA_TITLE_BYTES}),
  description: truncateUtf8(
    recipe.description || recipe.name + ' recipe',
    ${RECIPE_METADATA_DESCRIPTION_BYTES},
  ),
  tags: ['qrecipes', 'recipe', 'v1', ...recipe.tags]
    .slice(0, ${RECIPE_METADATA_TAG_LIMIT})
    .map((tag) => truncateUtf8(tag, ${RECIPE_METADATA_TAG_BYTES})),
  base64,
});`,
  ready: `const listed = await qdnRequest({
  action: 'SEARCH_QDN_RESOURCES',
  service: '${RECIPE_SERVICE}',
  name: selectedWritableName,
  identifier,
  prefix: false,
  mode: 'ALL',
  includeStatus: true,
});

const exact = listed.find((item) =>
  item.name === selectedWritableName &&
  item.identifier === identifier &&
  item.latestSignature === result.transactionSignature
);
const status = typeof exact?.status === 'string'
  ? exact.status.toUpperCase()
  : exact?.status?.status?.toUpperCase();

if (status === 'BLOCKED' || status === 'BUILD_FAILED') {
  throw new Error('Recipe publication failed');
}
const ready = status === 'READY';`,
  jsonLd: `const duration = (minutes) => {
  if (minutes == null) return undefined;
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);
  return 'PT' + (hours ? hours + 'H' : '') + (remaining || !hours ? remaining + 'M' : '');
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: recipe.name,
  description: recipe.description || undefined,
  author: resource.name ? { '@type': 'Person', name: resource.name } : undefined,
  image: recipe.image || undefined,
  prepTime: duration(recipe.prepMinutes),
  cookTime: duration(recipe.cookMinutes),
  totalTime: recipe.prepMinutes != null || recipe.cookMinutes != null
    ? duration((recipe.prepMinutes || 0) + (recipe.cookMinutes || 0))
    : undefined,
  recipeYield: recipe.yieldText || (recipe.baseServings
    ? recipe.baseServings + ' servings'
    : undefined),
  recipeCategory: recipe.category || undefined,
  recipeCuisine: recipe.cuisine || undefined,
  keywords: recipe.tags.length ? recipe.tags.join(', ') : undefined,
  recipeIngredient: recipe.ingredients.map((entry) => entry.text),
  recipeInstructions: recipe.instructions.map((text) => ({
    '@type': 'HowToStep', text,
  })),
  isBasedOn: recipe.source.url || undefined,
};`,
} as const;

type ExampleName = keyof typeof RECIPE_REFERENCE_EXAMPLES;

function CodeExample({ id, label }: { id: ExampleName; label: string }) {
  const [state, setState] = useState<'copied' | 'idle' | 'unavailable'>('idle');
  const code = RECIPE_REFERENCE_EXAMPLES[id];

  async function copy() {
    setState(await copyTextToClipboard(code) ? 'copied' : 'unavailable');
  }

  return (
    <div className="reference-code" id={`reference-example-${id}`}>
      <header>
        <strong>{label}</strong>
        <button
          aria-label={`${state === 'copied' ? 'Copied' : 'Copy'} ${label}`}
          className="button button--ghost"
          onClick={() => void copy()}
          type="button"
        >
          {state === 'copied' ? 'Copied' : 'Copy'}
        </button>
      </header>
      <pre><code>{code}</code></pre>
      <span aria-live="polite" className="sr-only">
        {state === 'copied'
          ? `${label} copied.`
          : state === 'unavailable'
            ? 'Clipboard access is unavailable. Select the code manually.'
            : ''}
      </span>
    </div>
  );
}

export function Reference() {
  return (
    <article className="developer-reference">
      <header className="reference-hero">
        <p className="eyebrow">Always-English public contract</p>
        <h1>Recipes developer reference</h1>
        <p>
          The validated JSON payload is authoritative. Metadata helps discovery, and the
          Schema.org mapping is an export format rather than the QDN storage contract.
        </p>
      </header>

      <nav aria-label="Developer reference sections" className="reference-toc">
        <a href="#reference-schema">Schema</a>
        <a href="#reference-fields">Fields</a>
        <a href="#reference-scaling">Scaling</a>
        <a href="#reference-qdn">QDN lifecycle</a>
        <a href="#reference-bridge">Bridge</a>
        <a href="#reference-interchange">Interchange</a>
        <a href="#reference-privacy">Privacy</a>
      </nav>

      <section className="reference-section" id="reference-schema">
        <header><p className="eyebrow">Versioned data contract</p><h2>Recipe v1 JSON</h2></header>
        <div className="reference-grid">
          <article className="reference-card">
            <h3>Resource tuple</h3>
            <p>
              Recipes uses <code>{RECIPE_SERVICE}</code> resources named by the author,
              filename <code>{RECIPE_FILENAME}</code>, and identifier{' '}
              <code>{RECIPE_IDENTIFIER_PREFIX}{'{id}'}</code>. Every payload declares{' '}
              <code>schema: &quot;{RECIPE_SCHEMA}&quot;</code>.
            </p>
          </article>
          <article className="reference-card">
            <h3>Compatibility</h3>
            <p>
              Readers reject unknown schema names and malformed required data. Compatible
              readers may ignore unknown optional fields, but publishers must not change
              the meaning of existing v1 fields; incompatible changes need a new schema and
              identifier prefix.
            </p>
          </article>
        </div>
        <CodeExample id="recipe" label="Complete recipe.json example" />
      </section>

      <section className="reference-section" id="reference-fields">
        <header><p className="eyebrow">Validation</p><h2>Required and normalized fields</h2></header>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Field</th><th>Contract</th></tr></thead>
            <tbody>
              <tr><td><code>id</code></td><td>Required; 8–24 ASCII letters, numbers, underscores, or hyphens.</td></tr>
              <tr><td><code>name</code></td><td>Required; at most 200 UTF-8 bytes.</td></tr>
              <tr><td><code>ingredients</code></td><td>At least one accepted ingredient object.</td></tr>
              <tr><td><code>instructions</code></td><td>At least one non-empty step; at most 200 retained.</td></tr>
              <tr><td><code>baseServings</code></td><td>Optional positive number. Zero and negative values are invalid.</td></tr>
              <tr><td><code>prepMinutes</code>, <code>cookMinutes</code></td><td>Optional non-negative numbers.</td></tr>
              <tr><td><code>tags</code></td><td>Trimmed, de-duplicated payload tags; at most 20 retained.</td></tr>
              <tr><td><code>notes</code></td><td>Optional public notes; at most 100 non-empty entries retained.</td></tr>
              <tr><td><code>source</code></td><td>Optional attribution name and URL; no private credentials.</td></tr>
              <tr><td><code>createdAt</code>, <code>updatedAt</code></td><td>Positive epoch milliseconds; invalid values normalize to the read time.</td></tr>
            </tbody>
          </table>
        </div>
        <aside className="reference-callout">
          <strong>App payload ceiling: {RECIPE_MAX_BYTES.toLocaleString()} UTF-8 bytes.</strong>
          <p>This matches the current Recipes fetch ceiling; it is not presented as a universal Core publish limit.</p>
        </aside>
      </section>

      <section className="reference-section" id="reference-scaling">
        <header><p className="eyebrow">Presentation contract</p><h2>Ingredients and serving scaling</h2></header>
        <div className="reference-grid">
          <article className="reference-card">
            <h3>Original text survives</h3>
            <p>
              Every ingredient keeps its author-entered <code>text</code>. Structured{' '}
              <code>amount</code>, <code>amountMax</code>, <code>unit</code>, and{' '}
              <code>item</code> fields are optional reviewable assistance, not a claim that
              arbitrary prose can always be parsed.
            </p>
          </article>
          <article className="reference-card">
            <h3>Only confirmed amounts scale</h3>
            <p>
              A line scales only when <code>scalable</code> is true and <code>amount</code> is
              numeric. Ranges scale both ends. Text such as <code>salt to taste</code> remains
              unchanged. Known English units switch between singular and plural in scaled
              views; unknown or abbreviated unit labels remain verbatim. Custom servings use
              requested servings divided by <code>baseServings</code>.
            </p>
          </article>
        </div>
      </section>

      <section className="reference-section" id="reference-qdn">
        <header><p className="eyebrow">Identity and lifecycle</p><h2>Discovery, ownership, and updates</h2></header>
        <div className="reference-grid">
          <article className="reference-card">
            <h3>Name-based control</h3>
            <p>
              The resource tuple is service + registered name + identifier. Recipes exposes
              editing only when the selected account controls the resource name. Republishing
              the same tuple creates the next public version; preserve <code>id</code> and{' '}
              <code>createdAt</code>, and advance <code>updatedAt</code>.
            </p>
          </article>
          <article className="reference-card">
            <h3>Identifiers and metadata</h3>
            <p>
              The prefix plus the maximum 24-character id stays below QDN&apos;s 64-byte
              identifier limit. Published metadata uses at most {RECIPE_METADATA_TITLE_BYTES}
              title bytes, {RECIPE_METADATA_DESCRIPTION_BYTES} description bytes, and{' '}
              {RECIPE_METADATA_TAG_LIMIT} tags of {RECIPE_METADATA_TAG_BYTES} bytes each.
              Metadata is an index; validate the fetched JSON before display.
            </p>
          </article>
          <article className="reference-card">
            <h3>Discovery and paging</h3>
            <p>
              Search uses the recipe identifier prefix, asks Core for reverse order, and
              requests pages of 24 with an explicit <code>offset</code>. Search metadata is
              untrusted discovery data; clients fetch and validate each selected JSON
              payload before treating it as a recipe.
            </p>
          </article>
          <article className="reference-card">
            <h3>No delete contract</h3>
            <p>
              Recipes v1 defines create and update by publishing the same resource tuple.
              It does not define deletion or a tombstone record. Older QDN versions remain
              part of public history even after a newer version is published.
            </p>
          </article>
        </div>
        <div className="reference-grid">
          <CodeExample id="search" label="Discover recipe resources" />
          <CodeExample id="fetch" label="Fetch and validate a recipe" />
        </div>
      </section>

      <section className="reference-section" id="reference-bridge">
        <header><p className="eyebrow">Qortium Home</p><h2>Feature detection and publication</h2></header>
        <div className="reference-grid">
          <article className="reference-card">
            <h3>Detect each capability</h3>
            <p>
              Use <code>SHOW_ACTIONS</code>. Browsing needs search/fetch actions. Publishing
              needs <code>GET_SELECTED_ACCOUNT</code>, a writable registered name, and{' '}
              <code>PUBLISH_QDN_RESOURCE</code>. The selected account&apos;s primary name is the
              normal fallback; when available, <code>GET_ACCOUNT_NAMES</code> discovers its
              other writable names. Standalone browser development is intentionally read-only.
            </p>
          </article>
          <article className="reference-card">
            <h3>Confirm the exact write</h3>
            <p>
              JSON is UTF-8 encoded and published as base64. Recipes waits for the exact
              returned transaction signature to appear on the same name/identifier with{' '}
              <code>READY</code> status; <code>BLOCKED</code> and <code>BUILD_FAILED</code> are
              terminal failures.
            </p>
          </article>
        </div>
        <div className="reference-grid">
          <CodeExample id="capabilities" label="Detect bridge capabilities" />
          <CodeExample id="publish" label="Publish or update a recipe" />
          <CodeExample id="ready" label="Confirm READY and signature" />
        </div>
      </section>

      <section className="reference-section" id="reference-interchange">
        <header><p className="eyebrow">Portable output</p><h2>Schema.org Recipe JSON-LD</h2></header>
        <p>
          The app exports a Schema.org <code>Recipe</code> mapping for interoperability.
          Ingredient strings come from original text, instructions become{' '}
          <code>HowToStep</code> objects, and minute values become ISO 8601 durations. This
          export does not replace <code>{RECIPE_SCHEMA}</code> on QDN. RecipeMD and arbitrary
          website import are not implemented contracts.
        </p>
        <CodeExample id="jsonLd" label="Schema.org mapping outline" />
      </section>

      <section className="reference-section" id="reference-privacy">
        <header><p className="eyebrow">Public by design</p><h2>Privacy and permanence</h2></header>
        <aside className="reference-callout reference-callout--warning">
          <strong>Every published recipe is public and durable.</strong>
          <p>
            Recipe text, notes, source URLs, author name, and QDN image references are public.
            Never publish API keys, credentials, private keys, private household details, or
            information that depends on later deletion for safety.
          </p>
        </aside>
      </section>
    </article>
  );
}
