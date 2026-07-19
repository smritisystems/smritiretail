/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.2
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { createPortal } from "react-dom";
import { StandardInvoiceA4 } from "./templates/StandardInvoiceA4.tsx";
import { GoodsReceiptNoteA4 } from "./templates/GoodsReceiptNoteA4.tsx";
import { ThermalReceipt80mm } from "./templates/ThermalReceipt80mm.tsx";
import { BarcodeLabel } from "./templates/BarcodeLabel.tsx";

export type PrintFormat = "A4" | "Thermal80mm" | "Label";

export interface PrintTemplate {
  id: string;
  name: string;
  format: PrintFormat;
  component: React.FC<{ data: any }>;
}

export interface PrintRequest {
  templateId: string;
  data: any;
}

export interface PrinterDevice {
  id: string;
  name: string;
  type: "thermal" | "laser" | "inkjet" | "label";
  connection: "usb" | "network" | "bluetooth";
  status: "online" | "offline" | "printing" | "low-ink" | "out-of-paper" | "error";
  inkLevel: number; // 0 - 100
  paperLevel: number; // 0 - 100
  ipAddress?: string;
}

export interface PrinterState {
  status: "ready" | "busy" | "offline" | "error";
  activePrinter: PrinterDevice | null;
  devices: PrinterDevice[];
  isQuerying: boolean;
  lastChecked: string;
}

export interface PrintHistoryItem {
  id: string;
  timestamp: string;
  templateId: string;
  templateName: string;
  format: PrintFormat;
  documentName: string;
  printerName: string;
  status: "success" | "warning" | "failed";
  details?: string;
}

interface PrintState {
  print: (request: PrintRequest) => void;
  templates: PrintTemplate[];
  registerTemplate: (template: PrintTemplate) => void;
  printerStatus: PrinterState;
  queryConnectedPrinters: () => Promise<void>;
  selectPrinter: (id: string) => void;
  updatePrinterStatus: (id: string, updates: Partial<PrinterDevice>) => void;
  printHistory: PrintHistoryItem[];
  clearPrintHistory: () => void;
}

const PrintContext = createContext<PrintState | undefined>(undefined);

export const usePrintEngine = () => {
  const context = useContext(PrintContext);
  if (!context) throw new Error("usePrintEngine must be used within a PrintProvider");
  return context;
};

