/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Universal Document Studio Workspace Shell
 */

import React, { useState, useEffect } from "react";
import { SAWFExperienceMode, SAWFCommandItem } from "../types/sawf.ts";
import { MetadataLoader } from "../metadata/MetadataLoader.ts";
import { WorkspacePreferences } from "../core/WorkspacePreferences.ts";
import { ExperienceEngine } from "../core/ExperienceEngine.ts";
import { AutosaveEngine } from "../core/AutosaveEngine.ts";
import { attachKeyboardShortcuts } from "../keyboard/KeyboardShortcuts.ts";
// Header is provided by Workspace Kernel (WorkspaceShell) via WorkspaceEventBus
import { DocumentFooter } from "./DocumentFooter.tsx";
import { DocumentSidebar } from "./DocumentSidebar.tsx";
import { DocumentPanels } from "./DocumentPanels.tsx";
import { DocumentItemsGrid, ItemGridRow } from "./DocumentItemsGrid.tsx";
import { CommandPalette } from "../keyboard/CommandPalette.tsx";
import { UnsavedChangesModal } from "./UnsavedChangesModal.tsx";
import { LayoutEngine } from "../layouts/LayoutEngine.tsx";
import { Product } from "../../../types.ts";
import { AIStudioExtension, AISuggestion } from "../../../plugins/AIStudioExtension.ts";

interface DocumentStudioProps {
  documentType: string;
  documentNo?: string;
  status: string;
  role?: string;
  items: ItemGridRow[];
  onChangeItems: (items: ItemGridRow[]) => void;
  products: Product[];
  renderPanelContent: (panelId: string) => React.ReactNode;
  onBack: () => void;
  onSaveDraft?: () => void;
  onSave?: () => void;
  onPost?: () => void;
  onPrint?: () => void;
  onShare?: () => void;
  sidebarData?: any;
  customCommands?: SAWFCommandItem[];
}

export const DocumentStudio: React.FC<DocumentStudioProps> = ({
  documentType,
  documentNo,
  status,
  role,
  items,
  onChangeItems,
  products,
  renderPanelContent,
  onBack,
  onSaveDraft,
  onSave,
  onPost,
  onPrint,
  onShare,
  sidebarData,
  customCommands = [],
}) => {
  const meta = MetadataLoader.getDocumentMeta(documentType);
  const defaultModeFromRole = ExperienceEngine.resolveProfileDefaultMode(role);
  const initialPrefs = WorkspacePreferences.get(documentType, defaultModeFromRole);

  const [mode, setMode] = useState<SAWFExperienceMode>(initialPrefs.experienceMode);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [lastAutosavedAt, setLastAutosavedAt] = useState<number | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState<boolean>(false);

  // AI Advisory suggestions
  const aiSuggestions: AISuggestion[] = AIStudioExtension.analyzeInvoiceDraft(sidebarData);

  // Autosave engine
  useEffect(() => {
    const engine = new AutosaveEngine();
    if (onSaveDraft) {
      engine.start(() => {
        onSaveDraft();
        setLastAutosavedAt(Date.now());
        setIsDirty(false);
      });
    }
    return () => engine.stop();
  }, [onSaveDraft]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const cleanup = attachKeyboardShortcuts({
      onSave: () => onSave?.(),
      onSaveDraft: () => onSaveDraft?.(),
      onPrint: () => onPrint?.(),
      onOpenCommandPalette: () => setIsCommandPaletteOpen(true),
      onCustomerSearch: () => setIsCommandPaletteOpen(true),
      onOpenPayment: () => setIsCommandPaletteOpen(true),
      onScanBarcode: () => {
        alert("Barcode scanner listening for input (F6)...");
      },
    });
    return cleanup;
  }, [onSave, onSaveDraft, onPrint]);

  const handleModeChange = (newMode: SAWFExperienceMode) => {
    setMode(newMode);
    WorkspacePreferences.save(documentType, { experienceMode: newMode });
  };

  const handleAttemptBack = () => {
    if (isDirty) {
      setShowUnsavedModal(true);
    } else {
      onBack();
    }
  };

  const defaultCommands: SAWFCommandItem[] = [
    {
      id: "cmd-save",
      label: "Save Document",
      shortcut: "Ctrl+S",
      category: "Actions",
      action: () => onSave?.(),
    },
    {
      id: "cmd-draft",
      label: "Save Draft",
      shortcut: "Ctrl+Shift+S",
      category: "Actions",
      action: () => onSaveDraft?.(),
    },
    {
      id: "cmd-print",
      label: "Print Document",
      shortcut: "Ctrl+P",
      category: "Actions",
      action: () => onPrint?.(),
    },
  ];

  const allCommands = [...defaultCommands, ...customCommands];

  return (
    <div className="w-full bg-theme-surface-1 min-h-[92vh] flex flex-col font-sans text-theme-primary border border-theme-divider rounded-2xl overflow-hidden shadow-2xl">

      {/* 2. MAIN WORKSPACE CONTENT (Header is rendered by Workspace Kernel) */}
      <div className="p-6 flex-1 overflow-y-auto space-y-6">
        <LayoutEngine
          sidebar={
            <DocumentSidebar
              widgetIds={meta.sidebarWidgets}
              data={sidebarData}
              aiSuggestions={aiSuggestions}
            />
          }
          sidebarOpen={true}
        >
          <div className="space-y-6">
            {/* Metadata Accordion Panels */}
            <DocumentPanels
              panels={meta.panels}
              mode={mode}
              renderPanelContent={renderPanelContent}
            />

            {/* Item Entry Grid */}
            <DocumentItemsGrid
              items={items}
              onChangeItems={(updated) => {
                onChangeItems(updated);
                setIsDirty(true);
              }}
              products={products}
              onScanBarcode={() => alert("Barcode scanner activated (F6).")}
            />
          </div>
        </LayoutEngine>
      </div>

      {/* 3. STICKY DOCUMENT FOOTER BAR */}
      <DocumentFooter
        onSaveDraft={onSaveDraft}
        onSave={onSave}
        onPost={onPost}
        onPrint={onPrint}
        onShare={onShare}
        onCancel={handleAttemptBack}
        isDirty={isDirty}
        lastAutosavedAt={lastAutosavedAt}
      />

      {/* UNSAVED CHANGES GUARD MODAL */}
      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onSaveAndExit={() => {
          onSave?.();
          setShowUnsavedModal(false);
          onBack();
        }}
        onDiscardAndExit={() => {
          setShowUnsavedModal(false);
          onBack();
        }}
        onCancel={() => setShowUnsavedModal(false)}
      />
    </div>
  );
};
