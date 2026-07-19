import type { QdnResource } from './types';

function formatDate(value: number | null | undefined) {
  if (!value) {
    return '';
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

function statusLabel(resource: QdnResource) {
  if (typeof resource.status === 'string') {
    return resource.status;
  }
  return resource.status?.status || 'listed';
}

export function RecipeCard({
  favorite,
  onOpen,
  resource,
}: {
  favorite: boolean;
  onOpen: () => void;
  resource: QdnResource;
}) {
  const metadata = resource.metadata ?? {};
  const date = formatDate(resource.updated || resource.created);

  return (
    <button className="recipe-card" type="button" onClick={onOpen}>
      <span className="recipe-card__topline">
        <span className="recipe-card__publisher">{resource.name}</span>
        {favorite ? <span aria-label="Favorite" title="Favorite">★</span> : null}
      </span>
      <strong>{metadata.title || 'Untitled recipe'}</strong>
      <span className="recipe-card__description">{metadata.description || 'No description provided.'}</span>
      <span className="recipe-card__footer">
        <span>{date}</span>
        <span className="status-pill">{statusLabel(resource)}</span>
      </span>
      {metadata.tags?.length ? (
        <span className="tag-row">
          {metadata.tags.filter((tag) => !['qrecipes', 'recipe', 'v1'].includes(tag)).map((tag) => (
            <span className="tag" key={tag}>{tag}</span>
          ))}
        </span>
      ) : null}
    </button>
  );
}
