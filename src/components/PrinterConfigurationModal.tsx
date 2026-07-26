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
 * * Version    : 3.35.0 (SMRITI Barcode Printer USB & TCP/IP Config Studio)
 * * Created    : 2026-07-25
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { 
  Printer, X, Plus, Trash2, CheckCircle2, AlertTriangle, 
  Wifi, Usb, Cpu, RefreshCw, Radio, Play, Check, Server, Monitor
} from "lucide-react";
import { 
  PrinterProfile, PRNPrinterBrand, getStoredPrinterProfiles, 
  savePrinterProfiles, pushPrinterProfilesToNetwork, syncPrinterProfilesFromNetwork,
  testPrinterConnection, generateRawTestPrintScript 
} from "../services/universalLabelPrinterService.ts";

export interface PrinterConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrinterProfileChanged?: (updatedProfiles: PrinterProfile[], selectedPrinterId?: string) => void;
}

export const PrinterConfigurationModal: React.FC<PrinterConfigurationModalProps> = ({
  isOpen,
  onClose,
  onPrinterProfileChanged
}) => {
  if (!isOpen) return null;

  const [profiles, setProfiles] = useState<PrinterProfile[]>(() => getStoredPrinterProfiles());
  const [selectedProfileId, setSelectedProfileId] = useState<string>(() => {
    const defaultPrn = profiles.find(p => p.isDefault);
    return defaultPrn ? defaultPrn.id : profiles[0]?.id || "";
  });

  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; payload?: string } | null>(null);

  // Form State for Editing/Adding Printer Profile
  const activeEditingProfile = profiles.find(p => p.id === selectedProfileId);

  const [formData, setFormData] = useState<Partial<PrinterProfile>>(() => {
    if (activeEditingProfile) return { ...activeEditingProfile };
    return {
      id: `prn-${Date.now().toString().slice(-4)}`,
      name: "New Barcode Printer",
      printerBrand: "Zebra",
      protocol: "ZPL",
      connectionType: "TCP/IP",
      ipAddress: "192.168.1.100",
      port: 9100,
      usbPort: "USB001",
      dpi: 203,
      isDefault: false,
      status: "Ready",
      address: "192.168.1.100:9100"
    };
  });

  // Sync state when modal is opened or profile selection changes
  useEffect(() => {
    if (isOpen) {
      syncPrinterProfilesFromNetwork().then(freshProfiles => {
        setProfiles(freshProfiles);
        if (!isAddingNew) {
          const target = freshProfiles.find(p => p.id === selectedProfileId) || freshProfiles.find(p => p.isDefault) || freshProfiles[0];
          if (target) {
            setSelectedProfileId(target.id);
            setFormData({ ...target });
          }
        }
      });
    }
  }, [isOpen]);

  const handleSelectProfile = (id: string) => {
    setSelectedProfileId(id);
    setIsAddingNew(false);
    setTestResult(null);
    const target = profiles.find(p => p.id === id);
    if (target) {
      setFormData({ ...target });
    }
  };

  const handleAddNewClick = () => {
    const newId = `prn-${Date.now().toString().slice(-4)}`;
    const newProf: PrinterProfile = {
      id: newId,
      name: "New Custom Barcode Printer",
      printerBrand: "TSC",
      protocol: "TSPL",
      connectionType: "USB",
      usbPort: "USB001",
      dpi: 203,
      isDefault: profiles.length === 0,
      status: "Ready",
      address: "USB001"
    };
    setIsAddingNew(true);
    setSelectedProfileId(newId);
    setFormData(newProf);
    setTestResult(null);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    // Computed display address
    let computedAddress = formData.address || "";
    if (formData.connectionType === "TCP/IP") {
      computedAddress = `${formData.ipAddress || "192.168.1.1"}:${formData.port || 9100}`;
    } else if (formData.connectionType === "USB") {
      computedAddress = `${formData.usbPort || "USB001"}`;
    } else if (formData.connectionType === "COM") {
      computedAddress = `${formData.address || "COM1"} (${formData.baudRate || 9600} baud)`;
    } else {
      computedAddress = "Local Browser PDF";
    }

    const updatedProfile: PrinterProfile = {
      id: formData.id || `prn-${Date.now()}`,
      name: formData.name,
      protocol: formData.protocol || "ZPL",
      connectionType: formData.connectionType || "TCP/IP",
      address: computedAddress,
      isDefault: !!formData.isDefault,
      ipAddress: formData.ipAddress,
      port: formData.port || 9100,
      usbPort: formData.usbPort || "USB001",
      baudRate: formData.baudRate || 9600,
      printerBrand: formData.printerBrand || "Zebra",
      dpi: formData.dpi || 203,
      status: "Ready",
      description: formData.description || `${formData.printerBrand} ${formData.protocol} over ${formData.connectionType}`
    };

    let newProfilesList = [...profiles];
    
    // If set to default, clear other default flags
    if (updatedProfile.isDefault) {
      newProfilesList = newProfilesList.map(p => ({ ...p, isDefault: false }));
    }

    const existingIdx = newProfilesList.findIndex(p => p.id === updatedProfile.id);
    if (existingIdx >= 0) {
      newProfilesList[existingIdx] = updatedProfile;
    } else {
      newProfilesList.push(updatedProfile);
    }

    setProfiles(newProfilesList);
    savePrinterProfiles(newProfilesList);
    pushPrinterProfilesToNetwork(newProfilesList);
    setIsAddingNew(false);
    setSelectedProfileId(updatedProfile.id);

    if (onPrinterProfileChanged) {
      onPrinterProfileChanged(newProfilesList, updatedProfile.id);
    }
  };

  const handleDeleteProfile = (id: string) => {
    if (profiles.length <= 1) {
      alert("At least one barcode printer profile must remain in the configuration registry.");
      return;
    }
    const filtered = profiles.filter(p => p.id !== id);
    if (filtered.length > 0 && !filtered.some(p => p.isDefault)) {
      filtered[0].isDefault = true;
    }
    setProfiles(filtered);
    savePrinterProfiles(filtered);
    pushPrinterProfilesToNetwork(filtered);
    const nextSelected = filtered[0]?.id || "";
    setSelectedProfileId(nextSelected);
    if (filtered[0]) setFormData({ ...filtered[0] });

    if (onPrinterProfileChanged) {
      onPrinterProfileChanged(filtered, nextSelected);
    }
  };

  const handleTestConnection = () => {
    const targetProfile: PrinterProfile = {
      id: formData.id || "test-id",
      name: formData.name || "Test Printer",
      protocol: formData.protocol || "ZPL",
      connectionType: formData.connectionType || "TCP/IP",
      address: formData.address || "",
      isDefault: !!formData.isDefault,
      ipAddress: formData.ipAddress,
      port: formData.port,
      usbPort: formData.usbPort,
      baudRate: formData.baudRate,
      printerBrand: formData.printerBrand,
      dpi: formData.dpi
    };

    const res = testPrinterConnection(targetProfile);
    setTestResult(res);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-mono text-xs select-none">
      <div className="bg-theme-surface-1 border border-amber-500/30 rounded-2xl max-w-4xl w-full flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-theme-surface-2 px-6 py-4 border-b border-theme-divider flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Printer size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-theme-heading font-display">Barcode Standard Printer Hardware Setup</h2>
              <p className="text-[11px] text-theme-muted">Configure TCP/IP Network & Direct USB Barcode Label Printers (Zebra, TSC, TVS, Citizen)</p>
            </div>
          </div>
          
          <button onClick={onClose} className="p-1.5 text-theme-muted hover:text-theme-heading rounded-lg hover:bg-theme-surface-hover border border-theme-divider">
            <X size={18} />
          </button>
        </div>

        {/* Body Container */}
        <div className="grid grid-cols-12 flex-1 overflow-hidden">
          
          {/* Left Column: Printer Profiles List */}
          <div className="col-span-4 bg-theme-surface-2 border-r border-theme-divider p-4 space-y-3 flex flex-col">
            <div className="flex justify-between items-center border-b border-theme-divider pb-2">
              <span className="text-[10px] font-bold uppercase text-theme-muted tracking-wider">Configured Printers</span>
              <button 
                onClick={handleAddNewClick}
                className="px-2 py-1 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-lg border border-amber-500/40 text-[10px] font-bold flex items-center gap-1"
              >
                <Plus size={12} />
                <span>Add Printer</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {profiles.map(p => {
                const isSelected = p.id === selectedProfileId && !isAddingNew;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProfile(p.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-amber-950/40 border-amber-500/60 shadow-lg"
                        : "bg-theme-surface-3 border-theme-divider hover:border-amber-500/40 hover:bg-theme-surface-hover"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-theme-heading text-xs truncate max-w-[170px]">{p.name}</div>
                      {p.isDefault && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-bold">
                          DEFAULT
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-[10px]">
                      <span className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                        p.connectionType === "TCP/IP" 
                          ? "bg-indigo-950 text-indigo-300 border border-indigo-800/40" 
                          : p.connectionType === "USB"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800/40"
                          : "bg-theme-surface-1 text-theme-body border border-theme-divider"
                      }`}>
                        {p.connectionType === "TCP/IP" ? <Wifi size={10} /> : <Usb size={10} />}
                        {p.connectionType}
                      </span>

                      <span className="text-theme-muted font-mono">[{p.protocol}]</span>
                      <span className="text-theme-muted truncate">{p.printerBrand || "Generic"}</span>
                    </div>

                    <div className="text-[10px] text-theme-muted mt-1 font-mono truncate">
                      {p.connectionType === "TCP/IP" ? (
                        <span>IP: {p.ipAddress || "192.168.1.45"}:{p.port || 9100}</span>
                      ) : p.connectionType === "USB" ? (
                        <span>Port: {p.usbPort || "USB001"}</span>
                      ) : (
                        <span>{p.address}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Right Column: Configuration Form & Live Connection Tester */}
          <div className="col-span-8 p-6 overflow-y-auto space-y-5 bg-theme-surface-1">
            
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="flex justify-between items-center border-b border-theme-divider pb-3">
                <div>
                  <h3 className="text-sm font-bold text-theme-heading font-display">
                    {isAddingNew ? "Add New Barcode Printer" : `Configure Printer: ${formData.name}`}
                  </h3>
                  <span className="text-[10px] text-theme-muted">ID: {formData.id}</span>
                </div>

                <div className="flex items-center gap-2">
                  {!isAddingNew && (
                    <button 
                      type="button" 
                      onClick={() => handleDeleteProfile(formData.id!)}
                      className="px-2.5 py-1.5 bg-rose-950/50 text-rose-300 hover:bg-rose-900/60 rounded-xl border border-rose-500/30 flex items-center gap-1 text-[11px]"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  )}
                  <button 
                    type="submit" 
                    className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg text-[11px] flex items-center gap-1.5"
                  >
                    <Check size={14} />
                    <span>Save Printer Config</span>
                  </button>
                </div>
              </div>

              {/* Printer Profile Name & Brand */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-theme-muted block mb-1 text-[10px] font-bold uppercase">Printer Name / Identifier *</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.name || ""} 
                    onChange={e => setFormData({ ...formData, name: e.target.value })} 
                    placeholder="e.g. Zebra ZD421 Warehouse (TCP/IP)" 
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-theme-heading focus:outline-none focus:border-amber-500/60" 
                  />
                </div>

                <div>
                  <label className="text-theme-muted block mb-1 text-[10px] font-bold uppercase">Printer Brand / Manufacturer</label>
                  <select 
                    value={formData.printerBrand || "Zebra"} 
                    onChange={e => setFormData({ ...formData, printerBrand: e.target.value as PRNPrinterBrand })} 
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-theme-heading focus:outline-none"
                  >
                    <option value="Zebra">Zebra (ZD421 / ZT230 / ZT411)</option>
                    <option value="TSC">TSC (TE244 / DA210 / MB240)</option>
                    <option value="TVS">TVS (LP-46 Neo / Electronics)</option>
                    <option value="Citizen">Citizen (CL-S621 / CL-E321)</option>
                    <option value="Argox">Argox (OS-214 Plus)</option>
                    <option value="Godex">Godex (G500 / RT700)</option>
                    <option value="Brother">Brother (TD-4420TN)</option>
                    <option value="Generic/PDF">Generic / PDF Renderer</option>
                  </select>
                </div>
              </div>

              {/* Connection Mode Selection Tabs */}
              <div>
                <label className="text-theme-muted block mb-1.5 text-[10px] font-bold uppercase">Printer Connection Protocol Mode</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, connectionType: "TCP/IP", protocol: formData.protocol === "PDF" ? "ZPL" : formData.protocol })}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                      formData.connectionType === "TCP/IP"
                        ? "bg-indigo-950/60 border-indigo-500 text-indigo-300 shadow-lg font-bold"
                        : "bg-theme-surface-2 border-theme-divider text-theme-muted hover:text-theme-body"
                    }`}
                  >
                    <Wifi size={18} />
                    <span className="text-xs">TCP/IP Network</span>
                    <span className="text-[9px] opacity-70">Ethernet / Wi-Fi RAW Socket</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, connectionType: "USB", protocol: formData.protocol === "PDF" ? "TSPL" : formData.protocol })}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                      formData.connectionType === "USB"
                        ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-lg font-bold"
                        : "bg-theme-surface-2 border-theme-divider text-theme-muted hover:text-theme-body"
                    }`}
                  >
                    <Usb size={18} />
                    <span className="text-xs">Direct USB Port</span>
                    <span className="text-[9px] opacity-70">USB Spooler / Virtual COM</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, connectionType: "PDF", protocol: "PDF" })}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                      formData.connectionType === "PDF"
                        ? "bg-theme-surface-3 border-amber-500/50 text-amber-300 shadow-lg font-bold"
                        : "bg-theme-surface-2 border-theme-divider text-theme-muted hover:text-theme-body"
                    }`}
                  >
                    <Monitor size={18} />
                    <span className="text-xs">Virtual PDF Mode</span>
                    <span className="text-[9px] opacity-70">Browser Print / A4 Sheet</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Connection Parameters: TCP/IP vs USB */}
              {formData.connectionType === "TCP/IP" && (
                <div className="bg-theme-surface-2 border border-indigo-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                    <Server size={14} />
                    <span>TCP/IP Network Socket Parameters</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="text-theme-muted block mb-1 text-[10px]">Printer IP Address / Hostname *</label>
                      <input 
                        type="text" 
                        value={formData.ipAddress || ""} 
                        onChange={e => setFormData({ ...formData, ipAddress: e.target.value })} 
                        placeholder="e.g. 192.168.1.45" 
                        className="w-full bg-theme-surface-3 border border-theme-divider rounded-xl px-3 py-1.5 text-indigo-300 font-bold focus:outline-none" 
                      />
                    </div>
                    <div>
                      <label className="text-theme-muted block mb-1 text-[10px]">Network Port *</label>
                      <input 
                        type="number" 
                        value={formData.port || 9100} 
                        onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) || 9100 })} 
                        placeholder="9100" 
                        className="w-full bg-theme-surface-3 border border-theme-divider rounded-xl px-3 py-1.5 text-indigo-300 font-bold focus:outline-none" 
                      />
                    </div>
                  </div>
                  <div className="text-[10px] text-theme-muted">Standard barcode printers operate over RAW TCP Port 9100 (Direct JetDirect Socket).</div>
                </div>
              )}

              {formData.connectionType === "USB" && (
                <div className="bg-theme-surface-2 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <Usb size={14} />
                    <span>USB & Serial Port Parameters</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-theme-muted block mb-1 text-[10px]">USB Port / Device Name *</label>
                      <input 
                        type="text" 
                        value={formData.usbPort || "USB001"} 
                        onChange={e => setFormData({ ...formData, usbPort: e.target.value })} 
                        placeholder="e.g. USB001, COM4, Zebra ZD421" 
                        className="w-full bg-theme-surface-3 border border-theme-divider rounded-xl px-3 py-1.5 text-emerald-300 font-bold focus:outline-none" 
                      />
                    </div>

                    <div>
                      <label className="text-theme-muted block mb-1 text-[10px]">Serial Baud Rate (If COM Port)</label>
                      <select 
                        value={formData.baudRate || 9600} 
                        onChange={e => setFormData({ ...formData, baudRate: parseInt(e.target.value) })} 
                        className="w-full bg-theme-surface-3 border border-theme-divider rounded-xl px-3 py-1.5 text-theme-body focus:outline-none"
                      >
                        <option value={9600}>9600 Baud</option>
                        <option value={19200}>19200 Baud</option>
                        <option value={38400}>38400 Baud</option>
                        <option value={115200}>115200 Baud</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Protocol, Resolution & Default Settings */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-theme-muted block mb-1 text-[10px] font-bold uppercase">Command Protocol</label>
                  <select 
                    value={formData.protocol || "ZPL"} 
                    onChange={e => setFormData({ ...formData, protocol: e.target.value as any })} 
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-amber-300 font-bold focus:outline-none"
                  >
                    <option value="ZPL">ZPL / ZPL-II (Zebra Command)</option>
                    <option value="TSPL">TSPL / TSPL-2 (TSC / TVS / Godex)</option>
                    <option value="EPL">EPL (Eltron Printer Language)</option>
                    <option value="CPCL">CPCL (Mobile Printer Language)</option>
                    <option value="ESC-POS">ESC-POS (Thermal Receipt)</option>
                    <option value="PDF">PDF / Graphic Rendering</option>
                  </select>
                </div>

                <div>
                  <label className="text-theme-muted block mb-1 text-[10px] font-bold uppercase font-sans">Print Resolution (DPI)</label>
                  <select 
                    value={formData.dpi || 203} 
                    onChange={e => setFormData({ ...formData, dpi: parseInt(e.target.value) as any })} 
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-theme-body focus:outline-none"
                  >
                    <option value={203}>203 DPI (Standard Desktop/POS)</option>
                    <option value={300}>300 DPI (High Resolution Industrial)</option>
                    <option value={600}>600 DPI (Ultra Precision Jewelry)</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer bg-theme-surface-2 border border-theme-divider rounded-xl p-2.5 text-xs text-amber-300">
                    <input 
                      type="checkbox" 
                      checked={!!formData.isDefault} 
                      onChange={e => setFormData({ ...formData, isDefault: e.target.checked })} 
                      className="accent-amber-500" 
                    />
                    <span className="font-bold">Set as Default Printer</span>
                  </label>
                </div>
              </div>

              {/* Hardware Diagnostics & Connection Test Bar */}
              <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-theme-heading flex items-center gap-2">
                    <Cpu size={15} className="text-amber-400" />
                    Printer Hardware Diagnostics & Connection Test
                  </span>

                  <button
                    type="button"
                    onClick={handleTestConnection}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl font-bold text-xs flex items-center gap-1.5"
                  >
                    <Play size={13} />
                    <span>Test Hardware Connection</span>
                  </button>
                </div>

                {testResult && (
                  <div className={`p-3 rounded-xl border text-xs space-y-2 ${
                    testResult.success 
                      ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-200" 
                      : "bg-rose-950/40 border-rose-500/50 text-rose-200"
                  }`}>
                    <div className="flex items-center gap-2 font-bold">
                      {testResult.success ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertTriangle size={16} className="text-rose-400" />}
                      <span>{testResult.message}</span>
                    </div>

                    {testResult.payload && (
                      <pre className="text-[10px] bg-theme-surface-3 p-2 rounded border border-theme-divider text-amber-300 overflow-x-auto">
                        {testResult.payload}
                      </pre>
                    )}
                  </div>
                )}
              </div>

            </form>

          </div>

        </div>

      </div>
    </div>
  );
};

export default PrinterConfigurationModal;
