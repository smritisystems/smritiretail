<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-13
  Modified     : 2026-07-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: One-Command Installation Scripts — v3.16.0

## 1. Purpose
This walkthrough documents the creation and verification of automated "one-command" installation scripts (`install.ps1` for Windows, `install.sh` for Unix/Linux/macOS) designed to simplify environment initialization, dependency installation, and local configuration.

---

## 2. Scope
- Author and verify a robust Windows PowerShell installer script (`install.ps1`).
- Author a Linux/macOS/WSL Bash installer script (`install.sh`).
- Auto-detect prerequisites (Git, Node.js, Python, Docker).
- Manage virtual environment creation (including automated fallback/detection of stable Python 3.10-3.12 versions over experimental/pre-release runtimes like 3.14).
- Configure Windows Explorer folder visual indicators (applying custom folder settings using a hidden `desktop.ini` pointing to a green circle/dot indicator (🟢)).

---

## 3. Files Created
- `install.ps1` (PowerShell installer)
- `install.sh` (Bash installer)
- `docs/implementation/foundation/One_Command_Installation_Scripts_Plan_v3.16.0.md` (Implementation plan)
- `docs/walkthrough/foundation/Foundation_One_Command_Installation_Scripts_v3.16.0.md` (This file)

---

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

---

## 5. Architecture Decisions
- **Stable Python Version Prioritization:** If multiple Python versions exist on a system, the installer detects and prioritizes stable releases (Python 3.10 to 3.12) to avoid dependency compilation failures associated with pre-release/unsupported runtimes (like Python 3.14).
- **CRLF Line Endings Enforcement:** The Windows PowerShell installer is formatted with strict Windows (CRLF) line endings to avoid here-string and multi-line parsing errors typical in raw PowerShell runtimes.
- **ASCII Conversion:** To prevent character encoding mapping issues when running PowerShell scripts under different regional settings or default ANSI code pages, all output strings use standard ASCII indicators.

---

## 6. Design Rationale
Providing single-command installers ensures uniform developer onboarding and reduces installation issues caused by misconfigured python paths, missing `.env` environments, or manual package setup steps.

---

## 7. Implementation Summary
1. Created `install.ps1` with standard dependency scanning, `.env` file copying, virtual environment compilation (with automated version checks), node package installation, and folder visual customization logic.
2. Created a corresponding `install.sh` script with comparable checks, virtual environment setup, and execute permissions enablement.
3. Successfully ran and verified `install.ps1` on a Windows host, resulting in proper `.venv` rebuild and green-dot branding setup.

---

## 8. Tests Executed
```powershell
# Executed installer script
Powershell.exe -ExecutionPolicy Bypass -File .\install.ps1
# Output:
# =====================================================================
#  SMRITI Retail OS - PowerShell One-Command Installer
# =====================================================================
# [1/5] Verifying system prerequisites...
#   [OK] Git is installed (git version 2.53.0.windows.1)
#   [OK] Node.js is installed (v24.14.0)
#   [OK] Docker is installed (Docker version 29.5.3, build d1c06ef)
#   [OK] Python is installed (Python 3.14.3)
# [2/5] Setting up environment configuration (.env)...
#   [OK] .env file already exists. Skipping copy.
# [3/5] Setting up Python virtual environment and dependencies...
#   Found preferred Python interpreter: C:\Users\netma\AppData\Local\Programs\Python\Python311\python.exe (Python 3.11.6)
#   Existing .venv is built with unsupported Python 3.14. Re-creating...
#   Removing old .venv...
#   Creating virtual environment (.venv) using C:\Users\netma\AppData\Local\Programs\Python\Python311\python.exe...
#   [OK] Virtual environment created.
#   Installing Python dependencies (backend\requirements.txt)...
#   [OK] Python dependencies installed successfully.
# [4/5] Installing frontend Node.js dependencies...
#   Running npm install...
#   [OK] Node.js dependencies installed successfully.
# [5/5] Configuring Explorer visual folder icon (GREEN)...
#   [OK] Configured folder icon to SMRITI visual green indicator (GREEN).
# =====================================================================
#  SMRITI Retail OS installation complete!
# =====================================================================
```

---

## 9. Verification Results
- **Prerequisites scanning:** Done (Properly scans Git, Node, Python, and Docker).
- **Python Selection:** Done (Bypassed Python 3.14 on finding Python 3.11.6 to prevent Wheel build failures).
- **Branding Icon Settings:** Done (Creates hidden `desktop.ini` and sets folder attributes so Explorer displays the green indicator).

---

## 10. Known Limitations
- The visual green indicator dot configuration relies on Windows Explorer loading the `desktop.ini` file; folder caching may delay the visual update until Windows Explorer or the machine is restarted.

---

## 11. Future Work
- Add automated verification checks for PostgreSQL database accessibility.

---

## 12. Related ADRs
None.

---

## 13. Related RFCs
None.
