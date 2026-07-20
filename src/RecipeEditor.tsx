import { useMemo, useState } from 'react';
import {
  createBlankRecipe,
  parseIngredientLine,
  parseIngredientLines,
  rebuildIngredientText,
  validateRecipe,
} from './recipe';
import type { RecipeIngredient, RecipeV1 } from './types';

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
  return { ...cloned, image: images[0] ?? '', images };
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
          <label className="field field--wide">
            <span>QDN image URIs <small>one per line; first is the cover</small></span>
            <textarea
              rows={4}
              placeholder={'qdn://IMAGE/Name/cover\nqdn://IMAGE/Name/step-1'}
              value={recipe.images.join('\n')}
              onChange={(event) => {
                const images = event.target.value.split('\n').map((image) => image.trim()).filter(Boolean);
                patchRecipe({ image: images[0] ?? '', images });
              }}
            />
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
