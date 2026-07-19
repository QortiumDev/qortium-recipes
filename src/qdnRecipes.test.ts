import { describe, expect, it } from 'vitest';
import { buildWritableNames, truncateUtf8 } from './qdnRecipes';

describe('QDN recipe helpers', () => {
  it('collects writable names case-insensitively while preserving display case', () => {
    expect(
      buildWritableNames('Cook', ['cook', { name: 'Baker' }, { name: '' }, 'SecondName']),
    ).toEqual(['Cook', 'Baker', 'SecondName']);
  });

  it('truncates metadata by UTF-8 bytes without splitting characters', () => {
    expect(truncateUtf8('Soup 🍲 recipe', 9)).toBe('Soup 🍲');
    expect(new TextEncoder().encode(truncateUtf8('éééé', 5)).byteLength).toBeLessThanOrEqual(5);
  });
});
