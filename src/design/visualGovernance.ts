import { SMRITI_SURFACE_TOKENS, SMRITI_TEXT_TOKENS, SMRITI_BORDER_TOKENS, SMRITI_RADIUS_TOKENS, SMRITI_SHADOW_TOKENS, SMRITI_SPACING_TOKENS } from './designTokens';

export const SMRITI_VISUAL_GOVERNANCE = {
  surfaces: SMRITI_SURFACE_TOKENS,
  text: SMRITI_TEXT_TOKENS,
  borders: SMRITI_BORDER_TOKENS,
  radius: SMRITI_RADIUS_TOKENS,
  shadows: SMRITI_SHADOW_TOKENS,
  spacing: SMRITI_SPACING_TOKENS,
} as const;

export const createSurfaceStyle = (layer: keyof typeof SMRITI_SURFACE_TOKENS = 'card') => ({
  background: SMRITI_SURFACE_TOKENS[layer],
  color: SMRITI_TEXT_TOKENS.primary,
  border: `1px solid ${SMRITI_BORDER_TOKENS.default}`,
  borderRadius: SMRITI_RADIUS_TOKENS.md,
  boxShadow: SMRITI_SHADOW_TOKENS.sm,
});

export const createPanelStyle = () => ({
  ...createSurfaceStyle('workspace'),
  borderRadius: SMRITI_RADIUS_TOKENS.lg,
});
