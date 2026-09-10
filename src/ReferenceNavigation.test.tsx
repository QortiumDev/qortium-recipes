import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  canonicalizeReferenceLocation,
  navigateToReferenceSection,
  REFERENCE_SECTIONS,
  ReferenceNavigation,
  referenceSectionUrl,
  scrollReferenceSection,
  type ReferenceDocument,
  type ReferenceElement,
  type ReferenceWindow,
} from './ReferenceNavigation';
import { parseRecipeRoute } from './recipeRoute';

type FakeElement = ReferenceElement & { overflowY: string; scrollMarginTop: string; top: number; isRoot?: boolean };

function element(partial: Partial<FakeElement> = {}): FakeElement {
  const node: FakeElement = {
    scrollTop: 0, scrollHeight: 0, clientHeight: 0, parentElement: null,
    overflowY: 'visible', scrollMarginTop: '0px', top: 0,
    getBoundingClientRect: () => ({ top: node.top }),
    closest: (selector) => {
      let current: FakeElement | null = node;
      while (current && !(selector === '.app-shell' && current.isRoot)) current = current.parentElement as FakeElement | null;
      return current;
    },
    focus: vi.fn(),
    ...partial,
  };
  return node;
}

function fakeWindow(href: string): ReferenceWindow {
  const url = new URL(href);
  return {
    location: { href, pathname: url.pathname, search: url.search, hash: url.hash },
    history: { state: { home: 'entry' }, pushState: vi.fn(), replaceState: vi.fn() },
    getComputedStyle: (target) => {
      const { overflowY, scrollMarginTop } = target as FakeElement;
      return { overflowY, scrollMarginTop };
    },
  };
}

function fakeDocument(section: FakeElement | null, scrollingElement = element()): ReferenceDocument {
  return {
    getElementById: (id) => (section && id === 'reference-fields' ? section : null),
    scrollingElement,
    documentElement: scrollingElement,
  };
}

