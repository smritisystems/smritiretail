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

smriti_change_field.py — SMRITI Practical Enterprise Field Change CLI Tool & Migration Scaffolder
Conforms to Level 1 SMRITI Architecture Constitution (ADR-014 Field Change Lifecycle v2.0).
"""

import os
import sys
import argparse
import datetime
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("smriti.change_field")

def generate_cr_file(cr_id, module, entity, field, data_type, reason):
    """Generate Change Request markdown document."""
    cr_dir = os.path.join("docs", "change_requests")
    os.makedirs(cr_dir, exist_ok=True)
    cr_path = os.path.join(cr_dir, f"{cr_id}_{module}_{entity}_{field}.md")

    content = f"""<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
-->

# Change Request: {cr_id} — Add Field `{field}` to `{entity}`

- **CR ID:** {cr_id}
- **Date:** {datetime.date.today().isoformat()}
- **Module:** {module}
- **Target Entity:** {entity}
- **Field Name:** `{field}`
- **Data Type:** `{data_type}`
- **Business Reason:** {reason}

---

## Impact Analysis Matrix

| Layer | Target Component / File | Impact |
|:---|:---|:---:|
| 1. Database | Table for entity `{entity}` | `[IMPACT]` |
| 2. Migration | `backend/app/db/versions/` | `[IMPACT]` |
| 3. ORM Model | `backend/app/models/` | `[IMPACT]` |
| 4. Repository | `backend/app/repositories/` | `[IMPACT]` |
| 5. Service | `backend/app/services/` | `[IMPACT]` |
| 6. REST API | `backend/app/schemas/` & `api/v1/` | `[IMPACT]` |
| 7. UI Form | `frontend/src/modules/` | `[IMPACT]` |
| 8. Global Search | `backend/app/core/ecosystem/search/` | `[IMPACT]` |
| 9. Reports & BI | `backend/app/services/reports.py` | `[IMPACT]` |
| 10. Data Exchange | `backend/app/api/v1/exchange.py` (Excel) | `[IMPACT]` |
| 11. Print Framework | `backend/app/services/print_framework/` | `[IMPACT]` |
| 12. Test Suite | `backend/app/tests/` | `[IMPACT]` |

---

## Auto-Generated Task Checklist

- [ ] Task 1: Add migration column `{field}` to entity `{entity}`
- [ ] Task 2: Update ORM Model attribute in `backend/app/models/`
- [ ] Task 3: Update Repository filter & CRUD in `backend/app/repositories/`
- [ ] Task 4: Update Domain Service validation in `backend/app/services/`
- [ ] Task 5: Update REST DTO schemas & API endpoints
- [ ] Task 6: Update UI Form component & Pattern C view
- [ ] Task 7: Update Global Unified Search vector
- [ ] Task 8: Update Excel Import & Export pipeline
- [ ] Task 9: Update Print document templates
- [ ] Task 10: Run unit/integration suite in `F:\\SMRITI9TEST`
"""

    with open(cr_path, "w", encoding="utf-8") as f:
        f.write(content)

    logger.info("Change Request created at '%s'", cr_path)
    return cr_path

def scaffold_migration(cr_id, entity, field, data_type):
    """Scaffold Alembic migration file."""
    versions_dir = os.path.join("backend", "app", "db", "versions")
    os.makedirs(versions_dir, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    table_name = entity.lower() + "s"
    revision_id = f"v1216_{entity.lower()}_{field}"
    filename = f"{revision_id}.py"
    filepath = os.path.join(versions_dir, filename)

    content = f"""\"\"\"
Change Request {cr_id}: Add {field} to {entity}
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
    op.execute("ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {field} VARCHAR(255) NULL;")

def downgrade() -> None:
    op.drop_column('{table_name}', '{field}')
"""

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

    logger.info("Scaffolded Alembic migration at '%s'", filepath)
    return filepath

def main():
    parser = argparse.ArgumentParser(description="SMRITI Practical Enterprise Field Change CLI Tool")
    parser.add_argument("--module", required=True, help="Module Name (e.g. Sales, Purchase, CRM)")
    parser.add_argument("--entity", required=True, help="Target Entity Class (e.g. Supplier, SalesInvoice, Customer)")
    parser.add_argument("--field", required=True, help="Field Name (e.g. sales_person_id, fssai_number)")
    parser.add_argument("--type", default="String(50)", help="Field Data Type (e.g. String(50), UUID, Numeric(15,2))")
    parser.add_argument("--reason", default="Business requirement expansion", help="Business Justification")

    args = parser.parse_args()
    timestamp = datetime.datetime.now().strftime("%H%M%S")
    cr_id = f"CR-{datetime.date.today().year}-{timestamp[:4]}"

    logger.info("==========================================================================")
    logger.info("           SMRITI PRACTICAL FIELD CHANGE LIFECYCLE CLI (FCL v2.0)          ")
    logger.info("==========================================================================")
    logger.info("Module       : %s", args.module)
    logger.info("Entity       : %s", args.entity)
    logger.info("Field        : %s", args.field)
    logger.info("Data Type    : %s", args.type)
    logger.info("Reason       : %s", args.reason)
    logger.info("--------------------------------------------------------------------------")

    cr_path = generate_cr_file(cr_id, args.module, args.entity, args.field, args.type, args.reason)
    mig_path = scaffold_migration(cr_id, args.entity, args.field, args.type)

    logger.info("--------------------------------------------------------------------------")
    logger.info("IMPACT ANALYSIS & SCAFFOLDING COMPLETE ✅")
    logger.info("  1. Change Request Doc : %s", cr_path)
    logger.info("  2. Alembic Migration  : %s", mig_path)
    logger.info("--------------------------------------------------------------------------")
    logger.info("Developer & AI Next Action: Implement Tasks 2-10 across impacted files.")
    logger.info("==========================================================================")

if __name__ == "__main__":
    main()
