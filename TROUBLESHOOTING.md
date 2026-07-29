<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.33.0
  Created      : 2026-07-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# SMRITI Retail OS - Enterprise Troubleshooting & Diagnostic Matrix

---

## 🔍 Quick Diagnostic Workflow

If an issue occurs, run the diagnostic dashboard first:

```powershell
powershell -ExecutionPolicy Bypass -File status.ps1
```

To view streaming logs for diagnosis:

```powershell
powershell -ExecutionPolicy Bypass -File logs.ps1 -Service api
```

---

## 🛠 Common Errors & Step-by-Step Solutions

### Issue 1: "Docker Daemon is NOT running" / `docker info` fails

- **Symptom**: `install.ps1` reports `[✗] Docker Daemon is NOT running. Please start Docker Desktop.`
- **Cause**: Docker Desktop is closed, starting up, or the WSL2 engine backend crashed.
- **Resolution**:
  1. Launch **Docker Desktop** from the Start Menu.
  2. Wait until the whale icon in the Windows notification area shows **Docker Desktop is running**.
  3. Re-run `powershell -ExecutionPolicy Bypass -File install.ps1`.

---

### Issue 2: Port Binding Conflict (Port 3000, 8000, or 5432 in use)

- **Symptom**: Docker error: `bind: address already in use` or `port is already allocated`.
- **Cause**: Local services (e.g. host PostgreSQL, Node, IIS, or python) are using ports 3000, 8000, or 5432.
- **Resolution**:
  1. Identify which process is holding the port in PowerShell:
     ```powershell
     Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess
     ```
  2. Stop the conflicting process or change the port binding in `.env`:
     ```env
     PORT=3001
     BACKEND_API_PORT=8001
     POSTGRES_PORT=5433
     ```
  3. Re-run `install.ps1` or `start.ps1`.

---

### Issue 3: Container Health Check Timeout (`smriti-api` or `smriti-db` starting slowly)

- **Symptom**: `install.ps1` shows `[✗] Timeout waiting for container 'smriti-api' to become healthy!`.
- **Cause**: Slow machine hardware, WSL2 memory throttling, or database initialization taking longer than expected.
- **Resolution**:
  1. Run self-healing repair:
     ```powershell
     powershell -ExecutionPolicy Bypass -File repair.ps1
     ```
  2. Increase Docker memory limits in Docker Desktop (Settings -> Resources -> Advanced -> Memory 4GB+).
  3. Inspect specific container logs:
     ```powershell
     docker logs --tail 50 smriti-api
     ```

---

### Issue 4: Database Migration Failure (`alembic upgrade head`)

- **Symptom**: Error running Alembic schema migrations or table lock conflict.
- **Cause**: Database container was restarted during an active migration or database credentials in `.env` do not match.
- **Resolution**:
  1. Check database connectivity:
     ```powershell
     docker exec -it smriti-db pg_isready -U postgres -d smriti_retail_db
     ```
  2. Run database migration manually:
     ```powershell
     docker exec smriti-api python -m alembic upgrade head
     ```
  3. If database state is corrupt, perform factory reset (WARNING: erases transactional data):
     ```powershell
     powershell -ExecutionPolicy Bypass -File reset.ps1
     ```

---

### Issue 5: PowerShell Execution Policy Restriction

- **Symptom**: `File install.ps1 cannot be loaded because running scripts is disabled on this system.`
- **Cause**: Default Windows PowerShell script execution policy prevents unsigned script execution.
- **Resolution**:
  Pass `-ExecutionPolicy Bypass` explicitly:
  ```powershell
  powershell -ExecutionPolicy Bypass -File install.ps1
  ```
  Or adjust execution policy for current user session:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

---

## 📑 Diagnostic Command Reference Summary

| Task | Command |
| :--- | :--- |
| **Check Cluster Status** | `powershell -File status.ps1` |
| **View Live API Logs** | `powershell -File logs.ps1 -Service api` |
| **View Live Workspace Logs** | `powershell -File logs.ps1 -Service workspace` |
| **Execute Diagnostic Repair** | `powershell -File repair.ps1` |
| **Restart Cluster** | `powershell -File stop.ps1` followed by `powershell -File start.ps1` |
| **Database Factory Reset** | `powershell -File reset.ps1` |
| **Full Container Tear-down** | `powershell -File uninstall.ps1` |
