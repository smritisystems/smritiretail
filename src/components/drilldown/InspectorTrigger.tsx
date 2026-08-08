/**
 * Project      : SMRITI Retail OS
 * Module       : UCIF v1.0 — Inspector Trigger (Hover + F2 Awareness Wrapper)
 * Standard     : UCIF-004 (Renderer Rule — FROZEN)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * Usage:
 *   <InspectorTrigger entityType="customer" entityId={id}>
 *     {children}
 *   </InspectorTrigger>
 *
 * Behaviour:
 *   Hover 500ms  → shows HoverPreviewCard (preview variant)
 *   F2 on focus  → WorkspaceActionRegistry.execute("inspect_context")
 *   Mouse leave  → dismiss preview
 */

import React, { useRef, useState, useCallback } from "react";
import { HoverPreviewCard } from "./HoverPreviewCard.js";
import { UCIFKernel } from "../../kernel/upr/context/UCIFKernel.js";
import type { ResolvedContext } from "../../kernel/upr/context/InspectorSchema.js";

const HOVER_DELAY_MS = 500;

interface InspectorTriggerProps {
  entityType: string;
  entityId: string;
  /** Optional title override — shown in preview card header */
  title?: string;
  /** Hover delay in ms — defaults to 500 */
  hoverDelay?: number;
  /** Disable hover preview (still allows F2) */
  disableHover?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const InspectorTrigger: React.FC<InspectorTriggerProps> = ({
  entityType,
  entityId,
  title,
  hoverDelay = HOVER_DELAY_MS,
  disableHover = false,
  children,
  className,
}) => {
  const timerRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [previewContext, setPreviewContext] = useState<ResolvedContext | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<DOMRect | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    if (disableHover || !entityId) return;
    clearTimer();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    timerRef.current = window.setTimeout(async () => {
      const resolved = await UCIFKernel.preview(triggerRef.current ?? undefined);
      const ctx: ResolvedContext = resolved ?? {
        entityType,
        entityId,
        title: title ?? entityId,
        confidence: 100,
        resolvedBy: "InspectorTrigger",
        variant: "preview",
      };
      setPreviewContext(ctx);
      setPreviewAnchor(rect);
    }, hoverDelay);
  }, [entityType, entityId, title, hoverDelay, disableHover, clearTimer]);

  const handleMouseLeave = useCallback(() => {
    clearTimer();
    setPreviewContext(null);
    setPreviewAnchor(null);
  }, [clearTimer]);

  return (
    <>
      <span
        ref={triggerRef}
        className={className}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        // data attributes for Phase 1 DOM resolver (fallback)
        data-entity-type={entityType}
        data-entity-id={entityId}
        data-field-id={`${entityType}_id`}
      >
        {children}
      </span>

      {previewContext && previewAnchor && (
        <HoverPreviewCard
          context={previewContext}
          anchor={previewAnchor}
          onClose={() => { setPreviewContext(null); setPreviewAnchor(null); }}
        />
      )}
    </>
  );
};
