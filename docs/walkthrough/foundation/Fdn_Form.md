<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-12
  Modified     : 2026-07-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Form Standardization & Setup Wizard Defaults (v3.16.0)

## 1. Purpose
Provide a single source of truth for Indian-market state mappings, formats, and validations across the setup wizard, registration forms, and import handlers. Update default demo seeding values to Gorakhpur (GIDA) for AITDL NETWORKS.

## 2. Scope
- **Shared Constants**: State mappings in `src/constants/indianStates.ts`.
- **Shared Utilities**: Form validation functions in `src/utils/validators.ts` and formatting functions in `src/utils/formatters.ts`.
- **Setup Wizard Tab**: Gorakhpur (GIDA) defaults, state selection dropdowns, landmark fields, and input format validation in `src/components/SetupWizard/SetupWizardTab.tsx`.
- **Sales Studio & Customers API**: Standardize date and currency rendering, and validate mobile and GSTIN formats in `src/components/SalesStudioTab.tsx` and `src/routes/customers.ts`.
- **System Types**: Address type updates in `src/types.ts`.
- **Unit Tests**: Verification in `src/tests/validatorsAndFormatters.test.ts`.

## 3. Files Created
1. **[indianStates.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/constants/indianStates.ts)** — Shared Indian state constants.
2. **[validators.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/utils/validators.ts)** — Form validators (GSTIN, PIN, Mobile).
3. **[formatters.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/utils/formatters.ts)** — Indian market display formatters (date, datetime, currency).
4. **[validatorsAndFormatters.test.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/tests/validatorsAndFormatters.test.ts)** — Automated unit tests.

