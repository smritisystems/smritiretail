/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.85.0
 * Created      : 2026-10-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Commercial Terms Safe Renderer Component
 */

import React from "react";
import { sanitizeTermsHtml, hasHtmlTags } from "../../utils/sanitizeTermsHtml";

export interface SafeRichTermsRendererProps {
  content?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * SafeRichTermsRenderer — Renders rich-text HTML commercial terms securely without script injection,
 * while seamlessly supporting legacy plain text with natural line-break preservation.
 * Used in Purchase Order screen preview, print formats, and supplier dashboard previews.
 */
export const SafeRichTermsRenderer: React.FC<SafeRichTermsRendererProps> = ({
  content,
  className = "",
  style,
}) => {
  if (!content || !content.trim()) {
    return null;
  }

  const trimmed = content.trim();

  // If content contains rich HTML tags, sanitize and render cleanly
  if (hasHtmlTags(trimmed)) {
    const sanitizedHtml = sanitizeTermsHtml(trimmed);
    return (
      <div
        className={`rich-terms-rendered font-sans leading-relaxed text-slate-700 dark:text-slate-300 ${className}`}
        style={style}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    );
  }

  // Backward-compatible plain text fallback (preserves whitespace and linebreaks)
  return (
    <div
      className={`whitespace-pre-line font-sans leading-relaxed text-slate-700 dark:text-slate-300 ${className}`}
      style={style}
    >
      {trimmed}
    </div>
  );
};
