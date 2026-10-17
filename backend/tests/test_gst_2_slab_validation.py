"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-29
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

GST 2.0 Slab Validation Tests
================================
Verifies that the gst_rate master_values table in smritisys reflects the
correct GST 2.0 statutory slabs: {0, 5, 18, 40}  and that 12 is retired.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
import psycopg2


VALID_GST_2_SLABS = {"0", "5", "18", "40"}
ABOLISHED_SLAB   = "12"

CP_DSN     = "postgresql://postgres:postgres@localhost:2781/smritisys"
TENANT_DSN = "postgresql://postgres:postgres@localhost:2781/smriti001"


def get_gst_slabs(dsn: str) -> dict:
    """Returns {code: is_deleted} for all gst_rate master_values."""
    try:
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        cur.execute("""
            SELECT mv.code, mv.is_deleted
            FROM master_values mv
            JOIN master_types mt ON mt.id = mv.master_type_id
            WHERE mt.code = 'gst_rate'
        """)
        result = {r[0]: r[1] for r in cur.fetchall()}
        cur.close(); conn.close()
        return result
    except Exception as e:
        pytest.skip(f"DB not reachable: {e}")


class TestGst20SlabCorrection:
    """
    GST 2.0 Slab correctness contract for smritisys master_values.
    Effective 22-Sep-2025: slabs are {0%, 5%, 18%, 40%}; 12% is abolished.
    """

    @pytest.mark.integration
    def test_gst_40_slab_is_active_in_control_plane(self):
        """40% slab must be present and active (is_deleted=False) in smritisys."""
        slabs = get_gst_slabs(CP_DSN)
        assert "40" in slabs, (
            "GST 2.0 (effective 22-Sep-2025): 40% slab is missing from smritisys master_values. "
            "Run scripts/remediate_gst_2_slab_correction.py to fix."
        )
        assert slabs["40"] is False, (
            "GST 40% slab is present but is_deleted=True. It must be ACTIVE."
        )

    @pytest.mark.integration
    def test_gst_12_slab_is_retired_in_control_plane(self):
        """12% slab must be soft-retired (is_deleted=True) in smritisys — not hard-deleted."""
        slabs = get_gst_slabs(CP_DSN)
        assert ABOLISHED_SLAB in slabs, (
            "GST 12% slab must be soft-deleted in smritisys (not hard-deleted, for audit trail). "
            "If missing entirely, the remediation script was not run — or data was hard-deleted."
        )
        assert slabs[ABOLISHED_SLAB] is True, (
            "GST 12% slab (abolished per GST 2.0) must be is_deleted=True in smritisys. "
            "Found is_deleted=False — run scripts/remediate_gst_2_slab_correction.py."
        )

    @pytest.mark.integration
    def test_all_approved_gst_slabs_are_active(self):
        """Every approved GST 2.0 slab {0, 5, 18, 40} must be ACTIVE in smritisys."""
        slabs = get_gst_slabs(CP_DSN)
        for slab in VALID_GST_2_SLABS:
            assert slab in slabs, (
                f"Approved GST 2.0 slab '{slab}%' is missing from smritisys master_values."
            )
            assert slabs[slab] is False, (
                f"Approved GST 2.0 slab '{slab}%' is present but is_deleted=True. It must be ACTIVE."
            )

    @pytest.mark.integration
    def test_no_unapproved_active_gst_slabs(self):
        """
        No slab outside {0, 5, 18, 40} may be is_deleted=False in smritisys.
        This pins the full active-slab set to exactly the GST 2.0 statutory slabs.
        """
        slabs = get_gst_slabs(CP_DSN)
        active_slabs = {code for code, deleted in slabs.items() if not deleted}
        rogue = active_slabs - VALID_GST_2_SLABS
        assert not rogue, (
            f"Unapproved GST slabs are ACTIVE in smritisys: {rogue}. "
            f"All active GST slabs must be within {VALID_GST_2_SLABS}. "
            "Soft-retire any slab outside this set."
        )

    @pytest.mark.integration
    def test_no_active_items_use_12_percent_gst(self):
        """
        All items using the abolished 12% slab must be flagged REQUIRES_REVIEW
        (validation_status). None may have validation_status=PASS with tax_rate=12.
        """
        try:
            conn = psycopg2.connect(TENANT_DSN)
            cur = conn.cursor()
            cur.execute("""
                SELECT COUNT(*) FROM items
                WHERE tax_rate = 12
                  AND is_deleted IS NOT TRUE
                  AND (validation_status IS NULL OR validation_status = 'PASS')
            """)
            unflagged = cur.fetchone()[0]
            cur.close(); conn.close()
        except Exception as e:
            pytest.skip(f"smriti001 not reachable: {e}")

        assert unflagged == 0, (
            f"{unflagged} item(s) use tax_rate=12% but are NOT flagged as REQUIRES_REVIEW. "
            "Run scripts/remediate_gst_2_slab_correction.py to flag them for CA review."
        )

    @pytest.mark.integration
    def test_flagged_12_percent_items_have_review_message(self):
        """
        Items flagged REQUIRES_REVIEW with tax_rate=12 must have a validation_message
        that contains 'GST 2.0' — so operators can identify the reason.
        """
        try:
            conn = psycopg2.connect(TENANT_DSN)
            cur = conn.cursor()
            cur.execute("""
                SELECT COUNT(*) FROM items
                WHERE tax_rate = 12
                  AND is_deleted IS NOT TRUE
                  AND validation_status = 'REQUIRES_REVIEW'
                  AND (validation_message IS NULL OR validation_message NOT ILIKE '%GST 2.0%')
            """)
            missing_msg = cur.fetchone()[0]
            cur.close(); conn.close()
        except Exception as e:
            pytest.skip(f"smriti001 not reachable: {e}")

        assert missing_msg == 0, (
            f"{missing_msg} REQUIRES_REVIEW item(s) with tax_rate=12% have no 'GST 2.0' "
            "context in validation_message. CA reviewers cannot identify the reason."
        )
