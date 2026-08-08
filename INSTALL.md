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

# SMRITI Retail OS - Enterprise One-Click Quick Start Guide

Welcome to **SMRITI Retail OS**, the AI-Augmented, Four-Tier Enterprise Retail Management System.

---

## ⚡ Single Command One-Click Installation

To automatically install, configure, build, migrate, and launch the complete SMRITI Retail OS application cluster on Windows, open **PowerShell** in the repository root directory and run:

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

> [!NOTE]
> `install.ps1` automatically verifies system prerequisites, creates environment files, generates cryptographic secrets, builds Docker images, starts container services, runs database schema migrations, seeds default admin accounts, and performs HTTP health check probes.

---

## 🖥️ System Requirements

| Requirement | Minimum | Recommended |
| :--- | :--- | :--- |
| **Operating System** | Windows 10 (Build 19041+) / Windows 11 | Windows 11 Pro / Enterprise |
| **PowerShell** | PowerShell 5.1 / 7.0+ | PowerShell 7.4+ |
| **Container Engine** | Docker Desktop v4.20+ with WSL2 | Docker Desktop v4.30+ with WSL2 Integration |
| **RAM** | 8 GB | 16 GB+ |
| **Disk Space** | 10 GB Free Storage | SSD with 20 GB+ Free Storage |
| **CPU** | Dual-Core 2.0 GHz | Quad-Core / 8-Thread 3.0 GHz+ |

---

## 🌐 Application Access Endpoints

Once the installer completes, access the application services at:

- **SMRITI Operations Workspace (Frontend)**: [http://localhost:3000](http://localhost:3000)
- **SMRITI Platform API Core (Headless API)**: [http://localhost:8000](http://localhost:8000)
- **API Health Status Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 🔑 Default Initial Login Credentials

| Username | Password | Assigned System Role |
| :--- | :--- | :--- |
| `super` | `Shpr0128vdq!@` | **System Administrator** (Full Permissions) |
| `manager` | `Password@123` | **Store Manager** (Operations & Reports) |
| `cashier` | `Cashier@1234` | **POS Cashier** (POS & Sales) |

---

## 🛠️ Management Command Palette

All cluster operations can be managed via dedicated PowerShell scripts in the root directory:

```powershell
# Check Cluster Health & Endpoint Status
powershell -File status.ps1

# Stream Container Logs in Real-Time
powershell -File logs.ps1 -Service api

# Create Compressed Database Backup
powershell -File backup.ps1

# Restore Database from Backup
powershell -File restore.ps1

# Pull Updates & Rebuild Images
powershell -File update.ps1

# Execute Self-Healing Diagnostic & Repair
powershell -File repair.ps1

# Stop Cluster Containers Gracefully
powershell -File stop.ps1

# Start Cluster Containers
powershell -File start.ps1

# Factory Reset Database to Fresh Seed State
powershell -File reset.ps1

# Uninstall Cluster
powershell -File uninstall.ps1
```

---

## 📚 Further Documentation

- [Enterprise Installation Guide](file:///f:/SMRITRretailNXmgrt/INSTALLATION_GUIDE.md)
- [Troubleshooting Matrix](file:///f:/SMRITRretailNXmgrt/TROUBLESHOOTING.md)
