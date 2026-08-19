/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Inventory & Item Master Workspace (Global Screen Refactor)
 */

import React, { useMemo } from "react";
import { MasterListScreen } from "./global/master/MasterListScreen.tsx";
import { itemMasterConfig } from "./global/configs/itemMaster.config.tsx";
import { Product } from "../types.ts";
import { ExcelGridEntrySection } from "./ExcelGridEntrySection.tsx";
import { AttributeManagerSection } from "./AttributeManagerSection.tsx";
import { VariantTemplateSection } from "./VariantTemplateSection.tsx";
import { BulkImportSection } from "./BulkImportSection.tsx";
import { AttributeAnalyticsSection } from "./AttributeAnalyticsSection.tsx";
import { BarcodeMappingSection } from "./BarcodeMappingSection.tsx";
import { LabelPrintingSection } from "./LabelPrintingSection.tsx";

export interface ItemMasterTabProps {
  products?: Product[];
  onRefreshProducts?: () => Promise<void>;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  currentUser?: { role: string; name: string } | null;
  initialSubTab?: string;
}

export const ItemMasterTab: React.FC<ItemMasterTabProps> = ({
  products = [],
  onRefreshProducts,
  onNotification,
  currentUser,
  initialSubTab = "registry"
}) => {
  const handleNotify = onNotification || (() => {});
  const handleRefresh = onRefreshProducts || (async () => {});

  const enrichedConfig = useMemo(() => {
    return {
      ...itemMasterConfig,
      subTabs: [
        { id: "registry", label: "SKU Registry" },
        {
          id: "excel-grid",
          label: "Excel Quick Entry",
          renderContent: (items: Product[], refetch: () => void) => (
            <ExcelGridEntrySection
              onNotification={handleNotify}
              onRefreshProducts={async () => {
                await handleRefresh();
                refetch();
              }}
            />
          )
        },
        {
          id: "attributes",
          label: "Attribute Manager",
          renderContent: () => (
            <AttributeManagerSection onNotification={handleNotify} />
          )
        },
        {
          id: "templates",
          label: "Variant Templates",
          renderContent: (items: Product[], refetch: () => void) => (
            <VariantTemplateSection
              products={items.length > 0 ? items : products}
              onRefreshProducts={async () => {
                await handleRefresh();
                refetch();
              }}
              onNotification={handleNotify}
            />
          )
        },
        {
          id: "bulk",
          label: "Bulk Import",
          renderContent: (items: Product[], refetch: () => void) => (
            <BulkImportSection
              onNotification={handleNotify}
              onRefreshProducts={async () => {
                await handleRefresh();
                refetch();
              }}
            />
          )
        },
        {
          id: "analytics",
          label: "SKU Analytics",
          renderContent: () => (
            <AttributeAnalyticsSection onNotification={handleNotify} />
          )
        },
        {
          id: "barcode-mapping",
          label: "Barcode Mapping",
          renderContent: (items: Product[], refetch: () => void) => (
            <BarcodeMappingSection
              products={items.length > 0 ? items : products}
              onNotification={handleNotify}
              onRefreshProducts={async () => {
                await handleRefresh();
                refetch();
              }}
            />
          )
        },
        {
          id: "label-printing",
          label: "Label Printing",
          renderContent: () => (
            <LabelPrintingSection onNotification={handleNotify} currentUser={currentUser} />
          )
        }
      ]
    };
  }, [products, handleRefresh, handleNotify, currentUser]);

  return (
    <MasterListScreen<Product>
      config={enrichedConfig}
      currentUser={currentUser}
      onNotification={(t, m, type) => {
        if (onNotification) onNotification(t, m, type === "warning" || type === "info" ? "success" : type);
      }}
    />
  );
};
