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
 * Classification: Commercial Terms Sanitizer & Safety Governance Utility
 */

export const STANDARD_COMMERCIAL_TERMS_HTML = `<h3>BUSINESS TERMS &amp; STATUTORY CONDITIONS</h3>
<p><strong>SMRITI STATUTORY COMMERCIAL CONTRACT</strong></p>
<ol>
  <li><strong>Payment Terms:</strong> Strictly 120 Days credit settlement from date of physical GRN inwarding and barcode acceptance.</li>
  <li><strong>Quality &amp; Inspection:</strong> Goods are subject to warehouse QC inspection. Any manufacturing defect, shade mismatch, or size deviation must be replaced or credited within 15 days of intimation.</li>
  <li><strong>Packaging &amp; Labeling:</strong> All footwear articles must arrive packed in individual master boxes carrying GS1/EAN-13 barcodes, size labels, and manufacturer MRP stickers.</li>
  <li><strong>Statutory &amp; Legal Jurisdiction:</strong> All commercial disputes arising out of this statutory purchase order are subject to the exclusive jurisdiction of courts in Mumbai, Maharashtra.</li>
</ol>`;

export const STANDARD_COMMERCIAL_TERMS_TEXT = `BUSINESS TERMS & STATUTORY CONDITIONS

SMRITI STATUTORY COMMERCIAL CONTRACT

1. Payment Terms: Strictly 120 Days credit settlement from date of physical GRN inwarding and barcode acceptance.

2. Quality & Inspection: Goods are subject to warehouse QC inspection. Any manufacturing defect, shade mismatch, or size deviation must be replaced or credited within 15 days of intimation.

3. Packaging & Labeling: All footwear articles must arrive packed in individual master boxes carrying GS1/EAN-13 barcodes, size labels, and manufacturer MRP stickers.

4. Statutory & Legal Jurisdiction: All commercial disputes arising out of this statutory purchase order are subject to the exclusive jurisdiction of courts in Mumbai, Maharashtra.`;

/**
 * Checks if a string contains any HTML markup.
 */
export function hasHtmlTags(content?: string): boolean {
  if (!content || typeof content !== "string") return false;
  return /<[a-z][\s\S]*>/i.test(content);
}

/**
 * Strips Microsoft Word, Outlook, and rich-document proprietary comments, tags, and formatting.
 */
export function cleanWordHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== "string") return "";

  let cleaned = rawHtml;

  // 1. Remove XML/HTML comments including Microsoft Word conditional comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/gi, "");

  // 2. Remove <style> and <script> tags with their content
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, "");
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, "");

  // 3. Remove office/word specific tags: <o:p>, <w:...>, <m:...>
  cleaned = cleaned.replace(/<\/?\w+:[^>]*>/gi, "");

  // 4. Remove MsoNormal and other Word class attributes
  cleaned = cleaned.replace(/\s*class="[^"]*mso[^"]*"/gi, "");
  cleaned = cleaned.replace(/\s*class=mso[^\s>]*/gi, "");

  // 5. Remove mso- styles from inline style attributes
  cleaned = cleaned.replace(/mso-[^:;"]+:[^;"]*;?/gi, "");

  return cleaned;
}

/**
 * Whitelist of allowed HTML tags for rich commercial terms.
 */
const ALLOWED_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr",
  "b", "strong", "i", "em", "u", "s", "strike",
  "ul", "ol", "li",
  "blockquote", "div", "span"
]);

/**
 * Sanitizes rich HTML for safe rendering and persistence.
 * Completely strips malicious tags (<script>, <iframe>, <object>, etc.)
 * and strips inline JavaScript event handlers (on* attributes).
 */
export function sanitizeTermsHtml(rawHtml?: string): string {
  if (!rawHtml || typeof rawHtml !== "string") return "";

  // Pre-clean Word artifacts
  let html = cleanWordHtml(rawHtml);

  // Strip dangerous tags completely including their inner text
  html = html.replace(/<(script|style|iframe|object|embed|applet|form|input|button|link|meta|svg)[\s\S]*?<\/\1>/gi, "");
  // Self-closing or orphan dangerous tags
  html = html.replace(/<\/?(script|style|iframe|object|embed|applet|form|input|button|link|meta|svg)[^>]*>/gi, "");

  // Strip dangerous protocols (javascript:, vbscript:, data: except images)
  html = html.replace(/(href|src)\s*=\s*["']?\s*(javascript|vbscript|data):[^"'>\s]*/gi, "");

  // Sanitize tags & attributes
  // Matches <tag ...> or </tag>
  html = html.replace(/<(\/)?([a-z0-9]+)([^>]*)>/gi, (match, isClosing, tagName, rawAttrs) => {
    const lowerTag = tagName.toLowerCase();

    // If tag is not allowed, strip the tag markers
    if (!ALLOWED_TAGS.has(lowerTag)) {
      return "";
    }

    if (isClosing) {
      return `</${lowerTag}>`;
    }

    // Filter allowed attributes: style (text-align only), class
    let safeAttrs = "";

    // Check for text-align style
    const styleMatch = rawAttrs.match(/style\s*=\s*["']([^"']*)["']/i);
    if (styleMatch) {
      const styleContent = styleMatch[1];
      const alignMatch = styleContent.match(/text-align\s*:\s*(left|center|right|justify)/i);
      if (alignMatch) {
        safeAttrs += ` style="text-align: ${alignMatch[1].toLowerCase()};"`;
      }
    }

    // Check for align attribute
    const alignAttrMatch = rawAttrs.match(/align\s*=\s*["']?(left|center|right|justify)["']?/i);
    if (alignAttrMatch && !safeAttrs.includes("text-align")) {
      safeAttrs += ` style="text-align: ${alignAttrMatch[1].toLowerCase()};"`;
    }

    return `<${lowerTag}${safeAttrs}>`;
  });

  return html.trim();
}
