import { resolveSurface } from './card';

export const createButtonVisualStyle = () => ({
  background: resolveSurface('card'),
  borderRadius: 'var(--smriti-radius-md, 12px)',
});
