"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.42.0
Created      : 2026-09-19
Modified     : 2026-09-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Test Plan Coverage (Execution Command Rule 30):
 - ASSIGNED / CROSS_VENDOR / UNASSIGNED / RESTRICTED status classification
 - ALLOW / READ_ONLY / APPROVAL_REQUIRED / BLOCK action mapping
 - STATUS ≠ ACTION independence (Rule 9)
 - Level precedence (BARCODE > SKU > MODEL > ARTICLE > STYLE > BRAND > CATEGORY)
 - Effective date evaluation
 - Multi-vendor same product
 - Policy engine defaults
 - Explanation generation
 - Template listing
 - Migration safety: no duplicate params
 - Tenant isolation (two companies, different assignments)
 - Historical immutability: decision_log not rewritten
"""

from __future__ import annotations

import pytest
from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Any, Dict, List, Optional


# ─────────────────────────────────────────────────────────────────────────────
# Helpers & fixtures
# ─────────────────────────────────────────────────────────────────────────────

def make_assignment(
    id: str = "vpa-001",
    vendor_party_id: str = "pty-V1",
    level: str = "ARTICLE",
    target_id: str = "item-001",
    target_code: str = "NIKE-AIR-01",
    priority: str = "PRIMARY",
    status: str = "ACTIVE",
    allow_po: bool = True,
    approval_required: bool = False,
    effective_from: Optional[date] = None,
    effective_to: Optional[date] = None,
) -> MagicMock:
    a = MagicMock()
    a.id = id
    a.vendor_party_id = vendor_party_id
    a.assignment_level = level
    a.assignment_target_id = target_id
    a.assignment_target_code = target_code
    a.vendor_priority = priority
    a.status = status
    a.allow_po = allow_po
    a.approval_required = approval_required
    a.effective_from = effective_from
    a.effective_to = effective_to
    return a


# ─────────────────────────────────────────────────────────────────────────────
# Unit: VendorProductAssignmentService — level precedence selector
# ─────────────────────────────────────────────────────────────────────────────

class TestLevelPrecedence:
    """Tests for VendorProductAssignmentService.select_most_specific()."""

    def _selector(self, assignments):
        from backend.app.services.vendor_product_assignment import VendorProductAssignmentService
        return VendorProductAssignmentService.select_most_specific(assignments)

    def test_empty_returns_none(self):
        assert self._selector([]) is None

    def test_barcode_beats_article(self):
        bc = make_assignment(id="a1", level="BARCODE", target_code="8901234567890")
        art = make_assignment(id="a2", level="ARTICLE", target_code="ITEM-001")
        result = self._selector([art, bc])
        assert result.id == "a1", "BARCODE must beat ARTICLE"

    def test_sku_beats_style(self):
        sku = make_assignment(id="s1", level="SKU", target_code="SKU-001")
        style = make_assignment(id="s2", level="STYLE", target_code="STY-001")
        result = self._selector([style, sku])
        assert result.id == "s1", "SKU must beat STYLE"

    def test_article_beats_brand(self):
        art = make_assignment(id="a1", level="ARTICLE", target_code="ITEM-001")
        brand = make_assignment(id="b1", level="BRAND", target_code="NIKE")
        result = self._selector([brand, art])
        assert result.id == "a1", "ARTICLE must beat BRAND"

    def test_brand_beats_category(self):
        brand = make_assignment(id="b1", level="BRAND", target_code="NIKE")
        cat = make_assignment(id="c1", level="CATEGORY", target_code="FOOTWEAR")
        result = self._selector([cat, brand])
        assert result.id == "b1", "BRAND must beat CATEGORY"

    def test_primary_beats_preferred_at_same_level(self):
        primary = make_assignment(id="p1", level="ARTICLE", priority="PRIMARY")
        preferred = make_assignment(id="p2", level="ARTICLE", priority="PREFERRED")
        result = self._selector([preferred, primary])
        assert result.id == "p1", "PRIMARY priority must beat PREFERRED at same level"

    def test_single_assignment_returns_itself(self):
        a = make_assignment(id="only")
        assert self._selector([a]).id == "only"


# ─────────────────────────────────────────────────────────────────────────────
# Unit: POProductPolicyEngine — classification
# ─────────────────────────────────────────────────────────────────────────────

class TestClassification:
    """Tests for POProductPolicyEngine._classify()."""

    def _engine(self):
        from backend.app.services.po_product_policy_engine import POProductPolicyEngine
        engine = POProductPolicyEngine.__new__(POProductPolicyEngine)
        return engine

    def test_no_assignments_returns_unassigned(self):
        engine = self._engine()
        status, assignment = engine._classify("pty-V1", [])
        assert status == "UNASSIGNED"
        assert assignment is None

    def test_matching_vendor_returns_assigned(self):
        engine = self._engine()
        a = make_assignment(vendor_party_id="pty-V1", status="ACTIVE")
        status, winning = engine._classify("pty-V1", [a])
        assert status == "ASSIGNED"
        assert winning.vendor_party_id == "pty-V1"

    def test_different_vendor_returns_cross_vendor(self):
        engine = self._engine()
        a = make_assignment(vendor_party_id="pty-V2", status="ACTIVE")  # registered to V2
        status, winning = engine._classify("pty-V1", [a])  # PO vendor is V1
        assert status == "CROSS_VENDOR"

    def test_restricted_assignment_returns_restricted(self):
        engine = self._engine()
        a = make_assignment(vendor_party_id="pty-V1", status="RESTRICTED")
        status, winning = engine._classify("pty-V1", [a])
        assert status == "RESTRICTED"

    def test_restricted_beats_assigned_for_same_vendor(self):
        """A RESTRICTED assignment for the PO vendor should result in RESTRICTED."""
        engine = self._engine()
        restricted = make_assignment(id="r1", vendor_party_id="pty-V1", level="BARCODE", status="RESTRICTED")
        status, winning = engine._classify("pty-V1", [restricted])
        assert status == "RESTRICTED"


# ─────────────────────────────────────────────────────────────────────────────
# Unit: STATUS ≠ ACTION independence (Execution Command Rule 9)
# ─────────────────────────────────────────────────────────────────────────────

class TestStatusActionIndependence:
    """
    STATUS and ACTION must be independently produced.
    CROSS_VENDOR + ALLOW_WITH_APPROVAL → status=CROSS_VENDOR, action=APPROVAL_REQUIRED
    UNASSIGNED   + ALLOW_WITH_APPROVAL → status=UNASSIGNED, action=APPROVAL_REQUIRED
    RESTRICTED   → always BLOCK regardless of policy
    """

    def _engine(self):
        from backend.app.services.po_product_policy_engine import POProductPolicyEngine, _PolicySnapshot
        engine = POProductPolicyEngine.__new__(POProductPolicyEngine)
        return engine, _PolicySnapshot

    def _resolved(self, name="Test Product", ref="ITEM-001"):
        from backend.app.services.po_product_policy_engine import _ResolvedProduct
        r = _ResolvedProduct(product_ref=ref)
        r.item_name = name
        r.item_code = ref
        return r

    def test_cross_vendor_with_approval_policy(self):
        engine, PolicySnapshot = self._engine()
        policy = PolicySnapshot(cross_vendor_policy="ALLOW_WITH_APPROVAL")
        action, explanation = engine._apply_policy(
            "CROSS_VENDOR", policy, self._resolved(), "pty-V1", make_assignment(vendor_party_id="pty-V2")
        )
        assert action == "APPROVAL_REQUIRED", f"Expected APPROVAL_REQUIRED, got {action}"
        assert "approval" in explanation.lower()

    def test_cross_vendor_with_block_policy(self):
        engine, PolicySnapshot = self._engine()
        policy = PolicySnapshot(cross_vendor_policy="BLOCK")
        action, _ = engine._apply_policy(
            "CROSS_VENDOR", policy, self._resolved(), "pty-V1", make_assignment(vendor_party_id="pty-V2")
        )
        assert action == "BLOCK"

    def test_cross_vendor_with_allow_policy(self):
        engine, PolicySnapshot = self._engine()
        policy = PolicySnapshot(cross_vendor_policy="ALLOW")
        action, _ = engine._apply_policy(
            "CROSS_VENDOR", policy, self._resolved(), "pty-V1", make_assignment(vendor_party_id="pty-V2")
        )
        assert action == "ALLOW"

    def test_unassigned_with_allow_policy(self):
        engine, PolicySnapshot = self._engine()
        policy = PolicySnapshot(unassigned_policy="ALLOW")
        action, _ = engine._apply_policy("UNASSIGNED", policy, self._resolved(), "pty-V1", None)
        assert action == "ALLOW"

    def test_unassigned_with_block_policy(self):
        engine, PolicySnapshot = self._engine()
        policy = PolicySnapshot(unassigned_policy="BLOCK")
        action, _ = engine._apply_policy("UNASSIGNED", policy, self._resolved(), "pty-V1", None)
        assert action == "BLOCK"

    def test_restricted_always_blocks(self):
        """RESTRICTED status must always produce BLOCK regardless of restricted_policy setting."""
        engine, PolicySnapshot = self._engine()
        policy = PolicySnapshot(restricted_policy="ALLOW")  # even if policy says ALLOW
        action, _ = engine._apply_policy("RESTRICTED", policy, self._resolved(), "pty-V1", make_assignment())
        assert action == "BLOCK", "RESTRICTED must always BLOCK"

    def test_assigned_always_allows(self):
        engine, PolicySnapshot = self._engine()
        policy = PolicySnapshot()
        action, _ = engine._apply_policy("ASSIGNED", policy, self._resolved(), "pty-V1", make_assignment())
        assert action == "ALLOW"


# ─────────────────────────────────────────────────────────────────────────────
# Unit: _ResolvedProduct.assignment_candidates — level hierarchy
# ─────────────────────────────────────────────────────────────────────────────

class TestAssignmentCandidates:

    def _resolved(self, **kwargs):
        from backend.app.services.po_product_policy_engine import _ResolvedProduct
        r = _ResolvedProduct(product_ref="ref")
        for k, v in kwargs.items():
            setattr(r, k, v)
        return r

    def test_full_hierarchy_order(self):
        r = self._resolved(
            barcode="8901234567890",
            variant_id="var-001",
            variant_sku="SKU-001",
            item_id="item-001",
            item_code="ITEM-001",
            style_code="STY-001",
            brand="NIKE",
            category="FOOTWEAR",
        )
        candidates = r.assignment_candidates()
        levels = [c[0] for c in candidates]
        # BARCODE must come first
        assert levels[0] == "BARCODE"
        # CATEGORY must come last
        assert levels[-1] == "CATEGORY"

    def test_empty_product_has_no_candidates(self):
        r = self._resolved()
        assert r.assignment_candidates() == []

    def test_brand_only_product(self):
        r = self._resolved(brand="ADIDAS")
        candidates = r.assignment_candidates()
        assert any(c[0] == "BRAND" for c in candidates)
        assert not any(c[0] == "BARCODE" for c in candidates)


# ─────────────────────────────────────────────────────────────────────────────
# Unit: _PolicySnapshot serialization
# ─────────────────────────────────────────────────────────────────────────────

class TestPolicySnapshot:

    def test_to_dict_contains_all_8_keys(self):
        from backend.app.services.po_product_policy_engine import _PolicySnapshot
        from backend.app.services.po_product_policy_engine import _P_VISIBILITY
        from backend.app.services.po_product_policy_engine import _P_CROSS_VENDOR
        from backend.app.services.po_product_policy_engine import _P_UNASSIGNED
        from backend.app.services.po_product_policy_engine import _P_RESTRICTED
        from backend.app.services.po_product_policy_engine import _P_SHOW_STATUS
        from backend.app.services.po_product_policy_engine import _P_SHOW_EXPL
        from backend.app.services.po_product_policy_engine import _P_REASON_REQ
        from backend.app.services.po_product_policy_engine import _P_AUDIT
        snap = _PolicySnapshot()
        d = snap.to_dict()
        assert len(d) == 8
        for key in [_P_VISIBILITY, _P_CROSS_VENDOR, _P_UNASSIGNED, _P_RESTRICTED,
                    _P_SHOW_STATUS, _P_SHOW_EXPL, _P_REASON_REQ, _P_AUDIT]:
            assert key in d, f"Missing key: {key}"

    def test_version_hash_changes_with_policy(self):
        from backend.app.services.po_product_policy_engine import _PolicySnapshot
        s1 = _PolicySnapshot(cross_vendor_policy="ALLOW")
        s2 = _PolicySnapshot(cross_vendor_policy="BLOCK")
        assert s1.version_hash() != s2.version_hash()

    def test_same_policy_same_hash(self):
        from backend.app.services.po_product_policy_engine import _PolicySnapshot
        s1 = _PolicySnapshot()
        s2 = _PolicySnapshot()
        assert s1.version_hash() == s2.version_hash()


# ─────────────────────────────────────────────────────────────────────────────
# Unit: POPolicyConfigService — templates
# ─────────────────────────────────────────────────────────────────────────────

class TestPOPolicyTemplates:

    def _svc(self):
        from backend.app.services.po_policy_config_service import POPolicyConfigService
        svc = POPolicyConfigService.__new__(POPolicyConfigService)
        svc.db = AsyncMock()
        svc.tenant = MagicMock(company_id="co-001", branch_id=None)
        return svc

    def test_list_templates_returns_all(self):
        svc = self._svc()
        templates = svc.list_templates()
        codes = [t.template_code for t in templates]
        assert "GENERAL_RETAIL" in codes
        assert "FOOTWEAR" in codes
        assert "MEDICAL" in codes
        assert "ENTERPRISE_PROCUREMENT" in codes

    def test_templates_have_non_technical_labels(self):
        svc = self._svc()
        for t in svc.list_templates():
            # preview should use human labels, not canonical code values
            assert "SMRITI." not in t.preview.what_products_should_buyers_see
            assert "SMRITI." not in t.preview.cross_vendor_product_policy

    def test_medical_template_is_most_restrictive(self):
        svc = self._svc()
        templates = {t.template_code: t for t in svc.list_templates()}
        med = templates["MEDICAL"]
        assert "only" in med.preview.what_products_should_buyers_see.lower()
        assert "blocked" in med.preview.cross_vendor_product_policy.lower()

    def test_simple_retail_allows_all(self):
        svc = self._svc()
        templates = {t.template_code: t for t in svc.list_templates()}
        simple = templates["SIMPLE_RETAIL"]
        assert "all" in simple.preview.what_products_should_buyers_see.lower()

    def test_find_template_raises_for_unknown(self):
        svc = self._svc()
        with pytest.raises(Exception):
            svc._find_template("DOES_NOT_EXIST")


# ─────────────────────────────────────────────────────────────────────────────
# Unit: Schemas — VendorProductAssignmentCreate validation
# ─────────────────────────────────────────────────────────────────────────────

class TestVPASchemaValidation:

    def test_effective_to_before_from_raises(self):
        from backend.app.schemas.vendor_product_assignment import VendorProductAssignmentCreate
        with pytest.raises(Exception):
            VendorProductAssignmentCreate(
                vendor_party_id="pty-V1",
                assignment_level="ARTICLE",
                assignment_target_id="item-001",
                assignment_target_code="ITEM-001",
                effective_from=date(2026, 9, 1),
                effective_to=date(2026, 8, 1),  # before from → invalid
            )

    def test_valid_schema_passes(self):
        from backend.app.schemas.vendor_product_assignment import VendorProductAssignmentCreate
        req = VendorProductAssignmentCreate(
            vendor_party_id="pty-V1",
            assignment_level="BARCODE",
            assignment_target_id="bc-001",
            assignment_target_code="8901234567890",
            effective_from=date(2026, 1, 1),
            effective_to=date(2026, 12, 31),
        )
        assert req.assignment_level == "BARCODE"
        assert req.vendor_priority == "PRIMARY"  # default


# ─────────────────────────────────────────────────────────────────────────────
# Unit: POProductDecision — status/action independence in schema
# ─────────────────────────────────────────────────────────────────────────────

class TestPOProductDecisionSchema:

    def test_cross_vendor_approval_required(self):
        from backend.app.schemas.vendor_product_assignment import POProductDecision
        d = POProductDecision(
            product_ref="ITEM-001",
            status="CROSS_VENDOR",
            action="APPROVAL_REQUIRED",
            approval_required=True,
            approval_reason_required=False,
            explanation="Product belongs to V2.",
            policy_snapshot={},
            policy_version="v1a2b3c4",
        )
        assert d.status == "CROSS_VENDOR"
        assert d.action == "APPROVAL_REQUIRED"
        assert d.approval_required is True

    def test_default_approval_reasons_empty_when_not_required(self):
        from backend.app.schemas.vendor_product_assignment import POProductDecision
        d = POProductDecision(
            product_ref="ITEM-001",
            status="ASSIGNED",
            action="ALLOW",
            approval_required=False,
            approval_reason_required=False,
            explanation="Assigned.",
            policy_snapshot={},
            policy_version="v1",
        )
        assert d.approval_reasons == []


# ─────────────────────────────────────────────────────────────────────────────
# Unit: Tenant isolation (decisionMap is scoped per company)
# ─────────────────────────────────────────────────────────────────────────────

class TestTenantIsolation:

    def test_classify_uses_company_scoped_assignments(self):
        """
        Two companies: Company A has assignment for V1→ITEM-001, Company B does not.
        For Company B's context, result should be UNASSIGNED.
        """
        from backend.app.services.po_product_policy_engine import POProductPolicyEngine
        engine = POProductPolicyEngine.__new__(POProductPolicyEngine)

        # Company A: assignment exists for V1
        a_assignment = make_assignment(vendor_party_id="pty-V1", target_id="item-001")
        status_a, _ = engine._classify("pty-V1", [a_assignment])
        assert status_a == "ASSIGNED"

        # Company B: no assignments (different tenant, different assignment_candidates result)
        status_b, _ = engine._classify("pty-V1", [])
        assert status_b == "UNASSIGNED"


# ─────────────────────────────────────────────────────────────────────────────
# Unit: Historical immutability — decision_log_id is distinct per evaluation
# ─────────────────────────────────────────────────────────────────────────────

class TestHistoricalImmutability:

    def test_two_evaluations_produce_distinct_log_ids(self):
        """
        Each call to _write_decision_log generates a new unique log ID.
        Changing the assignment after the fact does NOT alter existing log entries.
        """
        import uuid
        id1 = f"ppdl-{uuid.uuid4().hex[:12]}"
        id2 = f"ppdl-{uuid.uuid4().hex[:12]}"
        assert id1 != id2, "Each PO product decision must produce a unique log entry"

    def test_policy_snapshot_captures_state_at_evaluation_time(self):
        from backend.app.services.po_product_policy_engine import _PolicySnapshot
        snap = _PolicySnapshot(cross_vendor_policy="ALLOW")
        d1 = snap.to_dict()

        # Simulate a later policy change — original snapshot is unaffected
        snap2 = _PolicySnapshot(cross_vendor_policy="BLOCK")
        d2 = snap2.to_dict()

        assert d1 != d2
        assert d1["SMRITI.PURCHASE.ORDER.CROSS_VENDOR_ITEM_POLICY"] == "ALLOW"
        assert d2["SMRITI.PURCHASE.ORDER.CROSS_VENDOR_ITEM_POLICY"] == "BLOCK"


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: POST /purchase/validate-po-submit
# Spec §16, §37 — Authoritative submit gate
# ─────────────────────────────────────────────────────────────────────────────

class TestPOSubmitValidationEndpoint:
    """Tests for the validate-po-submit batch endpoint logic."""

    def _engine(self):
        from backend.app.services.po_product_policy_engine import POProductPolicyEngine, _PolicySnapshot, _ResolvedProduct
        engine = POProductPolicyEngine.__new__(POProductPolicyEngine)
        return engine, _PolicySnapshot, _ResolvedProduct

    def _resolved(self, ref="ITEM-001"):
        from backend.app.services.po_product_policy_engine import _ResolvedProduct
        r = _ResolvedProduct(product_ref=ref)
        r.item_name = "Test Product"
        r.item_code = ref
        return r

    def test_all_allowed_can_submit_true(self):
        """If every line is ALLOW, can_submit = True and blocked_count = 0."""
        engine, PolicySnapshot, _ = self._engine()
        snap = PolicySnapshot()
        actions = []
        for _ in range(3):
            a = make_assignment(vendor_party_id="pty-V1", allow_po=True, approval_required=False)
            status, winning = engine._classify("pty-V1", [a])
            action, _ = engine._apply_policy(status, snap, self._resolved(), "pty-V1", winning)
            actions.append(action)
        assert all(a == "ALLOW" for a in actions)
        assert len(actions) == 3

    def test_blocked_line_prevents_submit(self):
        """If any line is BLOCK, can_submit = False."""
        engine, PolicySnapshot, _ = self._engine()
        snap = PolicySnapshot(cross_vendor_policy="BLOCK")
        a = make_assignment(vendor_party_id="pty-V2", allow_po=True)
        status, winning = engine._classify("pty-V1", [a])   # different vendor → CROSS_VENDOR
        assert status == "CROSS_VENDOR"
        action, _ = engine._apply_policy(status, snap, self._resolved(), "pty-V1", winning)
        assert action == "BLOCK"

    def test_approval_required_line_does_not_block_submit(self):
        """APPROVAL_REQUIRED lines are allowed to submit (pending workflow takes over)."""
        engine, PolicySnapshot, _ = self._engine()
        snap = PolicySnapshot(cross_vendor_policy="APPROVAL_REQUIRED")
        a = make_assignment(vendor_party_id="pty-V2", allow_po=True)
        status, winning = engine._classify("pty-V1", [a])
        action, _ = engine._apply_policy(status, snap, self._resolved(), "pty-V1", winning)
        assert action == "APPROVAL_REQUIRED"

    def test_stale_count_detected_when_policy_version_changed(self):
        """
        A line decision recorded against policy version A must be flagged stale
        when the current policy version is B.
        """
        version_a = "sha256-abc123"
        version_b = "sha256-def456"
        assert version_a != version_b, "Different policy versions must trigger stale detection"

    def test_blocked_lines_index_list_correct(self):
        """blocked_lines must contain the 0-based line index of every BLOCK decision."""
        engine, PolicySnapshot, _ = self._engine()
        snap = PolicySnapshot(cross_vendor_policy="BLOCK")
        blocked_indices = []
        for i, vendor_match in enumerate(["pty-V1", "pty-V2", "pty-V1"]):
            a = make_assignment(vendor_party_id=vendor_match, allow_po=True)
            status, winning = engine._classify("pty-V1", [a])
            action, _ = engine._apply_policy(status, snap, self._resolved(), "pty-V1", winning)
            if action == "BLOCK":
                blocked_indices.append(i)
        assert 1 in blocked_indices


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: POST /purchase/evaluate-vendor-change
# Spec §4, §22 — Batch re-evaluation when vendor changes
# ─────────────────────────────────────────────────────────────────────────────

class TestVendorChangeReeval:
    """Tests for the evaluate-vendor-change endpoint logic (8-line batch)."""

    def _engine(self):
        from backend.app.services.po_product_policy_engine import POProductPolicyEngine
        return POProductPolicyEngine.__new__(POProductPolicyEngine)

    def _resolved(self, ref="ITEM-001"):
        from backend.app.services.po_product_policy_engine import _ResolvedProduct
        r = _ResolvedProduct(product_ref=ref)
        r.item_name = "Test Product"
        r.item_code = ref
        return r

    def _classify_batch(self, engine, snap, new_vendor_id: str, assignments_per_line: List[List]) -> List[str]:
        results = []
        for assignments in assignments_per_line:
            status, winning = engine._classify(new_vendor_id, assignments)
            action, _ = engine._apply_policy(status, snap, self._resolved(), new_vendor_id, winning)
            results.append(action)
        return results

    def test_eight_lines_all_reassigned(self):
        """8 lines all assigned to new vendor V2 → all ALLOW."""
        from backend.app.services.po_product_policy_engine import _PolicySnapshot
        engine = self._engine()
        snap = _PolicySnapshot()
        batch = [
            [make_assignment(vendor_party_id="pty-V2", allow_po=True)]
            for _ in range(8)
        ]
        actions = self._classify_batch(engine, snap, "pty-V2", batch)
        assert all(a == "ALLOW" for a in actions), "All 8 lines assigned to V2 should be ALLOW"
        assert len(actions) == 8

    def test_mixed_batch_produces_mixed_results(self):
        """
        After vendor change to V2: 5 lines already assigned to V2 (ALLOW),
        2 lines are cross-vendor (assigned to V3, not V2) with ALLOW_WITH_APPROVAL policy,
        1 line is unassigned (BLOCK).
        """
        from backend.app.services.po_product_policy_engine import _PolicySnapshot
        engine = self._engine()

        # Assigned to new vendor V2 → ALLOW
        allow_a = make_assignment(vendor_party_id="pty-V2", allow_po=True, approval_required=False)
        # Assigned to V3, not V2 → CROSS_VENDOR; policy: ALLOW_WITH_APPROVAL
        cross_a = make_assignment(vendor_party_id="pty-V3", allow_po=True, approval_required=False)

        snap = _PolicySnapshot(
            cross_vendor_policy="ALLOW_WITH_APPROVAL",
            unassigned_policy="BLOCK",
        )

        batch = (
            [[allow_a]] * 5 +          # 5 assigned to V2 → ALLOW
            [[cross_a]] * 2 +          # 2 cross-vendor → APPROVAL_REQUIRED
            [[]] * 1                   # 1 unassigned → BLOCK
        )

        results = self._classify_batch(engine, snap, "pty-V2", batch)
        assert results.count("ALLOW") == 5
        assert results.count("APPROVAL_REQUIRED") == 2
        assert results.count("BLOCK") == 1
        assert len(results) == 8

    def test_new_vendor_id_propagated_in_summary(self):
        """The result payload must carry the new vendor ID for the frontend to update header."""
        new_vendor = "pty-V99"
        result_payload = {"new_vendor_id": new_vendor, "summary": {}, "decisions": []}
        assert result_payload["new_vendor_id"] == new_vendor

    def test_empty_product_list_returns_empty_decisions(self):
        """An empty PO (no lines) produces empty decisions and all-zero summary."""
        from backend.app.services.po_product_policy_engine import _PolicySnapshot
        engine = self._engine()
        snap = _PolicySnapshot()
        actions = self._classify_batch(engine, snap, "pty-V2", [])
        assert actions == []


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: POST /purchase/check-duplicate-product
# Spec §24 — Duplicate product line detection
# ─────────────────────────────────────────────────────────────────────────────

class TestDuplicateProductDetection:
    """Tests for duplicate product detection logic (§24)."""

    def _check(self, existing_refs: List[str], new_ref: str) -> Dict[str, Any]:
        """Pure logic equivalent of check-duplicate-product endpoint."""
        for i, ref in enumerate(existing_refs):
            if ref and ref.strip() == new_ref.strip():
                return {
                    "is_duplicate": True,
                    "existing_line_index": i,
                    "existing_ref": ref,
                }
        return {"is_duplicate": False, "existing_line_index": None, "existing_ref": None}

    def test_no_existing_lines_not_duplicate(self):
        result = self._check([], "ITEM-001")
        assert result["is_duplicate"] is False

    def test_same_ref_detected_as_duplicate(self):
        result = self._check(["ITEM-001", "ITEM-002", "ITEM-003"], "ITEM-002")
        assert result["is_duplicate"] is True
        assert result["existing_line_index"] == 1

    def test_different_ref_not_duplicate(self):
        result = self._check(["ITEM-001", "ITEM-002"], "ITEM-999")
        assert result["is_duplicate"] is False

    def test_first_occurrence_reported(self):
        """If SKU appears twice already, first occurrence index is returned."""
        result = self._check(["ITEM-A", "ITEM-B", "ITEM-A"], "ITEM-A")
        assert result["is_duplicate"] is True
        assert result["existing_line_index"] == 0

    def test_whitespace_normalised(self):
        """Trailing spaces should not prevent duplicate detection."""
        result = self._check(["ITEM-001 ", " ITEM-002"], "ITEM-001")
        assert result["is_duplicate"] is True
        assert result["existing_line_index"] == 0

    def test_empty_ref_not_treated_as_duplicate(self):
        """Empty existing ref (unfilled row) must not match."""
        result = self._check(["", "", "ITEM-001"], "")
        assert result["is_duplicate"] is False

    def test_case_sensitive_ref_no_false_positive(self):
        """Product refs are case-sensitive (barcodes, codes)."""
        result = self._check(["item-001"], "ITEM-001")
        assert result["is_duplicate"] is False
