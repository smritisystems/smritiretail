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
 * SMRITI Breadcrumb Engine v1.0 — Compatibility Adapter
 *
 * @deprecated
 * BreadcrumbCompat accepts legacy string-array breadcrumbs and renders them
 * through the canonical Breadcrumb component. This is a TEMPORARY migration
 * bridge only. Remove after all pages are migrated to BreadcrumbResolver.
 *
 * Usage (legacy pages only):
 *   <BreadcrumbCompat segments={["Home", "Inventory", "Item Master"]} />
 */

import React, { useMemo } from "react";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { fromLegacyStringArray } from "./breadcrumbUtils.ts";
import type { BreadcrumbTrail } from "./BreadcrumbTypes.ts";

interface BreadcrumbCompatProps {
  /** Legacy string array, e.g. ["Home", "Inventory", "Item Master"] */
  segments: string[];
  onNavigate?: (moduleId: string) => void;
  className?: string;
}

/** @deprecated Use <Breadcrumb /> with BreadcrumbProvider instead */
export const BreadcrumbCompat: React.FC<BreadcrumbCompatProps> = ({
  segments,
  onNavigate,
  className,
}) => {
  const trail = useMemo<BreadcrumbTrail>(
    () => ({
      nodes: fromLegacyStringArray(segments),
      maxDepth: 5,
      isTruncated: false,
    }),
    [segments],
  );

  return (
    <Breadcrumb trail={trail} onNavigate={onNavigate} className={className} />
  );
};

BreadcrumbCompat.displayName = "BreadcrumbCompat";
