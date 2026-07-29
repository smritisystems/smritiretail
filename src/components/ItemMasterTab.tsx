/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Product Master Composition Host (SLGP-001 v2.0 Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 5.4.0 (SLGP-001 v2.0 & Pattern C Master-Detail)
 */

import React, { useState, useMemo } from "react";
import { Product } from "../types.js";
import { FioriObjectPage } from "./common/FioriObjectPage.tsx";
export { FioriObjectPage as SEEFObjectPage };

import { WorkspaceLayout } from "../layout_engine/components/WorkspaceLayout.tsx";
import { ItemMasterToolbar, ItemMasterViewMode } from "./item_master/ItemMasterToolbar.tsx";
import { ItemMasterMasterList } from "./item_master/ItemMasterMasterList.tsx";
import { ItemMasterFormInspector } from "./item_master/ItemMasterFormInspector.tsx";
import { BarcodePrintDialog } from "./item_master/BarcodePrintDialog.tsx";

import { AttributeManagerSection } from "./AttributeManagerSection.tsx";
import { VariantTemplateSection } from "./VariantTemplateSection.tsx";
import { BulkImportSection } from "./BulkImportSection.tsx";
import { ExcelGridEntrySection } from "./ExcelGridEntrySection.tsx";
import { AttributeAnalyticsSection } from "./AttributeAnalyticsSection.tsx";
import { SmritiSpreadsheetPlatform } from "../spreadsheet/SmritiSpreadsheetPlatform.tsx";
import { ItemMasterAdapter } from "../spreadsheet/adapters/ItemMasterAdapter.ts";
import { apiFetchV1 } from "../lib/apiFetchV1.js";

interface ItemMasterTabProps {
  products: Product[];
  onRefreshProducts: () => Promise<void>;
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
  currentUser?: { role: string; name: string } | null;
}

export const ItemMasterTab: React.FC<ItemMasterTabProps> = ({
  products,
  onRefreshProducts,
  onNotification,
  currentUser
}) => {
  const isReadOnly = currentUser?.role === "Report User";
  const [viewMode, setViewMode] = useState<ItemMasterViewMode>("registry");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(products[0] || null);
  const [isBarcodeDialogOpen, setIsBarcodeDialogOpen] = useState<boolean>(false);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCategory = selectedCategory === "ALL" || p.category === selectedCategory;

      return matchSearch && matchCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  // Save product handler
  const handleSaveProduct = async (updated: Product) => {
    try {
      await apiFetchV1(`/products/${updated.id}`, {
        method: "PUT",
        body: JSON.stringify(updated)
      });
      onNotification("Product Updated", `Successfully saved ${updated.name}`, "success");
      await onRefreshProducts();
    } catch (err: any) {
      onNotification("Save Error", err?.message || "Failed to update product", "error");
    }
  };

  // Delete product handler
  const handleDeleteProduct = async (id: string) => {
    try {
      await apiFetchV1(`/products/${id}`, { method: "DELETE" });
      onNotification("Product Deleted", "Item removed from master registry", "success");
      setSelectedProduct(null);
      await onRefreshProducts();
    } catch (err: any) {
      onNotification("Delete Error", err?.message || "Failed to delete product", "error");
    }
  };

  // New product generator
  const handleNewProduct = () => {
    const newSku: Product = {
      id: `prod_${Date.now()}`,
      code: `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
      name: "New Product Record",
      sku: `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
      barcode: `${Math.floor(8900000000000 + Math.random() * 9000000000)}`,
      category: selectedCategory !== "ALL" ? selectedCategory : "General",
      mrp: 100,
      price: 100,
      purchase_price: 60,
      stock: 10,
      stock_qty: 10,
      uom: "Pcs",
      hsn_code: "8471",
      gst_rate: 18
    };
    setSelectedProduct(newSku);
  };

  const spreadsheetColumns = useMemo(() => ItemMasterAdapter.getColumns(), []);
  const spreadsheetRows = useMemo(() => ItemMasterAdapter.toGridRows(products), [products]);

  // Mode Switcher View Rendering
  if (viewMode === "excel-grid") {
    return (
      <WorkspaceLayout
        mode="studio"
        toolbar={
          <ItemMasterToolbar
            activeMode={viewMode}
            onModeChange={setViewMode}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            productCount={filteredProducts.length}
            onNewProduct={handleNewProduct}
            onRefresh={onRefreshProducts}
            onOpenBarcodeHub={() => setIsBarcodeDialogOpen(true)}
            isReadOnly={isReadOnly}
          />
        }
      >
        <ExcelGridEntrySection
          onRefreshProducts={onRefreshProducts}
          onNotification={onNotification}
        />
      </WorkspaceLayout>
    );
  }

  if (viewMode === "attributes") {
    return (
      <WorkspaceLayout
        mode="scroll"
        toolbar={
          <ItemMasterToolbar
            activeMode={viewMode}
            onModeChange={setViewMode}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            productCount={filteredProducts.length}
            onNewProduct={handleNewProduct}
            onRefresh={onRefreshProducts}
            onOpenBarcodeHub={() => setIsBarcodeDialogOpen(true)}
            isReadOnly={isReadOnly}
          />
        }
      >
        <AttributeManagerSection onNotification={onNotification} />
      </WorkspaceLayout>
    );
  }

  if (viewMode === "templates") {
    return (
      <WorkspaceLayout
        mode="scroll"
        toolbar={
          <ItemMasterToolbar
            activeMode={viewMode}
            onModeChange={setViewMode}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            productCount={filteredProducts.length}
            onNewProduct={handleNewProduct}
            onRefresh={onRefreshProducts}
            onOpenBarcodeHub={() => setIsBarcodeDialogOpen(true)}
            isReadOnly={isReadOnly}
          />
        }
      >
        <VariantTemplateSection
          products={products}
          onRefreshProducts={onRefreshProducts}
          onNotification={onNotification}
        />
      </WorkspaceLayout>
    );
  }

  if (viewMode === "bulk") {
    return (
      <WorkspaceLayout
        mode="scroll"
        toolbar={
          <ItemMasterToolbar
            activeMode={viewMode}
            onModeChange={setViewMode}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            productCount={filteredProducts.length}
            onNewProduct={handleNewProduct}
            onRefresh={onRefreshProducts}
            onOpenBarcodeHub={() => setIsBarcodeDialogOpen(true)}
            isReadOnly={isReadOnly}
          />
        }
      >
        <BulkImportSection onRefreshProducts={onRefreshProducts} onNotification={onNotification} />
      </WorkspaceLayout>
    );
  }

  if (viewMode === "analytics") {
    return (
      <WorkspaceLayout
        mode="scroll"
        toolbar={
          <ItemMasterToolbar
            activeMode={viewMode}
            onModeChange={setViewMode}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            productCount={filteredProducts.length}
            onNewProduct={handleNewProduct}
            onRefresh={onRefreshProducts}
            onOpenBarcodeHub={() => setIsBarcodeDialogOpen(true)}
            isReadOnly={isReadOnly}
          />
        }
      >
        <AttributeAnalyticsSection onNotification={onNotification} />
      </WorkspaceLayout>
    );
  }

  // Primary Default View: Pattern C Master–Detail Split-Pane Workspace
  return (
    <>
      <WorkspaceLayout
        mode="master-detail"
        toolbar={
          <ItemMasterToolbar
            activeMode={viewMode}
            onModeChange={setViewMode}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            productCount={filteredProducts.length}
            onNewProduct={handleNewProduct}
            onRefresh={onRefreshProducts}
            onOpenBarcodeHub={() => setIsBarcodeDialogOpen(true)}
            isReadOnly={isReadOnly}
          />
        }
        masterPanel={
          <ItemMasterMasterList
            products={filteredProducts}
            selectedProductId={selectedProduct?.id || null}
            onSelectProduct={setSelectedProduct}
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        }
        detailPanel={
          <ItemMasterFormInspector
            product={selectedProduct}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onOpenBarcodeDialog={() => setIsBarcodeDialogOpen(true)}
            isReadOnly={isReadOnly}
          />
        }
        statusBar={
          <div className="flex items-center justify-between w-full font-mono text-[11px] text-theme-muted">
            <span>Pattern C Master–Detail Workspace Active</span>
            <span>Total SKUs: {products.length} | Displayed: {filteredProducts.length}</span>
          </div>
        }
      />

      {/* Barcode Tag Thermal Print Dialog */}
      <BarcodePrintDialog
        isOpen={isBarcodeDialogOpen}
        onClose={() => setIsBarcodeDialogOpen(false)}
        product={selectedProduct}
        onNotification={onNotification}
      />
    </>
  );
};
