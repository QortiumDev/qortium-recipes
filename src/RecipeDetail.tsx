import { useMemo, useState } from 'react';
import { composeIngredientText, recipeImageUrl, toSchemaOrgRecipe } from './recipe';
import type { PublishedRecipe, RecipeV1 } from './types';

function formatMinutes(minutes: number | null) {
  if (minutes === null) {
    return '';
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} hr${remainder ? ` ${remainder} min` : ''}`;
}

function downloadSchemaOrg(recipe: RecipeV1, publisher: string) {
  const blob = new Blob([JSON.stringify(toSchemaOrgRecipe(recipe, publisher), null, 2)], {
    type: 'application/ld+json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${recipe.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'recipe'}.jsonld`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RecipeDetail({
  canEdit,
  favorite,
  onBack,
  onEdit,
  onToggleFavorite,
  published,
}: {
  canEdit: boolean;
  favorite: boolean;
  onBack: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
  published: PublishedRecipe;
}) {
  const { recipe, resource } = published;
  const [factor, setFactor] = useState(1);
  const selectedServings = recipe.baseServings ? recipe.baseServings * factor : null;
  const totalMinutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  const imageUrl = useMemo(() => recipeImageUrl(recipe.image), [recipe.image]);

  function setServings(value: string) {
    const servings = Number(value);
    if (recipe.baseServings && Number.isFinite(servings) && servings > 0) {
      setFactor(servings / recipe.baseServings);
    }
  }

  return (
    <section className="detail-view">
      <div className="detail-actions">
        <button className="button button--ghost" type="button" onClick={onBack}>
          <span aria-hidden="true" className="back-arrow">←</span> Browse
        </button>
        <div>
          <button className="button button--ghost" type="button" onClick={() => downloadSchemaOrg(recipe, resource.name)}>
            Export JSON-LD
          </button>
          <button className="button button--ghost" type="button" onClick={onToggleFavorite}>
            {favorite ? '★ Favorited' : '☆ Favorite'}
          </button>
          {canEdit ? <button className="button" type="button" onClick={onEdit}>Edit recipe</button> : null}
        </div>
      </div>

      <article className="recipe-detail">
        {imageUrl ? <img className="recipe-hero" src={imageUrl} alt="" /> : null}
        <div className="recipe-detail__header">
          <p className="eyebrow">Published by {resource.name}</p>
          <h1>{recipe.name}</h1>
          {recipe.description ? <p className="lede">{recipe.description}</p> : null}
          <div className="recipe-facts">
            {recipe.yieldText || recipe.baseServings ? (
              <span><strong>Yield</strong>{recipe.yieldText || `${recipe.baseServings} servings`}</span>
            ) : null}
            {recipe.prepMinutes !== null ? <span><strong>Prep</strong>{formatMinutes(recipe.prepMinutes)}</span> : null}
            {recipe.cookMinutes !== null ? <span><strong>Cook</strong>{formatMinutes(recipe.cookMinutes)}</span> : null}
            {totalMinutes ? <span><strong>Total</strong>{formatMinutes(totalMinutes)}</span> : null}
            {recipe.category ? <span><strong>Category</strong>{recipe.category}</span> : null}
            {recipe.cuisine ? <span><strong>Cuisine</strong>{recipe.cuisine}</span> : null}
          </div>
          {recipe.tags.length ? <div className="tag-row">{recipe.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div> : null}
        </div>

        <div className="recipe-columns">
          <section>
            <div className="section-title-row">
              <h2>Ingredients</h2>
              <div className="scale-controls" aria-label="Recipe scale">
                {[0.5, 1, 2].map((value) => (
                  <button
                    className={Math.abs(factor - value) < 0.001 ? 'scale-button active' : 'scale-button'}
                    type="button"
                    key={value}
                    onClick={() => setFactor(value)}
                  >
                    {value === 0.5 ? '½×' : `${value}×`}
                  </button>
                ))}
                {recipe.baseServings ? (
                  <label className="servings-field">
                    <span>Servings</span>
                    <input type="number" min="0.25" step="0.25" value={selectedServings ?? ''} onChange={(event) => setServings(event.target.value)} />
                  </label>
                ) : null}
              </div>
            </div>
            <ul className="ingredient-list">
              {recipe.ingredients.map((ingredient) => (
                <li key={ingredient.id}>
                  <span>{composeIngredientText(ingredient, factor)}</span>
                  {factor !== 1 && !ingredient.scalable ? <small>unchanged</small> : null}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Directions</h2>
            <ol className="instruction-list">
              {recipe.instructions.map((instruction, index) => <li key={`${index}-${instruction}`}>{instruction}</li>)}
            </ol>
          </section>
        </div>

        {recipe.notes.length ? (
          <section className="notes-section">
            <h2>Notes</h2>
            {recipe.notes.map((note, index) => <p key={`${index}-${note}`}>{note}</p>)}
          </section>
        ) : null}

        {recipe.source.name || recipe.source.url ? (
          <footer className="source-line">
            <strong>Source or inspiration:</strong>{' '}
            {recipe.source.url && /^https?:\/\//i.test(recipe.source.url) ? (
              <a href={recipe.source.url} target="_blank" rel="noreferrer">{recipe.source.name || recipe.source.url}</a>
            ) : recipe.source.name || recipe.source.url}
          </footer>
        ) : null}
      </article>
    </section>
  );
}
