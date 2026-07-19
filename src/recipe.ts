import type { RecipeIngredient, RecipeV1, RecipeValidation } from './types';

export const RECIPE_SCHEMA = 'qortium.recipes.recipe.v1' as const;
export const RECIPE_IDENTIFIER_PREFIX = 'qrecipes.v1.r.';

const UNICODE_FRACTIONS: Record<string, [number, number]> = {
  '½': [1, 2],
  '⅓': [1, 3],
  '⅔': [2, 3],
  '¼': [1, 4],
  '¾': [3, 4],
  '⅕': [1, 5],
  '⅖': [2, 5],
  '⅗': [3, 5],
  '⅘': [4, 5],
  '⅙': [1, 6],
  '⅚': [5, 6],
  '⅛': [1, 8],
  '⅜': [3, 8],
  '⅝': [5, 8],
  '⅞': [7, 8],
};

const AMOUNT_TOKEN = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])`;
const LEADING_AMOUNT = new RegExp(
  String.raw`^(${AMOUNT_TOKEN})(?:\s*(?:-|–|—|to)\s*(${AMOUNT_TOKEN}))?(?:\s+|$)(.*)$`,
  'i',
);

const KNOWN_UNITS = [
  'fluid ounces',
  'fluid ounce',
  'tablespoons',
  'tablespoon',
  'teaspoons',
  'teaspoon',
  'milliliters',
  'milliliter',
  'kilograms',
  'kilogram',
  'centiliters',
  'centiliter',
  'packages',
  'package',
  'pinches',
  'pinch',
  'cloves',
  'clove',
  'slices',
  'slice',
  'sprigs',
  'sprig',
  'stalks',
  'stalk',
  'sticks',
  'stick',
  'pieces',
  'piece',
  'ounces',
  'ounce',
  'pounds',
  'pound',
  'grams',
  'gram',
  'cups',
  'cup',
  'cans',
  'can',
  'jars',
  'jar',
  'bunches',
  'bunch',
  'handfuls',
  'handful',
  'tbsp',
  'tsp',
  'fl oz',
  'ml',
  'cl',
  'kg',
  'mg',
  'lb',
  'lbs',
  'oz',
  'g',
];

const DISPLAY_FRACTIONS: Array<[number, string]> = [
  [1 / 8, '⅛'],
  [1 / 5, '⅕'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [2 / 5, '⅖'],
  [1 / 2, '½'],
  [3 / 5, '⅗'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [4 / 5, '⅘'],
  [5 / 6, '⅚'],
  [7 / 8, '⅞'],
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalPositiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function optionalNonNegativeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseAmountToken(token: string): number | null {
  const clean = token.trim();
  if (UNICODE_FRACTIONS[clean]) {
    const [numerator, denominator] = UNICODE_FRACTIONS[clean];
    return numerator / denominator;
  }

  if (/^\d+\s+\d+\/\d+$/.test(clean)) {
    const [whole, fraction] = clean.split(/\s+/);
    const [numerator, denominator] = fraction.split('/').map(Number);
    return denominator ? Number(whole) + numerator / denominator : null;
  }

  if (/^\d+\/\d+$/.test(clean)) {
    const [numerator, denominator] = clean.split('/').map(Number);
    return denominator ? numerator / denominator : null;
  }

  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeJoinedFraction(line: string) {
  return line.replace(/(\d)([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, (_match, whole: string, fraction: string) => {
    const [numerator, denominator] = UNICODE_FRACTIONS[fraction];
    return `${whole} ${numerator}/${denominator}`;
  });
}

function splitKnownUnit(remainder: string) {
  const lower = remainder.toLowerCase();
  const unit = KNOWN_UNITS.find(
    (candidate) => lower === candidate || lower.startsWith(`${candidate} `),
  );

  if (!unit) {
    return { item: remainder, unit: '' };
  }

  return {
    item: remainder.slice(unit.length).trim(),
    unit: remainder.slice(0, unit.length),
  };
}

export function createIngredientId() {
  const randomBytes = new Uint8Array(6);
  globalThis.crypto?.getRandomValues?.(randomBytes);
  const randomPart = Array.from(randomBytes, (value) => value.toString(36)).join('').slice(0, 8);
  return `i-${Date.now().toString(36)}-${randomPart || Math.random().toString(36).slice(2, 10)}`;
}

export function createRecipeId() {
  const randomBytes = new Uint8Array(8);
  globalThis.crypto?.getRandomValues?.(randomBytes);
  const randomPart = Array.from(randomBytes, (value) => value.toString(36)).join('').slice(0, 12);
  return `${Date.now().toString(36)}${randomPart || Math.random().toString(36).slice(2, 14)}`.slice(0, 24);
}

export function buildRecipeIdentifier(recipeId: string) {
  return `${RECIPE_IDENTIFIER_PREFIX}${recipeId}`;
}

export function parseIngredientLine(input: string, id = createIngredientId()): RecipeIngredient | null {
  const original = input.trim().replace(/^[*-]\s+/, '');
  if (!original) {
    return null;
  }

  const match = normalizeJoinedFraction(original).match(LEADING_AMOUNT);
  if (!match) {
    return {
      id,
      text: original,
      amount: null,
      amountMax: null,
      unit: '',
      item: original,
      scalable: false,
    };
  }

  const amount = parseAmountToken(match[1]);
  const amountMax = match[2] ? parseAmountToken(match[2]) : null;
  const remainder = match[3].trim();
  const fields = splitKnownUnit(remainder);

  return {
    id,
    text: original,
    amount,
    amountMax,
    unit: fields.unit,
    item: fields.item,
    scalable: amount !== null,
  };
}

export function parseIngredientLines(input: string): RecipeIngredient[] {
  return input
    .split(/\r?\n/)
    .map((line) => parseIngredientLine(line))
    .filter((ingredient): ingredient is RecipeIngredient => ingredient !== null);
}

export function formatAmount(value: number) {
  if (!Number.isFinite(value)) {
    return '';
  }

  const roundedInteger = Math.round(value);
  if (Math.abs(value - roundedInteger) < 0.0005) {
    return String(roundedInteger);
  }

  const whole = Math.floor(value);
  const fractional = value - whole;
  const fraction = DISPLAY_FRACTIONS.find(([candidate]) => Math.abs(fractional - candidate) < 0.015);
  if (fraction) {
    return `${whole || ''}${whole ? ' ' : ''}${fraction[1]}`;
  }

  return Number(value.toFixed(2)).toString();
}

export function composeIngredientText(ingredient: RecipeIngredient, factor = 1) {
  if (!ingredient.scalable || ingredient.amount === null) {
    return ingredient.text || ingredient.item;
  }

  if (factor === 1 && ingredient.text) {
    return ingredient.text;
  }

  const amount = formatAmount(ingredient.amount * factor);
  const amountMax = ingredient.amountMax === null ? '' : formatAmount(ingredient.amountMax * factor);
  return [amountMax ? `${amount}–${amountMax}` : amount, ingredient.unit, ingredient.item]
    .filter(Boolean)
    .join(' ');
}

export function rebuildIngredientText(ingredient: RecipeIngredient) {
  if (ingredient.amount === null) {
    return ingredient.item.trim() || ingredient.text.trim();
  }

  const amount = formatAmount(ingredient.amount);
  const amountMax = ingredient.amountMax === null ? '' : formatAmount(ingredient.amountMax);
  return [amountMax ? `${amount}–${amountMax}` : amount, ingredient.unit.trim(), ingredient.item.trim()]
    .filter(Boolean)
    .join(' ');
}

export function createBlankRecipe(): RecipeV1 {
  const now = Date.now();
  return {
    schema: RECIPE_SCHEMA,
    id: createRecipeId(),
    name: '',
    description: '',
    baseServings: null,
    yieldText: '',
    prepMinutes: null,
    cookMinutes: null,
    category: '',
    cuisine: '',
    tags: [],
    image: '',
    ingredients: [],
    instructions: [],
    notes: [],
    source: { name: '', url: '' },
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeIngredient(value: unknown, index: number): RecipeIngredient | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawText = text(value.text);
  const item = text(value.item) || rawText;
  if (!rawText && !item) {
    return null;
  }

  const amount = optionalNonNegativeNumber(value.amount);
  const amountMax = optionalNonNegativeNumber(value.amountMax);
  return {
    id: text(value.id) || `ingredient-${index + 1}`,
    text: rawText || item,
    amount,
    amountMax: amountMax !== null && amount !== null && amountMax >= amount ? amountMax : null,
    unit: text(value.unit),
    item,
    scalable: value.scalable === true && amount !== null,
  };
}

export function validateRecipe(value: unknown): RecipeValidation {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { errors: ['Recipe data must be a JSON object.'], recipe: null };
  }

  if (value.schema !== RECIPE_SCHEMA) {
    errors.push(`Unsupported recipe schema. Expected ${RECIPE_SCHEMA}.`);
  }

  const id = text(value.id);
  if (!/^[a-zA-Z0-9_-]{8,24}$/.test(id)) {
    errors.push('Recipe ID must contain 8–24 letters, numbers, underscores, or hyphens.');
  }

  const name = text(value.name);
  if (!name) {
    errors.push('Recipe name is required.');
  } else if (new TextEncoder().encode(name).byteLength > 200) {
    errors.push('Recipe name is too long.');
  }

  const ingredients = Array.isArray(value.ingredients)
    ? value.ingredients
        .map(normalizeIngredient)
        .filter((ingredient): ingredient is RecipeIngredient => ingredient !== null)
    : [];
  if (!ingredients.length) {
    errors.push('Add at least one ingredient.');
  }

  const instructions = Array.isArray(value.instructions)
    ? value.instructions.map(text).filter(Boolean).slice(0, 200)
    : [];
  if (!instructions.length) {
    errors.push('Add at least one instruction.');
  }

  const baseServings = optionalPositiveNumber(value.baseServings);
  if (value.baseServings !== null && value.baseServings !== undefined && baseServings === null) {
    errors.push('Base servings must be a positive number.');
  }

  if (errors.length) {
    return { errors, recipe: null };
  }

  const source = isRecord(value.source) ? value.source : {};
  const tags = Array.isArray(value.tags)
    ? [...new Set(value.tags.map(text).filter(Boolean))].slice(0, 20)
    : [];
  const createdAt = Number(value.createdAt);
  const updatedAt = Number(value.updatedAt);

  return {
    errors: [],
    recipe: {
      schema: RECIPE_SCHEMA,
      id,
      name,
      description: text(value.description).slice(0, 4_000),
      baseServings,
      yieldText: text(value.yieldText).slice(0, 120),
      prepMinutes: optionalNonNegativeNumber(value.prepMinutes),
      cookMinutes: optionalNonNegativeNumber(value.cookMinutes),
      category: text(value.category).slice(0, 80),
      cuisine: text(value.cuisine).slice(0, 80),
      tags,
      image: text(value.image).slice(0, 500),
      ingredients,
      instructions,
      notes: Array.isArray(value.notes) ? value.notes.map(text).filter(Boolean).slice(0, 100) : [],
      source: {
        name: text(source.name).slice(0, 200),
        url: text(source.url).slice(0, 1_000),
      },
      createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now(),
      updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now(),
    },
  };
}

function minutesToDuration(minutes: number | null) {
  if (minutes === null) {
    return undefined;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return `PT${hours ? `${hours}H` : ''}${remainingMinutes || !hours ? `${remainingMinutes}M` : ''}`;
}

export function toSchemaOrgRecipe(recipe: RecipeV1, authorName?: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.name,
    description: recipe.description || undefined,
    author: authorName ? { '@type': 'Person', name: authorName } : undefined,
    image: recipe.image || undefined,
    prepTime: minutesToDuration(recipe.prepMinutes),
    cookTime: minutesToDuration(recipe.cookMinutes),
    totalTime:
      recipe.prepMinutes !== null || recipe.cookMinutes !== null
        ? minutesToDuration((recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0))
        : undefined,
    recipeYield: recipe.yieldText || (recipe.baseServings ? `${recipe.baseServings} servings` : undefined),
    recipeCategory: recipe.category || undefined,
    recipeCuisine: recipe.cuisine || undefined,
    keywords: recipe.tags.length ? recipe.tags.join(', ') : undefined,
    recipeIngredient: recipe.ingredients.map((ingredient) => ingredient.text),
    recipeInstructions: recipe.instructions.map((instruction) => ({
      '@type': 'HowToStep',
      text: instruction,
    })),
    isBasedOn: recipe.source.url || undefined,
  };
}

export function recipeImageUrl(image: string) {
  const match = image.trim().match(/^qdn:\/\/([^/]+)\/([^/]+)\/([^/]+)$/i);
  if (!match) {
    return image.trim();
  }

  return `/arbitrary/${encodeURIComponent(match[1].toUpperCase())}/${encodeURIComponent(match[2])}/${encodeURIComponent(match[3])}`;
}
