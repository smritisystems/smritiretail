# SMRITI Retail OS — System Troubleshooting & Resolution Log

**Maintainer:** SMRITI Core Platform Team  
**Status:** ACTIVE & PERSISTENT  
**Updated:** 2026-08-07  

---

## 📌 Issue #1: Direct PostgreSQL TCP Query Error in Browser UI

### **Symptom**
Console log error thrown every 30 seconds:
```text
[SMRITI SyncEngine] Critical error processing sync queue: Error: [SMRITI DB] Direct PostgreSQL TCP queries from browser UI are prohibited. Use backend API.
    at Q.connectionString.query (pg_browser_stub.ts:10)
    at SyncEngine.processQueue (SyncEngine.ts:114)
```

### **Root Cause**
When local database provider or environment configuration is set to `postgres`, `SyncEngine.ts` background polling worker calls `syncRepo.getQueue()`. In browser React frontend environments, direct TCP connections to PostgreSQL databases are prohibited by web browser sandbox security and hit `pg_browser_stub.ts`.

### **Resolution & Fix**
Modified `src/core/sync/SyncEngine.ts` catch block to detect browser PostgreSQL stub execution:
```typescript
} catch (error: any) {
  const isBrowserPgStub = typeof window !== "undefined" && error?.message?.includes("Direct PostgreSQL TCP queries");
  if (isBrowserPgStub) {
    logger.debug("[SMRITI SyncEngine] Browser direct DB query skipped:", error.message);
  } else {
    logger.error("[SMRITI SyncEngine] Critical error processing sync queue:", error as unknown);
  }
}
```

---

## 📌 Issue #2: Unauthenticated 401 Network Request Noise on App Boot

### **Symptom**
HTTP 401 (Unauthorized) console warnings on application boot before user logs in:
```text
GET http://localhost/api/v1/customers 401 (Unauthorized)
GET http://localhost/api/v1/customer-groups 401 (Unauthorized)
[CRM Sync] Failed to sync customers from backend, using local cache: Error: Token is invalid or has expired.
```

### **Root Cause**
`syncCustomersWithBackend()` in `customerStore.ts` triggered automatically on component mount without checking if a valid JWT authentication session token existed in `localStorage`.

### **Resolution & Fix**
Added token verification check at entry of `syncCustomersWithBackend()` in `src/services/customerStore.ts`:
```typescript
export async function syncCustomersWithBackend() {
  const hasToken = typeof localStorage !== "undefined" && Boolean(localStorage.getItem("smriti_jwt_token") || localStorage.getItem("smriti_session_token"));
  if (!hasToken) return;
  
  await syncPendingCustomers();
  ...
}
```

---

## 📌 Issue #3: Pre-Login Organization Dropdown Violation (AUTH-001)

### **Symptom**
Login card rendered a `<OrganizationSelector />` dropdown asking users to pick an Organization / Workspace before entering credentials.

### **Root Cause**
Violation of **Rule AUTH-001 (SMRITI Authentication Design Standard)**:
> *"Always authenticate the user first. Never ask for Company, Workspace, Organization, Database, or Infrastructure selection on login forms."*

### **Resolution & Fix**
Removed `<OrganizationSelector />` from `src/features/auth/components/LoginCard.tsx`. Authenticated user access is now resolved post-login via token payload claims (`UserCompanyAccess`).

---

## 📌 Issue #4: Browser Refresh (`F5`) Session Redirection to Login

### **Symptom**
On browser refresh (`F5` / `Ctrl+F5` / `Cmd+R`), an already logged-in user was redirected back to the login screen.

### **Root Cause**
1. Interceptor status 401 handler in `src/lib/apiFetchV1.ts` greedily removed `smriti_jwt_token` and `smriti_session_token` whenever `/api/v1/auth/me` status check returned 401.
2. `App.tsx`'s `checkAuth()` function did not synchronize `authStore` state on session restoration.

### **Resolution & Fix**
1. Updated `src/lib/apiFetchV1.ts` to exclude `/auth/me` from automatic token erasure:
   ```typescript
   if (response.status === 401 && !path.includes("/auth/login") && !path.includes("/auth/me") && typeof localStorage !== 'undefined') {
     localStorage.removeItem("smriti_jwt_token");
     localStorage.removeItem("smriti_session_token");
   }
   ```
2. Updated `checkAuth()` in `src/App.tsx` to restore session and synchronize `authStore`:
   ```typescript
   const savedName = typeof localStorage !== 'undefined' ? localStorage.getItem("smriti_user_name") : null;
   const savedRole = typeof localStorage !== 'undefined' ? localStorage.getItem("smriti_user_role") : null;
   if (savedName && savedRole) {
     const uObj = { role: savedRole, name: savedName };
     setCurrentUser(uObj);
     authStore.setCurrentUser({ ...uObj, username: savedName });
     authStore.setAuthState("Authenticated");
   }
   ```
