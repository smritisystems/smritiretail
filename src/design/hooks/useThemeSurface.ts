import { useMemo } from 'react';
import { resolveSurface } from '../components/card';

export const useThemeSurface = (surface: 'app' | 'workspace' | 'card' | 'input' | 'popup' | 'modal' | 'nav' = 'card') => {
  return useMemo(() => resolveSurface(surface), [surface]);
};
