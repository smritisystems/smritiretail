/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal Platform Themes
 */

import { SEDS_COLORS } from '../tokens/colors';

export const sedsDarkTheme = {
  mode: 'dark',
  colors: {
    canvas: SEDS_COLORS.canvas.dark,
    surface1: SEDS_COLORS.surface[1].dark,
    surface2: SEDS_COLORS.surface[2].dark,
    surface3: SEDS_COLORS.surface[3].dark,
    surfaceHover: SEDS_COLORS.surface.hover.dark,
    divider: SEDS_COLORS.divider.dark,
    heading: SEDS_COLORS.text.heading.dark,
    body: SEDS_COLORS.text.body.dark,
    muted: SEDS_COLORS.text.muted.dark,
    inverse: SEDS_COLORS.text.inverse.dark,
    primary: SEDS_COLORS.brand.primary,
    accent: SEDS_COLORS.brand.accent,
  },
} as const;
