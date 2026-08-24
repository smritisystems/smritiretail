"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-24
Modified     : 2026-08-24
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Sprint 2 -- Legacy Menu Map Model

smriti_legacy_menu_map is a JOIN TABLE between:
  - The immutable Shoper9 vaMenu registry (MnuNo/MenuOpt as natural keys)
  - The canonical SMRITI workspace/action system (SmritiMenu.id)

Design Rules:
  1. This table is APPEND-ONLY. Legacy data is never deleted from it.
  2. The canonical SmritiMenu record is the authoritative owner.
     This table is subordinate and informational.
  3. MigrationStatus values are a closed enum. No freeform text.
  4. document_type is a VARCHAR label (e.g. SALES_INVOICE), not a FK.
     It serves as a routing hint, not a relational constraint.
  5. The table is GLOBAL (no company_id/branch_id scoping).
     Every tenant inherits the same Shoper-to-SMRITI lineage.
"""

from sqlalchemy import (
    Column, String, Integer, SmallInteger, Text,
    UniqueConstraint, CheckConstraint
)
from sqlalchemy.orm import relationship
from ..db.base import BaseEntity


class LegacyMenuMap(BaseEntity):
    """
    Maps every Shoper9 vaMenu entry (MnuNo, MenuOpt) to its
    canonical SMRITI workspace + action equivalent.

    Table: smriti_legacy_menu_map
    """
    __tablename__ = "smriti_legacy_menu_map"
    __table_args__ = (
        UniqueConstraint("sh9_mnu_no", "sh9_menu_opt",
                         name="uq_legacy_map_mnu_opt"),
        CheckConstraint(
            "migration_status IN ("
            "'MAPPED','MERGED','REPLACED','DEPRECATED','NOT_APPLIC','PENDING')",
            name="ck_legacy_map_status"
        ),
        CheckConstraint(
            "sh9_mnu_no >= 0 AND sh9_menu_opt >= 0",
            name="ck_legacy_map_nonneg"
        ),
    )

    # ── Shoper9 Identity (natural keys from vaMenu) ───────────────────────────
    sh9_mnu_no   = Column(Integer, nullable=False, index=True,
                          comment="vaMenu.MnuNo -- Shoper parent group code")
    sh9_menu_opt = Column(Integer, nullable=False, index=True,
                          comment="vaMenu.MenuOpt -- Shoper leaf action code")
    sh9_mnu_name = Column(String(120), nullable=True,
                          comment="vaMenu.MnuName -- Shoper group label")
    sh9_mnu_cap  = Column(String(200), nullable=True,
                          comment="vaMenu.MnuCap -- Shoper display caption")
    sh9_exe_name = Column(String(60), nullable=True,
                          comment="vaMenu.ExeName -- Shoper executable")
    sh9_pgm_opt  = Column(SmallInteger, nullable=True,
                          comment="vaMenu.pgmopt -- Shoper sub-function code")
    sh9_allow_closed = Column(SmallInteger, nullable=True, default=0,
                              comment="vaMenu.AllowWhenTrnClosed flag")
    sh9_multi_inst   = Column(SmallInteger, nullable=True, default=0,
                              comment="vaMenu.MultiInstance flag")

    # ── SMRITI Target (resolved from CANONICAL_34_MENU_MATRIX) ───────────────
    smriti_menu_id   = Column(String(80), nullable=True, index=True,
                              comment="SMRITI menu_id key from canonical matrix")
    smriti_workspace = Column(String(120), nullable=True,
                              comment="Human-readable SMRITI workspace name")
    smriti_module    = Column(String(50), nullable=True, index=True,
                              comment="SMRITI functional module: SALES/INVENTORY/etc")
    smriti_action    = Column(String(60), nullable=True,
                              comment="SMRITI action verb: NEW_TRANSACTION/VIEW/etc")
    document_type    = Column(String(60), nullable=True,
                              comment="SMRITI document_type routing label")

    # ── Migration Governance ──────────────────────────────────────────────────
    migration_status = Column(
        String(20), nullable=False, default="PENDING", index=True,
        comment=(
            "MAPPED=direct equiv | MERGED=consolidated | "
            "REPLACED=SMRITI-superior | DEPRECATED=pre-GST/Tally | "
            "NOT_APPLIC=internal Shoper infra | PENDING=needs review"
        )
    )
    migration_notes  = Column(Text, nullable=True,
                              comment="Free-text rationale for classification")

    # ── Source Traceability ───────────────────────────────────────────────────
    source_file      = Column(String(120), nullable=True,
                              comment="S9Q source file this entry was extracted from")
    map_version      = Column(String(10), nullable=False, default="1.0",
                              comment="Sprint that produced this mapping")

    def __repr__(self) -> str:
        return (
            f"<LegacyMenuMap sh9=({self.sh9_mnu_no},{self.sh9_menu_opt}) "
            f"smriti={self.smriti_menu_id} action={self.smriti_action} "
            f"status={self.migration_status}>"
        )
