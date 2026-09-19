"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-09-03
Modified     : 2026-09-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Unit & Integration Test
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "scripts"))
from lib.semantic_fingerprinter import SemanticFingerprint
from lib.certificate_manager import PreflightCertificateManager
from architecture_preflight import query_registry


class TestSemanticFingerprintAndGovernance:
    def test_negative_differently_named_customer_lookup_candidates(self):
        """
        Proves CustomerLookup.tsx, AdvancedPartySearch.tsx, and UniversalCustomerFinder.tsx
        are ALL detected as duplicate candidates for customer.lookup via semantic fingerprint.
        """
        sample_code_1 = """
        import React from 'react';
        import { apiFetchV1 } from '../lib/apiFetchV1';
        export function CustomerLookup() {
            const search = (q) => apiFetchV1('/api/v1/crm/customers?q=' + q);
            return <div><input name="gstin" /><input name="mobile" /></div>;
        }
        """

        sample_code_2 = """
        import React from 'react';
        import { apiFetchV1 } from '../lib/apiFetchV1';
        export function AdvancedPartySearch() {
            const query = () => apiFetchV1('/api/v1/crm/customers');
            const fields = { gstin: '27AAAAA0000A1Z5', mobile: '9876543210' };
            return <div>Find party</div>;
        }
        """

        sample_code_3 = """
        import React from 'react';
        import { apiFetchV1 } from '../lib/apiFetchV1';
        export function UniversalCustomerFinder() {
            const fetchCust = () => apiFetchV1('/api/v1/crm/customers/search');
            return <form><input name="mobile" /><input name="gst_number" /></form>;
        }
        """

        fp1 = SemanticFingerprint(sample_code_1, "CustomerLookup.tsx")
        fp2 = SemanticFingerprint(sample_code_2, "AdvancedPartySearch.tsx")
        fp3 = SemanticFingerprint(sample_code_3, "UniversalCustomerFinder.tsx")

        for fp in [fp1, fp2, fp3]:
            assert "customer" in fp.detected_entities
            assert any(r in ["lookup", "find", "search"] for r in fp.detected_capabilities)

    def test_novel_capability_without_adr_blocks_create_approved(self):
        """
        Proves NO_MATCH != CREATE_APPROVED.
        Unregistered capability 'ai_face_scanner' must return ARCHITECTURE_DECISION_REQUIRED.
        """
        res = query_registry(entity="customer", capability="ai_face_scanner", proposed_name="FaceScanner.tsx")
        assert res["status"] == "ARCHITECTURE_DECISION_REQUIRED"
        assert res["exit_code"] == 2
        assert "NO_MATCH ≠ CREATE_APPROVED" in res["message"]

    def test_novel_capability_with_approved_adr_allows_create_approved(self):
        """
        Proves that an approved ADR allows creation and issues a verifiable certificate.
        """
        res = query_registry(
            entity="sales_order",
            capability="order_entry",
            proposed_name="SalesOrderFormCustom.tsx",
            adr_id="ADR-EXEMPT-006",
        )
        assert res["status"] == "CREATE_APPROVED"
        assert res["exit_code"] == 0
        assert "certificate_id" in res
        assert res["certificate_id"].startswith("PF-")

    def test_false_positive_prevention_on_specialized_capability(self):
        """
        Proves that a genuinely distinct specialized capability (e.g. loyalty voucher redemption)
        is NOT falsely classified as a duplicate of customer.lookup.
        """
        voucher_code = """
        import React from 'react';
        import { apiFetchV1 } from '../lib/apiFetchV1';
        export function CustomerLoyaltyVoucherRedemption() {
            const redeem = (voucherId) => apiFetchV1('/api/v1/loyalty/vouchers/redeem', { method: 'POST' });
            return <div>Redeem Points</div>;
        }
        """
        fp = SemanticFingerprint(voucher_code, "CustomerLoyaltyVoucherRedemption.tsx")
        # Should not falsely resolve to customer.lookup
        assert "lookup" not in fp.detected_capabilities

    def test_preflight_certificate_verification(self):
        """
        Tests certificate issuance and validation through PreflightCertificateManager.
        """
        cert = PreflightCertificateManager.issue_certificate(
            entity="customer",
            capability="customer.lookup",
            asset_type="component",
            proposed_name="ValidCustomerView.tsx",
            decision="REUSE_EXISTING",
            canonical_owner="UniversalBrowseEngine.tsx",
            target_file_path="src/components/customer/ValidCustomerView.tsx",
        )

        assert cert["certificate_id"].startswith("PF-")

        # Test verification succeeds with valid name
        check = PreflightCertificateManager.verify_file_certificate("src/components/customer/ValidCustomerView.tsx")
        assert check["valid"] is True
        assert check["certificate_id"] == cert["certificate_id"]

        # Test verification fails for random uncertified file
        check_invalid = PreflightCertificateManager.verify_file_certificate("src/components/customer/UncertifiedHackedView.tsx")
        assert check_invalid["valid"] is False

    def test_frozen_architecture_decision_enforcement(self):
        """
        Proves that disputed targets (products vs items) strictly halt with ARCHITECTURE_DECISION_REQUIRED.
        """
        res = query_registry(entity="inventory", capability="modify_catalog", proposed_name="products")
        assert res["status"] == "ARCHITECTURE_DECISION_REQUIRED"
        assert res["decision_id"] == "ADR-FROZEN-001"
        assert res["exit_code"] == 2
