/**
 * Project      : SMRITI Retail OS
 * Module       : CommandPaletteModal — SXP v1.0 Bridge
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 4.0.0 (SXP v1.0 — delegates to SEEFCommandPalette)
 * Modified     : 2026-08-03
 *
 * MIGRATION NOTE:
 *   v3.x had hardcoded SUNEFKernel.open() commands.
 *   v4.0 delegates entirely to SEEFCommandPalette (the canonical palette).
 *   Interface preserved: { isOpen: boolean; onClose: () => void }
 *   New consumers should import SEEFCommandPalette directly.
 */

import React from "react";
import { SEEFCommandPalette } from "../../layout_engine/SEEFCommandPalette.tsx";
import { WorkspaceNavigationEngine } from "../../layout_engine/WorkspaceNavigationEngine.js";

/**
 * CommandPaletteModal — backward-compatible wrapper.
 * Retained for App.tsx and legacy call sites. Internally renders SEEFCommandPalette.
 *
 * @deprecated New code should use SEEFCommandPalette directly.
 */
export const CommandPaletteModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  return (
    <SEEFCommandPalette
      isOpen={isOpen}
      onClose={onClose}
      onNavigate={(workspaceId) => {
        WorkspaceNavigationEngine.navigate(workspaceId);
        onClose();
      }}
    />
  );
};
