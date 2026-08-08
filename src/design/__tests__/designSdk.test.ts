import { describe, expect, it } from 'vitest';
import { resolveDesignTheme, Surface, Radius, Elevation } from '../index';

describe('SMRITI design SDK', () => {
  it('resolves semantic surface and radius tokens to theme values', () => {
    const theme = resolveDesignTheme();

    expect(theme.surface.card).toContain('var(');
    expect(theme.surface.workspace).toContain('var(');
    expect(theme.radius.md).toContain('var(');
    expect(theme.elevation.sm).toContain('var(');
    expect(Surface.card).toBe('surface-2');
    expect(Radius.md).toBe('radius-md');
    expect(Elevation.sm).toBe('elevation-sm');
  });
});
