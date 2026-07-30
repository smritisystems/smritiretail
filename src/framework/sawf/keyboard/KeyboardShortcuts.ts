/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Keyboard Shortcuts Manager
 */

export interface KeyboardShortcutHandlers {
  onSave?: () => void;
  onSaveDraft?: () => void;
  onPrint?: () => void;
  onOpenCommandPalette?: () => void;
  onCustomerSearch?: () => void;
  onOpenPayment?: () => void;
  onScanBarcode?: () => void;
  onAddItem?: () => void;
  onDeleteRow?: () => void;
}

export function attachKeyboardShortcuts(handlers: KeyboardShortcutHandlers): () => void {
  const listener = (e: KeyboardEvent) => {
    // Ctrl+K / Cmd+K -> Command Palette
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      handlers.onOpenCommandPalette?.();
      return;
    }

    // Ctrl+Shift+S -> Save Draft
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      handlers.onSaveDraft?.();
      return;
    }

    // Ctrl+S -> Save
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      handlers.onSave?.();
      return;
    }

    // Ctrl+P -> Print
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
      e.preventDefault();
      handlers.onPrint?.();
      return;
    }

    // Ctrl+N -> Add Item
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
      e.preventDefault();
      handlers.onAddItem?.();
      return;
    }

    // Function keys
    if (e.key === "F2") {
      e.preventDefault();
      handlers.onCustomerSearch?.();
      return;
    }

    if (e.key === "F4") {
      e.preventDefault();
      handlers.onOpenPayment?.();
      return;
    }

    if (e.key === "F6") {
      e.preventDefault();
      handlers.onScanBarcode?.();
      return;
    }
  };

  window.addEventListener("keydown", listener);
  return () => window.removeEventListener("keydown", listener);
}
