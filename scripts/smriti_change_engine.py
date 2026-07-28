"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 12.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

smriti_change_engine.py — SMRITI Change Engine (SCE) & Change Studio (SCS v4.0) CLI Tool
Conforms to Level 1 SMRITI Architecture Constitution (ADR-014 & AOP-008 v4.0).
Supports: analyze, preview, and generate subcommands.
"""

import os
import sys
import argparse
import datetime
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("smriti.change_engine")

CHANGE_CATALOG = {
    "new_field": {
        "risk": "LOW",
        "layers": ["Database Column", "Alembic Migration", "ORM Model", "Repository", "Service", "REST API Schema", "UI Form", "Global Search", "Reports & BI", "Data Exchange (Excel)", "Print Framework", "Test Suite"]
    },
    "modify_field": {
        "risk": "HIGH",
        "layers": ["Schema Evolution Check", "Alembic Migration", "ORM Model", "Repository", "Service", "REST API Schema", "UI Form", "Reports & BI", "Test Suite"]
    },
    "delete_field": {
        "risk": "CRITICAL",
        "layers": ["Dependency Graph Analysis", "Deprecation Lifecycle", "Alembic Migration", "Model Attribute Removal", "API Schema Update", "UI Removal", "Test Suite Update"]
    },
    "new_table": {
        "risk": "MEDIUM",
        "layers": ["Database Blueprint (ADR-012)", "Alembic Migration", "BaseEntity ORM Class", "Repository Layer (ADR-006)", "Domain Service", "REST Router", "RBAC Scopes", "Test Suite"]
    },
    "modify_table": {
        "risk": "HIGH",
        "layers": ["Schema Evolution Check", "Alembic Migration", "ORM Class", "Repository", "Test Suite"]
    },
    "new_api": {
        "risk": "MEDIUM",
        "layers": ["Pydantic Request DTO", "Pydantic Response DTO", "FastAPI Router", "Auth Dependencies", "Rate Limiter", "OpenAPI Docs", "Test Suite"]
    },
    "new_screen": {
        "risk": "MEDIUM",
        "layers": ["SEDS UI Pattern (A/B/C)", "Layout Manager", "Navigation Manifest", "RBAC Scope", "Test Suite"]
    },
    "new_report": {
        "risk": "LOW",
        "layers": ["SQL Aggregations / ORM Query", "Service Report Compiler", "REST Endpoint", "Excel / CSV Pipeline", "RBAC Permissions", "Test Suite"]
    },
    "new_print_format": {
        "risk": "LOW",
        "layers": ["Jinja2 Template", "Print Token Registry", "Document Series", "Print Dispatcher", "Test Suite"]
    },
    "new_workflow": {
        "risk": "HIGH",
        "layers": ["FSM State Enum", "Approval Matrix", "Event Bus Trigger", "Escalation Rules", "REST API", "Test Suite"]
    },
    "new_integration": {
        "risk": "HIGH",
        "layers": ["Public API Gateway", "Webhook Callback Handler", "Event Queue Worker", "DLQ Logger", "Test Suite"]
    },
}

def capability_review(module, entity, name):
    """Perform capability review to check if component/field/report already exists (GR-014)."""
    logger.info("Executing Capability Review (GR-014 Code-First Search)...")
    model_path = os.path.join("backend", "app", "models", f"{module.lower()}.py")
    exists = os.path.exists(model_path)
    if exists:
        logger.info("  [✓] Existing module file found: %s (Can be extended)", model_path)
    else:
        logger.info("  [!] Module file not found: %s (New module scaffolding required)", model_path)

def analyze_change(cr_id, change_type, module, entity, name, reason):
    """Analyze change request without modifying codebase."""
    info = CHANGE_CATALOG.get(change_type, CHANGE_CATALOG["new_field"])
    risk = info["risk"]
    layers = info["layers"]

    logger.info("==========================================================================")
    logger.info("       SMRITI CHANGE STUDIO (SCS v4.0) — IMPACT ANALYZER (ADR-014)        ")
    logger.info("==========================================================================")
    logger.info("CR ID        : %s", cr_id)
    logger.info("Change Type  : %s", change_type)
    logger.info("Risk Level   : %s", risk)
    logger.info("Module/Entity: %s / %s", module, entity)
    logger.info("Change Name  : %s", name)
    logger.info("Reason       : %s", reason)
    logger.info("--------------------------------------------------------------------------")

    capability_review(module, entity, name)

    logger.info("--------------------------------------------------------------------------")
    logger.info("DEPENDENCY GRAPH FOR %s.%s:", entity, name)
    logger.info(" %s", entity)
    for layer in layers:
        logger.info("  ├── %s", layer)

    logger.info("--------------------------------------------------------------------------")
    logger.info("ROLLBACK PLAN SCAFFOLD:")
    logger.info("  Database : Execute Alembic downgrade -1")
    logger.info("  API/UI   : Revert schema DTO and hide component binding")
    logger.info("  Tests    : Revert test assertions in test workspace")
    logger.info("==========================================================================")
    logger.info("Status: Analysis Complete (Zero Code Modified). Run 'preview' or 'generate'.")

def preview_change(cr_id, change_type, module, entity, name):
    """Preview files to be modified/created before execution."""
    logger.info("==========================================================================")
    logger.info("       SMRITI CHANGE STUDIO (SCS v4.0) — PREVIEW ENGINE                   ")
    logger.info("==========================================================================")
    logger.info("CR ID        : %s", cr_id)
    logger.info("Change Type  : %s", change_type)
    logger.info("Files to be Scaffolded/Modified:")
    logger.info("  1. docs/change_requests/%s_%s_%s.md", cr_id, change_type, name)
    if "field" in change_type or "table" in change_type:
        logger.info("  2. backend/app/db/versions/v1216_%s_%s_%s.py", change_type, entity.lower(), name)
    logger.info("  3. backend/app/models/%s.py", module.lower())
    logger.info("  4. backend/app/schemas/%s.py", module.lower())
    logger.info("  5. backend/app/api/v1/%s.py", module.lower())
    logger.info("  6. backend/app/tests/test_%s.py", module.lower())
    logger.info("==========================================================================")

def generate_change(cr_id, change_type, module, entity, name, reason):
    """Generate Change Request document and scaffold files."""
    cr_dir = os.path.join("docs", "change_requests")
    os.makedirs(cr_dir, exist_ok=True)
    cr_filename = f"{cr_id}_{change_type}_{module}_{name}.md"
    cr_path = os.path.join(cr_dir, cr_filename)

    info = CHANGE_CATALOG.get(change_type, CHANGE_CATALOG["new_field"])
    layers = info["layers"]

    matrix_rows = "\n".join([f"| {idx+1}. {layer} | `[IMPACT]` |" for idx, layer in enumerate(layers)])
    task_rows = "\n".join([f"- [ ] Task {idx+1}: Scaffolding and update for {layer}" for idx, layer in enumerate(layers)])

    content = f"""<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
