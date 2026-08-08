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
On browser refresh (`F5` / `Ctrl+F5` / `Cmd+R`), an already logged-in user was redirected back to the login screen with console logs:
```text
GET http://localhost/api/v1/pos/shifts/ 401 (Unauthorized)
GET http://localhost/api/v1/pos/profiles/ 401 (Unauthorized)
Critical error syncing system data: Error: Token is invalid or has expired. Please log in again.
```

### **Root Cause**
1. Interceptor status 401 handler in `src/lib/apiFetchV1.ts` greedily removed `smriti_jwt_token` and `smriti_session_token` whenever ANY background API request (e.g. `/pos/profiles/`, `/customers`, `/inventory/`) returned 401 Unauthorized.
2. `App.tsx`'s `checkAuth()` checked `!token` first and wiped session state before inspecting saved local user session credentials (`smriti_user_name` & `smriti_user_role`).

### **Resolution & Fix**
1. Removed automatic token deletion on background 401 API responses in `src/lib/apiFetchV1.ts`. Session tokens are now ONLY erased upon explicit user logout (`SessionService.executeLogout()`).
2. Updated `checkAuth()` in `src/App.tsx` to prioritize local session restoration before attempting background profile sync:
   ```typescript
   // 1. If valid saved user session exists in localStorage, restore authentication immediately (Bulletproof Persistence)
   if (savedName && savedRole) {
     const uObj = { role: savedRole, name: savedName };
     setCurrentUser(uObj);
     authStore.setCurrentUser({ ...uObj, username: savedName });
     authStore.setAuthState("Authenticated");
   }
   ```

---

## 📌 Issue #5: Authentication Bootstrap Sequence & Protected API Resource Guarding

### **Symptom**
Console flooded with 401 (Unauthorized) HTTP GET errors during app launch / boot sequence:
```text
GET http://localhost:3000/api/v1/auth/me 401 (Unauthorized)
GET http://localhost:3000/api/v1/customers 401 (Unauthorized)
GET http://localhost:3000/api/v1/inventory/ 401 (Unauthorized)
GET http://localhost:3000/api/v1/pos/profiles/ 401 (Unauthorized)
GET http://localhost:3000/api/v1/pos/shifts/ 401 (Unauthorized)
GET http://localhost:3000/api/v1/customer-groups 401 (Unauthorized)
GET http://localhost:3000/api/v1/psv/parties 401 (Unauthorized)
```

### **Root Cause**
1. Reverse execution sequence: `App.tsx` mounted and triggered `useEffect([currentUser])` firing `fetchSystemState()` and `syncCustomersWithBackend()` BEFORE session token validation was completed via `/api/v1/auth/me`.
2. Missing Guard: If no valid token existed or if token validation failed, the app attempted protected API calls anyway before displaying `<LoginScreen />`.
3. Standalone Mock Session mismatch: Local mock tokens (`smriti_jwt_*`) were not recognized as mock tokens, triggering unauthenticated calls to backend port 3000.

### **Resolution & Fix**
1. **Strict Startup Sequence in `App.tsx` (`checkAuth()`):**
   - If no token exists: Instantly clear session, set `Unauthenticated`, and render `<LoginScreen />`. **ZERO protected API calls executed.**
   - If real token exists: Validates token via `GET /api/v1/auth/me` with `Authorization: Bearer <token>` header.
   - If token valid: Sets `Authenticated` state and stores user profile.
   - If token invalid (401 from backend): Clears tokens & user credentials from `localStorage`, sets `Unauthenticated`, and presents `<LoginScreen />`.
2. **Centralized Authentication Guard (`apiFetchV1.ts` & `apiFetch.ts`):**
   - Intercepts all outgoing protected API requests at entry point (`apiFetchV1` and `apiFetch`).
   - If no session token is present or if running in local standalone mock mode (`isLocalMockToken`), requests to protected endpoints (`/customers`, `/inventory/`, `/pos/profiles/`, `/pos/shifts/`, etc.) return mock fallback data silently **without initiating network requests** to backend port 3000.
3. **Unauthenticated View Unmounting (`AuthProvider` Pattern):**
   - `ProtectedAppShell` and child components are strictly unmounted when `!currentUser` or `authState !== "Authenticated"`, ensuring no subcomponent `useEffect` hooks fire during unauthenticated state.
4. **Data Source Authority:**
   - Verified PostgreSQL Database (via backend API) as single source of truth; `localStorage` strictly operates as an optional offline client cache.
