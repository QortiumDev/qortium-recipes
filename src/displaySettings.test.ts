import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyDisplaySettings,
  DEFAULT_DISPLAY_SETTINGS,
  getDisplaySettingsUpdateFromMessage,
  getInitialDisplaySettings,
  normalizeHomeSettingsHostMessage,
  normalizeUiStyle,
  type QdnDisplaySettings,
} from './displaySettings';

const current: QdnDisplaySettings = DEFAULT_DISPLAY_SETTINGS;

describe('Recipes display settings', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('accepts exactly the three current UI families', () => {
    expect(normalizeUiStyle('CLASSIC')).toBe('classic');
    expect(normalizeUiStyle('modern')).toBe('modern');
    expect(normalizeUiStyle('Fun')).toBe('fun');
    expect(normalizeUiStyle('retro')).toBeNull();
    expect(normalizeUiStyle('chibi')).toBeNull();
  });

  it('defaults to the Home-compatible Classic family', () => {
    vi.stubGlobal('window', { location: { search: '' } });
    expect(getInitialDisplaySettings()).toEqual(DEFAULT_DISPLAY_SETTINGS);
  });

  it('reads render URL settings before injected host globals', () => {
    vi.stubGlobal('window', {
      _qdnAccent: 'yellow',
      _qdnTheme: 'light',
      _qdnUiStyle: 'classic',
      location: { search: '?theme=dark&accent=purple&textSize=huge&lang=he&uiStyle=fun' },
    });
    expect(getInitialDisplaySettings()).toEqual({
      accent: 'purple',
      language: 'he',
      textSize: 'huge',
      theme: 'dark',
      uiStyle: 'fun',
    });
  });

  it('updates every setting through the bulk Home contract', () => {
    expect(getDisplaySettingsUpdateFromMessage({
      action: 'DISPLAY_SETTINGS_CHANGED',
      accent: 'cyan',
      language: 'ar',
      textSize: 'large',
      theme: 'dark',
      ui: 'modern',
    }, current)).toEqual({
      accent: 'cyan',
      language: 'ar',
      textSize: 'large',
      theme: 'dark',
      uiStyle: 'modern',
    });
  });

  it('handles individual UI messages and rejects unrelated handlers', () => {
    expect(getDisplaySettingsUpdateFromMessage(
      { requestedHandler: 'UI', action: 'UI_STYLE_CHANGED', uiStyle: 'fun' },
      current,
    )).toEqual({ ...current, uiStyle: 'fun' });
    expect(getDisplaySettingsUpdateFromMessage(
      { requestedHandler: 'UI', action: 'THEME_CHANGED', theme: 'dark' },
      current,
    )).toEqual({ ...current, theme: 'dark' });
    expect(getDisplaySettingsUpdateFromMessage(
      { requestedHandler: 'OTHER', action: 'ACCENT_CHANGED', accent: 'blue' },
      current,
    )).toBeNull();
  });

  it('unwraps Android Home settings messages', () => {
    const message = normalizeHomeSettingsHostMessage({
      type: 'qortium:home-settings-changed',
      detail: { theme: 'dark', accent: 'pink', textSize: 'large', ui: 'fun', language: 'fr' },
    });
    expect(getDisplaySettingsUpdateFromMessage(message, current)).toEqual({
      theme: 'dark', accent: 'pink', textSize: 'large', uiStyle: 'fun', language: 'fr',
    });
  });

  it('applies attributes, RTL direction, and color scheme before paint', () => {
    const root = {
      dataset: {} as Record<string, string>,
      dir: '',
      lang: '',
      style: {} as Record<string, string>,
    };
    vi.stubGlobal('document', { documentElement: root });
    applyDisplaySettings({
      accent: 'yellow', language: 'ar', textSize: 'huge', theme: 'dark', uiStyle: 'fun',
    });
    expect(root.dataset).toMatchObject({
      accent: 'yellow', language: 'ar', textSize: 'huge', theme: 'dark', ui: 'fun',
    });
    expect(root.dir).toBe('rtl');
    expect(root.lang).toBe('ar');
    expect(root.style.colorScheme).toBe('dark');
  });
});
