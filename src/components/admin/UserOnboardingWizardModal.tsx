/**
 * Project      : SMRITI Retail OS
 * Component    : 6-Step SAP Fiori–Style User Onboarding Wizard
 * Standard     : UFR-006 & WNG-002 Compliant
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import React, { useState } from "react";
import {
  X,
  User,
  Briefcase,
  Building,
  Shield,
  Layers,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Key,
  Lock,
  Mail,
  Phone,
  Sparkles
} from "lucide-react";

import { SEEFDialog } from "../common/SEEFDialog.tsx";

interface UserOnboardingWizardModalProps {
  onClose: () => void;
}

export const UserOnboardingWizardModal: React.FC<UserOnboardingWizardModalProps> = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    mobile: "",
    fullName: "",
    employeeCode: "",
    department: "Sales",
    designation: "Store Manager",
    companyId: "comp-default",
    branchId: "br-default",
    storeId: "stor-default",
    warehouseId: "wh-default",
    roleCode: "STORE_MANAGER",
    permissionSetCode: "PSET_RETAIL_MANAGER",
    effectiveScope: "STORE",
    persona: "Retail Manager",
    workspaceProfileCode: "PROF_RETAIL_MANAGER",
    theme: "light"
  });

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, 6));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  const handleFinish = async () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccess(true);
    }, 1000);
  };

  const footerContent = !success ? (
    <div className="w-full flex items-center justify-between">
      <button
        onClick={prevStep}
        disabled={currentStep === 1}
        className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-theme-surface-2 hover:bg-theme-surface-3 disabled:opacity-50 flex items-center gap-1"
      >
        <ChevronLeft className="w-4 h-4" /> Back
      </button>

      {currentStep < 6 ? (
        <button
          onClick={nextStep}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 shadow"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={handleFinish}
          disabled={isSubmitting}
          className="px-6 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow"
        >
          {isSubmitting ? "Provisioning..." : "Provision User Account"}
        </button>
      )}
    </div>
  ) : undefined;

  return (
    <SEEFDialog
      open={true}
      onClose={onClose}
      title="User Onboarding Wizard"
      subtitle="6-Step Enterprise SAP Fiori Onboarding Pipeline"
      icon={Sparkles}
      mode="centered"
      width={896}
      footer={footerContent}
    >

        {/* Step Indicator Bar */}
        <div className="px-6 py-3 bg-theme-surface-2/20 border-b border-theme-divider grid grid-cols-6 gap-2">
          {[
            { step: 1, label: "Identity", icon: User },
            { step: 2, label: "Employment", icon: Briefcase },
            { step: 3, label: "Org Scope", icon: Building },
            { step: 4, label: "Security", icon: Shield },
            { step: 5, label: "Persona", icon: Layers },
            { step: 6, label: "Provision", icon: CheckCircle2 }
          ].map((item) => (
            <div
              key={item.step}
              className={`flex items-center gap-2 text-xs font-semibold py-1 px-2 rounded-lg border transition ${
                currentStep === item.step
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                  : currentStep > item.step
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-theme-surface-2 text-theme-muted border-theme-divider"
              }`}
            >
              <item.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Body Content */}
        <div className="p-6 flex-1 overflow-auto">
          {success ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-500/30">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-theme-text">User Account Provisioned Successfully</h3>
              <p className="text-xs text-theme-muted max-w-md">
                User <span className="text-blue-400 font-mono font-bold">{formData.username}</span> has been onboarded with role <span className="text-emerald-400 font-bold">{formData.roleCode}</span>.
              </p>
              <button onClick={onClose} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow">
                Done & Close
              </button>
            </div>
          ) : (
            <>
              {currentStep === 1 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-theme-text border-b border-theme-divider pb-2">Step 1: Account Identity Credentials</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-theme-muted block mb-1">Username *</label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        placeholder="e.g. jmallah"
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-xs text-theme-text"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-theme-muted block mb-1">Initial Password *</label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Temporary Password"
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-xs text-theme-text"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-theme-muted block mb-1">Email Address</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="user@smritibooks.com"
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-xs text-theme-text"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-theme-muted block mb-1">Mobile Phone</label>
                      <input
                        type="text"
                        value={formData.mobile}
                        onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                        placeholder="+91 9324117007"
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-xs text-theme-text"
                      />
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-theme-text border-b border-theme-divider pb-2">Step 2: Employee HR Profile</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-theme-muted block mb-1">Full Employee Name *</label>
                      <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        placeholder="Jawahar Ramkripal Mallah"
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-xs text-theme-text"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-theme-muted block mb-1">Employee Code</label>
                      <input
                        type="text"
                        value={formData.employeeCode}
                        onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                        placeholder="EMP00023"
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-xs text-theme-text"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-theme-muted block mb-1">Department</label>
                      <select
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-xs text-theme-text"
                      >
                        <option value="Sales">Sales & Retail</option>
                        <option value="Purchase">Procurement & Sourcing</option>
                        <option value="Inventory">Warehouse & Stock</option>
                        <option value="Finance">Finance & Accounting</option>
                        <option value="IT">IT & Systems</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-theme-muted block mb-1">Designation</label>
                      <input
                        type="text"
                        value={formData.designation}
                        onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-xs text-theme-text"
                      />
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-theme-text border-b border-theme-divider pb-2">Step 3: Organization Entity Scoping</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-theme-muted block mb-1">Assigned Company</label>
                      <select
                        value={formData.companyId}
                        onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-xs text-theme-text"
                      >
                        <option value="comp-default">Smriti Enterprise Private Limited</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-theme-muted block mb-1">Assigned Operating Branch</label>
                      <select
                        value={formData.branchId}
                        onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-xs text-theme-text"
                      >
                        <option value="br-default">Gorakhpur Flagship Branch</option>
                        <option value="br-mumbai">Mumbai Corporate Branch</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-theme-text border-b border-theme-divider pb-2">Step 4: Security Role & Scope Assignment</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-theme-muted block mb-1">Role Template</label>
                      <select
                        value={formData.roleCode}
                        onChange={(e) => setFormData({ ...formData, roleCode: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-xs text-theme-text"
                      >
                        <option value="STORE_MANAGER">Store Manager (Full Store Scope)</option>
                        <option value="CASHIER">Cashier (POS & Billing Only)</option>
                        <option value="INVENTORY_MANAGER">Inventory Manager</option>
                        <option value="PURCHASE_MANAGER">Purchase Manager</option>
                        <option value="ACCOUNTANT">Accountant</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-theme-muted block mb-1">Data Scope Boundary</label>
                      <select
                        value={formData.effectiveScope}
                        onChange={(e) => setFormData({ ...formData, effectiveScope: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-xs text-theme-text"
                      >
                        <option value="STORE">Store Level (Assigned Store)</option>
                        <option value="BRANCH">Branch Level (Assigned Branch)</option>
                        <option value="COMPANY">Company Level (Entire Company)</option>
                        <option value="TENANT">Tenant Level (Entire Tenant)</option>
                        <option value="OWN">Own Documents Only</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 5 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-theme-text border-b border-theme-divider pb-2">Step 5: Workspace Profile & Persona (UX)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-theme-muted block mb-1">UX Persona</label>
                      <select
                        value={formData.persona}
                        onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-xs text-theme-text"
                      >
                        <option value="Retail Manager">Retail Store Manager Persona</option>
                        <option value="Retail Cashier">Retail Cashier Persona</option>
                        <option value="Warehouse Operator">Warehouse Operator Persona</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-theme-muted block mb-1">Theme</label>
                      <select
                        value={formData.theme}
                        onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-xs text-theme-text"
                      >
                        <option value="light">Light Theme</option>
                        <option value="dark">Dark Theme</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 6 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-theme-text border-b border-theme-divider pb-2">Step 6: Review & Final Provisioning</h3>
                  <div className="p-4 bg-theme-surface-2/60 rounded-lg border border-theme-divider grid grid-cols-2 gap-4 font-mono text-xs">
                    <div><span className="text-theme-muted">Username:</span> <span className="text-blue-400 font-bold">{formData.username || "—"}</span></div>
                    <div><span className="text-theme-muted">Full Name:</span> <span className="text-theme-text font-bold">{formData.fullName || "—"}</span></div>
                    <div><span className="text-theme-muted">Role:</span> <span className="text-emerald-400 font-bold">{formData.roleCode}</span></div>
                    <div><span className="text-theme-muted">Data Scope:</span> <span className="text-amber-400 font-bold">{formData.effectiveScope}</span></div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
    </SEEFDialog>
  );
};