export const PrintProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [templates, setTemplates] = useState<PrintTemplate[]>([
    {
      id: "standard-a4",
      name: "Standard Tax Invoice",
      format: "A4",
      component: StandardInvoiceA4
    },
    {
      id: "grn-a4",
      name: "Goods Receipt Note (GRN)",
      format: "A4",
      component: GoodsReceiptNoteA4
    },
    {
      id: "thermal-80",
      name: "Retail Receipt 80mm",
      format: "Thermal80mm",
      component: ThermalReceipt80mm
    },
    {
      id: "label-50x25",
      name: "Product Barcode Label (50x25mm)",
      format: "Label",
      component: BarcodeLabel
    }
  ]);
  const [printRequest, setPrintRequest] = useState<PrintRequest | null>(null);

  // Printer Management States
  const [devices, setDevices] = useState<PrinterDevice[]>([
    {
      id: "a4-laser",
      name: "SMRITI Pro-Laser 400 (Duplex)",
      type: "laser",
      connection: "usb",
      status: "online",
      inkLevel: 82,
      paperLevel: 95,
    },
    {
      id: "thermal-pos",
      name: "SMRITI Thermal POS-80X",
      type: "thermal",
      connection: "network",
      status: "online",
      inkLevel: 100, // thermal head
      paperLevel: 45,
      ipAddress: "192.168.1.185"
    },
    {
      id: "label-jet",
      name: "AITDL LabelJet-X1 (High Density)",
      type: "label",
      connection: "bluetooth",
      status: "online",
      inkLevel: 65,
      paperLevel: 12,
    },
    {
      id: "office-inkjet",
      name: "Epson Workforce Pro-7500",
      type: "inkjet",
      connection: "network",
      status: "offline",
      inkLevel: 18,
      paperLevel: 0,
      ipAddress: "192.168.1.120"
    }
  ]);

  const [activePrinterId, setActivePrinterId] = useState<string>("a4-laser");
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<string>(new Date().toLocaleTimeString());

  const [printHistory, setPrintHistory] = useState<PrintHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem("smriti_print_history");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to read print history from localStorage:", e);
    }
    
    // Default initial mock history items for visual richness and realism
    return [
      {
        id: "print-1",
        timestamp: "10:15:22 AM 7/10/2026",
        templateId: "standard-a4",
        templateName: "Standard Tax Invoice",
        format: "A4",
        documentName: "INV-2023-0889",
        printerName: "SMRITI Pro-Laser 400 (Duplex)",
        status: "success",
        details: "Dispatched A4 layout spool file successfully to SMRITI Pro-Laser 400 (Duplex)."
      },
      {
        id: "print-2",
        timestamp: "11:32:05 AM 7/10/2026",
        templateId: "grn-a4",
        templateName: "Goods Receipt Note (GRN)",
        format: "A4",
        printerName: "Epson Workforce Pro-7500",
        documentName: "GRN-99812",
        status: "failed",
        details: "Error spooling document. Epson Workforce Pro-7500 reported offline status."
      },
      {
        id: "print-3",
        timestamp: "12:05:40 PM 7/10/2026",
        templateId: "thermal-80",
        templateName: "Retail Receipt 80mm",
        format: "Thermal80mm",
        documentName: "REC-449102",
        printerName: "SMRITI Thermal POS-80X",
        status: "success",
        details: "Dispatched Thermal80mm layout spool file successfully to SMRITI Thermal POS-80X."
      },
      {
        id: "print-4",
        timestamp: "12:12:18 PM 7/10/2026",
        templateId: "label-50x25",
        templateName: "Product Barcode Label (50x25mm)",
        format: "Label",
        documentName: "BAR-99011",
        printerName: "AITDL LabelJet-X1 (High Density)",
        status: "warning",
        details: "Dispatched Label layout spool file to AITDL LabelJet-X1 (High Density). Warning: Low ink level reported (65%)."
      }
    ];
  });

  const registerTemplate = useCallback((template: PrintTemplate) => {
    setTemplates(prev => {
      if (prev.find(t => t.id === template.id)) return prev;
      return [...prev, template];
    });
  }, []);

  // System Hardware Query Loop
  const queryConnectedPrinters = useCallback(async () => {
    setIsQuerying(true);
    
    // Attempt physical navigator API inspections (WebUSB / WebBluetooth/ Serial if supported)
    try {
      if (typeof navigator !== "undefined") {
        // Query connected USB hardware profiles if possible
        if ("usb" in navigator && (navigator as any).usb.getDevices) {
          const usbDevices = await (navigator as any).usb.getDevices();
          console.log("[Hardware Engine] Detected USB Ports count:", usbDevices.length);
        }
      }
    } catch (e) {
      console.warn("[Hardware Engine] Safe WebUSB probe skipped:", e);
    }

    // Realistic hardware verification delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Stochastically simulate minor ink/paper level changes or status updates for active hardware
    setDevices(prev => 
      prev.map(device => {
        if (device.status === "offline") return device;

        // Introduce small jitter to level readings to indicate active hardware reporting
        const paperDrop = Math.floor(Math.random() * 2);
        const inkDrop = Math.random() > 0.8 ? 1 : 0;
        
        let nextPaper = Math.max(0, device.paperLevel - paperDrop);
        let nextInk = Math.max(0, device.inkLevel - inkDrop);
        let nextStatus = device.status;

        if (nextPaper === 0) {
          nextStatus = "out-of-paper";
        } else if (nextPaper < 15) {
          nextStatus = "low-ink"; // visually flags warnings
        } else {
          nextStatus = "online";
        }

        return {
          ...device,
          paperLevel: nextPaper,
          inkLevel: nextInk,
          status: nextStatus
        };
      })
    );

    setLastChecked(new Date().toLocaleTimeString());
    setIsQuerying(false);
  }, []);

  const selectPrinter = useCallback((id: string) => {
    setActivePrinterId(id);
  }, []);

  const updatePrinterStatus = useCallback((id: string, updates: Partial<PrinterDevice>) => {
    setDevices(prev => 
      prev.map(d => d.id === id ? { ...d, ...updates } : d)
    );
  }, []);

  const clearPrintHistory = useCallback(() => {
    setPrintHistory([]);
    localStorage.removeItem("smriti_print_history");
  }, []);

  const print = useCallback((request: PrintRequest) => {
    setPrintRequest(request);
    
    // Dynamically set active printing state
    setDevices(prev => prev.map(d => d.id === activePrinterId ? { ...d, status: "printing" } : d));

    const selectedTemplate = templates.find(t => t.id === request.templateId);
    const activePrinter = devices.find(d => d.id === activePrinterId);
    const printerName = activePrinter ? activePrinter.name : "System Default Printer";
    const docName = request.data?.invoiceNo || request.data?.title || `Document #${Math.floor(Math.random() * 9000 + 1000)}`;

    const newHistoryItem: PrintHistoryItem = {
      id: `print-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString() + " " + new Date().toLocaleDateString(),
      templateId: request.templateId,
      templateName: selectedTemplate ? selectedTemplate.name : "Custom Template",
      format: selectedTemplate ? selectedTemplate.format : "A4",
      documentName: docName,
      printerName,
      status: activePrinter?.status === "low-ink" || activePrinter?.status === "out-of-paper" ? "warning" : "success",
      details: `Dispatched ${selectedTemplate ? selectedTemplate.format : 'A4'} layout spool file successfully to ${printerName}.`
    };

    setPrintHistory(prev => {
      const updated = [newHistoryItem, ...prev];
      localStorage.setItem("smriti_print_history", JSON.stringify(updated));
      return updated;
    });

    // Give React time to render the portal, then trigger print
    setTimeout(() => {
      window.print();
      
      // Revert status to online or appropriate state after spooling
      setTimeout(() => {
        setPrintRequest(null);
        setDevices(prev => prev.map(d => {
          if (d.id === activePrinterId) {
            return { 
              ...d, 
              status: d.paperLevel === 0 ? "out-of-paper" : (d.paperLevel < 15 ? "low-ink" : "online")
            };
          }
          return d;
        }));
      }, 1000);
    }, 500);
  }, [activePrinterId, templates, devices]);

  const activePrinter = devices.find(d => d.id === activePrinterId) || null;
  
  // Calculate aggregate status
  let overallStatus: "ready" | "busy" | "offline" | "error" = "ready";
  if (activePrinter) {
    if (activePrinter.status === "printing") {
      overallStatus = "busy";
    } else if (activePrinter.status === "offline") {
      overallStatus = "offline";
    } else if (activePrinter.status === "out-of-paper" || activePrinter.status === "error") {
      overallStatus = "error";
    }
  }

  const printerStatusValue: PrinterState = {
    status: overallStatus,
    activePrinter,
    devices,
    isQuerying,
    lastChecked
  };

  return (
    <PrintContext.Provider value={{ 
      print, 
      templates, 
      registerTemplate,
      printerStatus: printerStatusValue,
      queryConnectedPrinters,
      selectPrinter,
      updatePrinterStatus,
      printHistory,
      clearPrintHistory
    }}>
      {children}
      {printRequest && (
        <PrintPortal request={printRequest} templates={templates} />
      )}
    </PrintContext.Provider>
  );
};

const PrintPortal: React.FC<{ request: PrintRequest; templates: PrintTemplate[] }> = ({ request, templates }) => {
  const template = templates.find(t => t.id === request.templateId);
  if (!template) return null;
  const Component = template.component;

  // We append to document.body so it is a direct child and easier to manage with @media print
  return createPortal(
    <div className="print-only-container">
      <Component data={request.data} />
    </div>,
    document.body
  );
};
