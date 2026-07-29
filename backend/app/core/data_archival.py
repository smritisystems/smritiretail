"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 7.1.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
SMRITI System Core Layer - Data Archival & Cold-Storage Export Engine
Conforms to Level 1 SMRITI Architecture Constitution (AOP-004: Additive Schema Evolution & Data Safety Principle).

Responsibilities:
1. Identifies historical records that have crossed the retention threshold.
2. Exports qualifying records as JSON bundles to a cold-storage target path (file system / cloud bucket ready).
3. Returns a dry-run or execute manifest — never deletes without explicit confirmation flag.
4. Guarantees FK-safe archival: only archives records with no open workflow dependencies.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import datetime
import json
import os


@dataclass
class ArchivalRecord:
    record_id: str
    entity_type: str
    document_date: datetime.date
    data: Dict[str, Any]


@dataclass
class ArchivalManifest:
    run_id: str
    cutoff_date: datetime.date
    records_eligible: int
    records_archived: int
    cold_storage_path: Optional[str]
    dry_run: bool
    archived_ids: List[str]
    blocked_ids: List[str]  # Records with open dependencies — NOT archived
    executed_at: datetime.datetime = field(default_factory=datetime.datetime.now)


class DataArchivalEngine:
    """
    Canonical Data Archival & Cold-Storage Export Engine (AOP-004).

    Design Guarantees (AOP-004):
    - Additive: Only exports data, never alters live table structure.
    - Safe: Blocked records (open dependencies) are never archived.
    - Reversible: Archived JSON can be re-imported.
    - Dry-Run First: Simulate before executing.
    """

    def __init__(self, cold_storage_base_path: str = "data/archive"):
        self.cold_storage_base_path = cold_storage_base_path
        # Registry of record IDs that have open dependencies (e.g. unpaid invoices, open POs)
        self._open_dependency_ids: set = set()

    def register_open_dependencies(self, record_ids: List[str]) -> None:
        """Register record IDs that are blocked from archival due to active workflows."""
        self._open_dependency_ids.update(record_ids)

    def run_archival(
        self,
        records: List[ArchivalRecord],
        cutoff_date: datetime.date,
        run_id: str = "ARCH-RUN-001",
        dry_run: bool = True,
        export_dir: Optional[str] = None,
    ) -> ArchivalManifest:
        """
        Run archival batch for records older than cutoff_date.

        Args:
            records: Full list of candidate records.
            cutoff_date: Records with document_date < cutoff_date are eligible.
            run_id: Unique identifier for this archival run.
            dry_run: If True, simulates export without writing files.
            export_dir: Override cold storage path for this run.
        """
        eligible = [r for r in records if r.document_date < cutoff_date]
        archived_ids = []
        blocked_ids = []
        exported_records = []

        for record in eligible:
            if record.record_id in self._open_dependency_ids:
                blocked_ids.append(record.record_id)
                continue
            archived_ids.append(record.record_id)
            exported_records.append(record.data)

        cold_path = None
        if not dry_run and exported_records:
            base = export_dir or self.cold_storage_base_path
            os.makedirs(base, exist_ok=True)
            filename = f"{run_id}_{cutoff_date.isoformat()}_archive.json"
            cold_path = os.path.join(base, filename)
            with open(cold_path, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "run_id": run_id,
                        "cutoff_date": cutoff_date.isoformat(),
                        "exported_at": datetime.datetime.now().isoformat(),
                        "records": exported_records,
                    },
                    f,
                    indent=2,
                    default=str,
                )

        return ArchivalManifest(
            run_id=run_id,
            cutoff_date=cutoff_date,
            records_eligible=len(eligible),
            records_archived=len(archived_ids),
            cold_storage_path=cold_path,
            dry_run=dry_run,
            archived_ids=archived_ids,
            blocked_ids=blocked_ids,
        )
