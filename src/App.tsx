import { FormEvent, useEffect, useMemo, useState } from 'react';
import { RecipeCard } from './RecipeCard';
import { RecipeDetail } from './RecipeDetail';
import { RecipeEditor } from './RecipeEditor';
import { Reference } from './Reference';
import {
  applyDisplaySettings,
  getDisplaySettingsUpdateFromMessage,
  getInitialDisplaySettings,
  normalizeHomeSettingsHostMessage,
} from './displaySettings';
import { getBridgeState, qdnRequest } from './qdnRequest';
import {
  canEditResource,
  fetchPublishedRecipe,
  fetchRecipeResource,
  loadAccountContext,
  publishRecipe,
  requireTransactionSignature,
  searchRecipeResources,
  waitForRecipeReady,
} from './qdnRecipes';
import { buildRecipeIdentifier } from './recipe';
import { copyTextToClipboard } from './clipboard';
import {
  buildRecipeLink,
  navigateRecipeRoute,
  parseRecipeRoute,
  subscribeToRecipeRoute,
  type RecipeRoute,
} from './recipeRoute';
import {
  deleteDraft,
  loadDrafts,
  loadFavorites,
  resourceFavoriteKey,
  saveDraft,
  saveFavorites,
} from './storage';
import type {
  AccountContext,
  BridgeState,
  NodeStatus,
  PublishedRecipe,
  QdnResource,
  RecipeV1,
} from './types';

function errorText(value: unknown) {
  return value instanceof Error ? value.message : String(value);
}

function hasAction(state: BridgeState | null, action: string) {
  return !!state?.actions.some((candidate) => candidate.toUpperCase() === action.toUpperCase());
}

function nodeStatusLabel(status: NodeStatus | null) {
  if (!status) {
    return 'Node unavailable';
  }
  if (typeof status.syncPercent === 'number') {
    return `${status.syncPercent}% synced`;
  }
  return status.syncPhase || 'Connected';
}

function metadataTitle(resource: QdnResource) {
  return resource.metadata?.title || 'Untitled recipe';
}

