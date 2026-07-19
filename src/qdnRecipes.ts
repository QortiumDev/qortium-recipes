import { qdnRequest } from './qdnRequest';
import { buildRecipeIdentifier, RECIPE_IDENTIFIER_PREFIX, validateRecipe } from './recipe';
import type {
  AccountContext,
  PublishActionResult,
  PublishedRecipe,
  QdnResource,
  QdnSelectedAccount,
  RecipeV1,
} from './types';

export const RECIPE_SERVICE = 'JSON';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNames(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry : isRecord(entry) ? stringValue(entry.name) : ''))
    .filter(Boolean);
}

export function buildWritableNames(primaryName: unknown, accountNames: unknown) {
  const names = [stringValue(primaryName), ...normalizeNames(accountNames)].filter(Boolean);
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export async function loadAccountContext(): Promise<AccountContext> {
  const account = await qdnRequest<QdnSelectedAccount>({ action: 'GET_SELECTED_ACCOUNT' });
  let accountNames: unknown = [];

  if (account?.address) {
    try {
      accountNames = await qdnRequest({ action: 'GET_ACCOUNT_NAMES', address: account.address });
    } catch {
      // The primary name still provides the normal publish path.
    }
  }

  return {
    account,
    writableNames: buildWritableNames(account?.name, accountNames),
  };
}

export function canEditResource(resource: QdnResource, writableNames: string[]) {
  return writableNames.some((name) => name.toLowerCase() === resource.name.toLowerCase());
}

export async function searchRecipeResources(query = '', offset = 0, limit = 24): Promise<QdnResource[]> {
  const result = await qdnRequest<unknown>({
    action: 'SEARCH_QDN_RESOURCES',
    excludeBlocked: true,
    identifier: RECIPE_IDENTIFIER_PREFIX,
    includeMetadata: true,
    includeStatus: true,
    limit,
    mode: 'ALL',
    offset,
    prefix: true,
    query: query.trim(),
    reverse: true,
    service: RECIPE_SERVICE,
  });

  return Array.isArray(result)
    ? result.filter(
        (resource): resource is QdnResource =>
          isRecord(resource) &&
          resource.service === RECIPE_SERVICE &&
          typeof resource.name === 'string' &&
          typeof resource.identifier === 'string' &&
          resource.identifier.startsWith(RECIPE_IDENTIFIER_PREFIX),
      )
    : [];
}

export async function fetchPublishedRecipe(resource: QdnResource): Promise<PublishedRecipe> {
  const payload = await qdnRequest<unknown>({
    action: 'FETCH_QDN_RESOURCE',
    identifier: resource.identifier,
    maxBytes: 512_000,
    name: resource.name,
    service: RECIPE_SERVICE,
  });
  const validation = validateRecipe(payload);

  if (!validation.recipe) {
    throw new Error(validation.errors.join(' '));
  }

  return { recipe: validation.recipe, resource };
}

function utf8Base64(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function truncateUtf8(value: string, maxBytes: number) {
  const encoder = new TextEncoder();
  let result = '';
  for (const character of value) {
    const candidate = result + character;
    if (encoder.encode(candidate).byteLength > maxBytes) {
      break;
    }
    result = candidate;
  }
  return result;
}

export async function publishRecipe(name: string, recipe: RecipeV1) {
  const validation = validateRecipe({ ...recipe, updatedAt: Date.now() });
  if (!validation.recipe) {
    throw new Error(validation.errors.join(' '));
  }

  const payload = validation.recipe;
  const identifier = buildRecipeIdentifier(payload.id);
  const result = await qdnRequest<PublishActionResult>({
    action: 'PUBLISH_QDN_RESOURCE',
    base64: utf8Base64(payload),
    description: truncateUtf8(payload.description || `${payload.name} recipe`, 240),
    filename: 'recipe.json',
    identifier,
    name,
    service: RECIPE_SERVICE,
    tags: ['qrecipes', 'recipe', 'v1', ...payload.tags].slice(0, 5).map((tag) => truncateUtf8(tag, 20)),
    title: truncateUtf8(payload.name, 80),
  });

  return { identifier, payload, result };
}

function getStatus(resource: QdnResource | undefined) {
  if (!resource) {
    return '';
  }
  if (typeof resource.status === 'string') {
    return resource.status.toUpperCase();
  }
  return stringValue(resource.status?.status).toUpperCase();
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

export async function waitForRecipeReady(
  name: string,
  identifier: string,
  expectedSignature = '',
  timeoutMs = 90_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const result = await qdnRequest<QdnResource[]>({
        action: 'SEARCH_QDN_RESOURCES',
        identifier,
        includeMetadata: true,
        includeStatus: true,
        limit: 10,
        mode: 'ALL',
        name,
        prefix: false,
        reverse: true,
        service: RECIPE_SERVICE,
      });
      const resource = Array.isArray(result)
        ? result.find((candidate) => candidate.name === name && candidate.identifier === identifier)
        : undefined;
      const status = getStatus(resource);
      const matchesSignature = !expectedSignature || resource?.latestSignature === expectedSignature;

      if (status === 'READY' && matchesSignature) {
        return resource ?? null;
      }
      if (status === 'BLOCKED' || status === 'BUILD_FAILED') {
        throw new Error(`Published recipe entered ${status}.`);
      }
    } catch (error) {
      if (error instanceof Error && /BLOCKED|BUILD_FAILED/.test(error.message)) {
        throw error;
      }
    }
    await delay(750);
  }
  return null;
}
