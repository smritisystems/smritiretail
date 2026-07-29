/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.0.0
 * Created      : 2026-07-20
 * Modified     : 2026-07-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { useEffect } from "react";

export function useTerminalShortcuts(handlers: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      let keyCombo = "";
      if (e.ctrlKey) keyCombo += "Ctrl+";
      if (e.altKey) keyCombo += "Alt+";
      keyCombo += e.key.toUpperCase(); // Ensure standard comparison

      // Standardize Function keys
      if (e.key.startsWith("F") && e.key.length > 1) {
        keyCombo = e.key; // e.g. "F2", "F12"
      } else if (e.key === "Escape") {
        keyCombo = "ESC";
      }

      if (handlers[keyCombo]) {
        e.preventDefault();
        e.stopPropagation();
        handlers[keyCombo]();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [handlers]);
}
