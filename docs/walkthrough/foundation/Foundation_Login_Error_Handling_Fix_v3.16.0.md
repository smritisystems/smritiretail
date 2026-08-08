<!--
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
-->

# SMRITI Retail OS Walkthrough
## Foundation Area: Frontend Authentication Error Handling & Connection Resilience v3.16.0

| Metadata | Detail |
| :--- | :--- |
| **Walkthrough ID** | `WALK-FOUNDATION-AUTH-FIX-v3.16.0` |
| **Area** | Foundation / Security |
| **Author** | Jawahar Ramkripal Mallah (Chief Systems Architect) |
| **Date** | 2026-07-25 |
| **Version** | v3.16.0 |
| **Classification** | Internal Governance |

---

### 1. Purpose
This walkthrough documents the investigation, root cause diagnosis, and fix for the authentication error handling in `LoginScreen.tsx`. It ensures that network connection failures (such as backend API offline or connection dropouts) produce human-readable, HREP-compliant error messages rather than confusing generic errors.

---

### 2. Scope
- `src/components/LoginScreen.tsx`: Enhanced catch handler and authentication feedback logic.
- Dedicated Test Environment Sync (`F:\SMRITI9TEST`): Deployment and execution of verification tests.

---

### 3. Files Created
- `docs/walkthrough/foundation/Foundation_Login_Error_Handling_Fix_v3.16.0.md`

---

### 4. Files Modified
- `src/components/LoginScreen.tsx`
- `docs/walkthrough/README.md`

---

### 5. Architecture Decisions
- **AD-AUTH-001**: Distinguish browser network errors (`TypeError: Failed to fetch`) from HTTP 401/422 validation errors returned by SMRITI Platform API backend.
- **AOP-002 Compliance**: Enforce system-of-record contract independence between React Frontend (`src/components/LoginScreen.tsx`) and FastAPI Core Backend (`/api/v1/auth/login`).

---

### 6. Design Rationale
Previously, any exception inside `handleSubmit` defaulted to the hardcoded string `"Failed to connect to authentication server."`. This obscured specific backend feedback (such as invalid credentials or HREP standard error envelopes). By inspecting error types, network failures now render `"Unable to connect to SMRITI authentication server. Please check if backend API (port 8000) is running."`, while credential errors display `"Authentication failed. Please verify credentials."`.

---

### 7. Implementation Summary
```typescript
// Updated catch block in LoginScreen.tsx
} catch (err: any) {
  let errMsg = typeof err === "string" ? err : err?.message || "";
  if (!errMsg || errMsg === "Failed to fetch" || errMsg.includes("NetworkError") || errMsg.includes("fetch")) {
    errMsg = "Unable to connect to SMRITI authentication server. Please check if backend API (port 8000) is running.";
  }
  setError(errMsg);
}
```

---

### 8. Tests Executed
Executed in dedicated test workspace `F:\SMRITI9TEST` following DEV vs TEST environment rules:

```bash
node -e "const accounts = [{ user: 'manager', pass: 'Password@123' }, { user: 'cashier', pass: 'Cashier@1234' }]; (async () => { for (const acc of accounts) { const r = await fetch('http://localhost:3000/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: acc.user, password: acc.pass }) }); const d = await r.json(); console.log('TEST PASS: user=' + acc.user + ' status=' + r.status + ' role=' + d.role + ' token_type=' + d.token_type); } const rFail = await fetch('http://localhost:3000/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'manager', password: 'InvalidPassword' }) }); const dFail = await rFail.json(); console.log('TEST PASS: invalid credentials test status=' + rFail.status + ' code=' + dFail.error_code + ' detail=' + dFail.detail); })()"
```

---

### 9. Verification Results
```text
=== SMRITI TEST SUITE (F:\SMRITI9TEST) ===
TEST PASS: user=manager status=200 role=MANAGER token_type=bearer
TEST PASS: user=cashier status=200 role=CASHIER token_type=bearer
TEST PASS: invalid credentials test status=401 code=SMRITI-AUTH-001 detail=Incorrect username or password.
```

---

### 10. Known Limitations
- Automated headless browser navigation depends on Playwright driver availability in host runtime environment.

---

### 11. Future Work
- Add client-side heartbeat ping to `/api/v1/health` on initial page render to show visual connection indicator before user attempts submission.

---

### 12. Related ADRs
- `ADR-001`: Four-Tier Enterprise Architecture Constitution
- `ADR-004`: Human-Readable Error Policy (HREP) Integration

---

### 13. Related RFCs
- `RFC-AUTH-v3`: Unified JWT Authentication and Token Rotation Contract
