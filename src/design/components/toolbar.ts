import { resolveSurface } from './card';

export const createToolbarVisualStyle = () => ({
  background: resolveSurface('nav'),
  borderRadius: 'var(--smriti-radius-md, 12px)',
});
