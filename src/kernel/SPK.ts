/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-14
 * Modified     : 2026-08-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export const SPK = {
  configuration: {
    branding: {
      updateBranding: (config: any) => {
        try {
          localStorage.setItem("smriti_branding_config", JSON.stringify(config));
        } catch (e) {
          console.warn("Failed to persist branding config", e);
        }
      }
    }
  }
};
