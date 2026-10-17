/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-09-18
 * Modified     : 2026-09-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * SMRITI Breadcrumb Engine v1.0 — React Context & Hook
 *
 * Provides BreadcrumbProvider, useBreadcrumb(), and useOptionalBreadcrumb() hooks.
 * The provider wires the BreadcrumbRegistry + BreadcrumbResolver to the
 * live WorkspaceConfig registry from layout_store.
 *
 * Usage:
 *   // In AppShell.tsx (once, at shell level)
 *   <BreadcrumbProvider activeModuleId={activeTab} documentId={...}>
 *     {children}
 *   </BreadcrumbProvider>
 *
 *   // In any component
 *   const { trail, setDocument } = useBreadcrumb();
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLayoutEngine } from "../../layout_engine/layout_store.tsx";
import { BreadcrumbRegistry } from "./BreadcrumbRegistry.ts";
import { BreadcrumbResolver } from "./BreadcrumbResolver.ts";
import type {
  BreadcrumbResolutionContext,
  BreadcrumbTrail,
} from "./BreadcrumbTypes.ts";

// ---------------------------------------------------------------------------
// Context Types
// ---------------------------------------------------------------------------

export interface BreadcrumbContextValue {
  /** The currently resolved breadcrumb trail */
  trail: BreadcrumbTrail;
  /** Update the active document context (e.g. when a record is opened) */
  setDocument: (id: string | undefined, label?: string) => void;
  /** Manually override the active module (rarely needed — prefer prop-driven) */
  setActiveModule: (id: string) => void;
  /** Clear document context (return to module root) */
  clearDocument: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const BreadcrumbContext = createContext<BreadcrumbContextValue | undefined>(
  undefined,
);

// ---------------------------------------------------------------------------
// Provider Props
// ---------------------------------------------------------------------------

export interface BreadcrumbProviderProps {
  children: React.ReactNode;
  /** The currently active workspace/module id (from App.tsx activeTab) */
  activeModuleId: string;
  /** Optional user role for permission-aware resolution */
  userRole?: string;
  /** Optional branch/tenant id */
  branchId?: string;
  /** Optional company id */
  companyId?: string;
  /** Maximum trail depth (default: 5) */
  maxDepth?: number;
  /** Called when a breadcrumb node is clicked (for module switching) */
  onNavigate?: (moduleId: string) => void;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const BreadcrumbProvider: React.FC<BreadcrumbProviderProps> = ({
  children,
  activeModuleId,
  userRole,
  branchId,
  companyId,
  maxDepth,
  onNavigate: _onNavigate,
}) => {
  const { registeredWorkspaces } = useLayoutEngine();

  // Internal state
  const [internalModuleId, setInternalModuleId] = useState(activeModuleId);
  const [documentId, setDocumentId] = useState<string | undefined>(undefined);
  const [documentLabel, setDocumentLabel] = useState<string | undefined>(
    undefined,
  );

  // Sync external activeModuleId changes (from App.tsx) into internal state
  useEffect(() => {
    setInternalModuleId(activeModuleId);
    // Clear document context when module changes
    setDocumentId(undefined);
    setDocumentLabel(undefined);
  }, [activeModuleId]);

  // Build registry — rebuild only when registeredWorkspaces changes
  const registryRef = useRef<BreadcrumbRegistry | null>(null);
  const registry = useMemo(() => {
    const reg = new BreadcrumbRegistry(registeredWorkspaces);
    registryRef.current = reg;
    return reg;
  }, [registeredWorkspaces]);

  // Build resolver
  const resolver = useMemo(() => new BreadcrumbResolver(registry), [registry]);

  // Resolve the trail
  const trail = useMemo<BreadcrumbTrail>(() => {
    const ctx: BreadcrumbResolutionContext = {
      activeModuleId: internalModuleId,
      documentId,
      documentLabel,
      userRole,
      branchId,
      companyId,
      maxDepth,
    };
    return resolver.resolve(ctx);
  }, [
    resolver,
    internalModuleId,
    documentId,
    documentLabel,
    userRole,
    branchId,
    companyId,
    maxDepth,
  ]);

  // Public API
  const setDocument = useCallback(
    (id: string | undefined, label?: string) => {
      setDocumentId(id);
      setDocumentLabel(label);
    },
    [],
  );

  const clearDocument = useCallback(() => {
    setDocumentId(undefined);
    setDocumentLabel(undefined);
  }, []);

  const setActiveModule = useCallback((id: string) => {
    setInternalModuleId(id);
    setDocumentId(undefined);
    setDocumentLabel(undefined);
  }, []);

  const value = useMemo<BreadcrumbContextValue>(
    () => ({
      trail,
      setDocument,
      setActiveModule,
      clearDocument,
    }),
    [trail, setDocument, setActiveModule, clearDocument],
  );

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Access the breadcrumb context if available, or undefined if outside provider.
 * Does not throw.
 */
export const useOptionalBreadcrumb = (): BreadcrumbContextValue | undefined => {
  return useContext(BreadcrumbContext);
};

/**
 * Access the current breadcrumb trail and navigation controls.
 * Must be used within a BreadcrumbProvider.
 */
export const useBreadcrumb = (): BreadcrumbContextValue => {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) {
    throw new Error("useBreadcrumb must be used within a BreadcrumbProvider");
  }
  return ctx;
};
