/**
 * Project      : SMRITI Retail OS
 * Component    : DocumentStudio (SCS-DXP-001 Enterprise Architecture)
 * Description  : Modular Platform Document Studio consuming DocumentRegistry (DXP-DOC-001),
 *                DocumentRendererRegistry (DXP-REN-001), and OutputChannelRegistry (DXP-OUT-001).
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 4.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React, { useState } from "react";
import { DocumentRegistry } from "../core/DocumentRegistry.ts";
import { DocumentRendererRegistry } from "../core/DocumentRendererRegistry.ts";
import { OutputChannelRegistry } from "../core/OutputChannelRegistry.ts";
import { DxpDocumentType, DxpOutputChannel } from "../models/DxpTypes.ts";
import { DocumentExplorer } from "./DocumentExplorer.tsx";
import { DocumentOutputToolbar } from "./DocumentOutputToolbar.tsx";
import { DocumentPreviewCanvas } from "./DocumentPreviewCanvas.tsx";
import { UniversalLabelPrintingStudio } from "../../components/label_print/UniversalLabelPrintingStudio.tsx";
import { products as storeProducts } from "../../state/store.ts";
import { usePrintEngine } from "../../print_engine/print_store.tsx";
import { useLayoutEngine } from "../../layout_engine/layout_store.tsx";

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
  const { print } = usePrintEngine();
  const { addToRecentlyUsed } = useLayoutEngine();
  const [selectedDocType, setSelectedDocType] = useState<DxpDocumentType>("INVOICE");
  const [isLabelDesignerActive, setIsLabelDesignerActive] = useState<boolean>(false);
  const [outputStatus, setOutputStatus] = useState<string | null>(null);

  const activeDescriptor = DocumentRegistry.getDescriptor(selectedDocType);
  const PreviewComponent = DocumentRendererRegistry.resolve(selectedDocType);

  const getPreviewData = () => {
    return selectedDocType === "BARCODE_LABEL" || selectedDocType === "SHELF_LABEL" ? BARCODE_DEMO_DATA : MOCK_DATA;
  };

  const handleExecuteChannel = async (channelId: DxpOutputChannel) => {
    try {
      const channelPlugin = OutputChannelRegistry.get(channelId);
      if (!channelPlugin) {
        throw new Error(`Output channel ${channelId} not registered`);
      }

      const res = await channelPlugin.execute({
        documentType: selectedDocType,
        referenceId: getPreviewData().invoiceNo,
        channel: channelId,
        data: getPreviewData(),
      });

      if (channelId === "PRINT") {
        print({ templateId: activeDescriptor.defaultTemplateId || "standard-a4", data: getPreviewData() });
      }

      setOutputStatus(`Dispatched via ${channelPlugin.title} (State: ${res.lifecycleState})`);
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
      {/* Decoupled Document Explorer */}
      <DocumentExplorer
        selectedType={selectedDocType}
        onSelectType={(docType) => {
          setSelectedDocType(docType);
          setIsLabelDesignerActive(false);
        }}
        onLaunchLabelDesigner={() => setIsLabelDesignerActive(true)}
        isLabelDesignerActive={isLabelDesignerActive}
      />

      {/* Main Studio Workspace */}
      <div className="flex-1 flex flex-col bg-theme-surface-2 relative">
        <DocumentOutputToolbar
          descriptor={activeDescriptor}
          outputStatus={outputStatus}
          onExecuteChannel={handleExecuteChannel}
          onViewSpoolLogs={() => addToRecentlyUsed("print-history")}
        />

        <DocumentPreviewCanvas
          descriptor={activeDescriptor}
          previewComponent={PreviewComponent}
          previewData={getPreviewData()}
        />
      </div>
    </div>
  );
};
