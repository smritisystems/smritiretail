import { useMemo } from 'react';
import { resolveElevation } from '../components/card';

export const useElevation = (elevation: 'none' | 'sm' | 'md' | 'lg' = 'sm') => {
  return useMemo(() => resolveElevation(elevation), [elevation]);
};
