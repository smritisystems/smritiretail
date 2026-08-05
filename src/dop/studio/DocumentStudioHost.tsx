/**
 * Project      : SMRITI Retail OS
 * Component    : DocumentStudio (SCS-DXP-001 / DXP-DOC-001 Modular Architecture)
 * Description  : Modular Platform Document Studio assembling selector, toolbar, canvas,
 *                and Universal Label Designer.
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 3.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 *
 * DXP-DOC-001 Compliance Declaration
 * Principle    : Dynamic Document Discovery — DocumentStudio queries DocumentRegistry.listAll()
 *                to render document types dynamically without monolithic switch statements.
 */

import React, { useState, useEffect } from "react";
import { DocumentRegistry } from "../core/DocumentRegistry.ts";
import { DxpDocumentType, DxpOutputChannel } from "../models/DxpTypes.ts";
import { DocumentService } from "../core/DocumentService.ts";
import { DocumentTypeSelector } from "./DocumentTypeSelector.tsx";
import { DocumentOutputToolbar } from "./DocumentOutputToolbar.tsx";
import { DocumentPreviewCanvas } from "./DocumentPreviewCanvas.tsx";
import { UniversalLabelPrintingStudio } from "../../components/label_print/UniversalLabelPrintingStudio.tsx";
import { products as storeProducts } from "../../state/store.ts";
import { usePrintEngine } from "../../print_engine/print_store.tsx";
import { useLayoutEngine } from "../../layout_engine/layout_store.tsx";
import { StandardInvoiceA4 } from "../../print_engine/templates/StandardInvoiceA4.tsx";
import { ThermalReceipt80mm } from "../../print_engine/templates/ThermalReceipt80mm.tsx";
import { GoodsReceiptNoteA4 } from "../../print_engine/templates/GoodsReceiptNoteA4.tsx";
import { BarcodeLabel } from "../../print_engine/templates/BarcodeLabel.tsx";

const MOCK_DATA = {
  invoiceNo: "INV-2026-0891",
  date: "2026-08-06",
  companyName: "SMRITI Enterprise Co.",
  customerName: "Acme Retail Corp",
  items: [
    { name: "Wireless Keyboard", qty: 2, rate: 1450.0 },
    { name: "Optical Mouse", qty: 5, rate: 450.0 },
    { name: "USB-C Multi-Hub", qty: 1, rate: 2250.0 },
  ],
  subtotal: 7400.0,
  tax: 1332.0,
  total: 8732.0,
  cashier: "Jawahar M.",
  paymentMethod: "UPI",
  paid: 8732.0,
};

const BARCODE_DEMO_DATA = {
  invoiceNo: "LABEL-DEMO-001",
  date: "2026-08-06",
  companyName: "SMRITI Retail OS",
  customerName: "Demo Store",
  items: [{ name: "Smriti Running Shoe (Black - UK8)", qty: 1, rate: 1299.0, barcode: "8901234567890" }],
  subtotal: 1299.0,
  tax: 0.0,
  total: 1299.0,
  cashier: "Demo Cashier",
  paymentMethod: "CASH",
  paid: 1299.0,
};

export const DocumentStudio: React.FC = () => {
  const { print, registerTemplate, templates } = usePrintEngine();
  const { addToRecentlyUsed } = useLayoutEngine();
  const [selectedDocType, setSelectedDocType] = useState<DxpDocumentType>("INVOICE");
  const [isLabelDesignerActive, setIsLabelDesignerActive] = useState<boolean>(false);
  const [outputStatus, setOutputStatus] = useState<string | null>(null);

  useEffect(() => {
    registerTemplate({ id: "standard-a4", name: "Standard Tax Invoice (A4)", format: "A4", component: StandardInvoiceA4 });
    registerTemplate({ id: "grn-a4", name: "Goods Receipt Note (GRN)", format: "A4", component: GoodsReceiptNoteA4 });
    registerTemplate({ id: "thermal-80", name: "Retail Receipt (80mm Thermal)", format: "Thermal80mm", component: ThermalReceipt80mm });
    registerTemplate({ id: "label-50x25", name: "Product Barcode Label (50x25mm)", format: "Label", component: BarcodeLabel });
  }, [registerTemplate]);

  const activeDescriptor = DocumentRegistry.getDescriptor(selectedDocType);

  const getPreviewComponent = () => {
    if (selectedDocType === "GRN") return GoodsReceiptNoteA4;
    if (selectedDocType === "RECEIPT") return ThermalReceipt80mm;
    if (selectedDocType === "BARCODE_LABEL" || selectedDocType === "SHELF_LABEL") return BarcodeLabel;
    return StandardInvoiceA4;
  };

  const getPreviewData = () => {
    return selectedDocType === "BARCODE_LABEL" || selectedDocType === "SHELF_LABEL" ? BARCODE_DEMO_DATA : MOCK_DATA;
  };

  const handleExecuteChannel = async (channel: DxpOutputChannel) => {
    try {
      const res = await DocumentService.execute({
        documentType: selectedDocType,
        referenceId: getPreviewData().invoiceNo,
        channel: channel,
        data: getPreviewData(),
      });

      if (channel === "PRINT") {
        const targetTemplateId = activeDescriptor.defaultTemplateId || "standard-a4";
        print({ templateId: targetTemplateId, data: getPreviewData() });
      }

      setOutputStatus(`Dispatched via ${res.channel} channel (State: ${res.lifecycleState})`);
      setTimeout(() => setOutputStatus(null), 4000);
    } catch (err: any) {
      setOutputStatus(`Execution error: ${err.message || "Failed to process"}`);
    }
  };

  if (isLabelDesignerActive) {
    return (
      <div className="h-full flex flex-col bg-theme-base font-sans">
        <div className="h-12 border-b border-theme-divider bg-theme-surface-1 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLabelDesignerActive(false)}
              className="text-xs font-semibold text-blue-500 hover:underline cursor-pointer"
            >
              ← Back to Document Studio
            </button>
            <span className="text-theme-divider">|</span>
            <span className="text-xs font-bold text-theme-primary">Universal Label & Sticker Studio (SLPS)</span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <UniversalLabelPrintingStudio products={storeProducts} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-theme-base font-sans overflow-hidden text-theme-body">
      {/* Dynamic Selector Sidebar */}
      <DocumentTypeSelector
        selectedType={selectedDocType}
        onSelectType={(docType) => {
          setSelectedDocType(docType);
          setIsLabelDesignerActive(false);
        }}
        onLaunchLabelDesigner={() => setIsLabelDesignerActive(true)}
        isLabelDesignerActive={isLabelDesignerActive}
      />

      {/* Main Studio Area */}
      <div className="flex-1 flex flex-col bg-theme-surface-2 relative">
        <DocumentOutputToolbar
          descriptor={activeDescriptor}
          outputStatus={outputStatus}
          onExecuteChannel={handleExecuteChannel}
          onViewSpoolLogs={() => addToRecentlyUsed("print-history")}
        />

        <DocumentPreviewCanvas
          descriptor={activeDescriptor}
          previewComponent={getPreviewComponent()}
          previewData={getPreviewData()}
        />
      </div>
    </div>
  );
};
