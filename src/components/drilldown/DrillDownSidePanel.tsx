/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.0.0 (UCIF v1.0 Standardized)
 * Created      : 2026-07-10
 * Modified     : 2026-08-06
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useDrillDown } from "./drilldown_store.tsx";
import { UniversalInspectorRenderer } from "./UniversalInspectorRenderer.tsx";
import { CustomerInspectorPanel } from "./CustomerInspectorPanel.tsx";
import { InspectorRegistry } from "../../kernel/upr/context/InspectorRegistry.ts";
import { ContextDisambiguationPicker } from "./ContextDisambiguationPicker.tsx";
import type { ResolvedContext } from "../../kernel/upr/context/InspectorSchema.ts";

export const DrillDownSidePanel: React.FC = () => {
  const { activePanel, closePanel } = useDrillDown();
  const [disambiguationCandidates, setDisambiguationCandidates] = useState<ResolvedContext[] | null>(null);

  useEffect(() => {
    // Listen to ESC key to close panel (UCIF-003)
    const handleClose = () => closePanel();
    window.addEventListener("ucif:close-inspector", handleClose);
    return () => window.removeEventListener("ucif:close-inspector", handleClose);
  }, [closePanel]);

  useEffect(() => {
    // Listen for disambiguation events
    const handleDisambiguate = (e: CustomEvent<ResolvedContext[]>) => {
      setDisambiguationCandidates(e.detail);
    };
    window.addEventListener("ucif:show-disambiguation" as any, handleDisambiguate);
    return () => window.removeEventListener("ucif:show-disambiguation" as any, handleDisambiguate);
  }, []);

  if (!activePanel && !disambiguationCandidates) return null;

  const entityType = activePanel?.entityType || "";
  const entityId = activePanel?.entityId || "";
  const variant = activePanel?.metadata?.variant || "compact";

  // Check for custom component override in InspectorRegistry
  const CustomComponent = InspectorRegistry.resolveComponent(entityType);

  return (
    <>
      <AnimatePresence>
        {activePanel && (
          <div className="fixed inset-0 z-40 overflow-hidden flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePanel}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />

            {/* Slide-out Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative z-50 w-full max-w-md bg-theme-surface-1 border-l border-theme-divider shadow-2xl h-full flex flex-col"
            >
              {/* Header Bar with Close Button */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-theme-divider bg-theme-surface-2">
                <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider">
                  360° Inspection
                </span>
                <button
                  onClick={closePanel}
                  className="p-1 rounded-md text-theme-muted hover:text-theme-text hover:bg-theme-surface-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Body Content Router */}
              <div className="flex-1 overflow-hidden">
                {CustomComponent ? (
                  <CustomComponent entityId={entityId} onClose={closePanel} />
                ) : entityType === "customer" ? (
                  <CustomerInspectorPanel entityId={entityId} onClose={closePanel} />
                ) : (
                  <UniversalInspectorRenderer
                    entityType={entityType}
                    entityId={entityId}
                    variant={variant}
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Disambiguation Picker Modal */}
      {disambiguationCandidates && (
        <ContextDisambiguationPicker
          candidates={disambiguationCandidates}
          onClose={() => setDisambiguationCandidates(null)}
        />
      )}
    </>
  );
};
