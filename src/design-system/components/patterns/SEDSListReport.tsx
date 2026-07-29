/**
 * Project      : SMRITI Business OS
 * Pattern      : SEDSListReport (Enterprise List Report Pattern)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SEDS Enterprise Layout Pattern
 */

import React from "react";
import { SEDSFilterBar, SEDSFilterField } from "../SEDSFilterBar";
import { SEDSToolbar, SEDSAction } from "../SEDSToolbar";
import { SEDSTable, SEDSColumn } from "../SEDSTable";

export interface SEDSListReportProps<T> {
  title: string;
  subtitle?: string;
  data: T[];
  columns: SEDSColumn<T>[];
  rowKey: (row: T) => string;
  filterFields?: SEDSFilterField[];
  filterValues?: Record<string, any>;
  onFilterChange?: (newFilters: Record<string, any>) => void;
  onFilterReset?: () => void;
  actions?: SEDSAction[];
  bulkActions?: React.ReactNode;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyText?: string;
}

export function SEDSListReport<T>({
  title,
  subtitle,
  data,
  columns,
  rowKey,
  filterFields = [],
  filterValues = {},
  onFilterChange,
  onFilterReset,
  actions = [],
  bulkActions,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  onRowClick,
  loading = false,
  emptyText = "No records matching current filter criteria.",
}: SEDSListReportProps<T>) {
  return (
    <div className="w-full flex flex-col gap-4 font-sans select-text">
      {/* 1. Page Header & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 shadow-lg">
        <div>
          <h1 className="text-xl font-bold text-theme-body tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs text-theme-muted mt-1">{subtitle}</p>}
        </div>

        {actions.length > 0 && <SEDSToolbar actions={actions} maxVisibleActions={7} />}
      </div>

      {/* 2. Smart Filter Bar */}
      {filterFields.length > 0 && onFilterChange && (
        <SEDSFilterBar
          fields={filterFields}
          values={filterValues}
          onChange={onFilterChange}
          onReset={onFilterReset}
          compact={false}
        />
      )}

      {/* 3. Data Table */}
      <SEDSTable
        data={data}
        columns={columns}
        rowKey={rowKey}
        selectable={selectable}
        selectedKeys={selectedKeys}
        onSelectionChange={onSelectionChange}
        onRowClick={onRowClick}
        bulkActions={bulkActions}
        loading={loading}
        emptyText={emptyText}
      />
    </div>
  );
}
