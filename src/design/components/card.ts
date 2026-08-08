import { Surface } from '../tokens/colors';
import { Radius } from '../tokens/radius';
import { Elevation } from '../tokens/elevation';

export type SmritiCardSurface = keyof typeof Surface;

export const resolveDesignTheme = () => ({
  surface: {
    app: 'var(--smriti-surface-0, var(--c-theme-surface-1))',
    workspace: 'var(--smriti-surface-1, var(--c-theme-surface-2))',
    card: 'var(--smriti-card-bg, var(--c-theme-surface-2))',
    input: 'var(--smriti-input-bg, var(--c-theme-surface-2))',
    popup: 'var(--smriti-surface-4, var(--c-theme-surface-3))',
    modal: 'var(--smriti-surface-5, var(--c-theme-surface-3))',
    nav: 'var(--smriti-surface-6, var(--c-theme-surface-2))',
  },
  radius: {
    sm: 'var(--smriti-radius-sm, 8px)',
    md: 'var(--smriti-radius-md, 12px)',
    lg: 'var(--smriti-radius-lg, 16px)',
    xl: 'var(--smriti-radius-xl, 20px)',
  },
  elevation: {
    none: 'var(--smriti-shadow-xs, none)',
    sm: 'var(--smriti-shadow-sm, none)',
    md: 'var(--smriti-shadow-md, none)',
    lg: 'var(--smriti-shadow-lg, none)',
  },
});

export const resolveSurface = (surface: SmritiCardSurface = 'card') => resolveDesignTheme().surface[surface];
export const resolveRadius = (radius: keyof typeof Radius = 'md') => resolveDesignTheme().radius[radius];
export const resolveElevation = (elevation: keyof typeof Elevation = 'sm') => resolveDesignTheme().elevation[elevation];