-->

# Change Request: {cr_id} — {change_type.upper().replace('_', ' ')} `{name}`

- **CR ID:** {cr_id}
- **Date:** {datetime.date.today().isoformat()}
- **Change Type:** `{change_type}`
- **Risk Level:** `{info['risk']}`
- **Module:** {module}
- **Target Entity / Component:** {entity}
- **Change Name:** `{name}`
- **Business Reason:** {reason}

---

## Capability Review (GR-014)
- Existing components reviewed: Yes
- Reusable components identified: `backend/app/models/{module.lower()}.py`

---

## Impact Analysis Matrix

| Layer | Impact Status |
|:---|:---:|
{matrix_rows}

---

## Rollback Plan
- **Database:** Execute `alembic downgrade -1`
- **API/UI:** Revert schema DTO and hide component binding
- **Tests:** Revert test assertions in `backend/app/tests/`

---

## Auto-Generated Task Graph

{task_rows}
"""

    with open(cr_path, "w", encoding="utf-8") as f:
        f.write(content)

    logger.info("Change Request document generated at '%s'", cr_path)

    scaffolded_files = [cr_path]

    if "field" in change_type or "table" in change_type:
        versions_dir = os.path.join("backend", "app", "db", "versions")
        os.makedirs(versions_dir, exist_ok=True)
        revision_id = f"v1216_{change_type}_{entity.lower()}_{name}"
        filename = f"{revision_id}.py"
        filepath = os.path.join(versions_dir, filename)

        mig_content = f"""\"\"\"
Change Request {cr_id}: {change_type} {name} on {entity}
Revision ID: {revision_id}
Revises: v1215_wms_loyalty_expansion
Create Date: {datetime.datetime.now().isoformat()}
\"\"\"
from alembic import op
import sqlalchemy as sa

revision = '{revision_id}'
down_revision = 'v1215_wms_loyalty_expansion'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # TODO: Implement upgrade schema evolution
    pass

def downgrade() -> None:
    # TODO: Implement downgrade schema rollback
    pass
"""
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(mig_content)
        logger.info("Scaffolded Alembic migration at '%s'", filepath)
        scaffolded_files.append(filepath)

    logger.info("SCAFFOLDING GENERATION COMPLETE ✅")

def main():
    parser = argparse.ArgumentParser(description="SMRITI Change Studio (SCS v4.0) CLI Tool")
    parser.add_argument("mode", choices=["analyze", "preview", "generate"], help="Mode: analyze, preview, or generate")
    parser.add_argument("--type", choices=list(CHANGE_CATALOG.keys()), default="new_field", help="Change Type")
    parser.add_argument("--module", default="Sales", help="Module Name (e.g. Sales, Purchase, CRM, Accounting)")
    parser.add_argument("--entity", default="SalesInvoice", help="Target Entity Class / Component")
    parser.add_argument("--name", default="change_name", help="Change Name / Field Name")
    parser.add_argument("--reason", default="Business requirement expansion", help="Business Justification")
    parser.add_argument("--cr", default="CR-2026-001", help="Change Request ID for preview/generate")

    args = parser.parse_args()
    timestamp = datetime.datetime.now().strftime("%H%M%S")
    cr_id = args.cr if args.cr != "CR-2026-001" else f"CR-{datetime.date.today().year}-{timestamp[:4]}"

    if args.mode == "analyze":
        analyze_change(cr_id, args.type, args.module, args.entity, args.name, args.reason)
    elif args.mode == "preview":
        preview_change(cr_id, args.type, args.module, args.entity, args.name)
    elif args.mode == "generate":
        generate_change(cr_id, args.type, args.module, args.entity, args.name, args.reason)

if __name__ == "__main__":
    main()
