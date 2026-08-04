import { resolveSurface } from './card';

export const createInputVisualStyle = () => ({
  background: resolveSurface('input'),
  borderRadius: 'var(--smriti-radius-sm, 8px)',
});