export function App() {
  const [route, setRoute] = useState<RecipeRoute>(() => parseRecipeRoute(window.location.search));
  const [, setDisplaySettings] = useState(getInitialDisplaySettings);
  const [bridgeState, setBridgeState] = useState<BridgeState | null>(null);
  const [nodeStatus, setNodeStatus] = useState<NodeStatus | null>(null);
  const [accountContext, setAccountContext] = useState<AccountContext>({ account: null, writableNames: [] });
  const [publishName, setPublishName] = useState('');
  const [resources, setResources] = useState<QdnResource[]>([]);
  const [drafts, setDrafts] = useState<RecipeV1[]>(() => loadDrafts());
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PublishedRecipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<RecipeV1 | null>(null);
  const [editingResource, setEditingResource] = useState<QdnResource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const view = route.view;
  const canPublish =
    !!publishName &&
    hasAction(bridgeState, 'PUBLISH_QDN_RESOURCE');
  const favoriteCount = favorites.size;

  function updateDisplaySettings(value: unknown) {
    setDisplaySettings((current) => {
      const next = getDisplaySettingsUpdateFromMessage(value, current);
      if (next) {
        applyDisplaySettings(next);
        return next;
      }
      return current;
    });
  }

  function showRoute(next: RecipeRoute, replace = false) {
    navigateRecipeRoute(next, replace);
    setRoute(next);
    window.scrollTo({ top: 0 });
  }

  function recipeRouteFor(resource: QdnResource): RecipeRoute | null {
    return resource.identifier
      ? { view: 'recipe', name: resource.name, identifier: resource.identifier }
      : null;
  }

  async function refreshResources(search = query) {
    const result = await searchRecipeResources(search);
    setResources(result);
  }

  async function initialize() {
    setIsLoading(true);
    setError('');
    try {
      const state = await getBridgeState();
      setBridgeState(state);

      if (hasAction(state, 'GET_HOME_SETTINGS')) {
        void qdnRequest<Record<string, unknown>>({ action: 'GET_HOME_SETTINGS' })
          .then((settings) => updateDisplaySettings({ action: 'DISPLAY_SETTINGS_CHANGED', ...settings }))
          .catch(() => undefined);
      }

      const [statusResult, resourceResult] = await Promise.allSettled([
        qdnRequest<NodeStatus>({ action: 'GET_NODE_STATUS' }),
        searchRecipeResources(),
      ]);
      if (statusResult.status === 'fulfilled') {
        setNodeStatus(statusResult.value);
      }
      if (resourceResult.status === 'fulfilled') {
        setResources(resourceResult.value);
      } else {
        throw resourceResult.reason;
      }

      if (state.actions.some((action) => action === 'GET_SELECTED_ACCOUNT')) {
        try {
          const context = await loadAccountContext();
          setAccountContext(context);
          setPublishName(context.account?.name || context.writableNames[0] || '');
        } catch {
          // Browsing remains fully available without selected-account context.
        }
      }
    } catch (initializationError) {
      setError(initializationError instanceof Error ? initializationError.message : String(initializationError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      updateDisplaySettings(normalizeHomeSettingsHostMessage(event.data));
    };
    const onSettingsChanged = (event: Event) => {
      updateDisplaySettings({
        action: 'DISPLAY_SETTINGS_CHANGED',
        ...(event as CustomEvent<Record<string, unknown>>).detail,
      });
    };
    // Back/Forward only re-derives state from the URL; it must not write history.
    const unsubscribeRoute = subscribeToRecipeRoute(setRoute);

    window.addEventListener('message', onMessage);
    window.addEventListener('qortiumHomeSettingsChanged', onSettingsChanged);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('qortiumHomeSettingsChanged', onSettingsChanged);
      unsubscribeRoute();
    };
  }, []);

  // Load whatever recipe the URL points at, whether that URL arrived from a
  // shared link, a reload, or a Back/Forward step.
  useEffect(() => {
    if (route.view !== 'recipe') {
      return;
    }
    const { identifier, name } = route;
    if (selected?.resource.name === name && selected?.resource.identifier === identifier) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError('');
    (async () => {
      try {
        const resource = await fetchRecipeResource(name, identifier);
        const published = await fetchPublishedRecipe(resource);
        if (!cancelled) {
          setSelected(published);
          window.scrollTo({ top: 0 });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(`Could not open the linked recipe. ${errorText(loadError)}`);
          // Replace the dead target so Back does not land back on it.
          setSelected(null);
          showRoute({ view: 'browse' }, true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [route, selected]);

  async function search(event: FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await refreshResources();
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : String(searchError));
    } finally {
      setIsLoading(false);
    }
  }

  async function openResource(resource: QdnResource) {
    const target = recipeRouteFor(resource);
    if (!target) {
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const published = await fetchPublishedRecipe(resource);
      // Seed the selection before routing so the deep-link effect sees a match
      // and does not refetch what we already hold.
      setSelected(published);
      showRoute(target);
    } catch (loadError) {
      setError(`Could not open ${metadataTitle(resource)}. ${errorText(loadError)}`);
    } finally {
      setIsLoading(false);
    }
  }

  function beginNewRecipe() {
    setEditingRecipe(null);
    setEditingResource(null);
    showRoute({ view: 'editor' });
  }

  function editPublished() {
    if (!selected) {
      return;
    }
    setEditingRecipe(selected.recipe);
    setEditingResource(selected.resource);
    showRoute({ view: 'editor' });
  }

  function editDraft(draft: RecipeV1) {
    setEditingRecipe(draft);
    setEditingResource(null);
    showRoute({ view: 'editor' });
  }

  function handleSaveDraft(recipe: RecipeV1) {
    saveDraft(recipe);
    setDrafts(loadDrafts());
    setNotice(`Saved “${recipe.name || 'Untitled recipe'}” on this device.`);
    showRoute({ view: 'browse' });
  }

  async function handlePublish(recipe: RecipeV1) {
    if (!canPublish) {
      return;
    }
    setIsPublishing(true);
    setError('');
    setNotice('');
    try {
      const publication = await publishRecipe(publishName, recipe);
      const transactionSignature = requireTransactionSignature(publication.result);
      const resource = await waitForRecipeReady(
        publishName,
        publication.identifier,
        transactionSignature,
      );
      if (!resource) {
        saveDraft(publication.payload);
        setDrafts(loadDrafts());
        setNotice('The publish request was submitted, but READY was not confirmed yet. The local draft was kept.');
        showRoute({ view: 'browse' }, true);
        return;
      }

      deleteDraft(recipe.id);
      setDrafts(loadDrafts());
      await refreshResources('');
      const published = await fetchPublishedRecipe(resource);
      setSelected(published);
      setNotice(`Published “${recipe.name}” under ${publishName}.`);
      // Replace, not push: Back from a fresh publish should not re-enter the editor.
      showRoute(recipeRouteFor(resource) ?? { view: 'browse' }, true);
    } catch (publishError) {
      saveDraft(recipe);
      setDrafts(loadDrafts());
      setError(publishError instanceof Error ? publishError.message : String(publishError));
    } finally {
      setIsPublishing(false);
    }
  }

  function toggleFavorite() {
    if (!selected?.resource.identifier) {
      return;
    }
    const key = resourceFavoriteKey(selected.resource.name, selected.resource.identifier);
    const next = new Set(favorites);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setFavorites(next);
    saveFavorites(next);
  }

  async function copyRecipeLink() {
    if (!selected?.resource.identifier) {
      return;
    }
    const link = buildRecipeLink(selected.resource.name, selected.resource.identifier);
    setError('');
    // On failure show the raw link rather than an error the user cannot act on.
    setNotice(
      (await copyTextToClipboard(link))
        ? 'Recipe link copied.'
        : `Copy was blocked. Recipe link: ${link}`,
    );
  }

  function isFavorite(resource: QdnResource) {
    return !!resource.identifier && favorites.has(resourceFavoriteKey(resource.name, resource.identifier));
  }

  const selectedFavorite = useMemo(() => selected ? isFavorite(selected.resource) : false, [selected, favorites]);

  const workspaceHeader = (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Qortium community cookbook</p>
          <h1>Recipes</h1>
          <p className="topbar__description">Share recipes that stay readable as written—and scale when quantities are structured.</p>
        </div>
        <div className="topbar__actions">
          {accountContext.writableNames.length > 1 ? (
            <label className="name-picker">
              <span>Publish as</span>
              <select value={publishName} onChange={(event) => setPublishName(event.target.value)}>
                {accountContext.writableNames.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
          ) : publishName ? <span className="account-chip">Publishing as {publishName}</span> : null}
          <button className="button" type="button" onClick={beginNewRecipe}>New recipe</button>
        </div>
      </header>
      <nav aria-label="Recipes workspaces" className="workspace-tabs">
        <button
          aria-current={view === 'browse' ? 'page' : undefined}
          className={view === 'browse' ? 'workspace-tab is-active' : 'workspace-tab'}
          onClick={() => showRoute({ view: 'browse' })}
          type="button"
        >
          Browse
        </button>
        <button
          aria-current={view === 'developers' ? 'page' : undefined}
          className={view === 'developers' ? 'workspace-tab is-active' : 'workspace-tab'}
          onClick={() => showRoute({ view: 'developers' })}
          type="button"
        >
          Developers
        </button>
      </nav>
    </>
  );

  if (view === 'developers') {
    return (
      <main className="app-shell">
        <div className="workspace">
          {workspaceHeader}
          <Reference />
          <footer className="app-footer">
            Recipes {__APP_VERSION__} · Always-English developer contract for{' '}
            <code>qortium.recipes.recipe.v1</code>.
          </footer>
        </div>
      </main>
    );
  }

  if (view === 'editor') {
    return (
      <main className="app-shell">
        <RecipeEditor
          canPublish={canPublish}
          initialRecipe={editingRecipe}
          isPublishing={isPublishing}
          onCancel={() => {
            // Return to the recipe the editor was opened from, not to Browse.
            const origin = selected ? recipeRouteFor(selected.resource) : null;
            showRoute(origin ?? { view: 'browse' }, true);
          }}
          onPublish={handlePublish}
          onSaveDraft={handleSaveDraft}
          publishName={publishName}
        />
      </main>
    );
  }

  if (view === 'recipe' && selected) {
    return (
      <main className="app-shell">
        {notice ? <div className="global-notice global-notice--success">{notice}</div> : null}
        <RecipeDetail
          canEdit={canEditResource(selected.resource, accountContext.writableNames)}
          favorite={selectedFavorite}
          onBack={() => showRoute({ view: 'browse' })}
          onCopyLink={copyRecipeLink}
          onEdit={editPublished}
          onToggleFavorite={toggleFavorite}
          published={selected}
        />
      </main>
    );
  }

  if (view === 'recipe') {
    // Deep link still resolving; `error` covers the target-not-found case.
    return (
      <main className="app-shell">
        <div className="workspace">
          {workspaceHeader}
          {error ? <div className="global-notice global-notice--error">{error}</div> : null}
          {isLoading ? <div className="global-notice">Opening recipe…</div> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="workspace">
        {workspaceHeader}

        <div className="runtime-strip">
          <span><strong>{nodeStatusLabel(nodeStatus)}</strong>{nodeStatus?.height ? ` · height ${nodeStatus.height.toLocaleString()}` : ''}</span>
          <span>{bridgeState?.isHomeBridge ? 'Qortium Home' : 'Browser preview'} · {resources.length} recipe{resources.length === 1 ? '' : 's'} · {favoriteCount} favorite{favoriteCount === 1 ? '' : 's'}</span>
        </div>

        {error ? <div className="global-notice global-notice--error">{error}</div> : null}
        {notice ? <div className="global-notice global-notice--success">{notice}</div> : null}
        {isLoading ? <div className="global-notice">Loading recipes…</div> : null}

        <section className="browse-layout">
          <div className="browse-main">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Published on QDN</p>
                <h2>Browse recipes</h2>
              </div>
              <form className="search-form" onSubmit={search}>
                <input aria-label="Search recipes" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, descriptions, or tags" />
                <button className="button button--secondary" type="submit">Search</button>
              </form>
            </div>

            <div className="recipe-grid">
              {resources.map((resource) => (
                <RecipeCard
                  favorite={isFavorite(resource)}
                  key={`${resource.name}:${resource.identifier}`}
                  onOpen={() => openResource(resource)}
                  resource={resource}
                />
              ))}
            </div>

            {!isLoading && !resources.length ? (
              <div className="empty-state empty-state--large">
                <strong>No Qortium Recipes have been found yet.</strong>
                <p>Create a local draft here. Publishing becomes available inside Qortium Home with a selected named account.</p>
                <button className="button" type="button" onClick={beginNewRecipe}>Create the first recipe</button>
              </div>
            ) : null}
          </div>

          <aside className="draft-panel">
            <div className="draft-panel__heading">
              <div>
                <p className="eyebrow">This device</p>
                <h2>Local drafts</h2>
              </div>
              <span>{drafts.length}</span>
            </div>
            <div className="draft-list">
              {drafts.map((draft) => (
                <article className="draft-item" key={draft.id}>
                  <button type="button" onClick={() => editDraft(draft)}>
                    <strong>{draft.name || 'Untitled recipe'}</strong>
                    <span>{draft.ingredients.length} ingredients · {draft.instructions.filter(Boolean).length} steps</span>
                  </button>
                  <button
                    className="text-button text-button--danger"
                    type="button"
                    onClick={() => {
                      deleteDraft(draft.id);
                      setDrafts(loadDrafts());
                    }}
                  >
                    Delete
                  </button>
                </article>
              ))}
              {!drafts.length ? <p className="helper">Drafts are stored only in this browser until you publish them.</p> : null}
            </div>
          </aside>
        </section>

        <footer className="app-footer">
          Recipes {__APP_VERSION__} · Data uses <code>qortium.recipes.recipe.v1</code> under{' '}
          <code>JSON/&lt;author&gt;/{buildRecipeIdentifier('<id>')}</code>.{' '}
          <button className="footer-link" type="button" onClick={() => showRoute({ view: 'developers' })}>
            Developer reference
          </button>
        </footer>
      </div>
    </main>
  );
}
