// Intentionally outside localization: the Developers reference stays always-English.
import { useEffect, type MouseEvent } from 'react';
import { buildRecipeRoute } from './recipeRoute';

export const REFERENCE_SECTIONS = [
  ['reference-schema', 'Schema'],
  ['reference-fields', 'Fields'],
  ['reference-media', 'Media'],
  ['reference-scaling', 'Scaling'],
  ['reference-qdn', 'QDN lifecycle'],
  ['reference-bridge', 'Bridge'],
  ['reference-interchange', 'Interchange'],
  ['reference-privacy', 'Privacy'],
] as const;

export type ReferenceSectionId = (typeof REFERENCE_SECTIONS)[number][0];

// The app root every view renders; section navigation never scrolls above it.
const APP_ROOT_SELECTOR = '.app-shell';

// Minimal shapes so the scroll logic can be exercised without a DOM.
// Method signatures (not arrow properties) so the real Document/Window satisfy them.
export type ReferenceElement = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  parentElement: ReferenceElement | null;
  getBoundingClientRect(): { top: number };
  closest?(selector: string): ReferenceElement | null;
  focus?(options?: { preventScroll?: boolean }): void;
};

export type ReferenceDocument = {
  getElementById(id: string): ReferenceElement | null;
  scrollingElement: ReferenceElement | null;
  documentElement: ReferenceElement;
};

export type ReferenceWindow = {
  location: { href: string; pathname: string; search: string; hash: string };
  history: {
    state: unknown;
    pushState(state: unknown, unused: string, url: string): void;
    replaceState(state: unknown, unused: string, url: string): void;
  };
  getComputedStyle(element: ReferenceElement): { overflowY: string; scrollMarginTop: string };
};

export function isReferenceSectionId(value: string): value is ReferenceSectionId {
  return REFERENCE_SECTIONS.some(([id]) => id === value);
}

// Build a document link, never a bare `#fragment`: under Core's injected
// `<base>` a bare fragment resolves against the render base and can navigate
// away from `?view=developers`. The route helper keeps Home's own query keys.
export function referenceSectionUrl(href: string, id: ReferenceSectionId) {
  const url = new URL(href, 'http://localhost');
  url.hash = id;
  return buildRecipeRoute({ view: 'developers' }, url.href);
}

function isScrollContainer(element: ReferenceElement, windowRef: ReferenceWindow) {
  return /(auto|scroll)/.test(windowRef.getComputedStyle(element).overflowY)
    && element.scrollHeight > element.clientHeight;
}

// Scroll the section into view inside the app only. Recipes' styles.css sets no
// overflow-y on any layout container at wide or narrow widths, so the app
// document itself is the scroll owner; the walk still honours a scrolling
// ancestor if one is ever introduced, bounded at the app root. Never call
// scrollIntoView: inside Home on Android that can move the outer document.
export function scrollReferenceSection(
  hash: string,
  documentRef: ReferenceDocument = document,
  windowRef: ReferenceWindow = window,
) {
  const id = hash.replace(/^#/, '');
  if (!isReferenceSectionId(id)) {
    return false;
  }
  const section = documentRef.getElementById(id);
  if (!section) {
    return false;
  }

  const root = section.closest?.(APP_ROOT_SELECTOR) ?? null;
  let container = section.parentElement;
  while (container && container !== root && !isScrollContainer(container, windowRef)) {
    container = container.parentElement;
  }

  const margin = parseFloat(windowRef.getComputedStyle(section).scrollMarginTop) || 0;
  const sectionTop = section.getBoundingClientRect().top - margin;
  if (container && container !== root) {
    container.scrollTop += sectionTop - container.getBoundingClientRect().top;
  } else {
    const scroller = documentRef.scrollingElement ?? documentRef.documentElement;
    scroller.scrollTop += sectionTop;
  }
  section.focus?.({ preventScroll: true });
  return true;
}

export function navigateToReferenceSection(
  id: ReferenceSectionId,
  documentRef: ReferenceDocument = document,
  windowRef: ReferenceWindow = window,
) {
  const next = referenceSectionUrl(windowRef.location.href, id);
  if (windowRef.location.hash !== `#${id}`) {
    windowRef.history.pushState(windowRef.history.state, '', next);
  }
  scrollReferenceSection(id, documentRef, windowRef);
}

// Rewrite `?view=developer` / `?view=reference` to the canonical route without
// adding a history entry, keeping any hash and Home's parameters.
export function canonicalizeReferenceLocation(windowRef: ReferenceWindow = window) {
  const { pathname, search, hash, href } = windowRef.location;
  const canonical = buildRecipeRoute({ view: 'developers' }, href);
  if (canonical !== `${pathname}${search}${hash}`) {
    windowRef.history.replaceState(windowRef.history.state, '', canonical);
  }
  return canonical;
}

export function ReferenceNavigation() {
  useEffect(() => {
    canonicalizeReferenceLocation();
    const onLocationChange = () => scrollReferenceSection(window.location.hash);
    onLocationChange();
    window.addEventListener('popstate', onLocationChange);
    window.addEventListener('hashchange', onLocationChange);
    return () => {
      window.removeEventListener('popstate', onLocationChange);
      window.removeEventListener('hashchange', onLocationChange);
    };
  }, []);

  function visit(event: MouseEvent<HTMLAnchorElement>, id: ReferenceSectionId) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    navigateToReferenceSection(id);
  }

  const href = typeof window === 'undefined' ? '/?view=developers' : window.location.href;
  return (
    <nav aria-label="Developer reference sections" className="reference-toc">
      {REFERENCE_SECTIONS.map(([id, label]) => (
        <a href={referenceSectionUrl(href, id)} key={id} onClick={(event) => visit(event, id)}>
          {label}
        </a>
      ))}
    </nav>
  );
}