describe('Home-safe reference section navigation', () => {
  it('builds document links that survive Core base URLs and keep Home parameters', () => {
    const href = referenceSectionUrl(
      'https://node.test/render/APP/Recipes/Recipes?view=reference&recipe=stale&author=old&theme=dark&qdnHomeBridge=fixture&future=a&future=b#old',
      'reference-media',
    );
    const target = new URL(href, 'https://node.test/render/APP/Recipes/Recipes/');
    expect(href.startsWith('/')).toBe(true);
    expect(target.pathname).toBe('/render/APP/Recipes/Recipes');
    expect(target.searchParams.getAll('view')).toEqual(['developers']);
    expect(target.searchParams.has('recipe')).toBe(false);
    expect(target.searchParams.has('author')).toBe(false);
    expect(target.searchParams.get('theme')).toBe('dark');
    expect(target.searchParams.get('qdnHomeBridge')).toBe('fixture');
    expect(target.searchParams.getAll('future')).toEqual(['a', 'b']);
    expect(target.hash).toBe('#reference-media');
    expect(parseRecipeRoute(target.search)).toEqual({ view: 'developers' });
  });

  it('renders real document links for every section rather than bare fragments', () => {
    const html = renderToStaticMarkup(<ReferenceNavigation />);
    expect(html).toContain('aria-label="Developer reference sections"');
    for (const [id, label] of REFERENCE_SECTIONS) {
      expect(html).toContain(`<a href="/?view=developers#${id}">${label}</a>`);
    }
    expect(html).not.toContain('href="#');
  });

  it('scrolls the app document itself when no ancestor inside the app root scrolls', () => {
    // Recipes' styles.css sets no overflow-y on .workspace or .app-shell, so the
    // document is the scroll owner at every width.
    const root = element({ isRoot: true, overflowY: 'visible' });
    const workspace = element({ parentElement: root });
    const section = element({ parentElement: workspace, top: 500, scrollMarginTop: '24px' });
    const scroller = element({ scrollTop: 100 });
    const windowRef = fakeWindow('https://node.test/render/APP/Recipes/Recipes?view=developers#reference-fields');

    expect(scrollReferenceSection('#reference-fields', fakeDocument(section, scroller), windowRef)).toBe(true);
    expect(scroller.scrollTop).toBe(576);
    expect(root.scrollTop).toBe(0);
    expect(workspace.scrollTop).toBe(0);
    expect(section.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('scrolls only the nearest scrolling ancestor inside the app root', () => {
    const root = element({ isRoot: true, overflowY: 'auto', scrollHeight: 5000, clientHeight: 800 });
    const panel = element({ parentElement: root, overflowY: 'auto', scrollHeight: 2000, clientHeight: 600, top: 80, scrollTop: 40 });
    const section = element({ parentElement: panel, top: 500, scrollMarginTop: '24px' });
    const scroller = element({ scrollTop: 100 });

    scrollReferenceSection('reference-fields', fakeDocument(section, scroller), fakeWindow('https://node.test/?view=developers'));
    expect(panel.scrollTop).toBe(436);
    expect(root.scrollTop).toBe(0);
    expect(scroller.scrollTop).toBe(100);
  });

  it('never scrolls the app root itself and ignores unknown or missing targets', () => {
    const root = element({ isRoot: true, overflowY: 'auto', scrollHeight: 5000, clientHeight: 800, scrollTop: 10 });
    const section = element({ parentElement: root, top: 300 });
    const scroller = element({ scrollTop: 0 });
    const windowRef = fakeWindow('https://node.test/?view=developers');

    expect(scrollReferenceSection('reference-fields', fakeDocument(section, scroller), windowRef)).toBe(true);
    expect(root.scrollTop).toBe(10);
    expect(scroller.scrollTop).toBe(300);

    expect(scrollReferenceSection('#not-a-section', fakeDocument(section, scroller), windowRef)).toBe(false);
    expect(scrollReferenceSection('#reference-fields', fakeDocument(null, scroller), windowRef)).toBe(false);
    expect(scroller.scrollTop).toBe(300);
  });

  it('pushes a canonical history entry on visit and skips the push when already there', () => {
    const root = element({ isRoot: true });
    const section = element({ parentElement: root, top: 120 });
    const scroller = element();
    const windowRef = fakeWindow('https://node.test/render/APP/Recipes/Recipes?view=reference&theme=dark#reference-schema');

    navigateToReferenceSection('reference-fields', fakeDocument(section, scroller), windowRef);
    expect(windowRef.history.pushState).toHaveBeenCalledWith(
      { home: 'entry' }, '', '/render/APP/Recipes/Recipes?theme=dark&view=developers#reference-fields',
    );
    expect(scroller.scrollTop).toBe(120);
    expect(section.focus).toHaveBeenCalledWith({ preventScroll: true });

    const same = fakeWindow('https://node.test/render/APP/Recipes/Recipes?view=developers#reference-fields');
    navigateToReferenceSection('reference-fields', fakeDocument(section, scroller), same);
    expect(same.history.pushState).not.toHaveBeenCalled();
    expect(scroller.scrollTop).toBe(240);
  });

  it('canonicalizes developer aliases on mount without adding history', () => {
    const aliased = fakeWindow('https://node.test/render/APP/Recipes/Recipes?view=reference&theme=dark#reference-media');
    expect(canonicalizeReferenceLocation(aliased)).toBe('/render/APP/Recipes/Recipes?theme=dark&view=developers#reference-media');
    expect(aliased.history.replaceState).toHaveBeenCalledWith(
      { home: 'entry' }, '', '/render/APP/Recipes/Recipes?theme=dark&view=developers#reference-media',
    );
    expect(aliased.history.pushState).not.toHaveBeenCalled();

    const canonical = fakeWindow('https://node.test/render/APP/Recipes/Recipes?theme=dark&view=developers#reference-media');
    canonicalizeReferenceLocation(canonical);
    expect(canonical.history.replaceState).not.toHaveBeenCalled();
  });
});
