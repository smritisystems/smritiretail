<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 2.1.1
  * Created    : 2026-07-10
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# SMRITI Retail OS - Company Setup Wizard Implementation Plan

## 1. Objective & Philosophy
Implement a production-grade, highly polished, interactive **Company Setup Wizard** for **SMRITI Retail OS** to get Indian retail, distribution, and warehouse businesses fully operational in **5–7 minutes**. It features intelligent defaults, automated tax detections, robust validations, and event-sourced asset creation upon completion.

---

## 2. Core Onboarding Flow
The wizard will utilize a secure, state-managed 11-step sequence:
1. **Welcome Desk**: Choose setup mode (New Setup, Demo Company, Import/Restore).
2. **Business Profile**: Basic details with Indian-specific automated fields (GSTIN validation, State detection, PAN extraction, Financial Year selection).
3. **Org Structure**: Define warehouses, branches, or stores with auto-generated/suggested Unique Store Codes.
4. **Operations & Modules**: Recommended modules based on business persona (Retail vs Wholesaler).
5. **Tax & Accounting**: Simplified GST mapping, ledger creations (CGST/SGST/IGST), and cash/bank settings.
6. **Inventory Policy**: Stock valuation rules, base units of measure, and negative stock controls.
7. **Document Numbering**: Store-centric gapless serial sequences (e.g., `MUM01/INV/2026/000001`).
8. **POS Configuration**: Receipt styles (80mm vs A4), printer types, and payment integrations.
9. **Staff & Security**: Onboard Store Managers, Cashiers, and Accountants with specific role-based permissions.
10. **Business Communications**: Configure alert mechanisms (WhatsApp, SMS, Email) for key events.
11. **Audit & Completion**: Summary review. Submitting will execute a transactional setup sequence in the backend database.

---

## 3. Technology & UI Design
* **Style & Theming**: Integrated with Tailwind CSS and SMRITI theme variables (Light/Dark aware, modern Inter typography).
* **Animations**: Fluid, beautiful slide-in transitions for step progression, pulsing progress bars, and high-contrast check indicators via `motion/react`.
* **Icons**: Standard imports from `lucide-react`.
* **Header Rule**: Mandatory SMRITI coding header on all files.

---

## 4. API & Backend Integration
Create Express route handler proxies to commit created structures:
* Company registers inside the standard registry.
* Stores register as organizational nodes.
* Linked warehouses and default POS profiles are provisioned automatically.
* Series numbers register in the SMRITI Numbering Series database.
* Success redirection routes directly to the operational focus point (e.g. POS Billing desk for retail).
