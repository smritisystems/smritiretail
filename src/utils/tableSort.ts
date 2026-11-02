/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-11-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Description  : Universal Multi-Type Column Sorting Engine for SMRITI Reports
 */

import { useState, useMemo, useCallback } from "react";

export type SortDirection = "asc" | "desc";

export function sortTableData<T extends Record<string, any>>(
  data: T[],
  sortKey: string | null,
  sortDirection: SortDirection = "asc"
): T[] {
  if (!sortKey || !Array.isArray(data) || data.length === 0) return data;

  return [...data].sort((a, b) => {
    let aVal = a[sortKey];
    let bVal = b[sortKey];

    // Handle nulls and undefined
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    // Numeric comparison
    const aNum = Number(aVal);
    const bNum = Number(bVal);
    if (!isNaN(aNum) && !isNaN(bNum) && typeof aVal !== "boolean" && typeof bVal !== "boolean") {
      return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
    }

    // Date comparison
    const aDate = Date.parse(String(aVal));
    const bDate = Date.parse(String(bVal));
    if (!isNaN(aDate) && !isNaN(bDate) && (String(aVal).includes("-") || String(aVal).includes("/"))) {
      return sortDirection === "asc" ? aDate - bDate : bDate - aDate;
    }

    // String comparison
    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
    if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });
}

export interface UseTableSortResult<T> {
  sortKey: string | null;
  sortDirection: SortDirection;
  sortedData: T[];
  toggleSort: (key: string) => void;
  getSortIndicator: (key: string) => string;
}

export function useTableSort<T extends Record<string, any>>(
  data: T[],
  defaultKey: string | null = null,
  defaultDirection: SortDirection = "asc"
): UseTableSortResult<T> {
  const [sortKey, setSortKey] = useState<string | null>(defaultKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);

  const toggleSort = useCallback((key: string) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDirection((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
        return key;
      } else {
        setSortDirection("asc");
        return key;
      }
    });
  }, []);

  const getSortIndicator = useCallback(
    (key: string): string => {
      if (sortKey !== key) return "↕";
      return sortDirection === "asc" ? "↑" : "↓";
    },
    [sortKey, sortDirection]
  );

  const sortedData = useMemo(() => {
    return sortTableData(data, sortKey, sortDirection);
  }, [data, sortKey, sortDirection]);

  return {
    sortKey,
    sortDirection,
    sortedData,
    toggleSort,
    getSortIndicator,
  };
}
