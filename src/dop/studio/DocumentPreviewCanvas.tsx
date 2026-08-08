/**
 * Project      : SMRITI Retail OS
 * Component    : DocumentPreviewCanvas (DXP-DOC-001 Standard)
 * Description  : Isolated rendering canvas for document previews (A4, A5, Thermal, Label)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React from "react";
import { RegisteredDocumentDescriptor } from "../core/DocumentRegistry.ts";

interface DocumentPreviewCanvasProps {
  descriptor: RegisteredDocumentDescriptor;
  previewComponent: React.ComponentType<any>;
  previewData: any;
}

export const DocumentPreviewCanvas: React.FC<DocumentPreviewCanvasProps> = ({
  descriptor,
  previewComponent: PreviewComponent,
  previewData,
}) => {
  const getCanvasDimensions = () => {
    switch (descriptor.format) {
      case "A4":
        return { width: "210mm", minHeight: "297mm" };
      case "Thermal80mm":
        return { width: "80mm", minHeight: "150mm" };
      case "Label":
        return { width: "80mm", height: "40mm" };
      default:
        return { width: "210mm", minHeight: "297mm" };
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-theme-surface-3 relative p-8 font-sans">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(var(--color-theme-divider) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          opacity: 0.5,
        }}
      ></div>

      <div className="relative flex justify-center pb-20 pt-6">
        <div
          className="shadow-2xl ring-1 ring-black/5 bg-white transition-all transform origin-top"
          style={getCanvasDimensions()}
        >
          <div className="text-black bg-white w-full h-full p-4">
            <PreviewComponent data={previewData} />
          </div>
        </div>
      </div>
    </div>
  );
};
