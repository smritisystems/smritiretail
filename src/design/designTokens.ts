export const SMRITI_SURFACE_TOKENS = {
  app: 'var(--smriti-surface-0, var(--c-theme-surface-1))',
  workspace: 'var(--smriti-surface-1, var(--c-theme-surface-2))',
  card: 'var(--smriti-card-bg, var(--c-theme-surface-2))',
  input: 'var(--smriti-input-bg, var(--c-theme-surface-2))',
  overlay: 'var(--smriti-surface-4, var(--c-theme-surface-3))',
  modal: 'var(--smriti-surface-5, var(--c-theme-surface-3))',
  nav: 'var(--smriti-surface-6, var(--c-theme-surface-2))',
} as const;

export const SMRITI_TEXT_TOKENS = {
  primary: 'var(--smriti-text-primary, var(--c-theme-body))',
  secondary: 'var(--smriti-text-secondary, var(--c-theme-muted))',
  muted: 'var(--smriti-text-label, var(--c-theme-muted))',
} as const;

export const SMRITI_BORDER_TOKENS = {
  default: 'var(--smriti-color-border, var(--c-theme-divider))',
  strong: 'var(--smriti-color-border-strong, var(--c-theme-divider))',
} as const;

export const SMRITI_RADIUS_TOKENS = {
  sm: 'var(--smriti-radius-sm, 8px)',
  md: 'var(--smriti-radius-md, 12px)',
  lg: 'var(--smriti-radius-lg, 16px)',
} as const;

export const SMRITI_SHADOW_TOKENS = {
  xs: 'var(--smriti-shadow-xs, none)',
  sm: 'var(--smriti-shadow-sm, none)',
  md: 'var(--smriti-shadow-md, none)',
} as const;

export const SMRITI_SPACING_TOKENS = {
  xs: 'var(--smriti-space-xs, 4px)',
  sm: 'var(--smriti-space-sm, 8px)',
  md: 'var(--smriti-space-md, 12px)',
  lg: 'var(--smriti-space-lg, 16px)',
} as const;
