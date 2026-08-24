<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-13
  Modified     : 2026-07-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: One-Command Automated Installation Scripts

This plan outlines the design and implementation of automated installation scripts (`install.ps1` for Windows, `install.sh` for Linux/macOS/WSL) to allow a one-command setup of SMRITI Retail OS, including dependencies check, environment configuration, database seeding, and Windows Explorer visual branding.

## User Review Required

> [!IMPORTANT]
> **Windows Explorer Folder Customization:**
> On Windows, the installer will customize the root repository folder icon to use a system green circle icon (🟢) to match SMRITI's visual branding. This is achieved by creating a system/hidden `desktop.ini` configuration file and modifying the folder's Read-Only attribute.

## Open Questions

> [!NOTE]
> None. The script parameters and standard developer folder setups are already established.

## Proposed Changes

### Core Installation Scripts

#### [NEW] [install.ps1](file:///d:/IMP/GitHub/SMRITRretailNX/install.ps1)
Windows PowerShell installer script.
- Verifies system prerequisites (Git, Node.js, Python 3.12, Docker, PostgreSQL).
- Automatically sets up `.env` from `.env.example`.
- Installs Node.js packages and Python backend packages.
- Sets up SMRITI visual branding on the folder using a hidden `desktop.ini` file.

#### [NEW] [install.sh](file:///d:/IMP/GitHub/SMRITRretailNX/install.sh)
Bash installer script for Linux, macOS, and WSL.
- Verifies system prerequisites (Git, Node.js, Python 3.12, Docker, PostgreSQL).
- Automatically sets up `.env` from `.env.example`.
- Installs Node.js packages and Python backend packages.
- Configures execution permissions.

---

## Verification Plan

### Manual Verification
1. Run `Powershell.exe -ExecutionPolicy Bypass -File .\install.ps1` on a Windows host:
   - Check that dependencies (Node, Python, Git, Docker) are validated.
   - Verify `.env` is created.
   - Check that the folder icon in Windows Explorer changes to a green circle/dot.
2. Run `./install.sh` on a Linux/macOS terminal:
   - Check that dependencies are validated.
   - Verify `.env` is created.
