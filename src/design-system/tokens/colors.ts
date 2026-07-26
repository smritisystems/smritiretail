/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal Platform Tokens
 */

export const SEDS_COLORS = {
  canvas: {
    dark: '#090d16',
    light: '#f8fafc',
  },
  surface: {
    1: {
      dark: '#111827',
      light: '#ffffff',
    },
    2: {
      dark: '#1f2937',
      light: '#f1f5f9',
    },
    3: {
      dark: '#374151',
      light: '#e2e8f0',
    },
    hover: {
      dark: '#2d3748',
      light: '#cbd5e1',
    },
  },
  divider: {
    dark: 'rgba(255, 255, 255, 0.10)',
    light: 'rgba(0, 0, 0, 0.10)',
  },
  text: {
    heading: {
      dark: '#f9fafb',
      light: '#0f172a',
    },
    body: {
      dark: '#e5e7eb',
      light: '#334155',
    },
    muted: {
      dark: '#9ca3af',
      light: '#64748b',
    },
    inverse: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  },
  brand: {
    primary: '#4f46e5', // Indigo 600
    primaryHover: '#4338ca', // Indigo 700
    accent: '#06b6d4', // Cyan 500
  },
  status: {
    success: {
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.30)',
      text: '#10b981',
    },
    warning: {
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.30)',
      text: '#f59e0b',
    },
    danger: {
      bg: 'rgba(244, 63, 94, 0.12)',
      border: 'rgba(244, 63, 94, 0.30)',
      text: '#f43f5e',
    },
    info: {
      bg: 'rgba(59, 130, 246, 0.12)',
      border: 'rgba(59, 130, 246, 0.30)',
      text: '#3b82f6',
    },
  },
} as const;
