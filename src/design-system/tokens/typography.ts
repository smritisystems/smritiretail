/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal Platform Tokens
 */

export const SEDS_TYPOGRAPHY = {
  fontFamily: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    heading: 'Outfit, Inter, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  fontSize: {
    'xs': ['11px', '16px'],
    'sm': ['13px', '18px'],
    'base': ['14px', '20px'],
    'lg': ['16px', '24px'],
    'xl': ['18px', '28px'],
    '2xl': ['24px', '32px'],
    '3xl': ['30px', '38px'],
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;
