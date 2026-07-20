import { useMemo, useState } from 'react';
import {
  createBlankRecipe,
  parseIngredientLine,
  parseIngredientLines,
  RECIPE_MEDIA_LIMIT,
  recipeImageUrl,
  rebuildIngredientText,
  validateRecipe,
} from './recipe';
import type { RecipeIngredient, RecipeMedia, RecipeMediaPlacement, RecipeV1 } from './types';

function numberValue(value: string) {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function cloneRecipe(recipe: RecipeV1) {
  const cloned = JSON.parse(JSON.stringify(recipe)) as RecipeV1;
  const images = [...new Set([
    cloned.image,
    ...(Array.isArray(cloned.images) ? cloned.images : []),
  ].map((image) => image?.trim()).filter((image): image is string => !!image))];
  const media = cloned.media?.length ? cloned.media : images.map((uri, index) => ({
    id: `legacy-image-${index + 1}`,
    uri,
    alt: '',
    caption: '',
    placement: { type: index === 0 ? 'cover' : 'gallery' } as RecipeMediaPlacement,
  }));
  return { ...cloned, image: images[0] ?? '', images, media };
}

function syncLegacyImages(media: RecipeMedia[]) {
  const cover = media.find((item) => item.placement.type === 'cover');
  const images = [...new Set(media.map((item) => item.uri.trim()).filter(Boolean))];
  const image = cover?.uri.trim() || images[0] || '';
  return { image, images: image ? [image, ...images.filter((uri) => uri !== image)] : images };
}

function encodePlacement(placement: RecipeMediaPlacement) {
  if (placement.type === 'section') {
    return `section:${placement.section}:${placement.position}`;
  }
  if (placement.type === 'instruction') {
    return `instruction:${placement.instructionIndex}:${placement.position}`;
  }
  return placement.type;
}

function decodePlacement(value: string): RecipeMediaPlacement {
  const [type, detail, position] = value.split(':');
  if (type === 'section' && (detail === 'ingredients' || detail === 'notes') && (position === 'before' || position === 'after')) {
    return { type, section: detail, position };
  }
  if (type === 'instruction' && (position === 'before' || position === 'after')) {
    return { type, instructionIndex: Math.max(0, Number.parseInt(detail, 10) || 0), position };
  }
  return type === 'cover' ? { type } : { type: 'gallery' };
}

export function RecipeEditor({
  canPublish,
  initialRecipe,
  isPublishing,
  onCancel,
  onPublish,
  onSaveDraft,
  publishName,
}: {
  canPublish: boolean;
  initialRecipe?: RecipeV1 | null;
  isPublishing: boolean;
  onCancel: () => void;
  onPublish: (recipe: RecipeV1) => void;
  onSaveDraft: (recipe: RecipeV1) => void;
  publishName: string;
}) {
  const [recipe, setRecipe] = useState(() => cloneRecipe(initialRecipe ?? createBlankRecipe()));
  const [ingredientPaste, setIngredientPaste] = useState('');
  const [mediaPaste, setMediaPaste] = useState('');
  const validation = useMemo(() => validateRecipe(recipe), [recipe]);

  function patchRecipe(patch: Partial<RecipeV1>) {
    setRecipe((current) => ({ ...current, ...patch, updatedAt: Date.now() }));
  }

  function addIngredientLines() {
    const parsed = parseIngredientLines(ingredientPaste);
    if (!parsed.length) {
      return;
    }
    patchRecipe({ ingredients: [...recipe.ingredients, ...parsed] });
    setIngredientPaste('');
  }

  function patchIngredient(index: number, patch: Partial<RecipeIngredient>, rebuild = false) {
    const ingredients = recipe.ingredients.map((ingredient, ingredientIndex) => {
      if (ingredientIndex !== index) {
        return ingredient;
      }
      const next = { ...ingredient, ...patch };
      return rebuild ? { ...next, text: rebuildIngredientText(next) } : next;
    });
    patchRecipe({ ingredients });
  }

  function reparseIngredient(index: number) {
    const current = recipe.ingredients[index];
    const parsed = parseIngredientLine(current.text, current.id);
    if (parsed) {
      patchIngredient(index, parsed);
    }
  }

  function removeIngredient(index: number) {
    patchRecipe({ ingredients: recipe.ingredients.filter((_ingredient, ingredientIndex) => ingredientIndex !== index) });
  }

  function patchMedia(nextMedia: RecipeMedia[]) {
    patchRecipe({ media: nextMedia, ...syncLegacyImages(nextMedia) });
  }

  function addMediaUris() {
    const existingUris = new Set(recipe.media.map((item) => item.uri));
    const available = Math.max(0, RECIPE_MEDIA_LIMIT - recipe.media.length);
    const uris = mediaPaste.split(/\r?\n/).map((uri) => uri.trim()).filter((uri) => uri && !existingUris.has(uri)).slice(0, available);
    if (!uris.length) {
      return;
    }
    const hasCover = recipe.media.some((item) => item.placement.type === 'cover');
    const added = uris.map((uri, index): RecipeMedia => ({
      id: `media-${Date.now().toString(36)}-${index + 1}`,
      uri,
      alt: '',
      caption: '',
      placement: !hasCover && index === 0 ? { type: 'cover' } : { type: 'gallery' },
    }));
    patchMedia([...recipe.media, ...added]);
    setMediaPaste('');
  }

  function updateMedia(index: number, patch: Partial<RecipeMedia>) {
    patchMedia(recipe.media.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function updateMediaPlacement(index: number, placement: RecipeMediaPlacement) {
    patchMedia(recipe.media.map((item, itemIndex) => {
      if (itemIndex === index) {
        return { ...item, placement };
      }
      if (placement.type === 'cover' && item.placement.type === 'cover') {
        return { ...item, placement: { type: 'gallery' } };
      }
      return item;
    }));
  }

  function removeMedia(index: number) {
    patchMedia(recipe.media.filter((_item, itemIndex) => itemIndex !== index));
  }

  function completeRecipe() {
    return { ...recipe, updatedAt: Date.now() };
  }

  return (
    <section className="editor-view">
      <div className="editor-heading">
        <div>
          <p className="eyebrow">{initialRecipe?.name ? 'Edit recipe' : 'New recipe'}</p>
          <h1>{recipe.name || 'Untitled recipe'}</h1>
        </div>
        <button className="button button--ghost" type="button" onClick={onCancel}>Cancel</button>
      </div>

      <div className="editor-grid">
        <section className="form-card">
          <h2>Basics</h2>
          <label className="field field--wide">
            <span>Recipe name *</span>
            <input value={recipe.name} maxLength={200} onChange={(event) => patchRecipe({ name: event.target.value })} />
          </label>
          <label className="field field--wide">
            <span>Description</span>
            <textarea rows={3} value={recipe.description} onChange={(event) => patchRecipe({ description: event.target.value })} />
          </label>
          <div className="field-pair">
            <label className="field">
              <span>Base servings</span>
              <input type="number" min="0.25" step="0.25" value={recipe.baseServings ?? ''} onChange={(event) => patchRecipe({ baseServings: numberValue(event.target.value) })} />
            </label>
            <label className="field">
              <span>Yield text</span>
              <input placeholder="12 servings or 1 loaf" value={recipe.yieldText} onChange={(event) => patchRecipe({ yieldText: event.target.value })} />
            </label>
          </div>
          <div className="field-pair">
            <label className="field">
              <span>Prep minutes</span>
              <input type="number" min="0" value={recipe.prepMinutes ?? ''} onChange={(event) => patchRecipe({ prepMinutes: numberValue(event.target.value) })} />
            </label>
            <label className="field">
              <span>Cook minutes</span>
              <input type="number" min="0" value={recipe.cookMinutes ?? ''} onChange={(event) => patchRecipe({ cookMinutes: numberValue(event.target.value) })} />
            </label>
          </div>
          <div className="field-pair">
            <label className="field">
              <span>Category</span>
              <input placeholder="Soup, dessert, bread…" value={recipe.category} onChange={(event) => patchRecipe({ category: event.target.value })} />
            </label>
            <label className="field">
              <span>Cuisine</span>
              <input placeholder="Italian, Ethiopian…" value={recipe.cuisine} onChange={(event) => patchRecipe({ cuisine: event.target.value })} />
            </label>
          </div>
          <label className="field field--wide">
            <span>Tags <small>comma separated</small></span>
            <input value={recipe.tags.join(', ')} onChange={(event) => patchRecipe({ tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} />
          </label>
        </section>

        <section className="form-card">
          <h2>Source and attribution</h2>
          <label className="field field--wide">
            <span>Source name</span>
            <input placeholder="Family recipe, adapted from…" value={recipe.source.name} onChange={(event) => patchRecipe({ source: { ...recipe.source, name: event.target.value } })} />
          </label>
          <label className="field field--wide">
            <span>Source URL</span>
            <input type="url" value={recipe.source.url} onChange={(event) => patchRecipe({ source: { ...recipe.source, url: event.target.value } })} />
          </label>
          <div className={validation.errors.length ? 'validation-box validation-box--error' : 'validation-box validation-box--good'}>
            <strong>{validation.errors.length ? 'Before publishing' : 'Ready to publish'}</strong>
            {validation.errors.length ? <ul>{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul> : <p>The recipe has the required title, ingredients, and directions.</p>}
          </div>
        </section>

        <section className="form-card form-card--ingredients">
          <h2>Ingredients *</h2>
          <p className="helper">Paste one ingredient per line. Obvious quantities are detected for scaling; every original line is preserved.</p>
          <textarea
            rows={5}
            value={ingredientPaste}
            onChange={(event) => setIngredientPaste(event.target.value)}
            placeholder={'1 1/2 cups lentils\n2 onions\nsalt to taste'}
          />
          <button className="button button--secondary" type="button" onClick={addIngredientLines}>Add ingredient lines</button>

          <div className="ingredient-editor-list">
            {recipe.ingredients.map((ingredient, index) => (
              <article className="ingredient-editor" key={ingredient.id}>
                <div className="ingredient-editor__line">
                  <label className="field field--wide">
                    <span>Original line</span>
                    <input value={ingredient.text} onChange={(event) => patchIngredient(index, { text: event.target.value })} />
                  </label>
                  <button className="text-button" type="button" onClick={() => reparseIngredient(index)}>Reparse</button>
                  <button className="text-button text-button--danger" type="button" onClick={() => removeIngredient(index)}>Remove</button>
                </div>
                <div className="ingredient-fields">
                  <label className="field">
                    <span>Amount</span>
                    <input type="number" min="0" step="any" value={ingredient.amount ?? ''} onChange={(event) => patchIngredient(index, { amount: numberValue(event.target.value), scalable: numberValue(event.target.value) !== null }, true)} />
                  </label>
                  <label className="field">
                    <span>Maximum</span>
                    <input type="number" min="0" step="any" value={ingredient.amountMax ?? ''} onChange={(event) => patchIngredient(index, { amountMax: numberValue(event.target.value) }, true)} />
                  </label>
                  <label className="field">
                    <span>Unit</span>
                    <input value={ingredient.unit} onChange={(event) => patchIngredient(index, { unit: event.target.value }, true)} />
                  </label>
                  <label className="field ingredient-item-field">
                    <span>Ingredient and notes</span>
                    <input value={ingredient.item} onChange={(event) => patchIngredient(index, { item: event.target.value }, true)} />
                  </label>
                  <label className="check-field">
                    <input type="checkbox" checked={ingredient.scalable} disabled={ingredient.amount === null} onChange={(event) => patchIngredient(index, { scalable: event.target.checked })} />
                    <span>Scale this amount</span>
                  </label>
                </div>
              </article>
            ))}
            {!recipe.ingredients.length ? <div className="empty-state">No ingredients added yet.</div> : null}
          </div>
        </section>

        <section className="form-card form-card--wide">
          <h2>Directions *</h2>
          <p className="helper">Use one step per line.</p>
          <textarea rows={9} value={recipe.instructions.join('\n')} onChange={(event) => patchRecipe({ instructions: event.target.value.split(/\r?\n/) })} />
          <h2 className="subheading">Notes</h2>
          <textarea rows={4} value={recipe.notes.join('\n')} onChange={(event) => patchRecipe({ notes: event.target.value.split(/\r?\n/) })} placeholder="Storage, substitutions, serving ideas…" />
        </section>

        <section className="form-card form-card--wide">
          <h2>Images</h2>
          <p className="helper">Paste one QDN image URI per line, then choose where each image appears. The first image becomes the cover by default. Up to {RECIPE_MEDIA_LIMIT} images are supported.</p>
          <label className="field field--wide">
            <span>Add QDN image URIs</span>
            <textarea
              rows={4}
              placeholder={'qdn://IMAGE/Name/cover\nqdn://IMAGE/Name/step-1'}
              value={mediaPaste}
              onChange={(event) => setMediaPaste(event.target.value)}
            />
          </label>
          <button className="button button--secondary media-add-button" type="button" disabled={recipe.media.length >= RECIPE_MEDIA_LIMIT} onClick={addMediaUris}>Add images</button>
          <div className="media-editor-list">
            {recipe.media.map((item, index) => (
              <article className="media-editor" key={item.id}>
                <div className="media-editor__preview">
                  {item.uri ? <img src={recipeImageUrl(item.uri)} alt="" /> : <span>No preview</span>}
                </div>
                <div className="media-editor__fields">
                  <label className="field field--wide">
                    <span>QDN image URI</span>
                    <input value={item.uri} onChange={(event) => updateMedia(index, { uri: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Show this image</span>
                    <select value={encodePlacement(item.placement)} onChange={(event) => updateMediaPlacement(index, decodePlacement(event.target.value))}>
                      <option value="cover">Cover</option>
                      <option value="gallery">General gallery</option>
                      <option value="section:ingredients:before">Before Ingredients</option>
                      <option value="section:ingredients:after">After Ingredients</option>
                      {recipe.instructions.filter((instruction) => instruction.trim()).map((_instruction, stepIndex) => (
                        <optgroup label={`Step ${stepIndex + 1}`} key={`step-${stepIndex}`}>
                          <option value={`instruction:${stepIndex}:before`}>Before step {stepIndex + 1}</option>
                          <option value={`instruction:${stepIndex}:after`}>After step {stepIndex + 1}</option>
                        </optgroup>
                      ))}
                      <option value="section:notes:before">Before Notes</option>
                      <option value="section:notes:after">After Notes</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Caption <small>optional</small></span>
                    <input value={item.caption} onChange={(event) => updateMedia(index, { caption: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Alt text <small>optional but recommended</small></span>
                    <input value={item.alt} onChange={(event) => updateMedia(index, { alt: event.target.value })} />
                  </label>
                  <button className="text-button text-button--danger media-editor__remove" type="button" onClick={() => removeMedia(index)}>Remove image</button>
                </div>
              </article>
            ))}
            {!recipe.media.length ? <div className="empty-state">No images added yet.</div> : null}
          </div>
        </section>

      </div>

      <footer className="editor-footer">
        <span>{publishName ? `Publishing name: ${publishName}` : 'Publishing requires a selected account with a registered name.'}</span>
        <div>
          <button className="button button--ghost" type="button" disabled={isPublishing} onClick={() => onSaveDraft(completeRecipe())}>Save local draft</button>
          <button className="button" type="button" disabled={!canPublish || !!validation.errors.length || isPublishing} onClick={() => onPublish(completeRecipe())}>
            {isPublishing ? 'Publishing…' : 'Publish to QDN'}
          </button>
        </div>
      </footer>
    </section>
  );
}
