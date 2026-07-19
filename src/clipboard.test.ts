import { describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard, type ClipboardDependencies } from './clipboard';

describe('copyTextToClipboard', () => {
  it('uses the modern API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(copyTextToClipboard('recipe', { navigator: { clipboard: { writeText } } })).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('recipe');
  });

  it('falls back to a selected textarea in a sandboxed QDN view', async () => {
    const textarea = {
      value: '', style: {} as Record<string, string>, setAttribute: vi.fn(),
      focus: vi.fn(), select: vi.fn(), setSelectionRange: vi.fn(),
    };
    const documentRef = {
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      createElement: vi.fn(() => textarea),
      execCommand: vi.fn(() => true),
    };
    const dependencies: ClipboardDependencies = {
      document: documentRef as unknown as ClipboardDependencies['document'],
      navigator: { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) } },
    };
    await expect(copyTextToClipboard('fallback', dependencies)).resolves.toBe(true);
    expect(textarea.value).toBe('fallback');
    expect(documentRef.execCommand).toHaveBeenCalledWith('copy');
  });

  it('reports unavailable when neither clipboard path can run', async () => {
    await expect(copyTextToClipboard('manual', {})).resolves.toBe(false);
  });
});
