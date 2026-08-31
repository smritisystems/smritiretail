<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-08-14
  Modified     : 2026-08-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Training Academy — Learn → Practice → Verify → Certify — Implementation Plan v1.0

## 1. Objective
Build an operational, interactive training system (`src/components/training/TrainingAcademyTab.tsx`) inside SMRITI Retail OS that empowers store operators, cashiers, inventory managers, and supervisors to learn, practice, verify, and obtain server-authoritative certification on the 7-day business transaction lifecycle (`Master → PO → GRN → Stock → Sales → Reports`), with **100% strict isolation from production business data**.

## 2. Business Motivation
Store onboarding is often slow and prone to user error when taught as disconnected UI screens. By embedding a session-based **Training Sandbox Engine** with real-time business effect tracking, SMRITI Retail OS guarantees rapid staff onboarding, zero live database contamination, and verifiable competency certification before staff operate live billing terminals.

## 3. Golden Isolation Rule & Policy
> **Golden Isolation Rule**: No Training Academy operation may create, modify, delete, reserve, deduct, or otherwise mutate any production business data in `Smritibus_<CompanyCode>`.

```text
                    SMRITI RETAIL OS
                           │
             ┌─────────────┴─────────────┐
             │                           │
       PRODUCTION                    TRAINING
             │                           │
      SmritiSys                    Training Academy
             │                           │
 Smritibus_<CompanyCode>          Training Session
             │                           │
   BUSINESS SOURCE TRUTH           Sandbox Engine
                                         │
                              ┌──────────┴──────────┐
                              │                     │
                       Simulation State       Verification
                              │                     │
                              └──────────┬──────────┘
                                         ↓
                                  SmritiTraining
                                         │
                              Progress / Assessment
                                         │
                                         ↓
                                  Certification
```

## 4. Core Architecture & Clarifications

### A. Dedicated Training Database (`SmritiTraining`)
Production business truth resides in `Smritibus_<CompanyCode>`. All training progress, attempts, and certificate records are stored in a separate, dedicated `SmritiTraining` database schema containing:
- `training_sessions`
- `training_progress`
- `training_step_attempts`
- `training_assessments`
- `training_certificates`

### B. Header Isolation Policy (No `X-Company-Code` for Sandbox APIs)
Training API endpoints (`/api/v1/training/...`) execute under an isolated training JWT authorization scope bound to `training_session_id`. Training APIs **never** accept or pass `X-Company-Code` headers targeting production databases (`Smritibus_<CompanyCode>`).

### C. Session-Based Training Isolation (`training_session_id`)
Each trainee operates within an isolated session scope (e.g. `TRAIN-2026-001`):
```text
TRAIN-2026-001
 ├── Masters (Simulated Items, Suppliers, Customers)
 ├── Purchase Orders (Simulated POs)
 ├── Goods Receipts (Simulated GRNs & Shortage tracking)
 ├── Stock Ledgers (Simulated Available Stock)
 ├── Sales Invoices (Simulated POS Checkout)
 ├── Assessment Attempts
 └── Certificate Metadata
```

### D. Deterministic Day 5 Lifecycle Verification Engine
Day 5 competency test evaluates actual simulated sandbox state against exact expected business state:
```text
PO             = 50
GRN            = 48
Short          = 2
Stock Added    = +48
Sales          = -5
Expected Stock = 43
```
Verification succeeds if `Actual Sandbox State == Expected Business State`. Upon success, awards the **🏆 DAY 5 — BUSINESS LIFECYCLE PASSED** badge.

### E. Server-Authoritative Certificate & Public Verification Endpoint
- Public read-only verification route: `GET /api/v1/training/certificates/{certificate_id}/verify`.
- QR Code links directly to this public verification URL.
- Returns non-sensitive verification payload (`VALID`, `Trainee Name`, `Certification Level`, `Issue Date`, `Certificate Status`).

### F. Final Server Certification Gate Formula
```text
Day 1–7 completed
      +
Production DB mutation = 0
      +
Expected sandbox state = Actual sandbox state
      +
Assessment passed
      ↓
SERVER-CERTIFIED
```

## 5. Scope of Phase 1 Implementation
- **Curriculum Shell**: `TrainingAcademyTab.tsx` with clean native SMRITI UI layout.
- **Session Model**: `training_session_id` session manager & state initializer.
- **Sandbox Engine**: `trainingStore.ts` for handling local interactive UI simulation.
- **Isolation Tests**: `backend/tests/t_prod_isolate.py` ensuring zero mutation of production database `Smritibus_<CompanyCode>`.

## 6. Files Created
- `docs/implementation/user_guide/Training_Academy.md`: This plan file.
- `src/components/training/TrainingAcademyTab.tsx`: Main Academy UI component.
- `src/components/training/TrainingProgressHeader.tsx`: Academy header and progress tracker.
- `src/components/training/MethodologyRunner.tsx`: 7-Step daily lesson runner.
- `src/components/training/LiveTrainingStateView.tsx`: Business effect state widget.
- `src/components/training/Day5LifecycleTestE.tsx`: Signature Day 5 evaluation engine.
- `src/components/training/CertificateGenerat.tsx`: PDF certificate generator.
- `src/services/trainingStore.ts`: Session-based training sandbox store.
- `backend/app/api/v1/training.py`: FastAPI training backend routes & public verification endpoint.
- `backend/app/models/training.py`: SQLAlchemy database models for `SmritiTraining`.
- `backend/tests/t_prod_isolate.py`: Mandatory production isolation test suite.

## 7. Files Modified
- `src/App.tsx`: Mount `TrainingAcademyTab` in main workspace tab routing.
- `src/components/WorkspaceTaskbar.tsx` & `src/components/WorkspaceToolbar.tsx`: Add Training Academy icon/link.
- `backend/app/main.py`: Include `training.router`.
- `docs/implementation/README.md`: Update implementation plan index table.

## 8. Dependencies
- `react`, `lucide-react`, `motion` (Framer Motion), `jspdf`, `qrcode`.
- FastAPI, SQLAlchemy, PostgreSQL.

## 9. Status
Approved (Rating: 9.9/10) — Ready for Phase 1 Build.

## 10. Related ADRs
- `ADR-001`: Platform Architecture & Modular Isolation Policy.

## 11. Related Walkthroughs
- `docs/walkthrough/user_guide/User_Training.md`.
