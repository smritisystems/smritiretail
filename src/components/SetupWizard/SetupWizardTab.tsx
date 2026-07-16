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
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.16.0
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-12
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { apiFetchV1 } from "../../lib/apiFetch.ts";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Building2,
  GitBranch,
  ShieldAlert,
  Sliders,
  DollarSign,
  Tag,
  Printer,
  Users,
  MessageSquare,
  BadgeCheck,
  ChevronRight,
  ChevronLeft,
  Store,
  Check,
  Plus,
  Trash2,
  Lightbulb,
  FileText,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Database
} from "lucide-react";
import { INDIAN_STATES } from "../../constants/indianStates";
import { isValidGSTIN, isValidPIN } from "../../utils/validators";

const INDIAN_STATES_MAP: Record<string, string> = {};
INDIAN_STATES.forEach(s => {
  INDIAN_STATES_MAP[s.code] = s.name;
});;

interface StoreConfig {
  id: string;
  name: string;
  code: string;
  type: "Company Owned" | "Franchise" | "Kiosk";
  address: string;
  landmark?: string;
  city: string;
  state: string;
  pinCode: string;
  contactPerson: string;
  mobile: string;
  email: string;
}

interface StaffUser {
  id: string;
  name: string;
  username: string;
  role: "Owner" | "Administrator" | "Store Manager" | "Cashier" | "Accountant" | "Inventory Executive";
  email: string;
}

interface SetupWizardProps {
  onComplete?: () => void;
}

