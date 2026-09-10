/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCENT_VALUES, DEFAULT_DISPLAY_SETTINGS } from './displaySettings';

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('Recipes stylesheet contract', () => {
  it('defines light and dark tokens for every non-default accent Home can send', () => {
    for (const accent of ACCENT_VALUES) {
      if (accent === DEFAULT_DISPLAY_SETTINGS.accent) continue;
      expect(css, accent).toContain(`:root[data-accent='${accent}'] {`);
      expect(css, accent).toContain(`:root[data-theme='dark'][data-accent='${accent}'] {`);
    }
  });

  it('keeps copy controls at the 44px touch target and announces copy status visibly', () => {
    expect(css).toMatch(/\.button \{\n  min-height: 44px;/);
    expect(css).toMatch(/\.reference-code > header \.button \{\n  min-height: 44px;/);
    expect(css).toContain('.reference-copy-status,\n.copy-status {');
    expect(css).toContain('.reference-section:focus-visible');
  });
});
