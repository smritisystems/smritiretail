/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.55.0
 * Created      : 2026-10-03
 * Modified     : 2026-10-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Global Grid Input & Import Standard
 */

import { useState, useCallback } from "react";
import {
  GridInputProfile,
  GridProfileId,
  GridDuplicatePolicy,
  ParsedGridRow,
  GridInputParseResult,
} from "./types";
import { GRID_PROFILES } from "./gridProfiles";
import { GridInputEngine } from "./gridInputEngine";

export interface UseGridClipboardPasteOptions {
  profile: GridInputProfile | GridProfileId;
  duplicatePolicy?: GridDuplicatePolicy;
  autoResolve?: boolean;
  companyId?: string;
  onRowsParsed?: (rows: ParsedGridRow[], result: GridInputParseResult) => void;
  onRowsResolved?: (rows: ParsedGridRow[]) => void;
  onError?: (error: Error) => void;
}

export interface UseGridClipboardPasteReturn {
  isParsing: boolean;
  isResolving: boolean;
  lastResult: GridInputParseResult | null;
  error: string | null;
  handlePasteEvent: (e: React.ClipboardEvent<any>) => Promise<ParsedGridRow[] | null>;
  pasteFromClipboard: () => Promise<ParsedGridRow[] | null>;
  processText: (rawText: string) => Promise<ParsedGridRow[] | null>;
  clear: () => void;
}

/**
 * Universal React Hook for direct Excel/Google Sheets clipboard paste (Ctrl+V) into editable grids.
 */
export function useGridClipboardPaste({
  profile: profileOrId,
  duplicatePolicy,
  autoResolve = true,
  companyId,
  onRowsParsed,
  onRowsResolved,
  onError,
}: UseGridClipboardPasteOptions): UseGridClipboardPasteReturn {
  const profile: GridInputProfile =
    typeof profileOrId === "string" ? GRID_PROFILES[profileOrId] : profileOrId;

  const [isParsing, setIsParsing] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [lastResult, setLastResult] = useState<GridInputParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processText = useCallback(
    async (rawText: string): Promise<ParsedGridRow[] | null> => {
      if (!rawText || !rawText.trim()) {
        return null;
      }

      setError(null);
      setIsParsing(true);

      try {
        // Step 1: Parse delimited text matrix (TSV from Excel, CSV, etc.)
        const { matrix, delimiter } = GridInputEngine.parseDelimitedText(rawText);
        if (matrix.length === 0) {
          setIsParsing(false);
          return null;
        }

        // Step 2: Map columns with SMRITI HeaderMappingEngine
        const { columnMappings, hasHeaders, headerRowIndex, dataRows } =
          GridInputEngine.mapColumns(matrix, profile);

        // Step 3: Build normalized grid rows
        const activeDupPolicy = duplicatePolicy || profile.defaultDuplicatePolicy;
        const parsedRows = GridInputEngine.buildGridRows(
          dataRows,
          columnMappings,
          profile,
          activeDupPolicy
        );

        let validCount = 0;
        let invalidCount = 0;
        let warningCount = 0;

        parsedRows.forEach((r) => {
          if (r.resolutionStatus === "VALIDATION_ERROR") invalidCount++;
          else if (r.warnings && r.warnings.length > 0) warningCount++;
          else validCount++;
        });

        const parseResult: GridInputParseResult = {
          matrix,
          rawText,
          detectedDelimiter: delimiter,
          hasHeaders,
          headerRowIndex,
          columnMappings,
          rows: parsedRows,
          totalRows: parsedRows.length,
          validRows: validCount,
          invalidRows: invalidCount,
          warningRows: warningCount,
          duplicateRows: 0,
        };

        setLastResult(parseResult);
        setIsParsing(false);

        if (onRowsParsed) {
          onRowsParsed(parsedRows, parseResult);
        }

        // Step 4: Product Resolution (if required by profile and autoResolve is true)
        if (profile.requireProductResolution && autoResolve) {
          setIsResolving(true);
          try {
            const resolvedRows = await GridInputEngine.resolveRowsInBatch(
              parsedRows,
              companyId
            );

            // Re-tally status counts
            let finalValid = 0;
            let finalInvalid = 0;
            let finalWarning = 0;

            resolvedRows.forEach((r) => {
              if (
                r.resolutionStatus === "PRODUCT_NOT_FOUND" ||
                r.resolutionStatus === "PRODUCT_INACTIVE" ||
                r.resolutionStatus === "PRODUCT_QUARANTINED" ||
                r.resolutionStatus === "VALIDATION_ERROR"
              ) {
                finalInvalid++;
              } else if (r.warnings && r.warnings.length > 0) {
                finalWarning++;
              } else {
                finalValid++;
              }
            });

            setLastResult((prev) =>
              prev
                ? {
                    ...prev,
                    rows: resolvedRows,
                    validRows: finalValid,
                    invalidRows: finalInvalid,
                    warningRows: finalWarning,
                  }
                : null
            );

            setIsResolving(false);

            if (onRowsResolved) {
              onRowsResolved(resolvedRows);
            }

            return resolvedRows;
          } catch (resErr: any) {
            console.error("Resolution failed during clipboard paste:", resErr);
            setIsResolving(false);
            if (onError) onError(resErr);
            return parsedRows;
          }
        }

        return parsedRows;
      } catch (err: any) {
        setIsParsing(false);
        setIsResolving(false);
        const errMsg = err?.message || "Failed to parse clipboard data.";
        setError(errMsg);
        if (onError) onError(err);
        return null;
      }
    },
    [profile, duplicatePolicy, autoResolve, companyId, onRowsParsed, onRowsResolved, onError]
  );

  const handlePasteEvent = useCallback(
    async (e: React.ClipboardEvent<any>): Promise<ParsedGridRow[] | null> => {
      // Prevent browser default if clipboard contains multiple rows or tabular data
      const clipboardData = e.clipboardData?.getData("text/plain");
      if (!clipboardData) return null;

      // If text contains newline or tab, it is tabular/bulk paste
      if (clipboardData.includes("\n") || clipboardData.includes("\t")) {
        e.preventDefault();
        e.stopPropagation();
        return processText(clipboardData);
      }

      return null;
    },
    [processText]
  );

  const pasteFromClipboard = useCallback(async (): Promise<ParsedGridRow[] | null> => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        return processText(text);
      } else {
        throw new Error("Clipboard API not available in this environment.");
      }
    } catch (err: any) {
      const errMsg = err?.message || "Could not read clipboard.";
      setError(errMsg);
      if (onError) onError(err);
      return null;
    }
  }, [processText, onError]);

  const clear = useCallback(() => {
    setLastResult(null);
    setError(null);
    setIsParsing(false);
    setIsResolving(false);
  }, []);

  return {
    isParsing,
    isResolving,
    lastResult,
    error,
    handlePasteEvent,
    pasteFromClipboard,
    processText,
    clear,
  };
}
