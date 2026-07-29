/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal Platform Themes
 */

import { sedsDarkTheme } from './dark';
import { sedsLightTheme } from './light';

export const resolveSystemTheme = () => {
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return sedsDarkTheme;
  }
  return sedsLightTheme;
};
