/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal Platform Themes
 */

import { SEDS_COLORS } from '../tokens/colors';

export const sedsLightTheme = {
  mode: 'light',
  colors: {
    canvas: SEDS_COLORS.canvas.light,
    surface1: SEDS_COLORS.surface[1].light,
    surface2: SEDS_COLORS.surface[2].light,
    surface3: SEDS_COLORS.surface[3].light,
    surfaceHover: SEDS_COLORS.surface.hover.light,
    divider: SEDS_COLORS.divider.light,
    heading: SEDS_COLORS.text.heading.light,
    body: SEDS_COLORS.text.body.light,
    muted: SEDS_COLORS.text.muted.light,
    inverse: SEDS_COLORS.text.inverse.light,
    primary: SEDS_COLORS.brand.primary,
    accent: SEDS_COLORS.brand.accent,
  },
} as const;