export const SetupWizardTab: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 11;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [setupSuccess, setSetupSuccess] = useState(false);

  // Form States
  const [welcomeMode, setWelcomeMode] = useState<"new" | "demo" | "restore">("new");
  
  // Step 2: Business Info
  const [businessName, setBusinessName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [businessType, setBusinessType] = useState("retail"); // retail, wholesale, brand, franchise, hybrid
  const [gstin, setGstin] = useState("");
  const [pan, setPan] = useState("");
  const [detectedState, setDetectedState] = useState("");
  const [financialYear, setFinancialYear] = useState("2026-2027");
  const [booksStartDate, setBooksStartDate] = useState("2026-04-01");
  const [currency] = useState("INR (₹)");

  // Step 3: Org Structure
  const [orgLayout, setOrgLayout] = useState("single"); // single, multi, chain, distributor
  const [stores, setStores] = useState<StoreConfig[]>([
    {
      id: "st-1",
      name: "Main Flagship Store",
      code: "GKP01",
      type: "Company Owned",
      address: "Plot No. X-10, Sector 1A, Belvadari, Jaitpur, Kalesar Industrial Area, GIDA",
      landmark: "",
      city: "Gorakhpur",
      state: "Uttar Pradesh",
      pinCode: "273209",
      contactPerson: "Pushpa",
      mobile: "9324117007",
      email: "gida@smritibooks.com"
    }
  ]);

  // Dynamic store form inputs
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreCode, setNewStoreCode] = useState("");
  const [newStoreType, setNewStoreType] = useState<"Company Owned" | "Franchise" | "Kiosk">("Company Owned");
  const [newStoreCity, setNewStoreCity] = useState("");
  const [newStorePincode, setNewStorePincode] = useState("");
  const [newStoreAddress, setNewStoreAddress] = useState("");
  const [newStoreLandmark, setNewStoreLandmark] = useState("");
  const [newStoreState, setNewStoreState] = useState("");

  // Step 4: Operations & Modules
  const [modules, setModules] = useState<Record<string, boolean>>({
    pos: true,
    inventory: true,
    purchase: true,
    sales: true,
    crm: true,
    barcode: true,
    terms: true,
    exchange: true,
    batch: false,
    serial: false
  });

  // Step 5: Tax & Accounting
  const [gstType, setGstType] = useState("regular"); // regular, composition, exempt
  const [createLedgers, setCreateLedgers] = useState(true);
  const [roundOffMode, setRoundOffMode] = useState("auto");
  const [bankName, setBankName] = useState("HDFC Bank");
  const [accountNo, setAccountNo] = useState("");
  const [ifsc, setIfsc] = useState("");

  // Step 6: Inventory Policy
  const [valuationMethod, setValuationMethod] = useState("FIFO");
  const [negativeStock, setNegativeStock] = useState("block"); // block, warn, allow
  const [baseUOM, setBaseUOM] = useState("Nos");

  // Step 7: Document Numbering Series Previews
  const [gaplessSequencing, setGaplessSequencing] = useState(true);

  // Step 8: POS Configuration
  const [posPrinterWidth, setPosPrinterWidth] = useState("80mm");
  const [paymentModes, setPaymentModes] = useState<Record<string, boolean>>({
    cash: true,
    card: true,
    upi: true,
    credit: false
  });

  // Step 9: Staff & Security Users
  const [staffList, setStaffList] = useState<StaffUser[]>([
    { id: "u-1", name: "SMRITI Owner", username: "admin", role: "Owner", email: "support@smritibooks.com" },
    { id: "u-2", name: "Kishore Kumar", username: "kishore_cashier", role: "Cashier", email: "kishore@smritibooks.com" }
  ]);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<StaffUser["role"]>("Cashier");
  const [newStaffEmail, setNewStaffEmail] = useState("");

  // Step 10: Communications preferences
  const [alerts, setAlerts] = useState<Record<string, boolean>>({
    invoiceWhatsApp: true,
    invoiceEmail: true,
    lowStockSMS: true,
    shiftReportEmail: true
  });

  // Automated Field Deductions and Validations
  useEffect(() => {
    // GSTIN parser
    const cleanedGst = gstin.trim().toUpperCase();
    if (cleanedGst.length >= 2) {
      const stateCode = cleanedGst.slice(0, 2);
      if (INDIAN_STATES_MAP[stateCode]) {
        setDetectedState(INDIAN_STATES_MAP[stateCode]);
        // Update first store state if not manually touched
        setStores(prev => 
          prev.map((s, idx) => idx === 0 ? { ...s, state: INDIAN_STATES_MAP[stateCode] } : s)
        );
      } else {
        setDetectedState("Unknown/Invalid State Code");
      }
    } else {
      setDetectedState("");
    }

    if (cleanedGst.length >= 12) {
      // PAN is characters 3 to 12
      const extractedPan = cleanedGst.slice(2, 12);
      setPan(extractedPan);
    }
  }, [gstin]);

  // Helper to suggest Store Codes
  const suggestStoreCode = (name: string): string => {
    if (!name) return "";
    const clean = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const base = clean.substring(0, 3);
    const existingCount = stores.filter(s => s.code.startsWith(base)).length;
    return `${base}${String(existingCount + 1).padStart(2, "0")}`;
  };

  const handleAddStore = () => {
    if (!newStoreName) return;
    const code = newStoreCode.trim().toUpperCase() || suggestStoreCode(newStoreName);
    
    // Check duplicate code
    if (stores.some(s => s.code === code)) {
      alert(`Store code ${code} already exists! Please choose a unique code.`);
      return;
    }

    if (newStorePincode && !isValidPIN(newStorePincode)) {
      alert("Invalid Pincode. Pincode must be exactly 6 digits.");
      return;
    }

    const newStore: StoreConfig = {
      id: "st-" + Date.now(),
      name: newStoreName,
      code,
      type: newStoreType,
      address: newStoreAddress,
      landmark: newStoreLandmark || undefined,
      city: newStoreCity || "Gorakhpur",
      state: newStoreState || detectedState || "Uttar Pradesh",
      pinCode: newStorePincode || "273209",
      contactPerson: "Branch Manager",
      mobile: "",
      email: ""
    };

    setStores([...stores, newStore]);
    setNewStoreName("");
    setNewStoreCode("");
    setNewStoreCity("");
    setNewStorePincode("");
    setNewStoreAddress("");
    setNewStoreLandmark("");
    setNewStoreState("");
  };

  const handleRemoveStore = (id: string) => {
    if (stores.length <= 1) {
      alert("At least one primary store or branch is required.");
      return;
    }
    setStores(stores.filter(s => s.id !== id));
  };

  const handleAddStaff = () => {
    if (!newStaffName) return;
    const username = newStaffName.toLowerCase().replace(/[^a-z0-9]/g, "") + "_" + Math.floor(Math.random() * 100);
    const newStaff: StaffUser = {
      id: "u-" + Date.now(),
      name: newStaffName,
      username,
      role: newStaffRole,
      email: newStaffEmail || `${username}@smritibooks.com`
    };
    setStaffList([...staffList, newStaff]);
    setNewStaffName("");
    setNewStaffEmail("");
  };

  const handleRemoveStaff = (id: string) => {
    setStaffList(staffList.filter(u => u.id !== id));
  };

  // Automated operational suggestions based on business persona
  useEffect(() => {
    if (businessType === "retail") {
      setModules({
        pos: true,
        inventory: true,
        purchase: true,
        sales: false,
        crm: true,
        barcode: true,
        terms: true,
        exchange: false,
        batch: false,
        serial: false
      });
    } else if (businessType === "wholesale" || businessType === "distributor") {
      setModules({
        pos: false,
        inventory: true,
        purchase: true,
        sales: true,
        crm: true,
        barcode: true,
        terms: true,
        exchange: true,
        batch: true,
        serial: true
      });
    } else {
      setModules({
        pos: true,
        inventory: true,
        purchase: true,
        sales: true,
        crm: true,
        barcode: true,
        terms: true,
        exchange: true,
        batch: true,
        serial: true
      });
    }
  }, [businessType]);

  const handleNext = () => {
    // Validate current step before moving
    if (currentStep === 2) {
      if (!businessName) {
        alert("Please enter your Company Name to proceed.");
        return;
      }
      if (gstin && !isValidGSTIN(gstin)) {
        alert("Please enter a valid Indian GSTIN format (e.g. 09AAACS1234A1Z1) or clear the field.");
        return;
      }
    }
    if (currentStep === 3) {
      for (const st of stores) {
        if (st.pinCode && !isValidPIN(st.pinCode)) {
          alert(`Store '${st.name}' has an invalid Pincode. Pincode must be exactly 6 digits.`);
          return;
        }
      }
    }
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCompleteSetup = async () => {
    setIsSubmitting(true);
    try {
      const data = await apiFetchV1("/company/setup", {
        method: "POST",
        body: JSON.stringify({
          businessInfo: {
            name: businessName,
            tradeName,
            businessType,
            gstin,
            pan,
            state: detectedState,
            financialYear,
            booksStartDate
          },
          orgStructure: {
            layout: orgLayout,
            stores
          },
          operations: {
            modules
          },
          accounting: {
            gstType,
            createLedgers,
            roundOffMode,
            bankName,
            accountNo,
            ifsc
          },
          inventory: {
            valuation: valuationMethod,
            negativeStock,
            baseUOM
          },
          pos: {
            printerWidth: posPrinterWidth,
            paymentModes
          },
          users: {
            staff: staffList
          }
        })
      });

      if (data && data.success) {
        setSetupSuccess(true);
        localStorage.setItem("smriti_setup_completed", "true");
        localStorage.setItem("smriti_setup_business_type", businessType);
        setTimeout(() => {
          if (onComplete) {
            onComplete();
          } else {
            // Hard reload to sync fresh state
            window.location.reload();
          }
        }, 3000);
      } else {
        alert("Setup submission failed. Please try again.");
      }
    } catch (e) {
      console.error(e);
      alert("Network error during setup provisioning. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-theme-base select-text overflow-y-auto pb-10">
      {/* Permanent Coding Header Rule Metadata */}
      <div className="hidden">
        Project    : SMRITI Retail OS
        Author     : Jawahar Ramkripal Mallah
        Email      : support@smritibooks.com
        Websites   : smritibooks.com | erpnbook.com | aitdl.com
        Version    : 2.1.2
        Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
      </div>

      <AnimatePresence mode="wait">
        {setupSuccess ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center py-20 px-6 text-center"
          >
            <div className="w-24 h-24 rounded-full bg-emerald-950 border border-emerald-500 flex items-center justify-center text-emerald-400 mb-6 shadow-2xl animate-bounce">
              <CheckCircle2 size={48} className="animate-pulse" />
            </div>
            <h2 className="font-display font-bold text-2xl text-theme-body mb-2">
              SMRITI Retail OS Activated!
            </h2>
            <p className="text-sm text-theme-muted max-w-md leading-relaxed mb-6">
              Your organization **{businessName}** has been successfully provisioned on the Event Sourcing Engine. Creating stock ledgers, base tax profiles, document serial mappings, and counter terminals...
            </p>
            <div className="flex items-center space-x-2 text-xs font-mono text-indigo-400 bg-indigo-950 border border-indigo-900 rounded-xl px-4 py-2">
              <Database size={12} className="animate-spin" />
              <span>COMMITTING TRANSACTION STREAM TO CLOUD_SQL</span>
            </div>
          </motion.div>
        ) : (
          <div className="flex-1 max-w-4xl w-full mx-auto px-4 md:px-8 py-6 flex flex-col justify-between">
            
            {/* Header / Tracker */}
            <div className="mb-8 border-b border-theme-divider pb-4 flex flex-col md:flex-row md:items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="p-1 rounded-lg bg-blue-950 border border-blue-900 text-blue-400">
                    <Sparkles size={16} />
                  </span>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-theme-muted font-bold">
                    Interactive Setup Wizard
                  </span>
                </div>
                <h1 className="font-display font-bold text-xl text-theme-body mt-1">
                  Configure Your Retail Ecosystem
                </h1>
              </div>
              <div className="mt-3 md:mt-0 flex items-center space-x-2">
                <span className="text-xs font-mono text-theme-muted">
                  STEP {currentStep} OF {totalSteps}
                </span>
                <div className="w-32 bg-theme-surface-3 rounded-full h-1.5 border border-theme-divider">
                  <div 
                    className="bg-blue-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Steps Rendering */}
            <div className="flex-1 bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-xl p-6 md:p-8 min-h-[420px]">
              
              {currentStep === 1 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                  <div className="flex items-center space-x-4 mb-2">
                    <div className="w-12 h-12 rounded-2xl bg-blue-950 border border-blue-900 flex items-center justify-center text-blue-400 shadow-xl">
                      <Building2 size={24} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg text-theme-body">Welcome to SMRITI Retail OS</h3>
                      <p className="text-xs text-theme-muted">Complete the initial configuration to synchronize your retail environment.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <button
                      onClick={() => setWelcomeMode("new")}
                      className={`p-5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                        welcomeMode === "new" 
                          ? "bg-blue-950/35 border-blue-500 text-theme-body shadow-lg" 
                          : "bg-theme-surface-2 border-theme-divider text-theme-muted hover:border-theme-muted"
                      }`}
                    >
                      <Sparkles className="mb-4 text-blue-400" size={24} />
                      <div>
                        <h4 className="font-bold text-xs uppercase tracking-wide">Brand New Company</h4>
                        <p className="text-[10px] opacity-75 mt-1 leading-relaxed">Start fresh, input tax credentials, configure multi-stores, and initialize default books.</p>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setWelcomeMode("demo");
                        setBusinessName("AITDL NETWORKS");
                        setTradeName("AITDL NETWORKS");
                        setGstin("09AAACS1234A1Z1");
                      }}
                      className={`p-5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                        welcomeMode === "demo" 
                          ? "bg-blue-950/35 border-blue-500 text-theme-body shadow-lg" 
                          : "bg-theme-surface-2 border-theme-divider text-theme-muted hover:border-theme-muted"
                      }`}
                    >
                      <Lightbulb className="mb-4 text-amber-400" size={24} />
                      <div>
                        <h4 className="font-bold text-xs uppercase tracking-wide">Load Demo Data</h4>
                        <p className="text-[10px] opacity-75 mt-1 leading-relaxed">Populate catalogs with standard apparels, retail shifts, suppliers, and accounting layouts instantly.</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setWelcomeMode("restore")}
                      className={`p-5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                        welcomeMode === "restore" 
                          ? "bg-blue-950/35 border-blue-500 text-theme-body shadow-lg" 
                          : "bg-theme-surface-2 border-theme-divider text-theme-muted hover:border-theme-muted"
                      }`}
                    >
                      <FileText className="mb-4 text-teal-400" size={24} />
                      <div>
                        <h4 className="font-bold text-xs uppercase tracking-wide">Restore Backup</h4>
                        <p className="text-[10px] opacity-75 mt-1 leading-relaxed">Load from a previously exported SMRITI Retail OS backup JSON matrix or ZIP package.</p>
                      </div>
                    </button>
                  </div>

                  <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-start space-x-3 text-xs mt-6">
                    <Lightbulb className="text-amber-400 mt-0.5 shrink-0" size={14} />
                    <p className="text-theme-muted leading-relaxed">
                      **Standard Indian Practices**: SMRITI pre-configures standard SGST, CGST, and IGST tax templates by default. This setup wizard matches requirements for modern, compliant retail POS billing.
                    </p>
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <h3 className="font-display font-bold text-base text-theme-body mb-2">Business Profile Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">Company Name *</label>
                      <input 
                        type="text" 
                        value={businessName} 
                        onChange={e => setBusinessName(e.target.value)}
                        placeholder="e.g. SMRITI Apparels Pvt Ltd"
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">Trade Name / Brand (DBA)</label>
                      <input 
                        type="text" 
                        value={tradeName} 
                        onChange={e => setTradeName(e.target.value)}
                        placeholder="e.g. SMRITI Store"
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">GSTIN (Indian Tax ID)</label>
                      <input 
                        type="text" 
                        maxLength={15}
                        value={gstin} 
                        onChange={e => setGstin(e.target.value)}
                        placeholder="e.g. 27AAACS1234A1Z1"
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs font-mono text-theme-body focus:border-blue-500 outline-none"
                      />
                      {detectedState && (
                        <span className="text-[10px] text-emerald-400 font-mono mt-1 block">
                          ✓ State: {detectedState}
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">PAN Card (Extracted)</label>
                      <input 
                        type="text" 
                        value={pan} 
                        disabled
                        placeholder="Extracted from GSTIN"
                        className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-xs font-mono text-theme-muted outline-none cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">Business Type</label>
                      <select 
                        value={businessType} 
                        onChange={e => setBusinessType(e.target.value)}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:border-blue-500 outline-none"
                      >
                        <option value="retail">Retail Multi-Store</option>
                        <option value="wholesale">Wholesaler / Distributor</option>
                        <option value="brand">Direct-to-Consumer Brand</option>
                        <option value="franchise">Franchise operator</option>
                        <option value="hybrid">Hybrid (POS & Wholesale)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">Active Financial Year</label>
                      <select 
                        value={financialYear} 
                        onChange={e => setFinancialYear(e.target.value)}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:border-blue-500 outline-none"
                      >
                        <option value="2026-2027">FY 2026 - 2027 (Current)</option>
                        <option value="2025-2026">FY 2025 - 2026</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">Books Starting From</label>
                      <input 
                        type="date" 
                        value={booksStartDate} 
                        onChange={e => setBooksStartDate(e.target.value)}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 3 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-base text-theme-body">Retail Layout & Store Locations</h3>
                    <div className="flex space-x-1">
                      {["single", "multi", "distributor"].map(mode => (
                        <button
                          key={mode}
                          onClick={() => setOrgLayout(mode)}
                          className={`px-3 py-1 text-[10px] font-bold uppercase rounded border transition-colors ${
                            orgLayout === mode 
                              ? "bg-blue-950 text-blue-400 border-blue-900" 
                              : "bg-theme-surface-2 border-theme-divider text-theme-muted"
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Registered Outlets Grid */}
                  <div className="max-h-48 overflow-y-auto border border-theme-divider rounded-xl divide-y divide-theme-divider bg-theme-surface-2">
                    {stores.map((st) => (
                      <div key={st.id} className="p-3 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Store size={16} className="text-blue-400" />
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-theme-body">{st.name}</span>
                              <span className="text-[9px] bg-theme-surface-3 border border-theme-divider px-1.5 py-0.2 rounded font-mono font-bold text-indigo-400">
                                {st.code}
                              </span>
                            </div>
                            <p className="text-[10px] text-theme-muted mt-0.5">
                              {st.address}{st.landmark ? `, Near ${st.landmark}` : ""}, {st.city}, {st.state} • Pincode: {st.pinCode}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveStore(st.id)}
                          className="p-1 text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Quick Add Stores Form */}
                  <div className="p-4 bg-theme-surface-3 border border-theme-divider rounded-xl space-y-3">
                    <span className="text-[10px] font-mono uppercase font-bold text-theme-muted block">Add Branch Outlet / Warehouse</span>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <input 
                        type="text"
                        placeholder="Outlet Name (e.g. Pune Mall)"
                        value={newStoreName}
                        onChange={e => setNewStoreName(e.target.value)}
                        className="bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-body focus:border-blue-500 outline-none md:col-span-2"
                      />
                      <input 
                        type="text"
                        placeholder="Store Code (e.g. PUN01)"
                        value={newStoreCode}
                        onChange={e => setNewStoreCode(e.target.value)}
                        className="bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs font-mono text-theme-body focus:border-blue-500 outline-none"
                      />
                      <button
                        onClick={handleAddStore}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-1.5 px-3 rounded-lg flex items-center justify-center space-x-1"
                      >
                        <Plus size={14} />
                        <span>Add Outlet</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input 
                        type="text"
                        placeholder="Street Address (e.g. Plot No. X-10)"
                        value={newStoreAddress}
                        onChange={e => setNewStoreAddress(e.target.value)}
                        className="bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-body outline-none"
                      />
                      <input 
                        type="text"
                        placeholder="Landmark (Optional)"
                        value={newStoreLandmark}
                        onChange={e => setNewStoreLandmark(e.target.value)}
                        className="bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-body outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <input 
                        type="text"
                        placeholder="City"
                        value={newStoreCity}
                        onChange={e => setNewStoreCity(e.target.value)}
                        className="bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-body outline-none"
                      />
                      <input 
                        type="text"
                        placeholder="Pincode"
                        maxLength={6}
                        value={newStorePincode}
                        onChange={e => setNewStorePincode(e.target.value)}
                        className="bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-body outline-none"
                      />
                      <select
                        value={newStoreState}
                        onChange={e => setNewStoreState(e.target.value)}
                        className="bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-body outline-none"
                      >
                        <option value="">Select State</option>
                        {INDIAN_STATES.map(s => (
                          <option key={s.code} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                      <select
                        value={newStoreType}
                        onChange={e => setNewStoreType(e.target.value as any)}
                        className="bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-body outline-none"
                      >
                        <option value="Company Owned">Company Owned</option>
                        <option value="Franchise">Franchise</option>
                        <option value="Kiosk">Kiosk</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 4 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div>
                    <h3 className="font-display font-bold text-base text-theme-body">Active System Operations</h3>
                    <p className="text-[11px] text-theme-muted mt-0.5">Toggle SMRITI modules based on your retail business model.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                    {Object.entries(modules).map(([modId, enabled]) => (
                      <button
                        key={modId}
                        onClick={() => setModules(prev => ({ ...prev, [modId]: !prev[modId] }))}
                        className={`p-3.5 rounded-xl border text-left flex items-start space-x-3 transition-colors ${
                          enabled 
                            ? "bg-blue-950/20 border-blue-500/80 text-theme-body" 
                            : "bg-theme-surface-2 border-theme-divider text-theme-muted hover:border-theme-muted"
                        }`}
                      >
                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          enabled ? "bg-blue-500 border-blue-400 text-white" : "border-theme-divider"
                        }`}>
                          {enabled && <Check size={10} />}
                        </div>
                        <div>
                          <span className="text-xs font-bold capitalize">{modId} Studio</span>
                          <p className="text-[9px] opacity-75 mt-0.5 leading-relaxed">
                            {modId === "pos" && "Fast counter checkouts, shifts logging, hold bills."}
                            {modId === "inventory" && "Stock levels, automatic alerts, barcode mapping."}
                            {modId === "purchase" && "Procurement, goods received note, supplier ledger."}
                            {modId === "sales" && "Quotations, sales orders, wholesale invoices."}
                            {modId === "crm" && "Customer tiers, loyalty memberships, points."}
                            {modId === "barcode" && "Thermal ZPL/TSPL printing templates."}
                            {modId === "terms" && "Default payment terms & conditions mapping."}
                            {modId === "exchange" && "CSV/API auto-sync with shopping mall databases."}
                            {modId === "batch" && "Batch numbering and expiry tracking."}
                            {modId === "serial" && "Individual serial number inventory tracing."}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {currentStep === 5 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <h3 className="font-display font-bold text-base text-theme-body mb-2">Taxation & Finance Framework</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">GST Registration Type</label>
                      <select 
                        value={gstType} 
                        onChange={e => setGstType(e.target.value)}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:border-blue-500 outline-none"
                      >
                        <option value="regular">Regular Taxpayer (GST 5%, 12%, 18%, 28%)</option>
                        <option value="composition">Composition Scheme (1% Consolidated Tax)</option>
                        <option value="exempt">GST Exempt / Nil-Rated</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">Auto-Generate System Ledgers</label>
                      <button
                        onClick={() => setCreateLedgers(!createLedgers)}
                        className={`w-full text-left px-3 py-2 border rounded-lg flex items-center justify-between text-xs transition-colors ${
                          createLedgers ? "bg-emerald-950/20 border-emerald-500 text-theme-body" : "bg-theme-surface-2 border-theme-divider text-theme-muted"
                        }`}
                      >
                        <span>CGST, SGST, IGST, Cash, Capital Accounts</span>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          createLedgers ? "bg-emerald-500 border-emerald-400 text-white" : "border-theme-divider"
                        }`}>
                          {createLedgers && <Check size={10} />}
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-theme-surface-3 border border-theme-divider rounded-xl space-y-3">
                    <span className="text-[10px] font-mono uppercase font-bold text-theme-muted block">Linked Bank Settlement Account</span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input 
                        type="text"
                        placeholder="Bank Name (e.g. ICICI Bank)"
                        value={bankName}
                        onChange={e => setBankName(e.target.value)}
                        className="bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body outline-none"
                      />
                      <input 
                        type="text"
                        placeholder="Account Number"
                        value={accountNo}
                        onChange={e => setAccountNo(e.target.value)}
                        className="bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs font-mono text-theme-body outline-none"
                      />
                      <input 
                        type="text"
                        placeholder="IFSC Code"
                        value={ifsc}
                        onChange={e => setIfsc(e.target.value.toUpperCase())}
                        className="bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs font-mono text-theme-body outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">Decimal Round Off Policy</label>
                      <select 
                        value={roundOffMode} 
                        onChange={e => setRoundOffMode(e.target.value)}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body outline-none"
                      >
                        <option value="auto">Auto-Round to Nearest Rupee (Recommended)</option>
                        <option value="manual">Always Round Down (Floor)</option>
                        <option value="none">No Rounding (Retain decimals)</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 6 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <h3 className="font-display font-bold text-base text-theme-body mb-2">Inventory Ledger Policies</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">Stock Valuation Method</label>
                      <select 
                        value={valuationMethod} 
                        onChange={e => setValuationMethod(e.target.value)}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body outline-none"
                      >
                        <option value="FIFO">FIFO (First-In, First-Out)</option>
                        <option value="Moving Average">Moving Weighted Average</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">Default Base Unit of Measure (UOM)</label>
                      <select 
                        value={baseUOM} 
                        onChange={e => setBaseUOM(e.target.value)}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body outline-none"
                      >
                        <option value="Nos">Nos (Count)</option>
                        <option value="Box">Boxes</option>
                        <option value="Kg">Kilograms (Kg)</option>
                        <option value="Ltr">Liters (Ltr)</option>
                        <option value="Mtr">Meters (Mtr)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1.5">Negative Stock Policy</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button
                        onClick={() => setNegativeStock("block")}
                        className={`p-4 rounded-xl border text-left transition-colors ${
                          negativeStock === "block" 
                            ? "bg-red-950/25 border-red-500 text-theme-body shadow" 
                            : "bg-theme-surface-2 border-theme-divider text-theme-muted hover:border-theme-muted"
                        }`}
                      >
                        <span className="text-xs font-bold block text-red-400">Strict Block</span>
                        <span className="text-[10px] opacity-75 mt-0.5 block leading-relaxed">Prevent counter sales if on-hand ledger stock reaches 0 units. Ensures maximum audit correctness.</span>
                      </button>

                      <button
                        onClick={() => setNegativeStock("warn")}
                        className={`p-4 rounded-xl border text-left transition-colors ${
                          negativeStock === "warn" 
                            ? "bg-amber-950/25 border-amber-500 text-theme-body shadow" 
                            : "bg-theme-surface-2 border-theme-divider text-theme-muted hover:border-theme-muted"
                        }`}
                      >
                        <span className="text-xs font-bold block text-amber-400">Allow with Warning</span>
                        <span className="text-[10px] opacity-75 mt-0.5 block leading-relaxed">Alert cashiers during checkout, but permit the sale. Stock reconciliation occurs during audit sync.</span>
                      </button>

                      <button
                        onClick={() => setNegativeStock("allow")}
                        className={`p-4 rounded-xl border text-left transition-colors ${
                          negativeStock === "allow" 
                            ? "bg-blue-950/25 border-blue-500 text-theme-body shadow" 
                            : "bg-theme-surface-2 border-theme-divider text-theme-muted hover:border-theme-muted"
                        }`}
                      >
                        <span className="text-xs font-bold block text-blue-400">Silent Allow</span>
                        <span className="text-[10px] opacity-75 mt-0.5 block leading-relaxed">No warnings or blocks. Allow inventory quantities to drop below zero silently.</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 7 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-display font-bold text-base text-theme-body">Document Numbering Series</h3>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono font-bold text-theme-muted">GAPLESS SEQUENCING</span>
                      <button
                        onClick={() => setGaplessSequencing(!gaplessSequencing)}
                        className={`w-8 h-4 rounded-full transition-colors relative ${gaplessSequencing ? "bg-blue-600" : "bg-theme-surface-3 border border-theme-divider"}`}
                      >
                        <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0 transition-all ${gaplessSequencing ? "right-0" : "left-0"}`} />
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-theme-muted leading-relaxed">
                    SMRITI dynamically configures store-centric prefix sequences for gapless audit safety. Below is a preview of the series generated automatically:
                  </p>

                  <div className="border border-theme-divider rounded-xl divide-y divide-theme-divider bg-theme-surface-2 overflow-hidden">
                    {stores.map(st => (
                      <div key={st.code} className="p-3 grid grid-cols-3 gap-2 text-xs font-mono items-center">
                        <span className="font-bold text-theme-body">{st.name} ({st.code})</span>
                        <div className="space-y-0.5 text-right md:text-left col-span-2">
                          <div className="text-[11px]"><span className="text-theme-muted">POS Invoice:</span> <span className="text-indigo-400 font-bold">{st.code}/INV/26-27/000001</span></div>
                          <div className="text-[11px]"><span className="text-theme-muted">Purchase Order:</span> <span className="text-blue-400 font-bold">{st.code}/PO/2026/0001</span></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-blue-950/20 border border-blue-900 rounded-lg flex items-start space-x-2.5 text-[10px] text-blue-300">
                    <Lightbulb size={14} className="mt-0.5 shrink-0 text-blue-400" />
                    <span>
                      **Audit Safety Guarantee**: Numbering sequences are locked, gapless, and locked chronologically to avoid duplicate invoice reporting to TallyPrime.
                    </span>
                  </div>
                </motion.div>
              )}

              {currentStep === 8 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <h3 className="font-display font-bold text-base text-theme-body mb-2">POS Station & Counter Terminal</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">Default Receipt Printer Format</label>
                      <select 
                        value={posPrinterWidth} 
                        onChange={e => setPosPrinterWidth(e.target.value)}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body outline-none"
                      >
                        <option value="80mm">80mm Standard Thermal Roll (Classic POS)</option>
                        <option value="58mm">58mm Handheld Thermal Roll (Mobile POS)</option>
                        <option value="A4">A4 Full Sheet (Laser/Inkjet Invoice)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-theme-muted uppercase tracking-wider block mb-1">Active Settlement Payment Modes</label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {Object.entries(paymentModes).map(([mode, enabled]) => (
                          <button
                            key={mode}
                            onClick={() => setPaymentModes(prev => ({ ...prev, [mode]: !prev[mode] }))}
                            className={`px-3 py-1.5 rounded-lg border text-xs capitalize font-bold flex items-center justify-between transition-colors ${
                              enabled 
                                ? "bg-blue-950/20 border-blue-500/80 text-theme-body" 
                                : "bg-theme-surface-2 border-theme-divider text-theme-muted"
                            }`}
                          >
                            <span>{mode}</span>
                            <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${
                              enabled ? "bg-blue-500 border-blue-400 text-white" : "border-theme-divider"
                            }`}>
                              {enabled && <Check size={8} />}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl text-xs space-y-2">
                    <span className="font-bold text-theme-body block">Generated Checkout Environment</span>
                    <p className="text-theme-muted leading-relaxed text-[11px]">
                      SMRITI will automatically register an active terminal workspace **Counter A** mapped directly to store **{stores[0]?.name || "Main Outlet"}** with active inventory deduction linked to the **Default Warehouse**.
                    </p>
                  </div>
                </motion.div>
              )}

              {currentStep === 9 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <h3 className="font-display font-bold text-base text-theme-body mb-2">Initial Staff Accounts & Access Control</h3>

                  {/* Registered Users List */}
                  <div className="max-h-40 overflow-y-auto border border-theme-divider rounded-xl divide-y divide-theme-divider bg-theme-surface-2">
                    {staffList.map((st) => (
                      <div key={st.id} className="p-2.5 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-blue-950 border border-blue-900 flex items-center justify-center text-blue-400 font-bold text-xs uppercase">
                            {st.name.slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-theme-body">{st.name}</span>
                              <span className="text-[9px] bg-indigo-950 text-indigo-400 border border-indigo-900 rounded px-1.5 py-0.2 font-mono font-bold">
                                {st.role}
                              </span>
                            </div>
                            <p className="text-[10px] text-theme-muted font-mono mt-0.5">Username: {st.username} • {st.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveStaff(st.id)}
                          className="p-1 text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add User inputs */}
                  <div className="p-3 bg-theme-surface-3 border border-theme-divider rounded-xl grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input 
                      type="text"
                      placeholder="Full Name (e.g. Ramesh Shah)"
                      value={newStaffName}
                      onChange={e => setNewStaffName(e.target.value)}
                      className="bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body outline-none"
                    />
                    <select
                      value={newStaffRole}
                      onChange={e => setNewStaffRole(e.target.value as any)}
                      className="bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body outline-none"
                    >
                      <option value="Administrator">Administrator</option>
                      <option value="Store Manager">Store Manager</option>
                      <option value="Cashier">Cashier</option>
                      <option value="Accountant">Accountant</option>
                    </select>
                    <button
                      onClick={handleAddStaff}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-1.5 px-3 rounded-lg flex items-center justify-center space-x-1"
                    >
                      <Plus size={14} />
                      <span>Onboard Staff</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {currentStep === 10 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div>
                    <h3 className="font-display font-bold text-base text-theme-body">Alerts & Customer Communications</h3>
                    <p className="text-[11px] text-theme-muted mt-0.5">Define automated notification preferences.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(alerts).map(([alertKey, enabled]) => (
                      <button
                        key={alertKey}
                        onClick={() => setAlerts(prev => ({ ...prev, [alertKey]: !prev[alertKey] }))}
                        className={`p-4 rounded-xl border text-left flex items-start space-x-3 transition-colors ${
                          enabled 
                            ? "bg-blue-950/20 border-blue-500/80 text-theme-body" 
                            : "bg-theme-surface-2 border-theme-divider text-theme-muted"
                        }`}
                      >
                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          enabled ? "bg-blue-500 border-blue-400 text-white" : "border-theme-divider"
                        }`}>
                          {enabled && <Check size={10} />}
                        </div>
                        <div>
                          <span className="text-xs font-bold capitalize">
                            {alertKey.replace(/([A-Z])/g, " $1")}
                          </span>
                          <p className="text-[10px] opacity-75 mt-0.5 leading-relaxed">
                            {alertKey === "invoiceWhatsApp" && "Auto-dispatch digital PDF invoices to client's registered WhatsApp."}
                            {alertKey === "invoiceEmail" && "Send copies of cash memos directly to client email."}
                            {alertKey === "lowStockSMS" && "Alert purchasing executives when active store items breach reorder points."}
                            {alertKey === "shiftReportEmail" && "Dispatch shift closure statistics and currency counts directly to owner."}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {currentStep === 11 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 max-h-72 overflow-y-auto pr-1">
                  <h3 className="font-display font-bold text-base text-theme-body">Review & Activate SMRITI</h3>
                  
                  <div className="space-y-3.5 text-xs">
                    <div className="p-3.5 bg-theme-surface-2 border border-theme-divider rounded-xl grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-theme-muted block font-mono">COMPANY NAME</span>
                        <span className="font-bold text-theme-body">{businessName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-theme-muted block font-mono">GST REGISTRATION</span>
                        <span className="font-bold text-theme-body font-mono">{gstin || "Regular Scheme (Nil Registered)"}</span>
                      </div>
                      <div className="col-span-2 border-t border-theme-divider pt-2 mt-1">
                        <span className="text-[10px] text-theme-muted block font-mono">STORES & COUNTERS TO CREATE</span>
                        <span className="font-bold text-theme-body">
                          {stores.map(s => `${s.name} (${s.code})`).join(" , ")}
                        </span>
                      </div>
                      <div className="col-span-2 border-t border-theme-divider pt-2">
                        <span className="text-[10px] text-theme-muted block font-mono">STAFF USERS PROVISIONED</span>
                        <span className="font-bold text-theme-body">
                          {staffList.map(u => `${u.name} (${u.role})`).join(" , ")}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-indigo-950/20 border border-indigo-900 rounded-xl flex items-center space-x-3 text-xs text-indigo-300">
                      <BadgeCheck size={20} className="text-indigo-400 shrink-0" />
                      <div>
                        <span className="font-bold block text-theme-body text-xs">Ready for Onboarding Deployment</span>
                        <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">Completing setup will configure your live relational tables on CloudSQL and trigger the initial capital ledger movements.</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

            </div>

            {/* Bottom Navigation Buttons */}
            <div className="mt-6 flex items-center justify-between border-t border-theme-divider pt-4">
              <button
                onClick={handlePrev}
                disabled={currentStep === 1 || isSubmitting}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                  currentStep === 1 || isSubmitting
                    ? "text-theme-muted border border-theme-divider opacity-50 cursor-not-allowed"
                    : "text-theme-body border border-theme-divider hover:bg-theme-surface-3"
                }`}
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>

              {currentStep < totalSteps ? (
                <button
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-lg transition-transform hover:scale-[1.02]"
                >
                  <span>Continue</span>
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleCompleteSetup}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-theme-surface-3 text-white font-semibold text-xs rounded-xl flex items-center space-x-2 cursor-pointer shadow-lg transition-transform hover:scale-[1.02]"
                >
                  {isSubmitting ? (
                    <>
                      <Database size={16} className="animate-spin" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <>
                      <BadgeCheck size={16} />
                      <span>Complete Setup & Run OS</span>
                    </>
                  )}
                </button>
              )}
            </div>

          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