## 4. Files Modified
1. **[types.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/types.ts)**
2. **[SetupWizardTab.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/SetupWizard/SetupWizardTab.tsx)**
3. **[SalesStudioTab.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/SalesStudioTab.tsx)**
4. **[customers.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/customers.ts)**
5. **[README.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/README.md)** (Index Update)
6. **[AGENTS.md](file:///d:/IMP/GitHub/SMRITRretailNX/.agents/AGENTS.md)** (Added compliance and gateway integration governance rule)

## 5. Architecture Decisions
Extract regional configurations and validations into shared components instead of repeating ad hoc expressions at every call site. This enforces consistency, reduces lint errors, and simplifies the codebase.

## 6. Design Rationale
Using specialized validation functions (`isValidGSTIN`, `isValidPIN`, `isValidMobile`) prevents bugs caused by incomplete or local regular expression checks. Centralizing these rules ensures that CSV import and UI forms match identical constraints.

## 7. Implementation Summary
- Created helper utilities (`isValidMobile`, `isValidPIN`, `isValidGSTIN`, `formatDate`, `formatDateTime`, `formatCurrency`).
- Replaced manual regex matches in `SalesStudioTab.tsx` and `src/routes/customers.ts` with these helpers.
- Added validation gates in `SetupWizardTab.tsx` `handleNext` to block navigation if invalid inputs are entered.
- Added address landmark support to `Supplier`, `User`, and `StoreConfig` types and form views.
- Updated default demo company configuration to "AITDL NETWORKS" with "Uttar Pradesh" state, "Gorakhpur" city, "273209" pincode, and "Pushpa" (9324117007) contact details.
- Added a permanent backend integration rule (Rule 5) to `AGENTS.md` specifying that compliance and gateway integrations must be handled strictly inside the FastAPI + Postgres backend, not in the Express layer.

## 8. Tests Executed
Executed all unit tests using Vitest.

## 9. Verification Results

### Vitest Unit Test Run Output
```text
> smriti-retail-os@3.15.0 test
> vitest run


 RUN  v4.1.10 D:/IMP/GitHub/SMRITRretailNX

 ✓ src/tests/validatorsAndFormatters.test.ts (5 tests) 37ms
stdout | src/tests/helpers.test.ts
[Local DB] Loaded data successfully from disk!

stdout | src/tests/numbering.test.ts
[Local DB] Loaded data successfully from disk!

 ✓ src/tests/numbering.test.ts (3 tests) 6ms
stdout | src/tests/auth.test.ts
◇ injected env (12) from .env // tip: ⌘ override existing { override: true }

stdout | src/tests/gst.test.ts
[Local DB] Loaded data successfully from disk!

 ✓ src/tests/gst.test.ts (6 tests) 5ms
stdout | src/tests/auth.test.ts
[Local DB] Loaded data successfully from disk!

stdout | src/tests/auth.test.ts
◇ injected env (0) from .env // tip: ⌘ multiple files { path: ['.env.local', '.env'] }
[SMRITI Bootstrap] Initializing Platform Abstraction Layer (PAL) with DATABASE_PROVIDER: memory
[SMRITI SyncEngine] Starting background sync worker (Interval: 30000ms)...

 ✓ src/tests/helpers.test.ts (12 tests) 1833ms
       ✓ should verify correct password successfully  968ms
       ✓ should fail verification for incorrect password  834ms
 ✓ src/tests/auth.test.ts (6 tests) 4591ms
     ✓ should authenticate user and return session details with valid credentials  434ms
     ✓ should deny login with invalid password  482ms
     ✓ should lock user account after 5 failed login attempts  2047ms
     ✓ should return session details when requesting /me with a valid session token  416ms
     ✓ should destroy session and return 401 on subsequent requests after logging out  405ms

 Test Files  5 passed (5)
      Tests  32 passed (32)
   Start at  14:50:36
   Duration  6.46s (transform 560ms, setup 0ms, import 1.83s, tests 6.47s, environment 1ms)
```

### Git Diff Outputs

#### 1. src/constants/indianStates.ts
```diff
diff --git a/src/constants/indianStates.ts b/src/constants/indianStates.ts
new file mode 100644
index 0000000..c361aa1
--- /dev/null
+++ b/src/constants/indianStates.ts
@@ -0,0 +1,57 @@
+/**
+ * Project      : SMRITI Retail OS
+ * Author       : Jawahar Ramkripal Mallah
+ * Email        : support@smritibooks.com
+ * Websites     : smritibooks.com | erpnbook.com | aitdl.com
+ * Version      : 3.16.0
+ * Created      : 2026-07-12
+ * Modified     : 2026-07-12
+ * Copyright    : © SMRITIBooks.com. All Rights Reserved.
+ * License      : Proprietary Commercial Software
+ */
+
+export interface IndianState {
+  code: string; // GST state code (2 digits)
+  name: string;
+}
+
+export const INDIAN_STATES: IndianState[] = [
+  { code: "01", name: "Jammu & Kashmir" },
+  { code: "02", name: "Himachal Pradesh" },
+  { code: "03", name: "Punjab" },
+  { code: "04", name: "Chandigarh" },
+  { code: "05", name: "Uttarakhand" },
+  { code: "06", name: "Haryana" },
+  { code: "07", name: "Delhi" },
+  { code: "08", name: "Rajasthan" },
+  { code: "09", name: "Uttar Pradesh" },
+  { code: "10", name: "Bihar" },
+  { code: "11", name: "Sikkim" },
+  { code: "12", name: "Arunachal Pradesh" },
+  { code: "13", name: "Nagaland" },
+  { code: "14", name: "Manipur" },
+  { code: "15", name: "Mizoram" },
+  { code: "16", name: "Tripura" },
+  { code: "17", name: "Meghalaya" },
+  { code: "18", name: "Assam" },
+  { code: "19", name: "West Bengal" },
+  { code: "20", name: "Jharkhand" },
+  { code: "21", name: "Odisha" },
+  { code: "22", name: "Chhattisgarh" },
+  { code: "23", name: "Madhya Pradesh" },
+  { code: "24", name: "Gujarat" },
+  { code: "25", name: "Daman & Diu" },
+  { code: "26", name: "Dadra & Nagar Haveli" },
+  { code: "27", name: "Maharashtra" },
+  { code: "28", name: "Andhra Pradesh" },
+  { code: "29", name: "Karnataka" },
+  { code: "30", name: "Goa" },
+  { code: "31", name: "Lakshadweep" },
+  { code: "32", name: "Kerala" },
+  { code: "33", name: "Tamil Nadu" },
+  { code: "34", name: "Puducherry" },
+  { code: "35", name: "Andaman & Nicobar Islands" },
+  { code: "36", name: "Telangana" },
+  { code: "37", name: "Andhra Pradesh (New)" },
+  { code: "38", name: "Ladakh" }
+];
```

#### 2. src/utils/validators.ts
```diff
diff --git a/src/utils/validators.ts b/src/utils/validators.ts
new file mode 100644
index 0000000..9011cd1
--- /dev/null
+++ b/src/utils/validators.ts
@@ -0,0 +1,44 @@
+/**
+ * Project      : SMRITI Retail OS
+ * Author       : Jawahar Ramkripal Mallah
+ * Email        : support@smritibooks.com
+ * Websites     : smritibooks.com | erpnbook.com | aitdl.com
+ * Version      : 3.16.0
+ * Created      : 2026-07-12
+ * Modified     : 2026-07-12
+ * Copyright    : © SMRITIBooks.com. All Rights Reserved.
+ * License      : Proprietary Commercial Software
+ */
+
+/**
+ * Validates Indian GSTIN format.
+ * Format: 2 digits (State Code) + 10 characters (PAN) + 1 digit (Entity code) + 1 character (Z by default) + 1 checksum digit/char.
+ */
+export function isValidGSTIN(gstin: string): boolean {
+  if (!gstin) return false;
+  const clean = gstin.trim().toUpperCase();
+  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
+  return regex.test(clean);
+}
+
+/**
+ * Validates Indian Pincode format.
+ * Format: 6 digits, cannot start with 0.
+ */
+export function isValidPIN(pin: string): boolean {
+  if (!pin) return false;
+  const clean = pin.trim();
+  const regex = /^[1-9][0-9]{5}$/;
+  return regex.test(clean);
+}
+
+/**
+ * Validates Indian mobile number format.
+ * Format: 10 digits, starting with 6, 7, 8, or 9.
+ */
+export function isValidMobile(mobile: string): boolean {
+  if (!mobile) return false;
+  const clean = mobile.replace(/[- ]/g, "").trim();
+  const regex = /^[6-9]\d{9}$/;
+  return regex.test(clean);
+}
```

#### 3. src/utils/formatters.ts
```diff
diff --git a/src/utils/formatters.ts b/src/utils/formatters.ts
new file mode 100644
index 0000000..e4e0345
--- /dev/null
+++ b/src/utils/formatters.ts
@@ -0,0 +1,72 @@
+/**
+ * Project      : SMRITI Retail OS
+ * Author       : Jawahar Ramkripal Mallah
+ * Email        : support@smritibooks.com
+ * Websites     : smritibooks.com | erpnbook.com | aitdl.com
+ * Version      : 3.16.0
+ * Created      : 2026-07-12
+ * Modified     : 2026-07-12
+ * Copyright    : © SMRITIBooks.com. All Rights Reserved.
+ * License      : Proprietary Commercial Software
+ */
+
+/**
+ * Formats a date using en-IN locale with custom options.
+ * Default pattern: day/month/short-form (e.g. "12 Jul")
+ */
+export function formatDate(
+  date: string | Date | number | null | undefined,
+  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }
+): string {
+  if (!date) return "-";
+  try {
+    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
+    if (isNaN(d.getTime())) return "-";
+    return d.toLocaleDateString("en-IN", options);
+  } catch (e) {
+    return "-";
+  }
+}
+
+/**
+ * Formats a datetime using en-IN locale with custom options.
+ * Default pattern: "12 Jul, 02:30 PM" or similar depending on browser locale behavior
+ */
+export function formatDateTime(
+  date: string | Date | number | null | undefined,
+  options: Intl.DateTimeFormatOptions = {
+    day: "numeric",
+    month: "short",
+    hour: "2-digit",
+    minute: "2-digit"
+  }
+): string {
+  if (!date) return "-";
+  try {
+    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
+    if (isNaN(d.getTime())) return "-";
+    return d.toLocaleDateString("en-IN", options);
+  } catch (e) {
+    return "-";
+  }
+}
+
+/**
+ * Formats a number or string into Indian Rupees (INR) format.
+ * Example: 150000 -> ₹1,50,000.00
+ */
+export function formatCurrency(amount: number | string | null | undefined): string {
+  if (amount === null || amount === undefined) return "₹0.00";
+  try {
+    const num = typeof amount === "string" ? parseFloat(amount) : amount;
+    if (isNaN(num)) return "₹0.00";
+    return new Intl.NumberFormat("en-IN", {
+      style: "currency",
+      currency: "INR",
+      minimumFractionDigits: 2,
+      maximumFractionDigits: 2
+    }).format(num);
+  } catch (e) {
+    return "₹0.00";
+  }
+}
```

#### 4. src/types.ts
```diff
diff --git a/src/types.ts b/src/types.ts
index 1289d00..2ca8abe 100644
--- a/src/types.ts
+++ b/src/types.ts
@@ -16,9 +16,9 @@
  *
  * * Websites: aitdl.com | erpnbook.com | smritibooks.com
  *
- * * Version    : 2.1.2
+ * * Version    : 3.16.0
  * * Created    : 2026-07-10
- * * Modified   : 2026-07-11
+ * * Modified   : 2026-07-12
  * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * * License    : Proprietary Commercial Software
  */
@@ -632,6 +632,7 @@ export interface User {
   email: string;
   emergencyContact: string;
   address: string;
+  landmark?: string;
   city: string;
   state: string;
   country: string;
@@ -710,6 +711,7 @@ export interface Supplier {
   taxRegistrationNumber: string;
   category: string;
   address: string;
+  landmark?: string;
   contactDetails: string;
 }
```

## 10. Known Limitations
None. All components build and pass compilation.

## 11. Future Work
Apply standardized form validators to other modules (Inventory, Procurement) as they are migrated.

## 12. Related ADRs
None.

## 13. Related RFCs
None.
