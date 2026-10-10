"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-06
Modified     : 2026-10-06
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Schema Mapping Intelligence — DataBridge Phase 7
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_SCHEMA_MAPPING_ENGINE", role="SERVICE", canonicalOwner="backend/app/services/databridge/schema_mapping_engine.py")

import re
import difflib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Set

from .models import (
    DataBridgeEntityType,
    DataBridgeCandidateMatch,
    DataBridgeColumnMapping,
    DataBridgeMissingField,
    DataBridgeSchemaDetectRequest,
    DataBridgeSchemaDetectResponse,
)


class DataBridgeSchemaMapper:
    """
    Authoritative server-side Schema Mapping & Field Detection Intelligence for SMRITI DataBridge.
    Performs multi-tier matching: exact dictionary lookup, token similarity, regex content-profiling,
    ambiguity arbitration, and statutory compliance validation across all 15 enterprise retail entities.
    """

    # Statutory & data-type profiling regexes
    REGEX_GSTIN = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[1-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$", re.IGNORECASE)
    REGEX_PAN = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$", re.IGNORECASE)
    REGEX_PHONE = re.compile(r"^[6-9]\d{9}$")
    REGEX_EMAIL = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")
    REGEX_PINCODE = re.compile(r"^[1-9]\d{5}$")
    REGEX_BARCODE = re.compile(r"^\d{8,14}$")
    REGEX_DATE = re.compile(r"^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})$")

    # Authoritative Entity Field Catalog
    ENTITY_FIELD_CATALOG: Dict[DataBridgeEntityType, Dict[str, Dict[str, Any]]] = {
        DataBridgeEntityType.ITEM: {
            "item_code": {
                "label": "Item / SKU Code",
                "required": True,
                "statutory": False,
                "aliases": ["item_code", "itemcode", "sku", "product_code", "style_code", "article", "art_no", "item_no", "code"],
                "content_type": None,
            },
            "item_name": {
                "label": "Item / Product Name",
                "required": True,
                "statutory": False,
                "aliases": ["item_name", "itemname", "product_name", "product_title", "title", "description", "style_name", "item_desc", "name", "prod_name", "prod_title"],
                "content_type": None,
            },
            "primary_uom": {
                "label": "Primary UOM",
                "required": True,
                "statutory": False,
                "aliases": ["primary_uom", "uom", "unit", "unit_of_measure", "measurement", "base_uom"],
                "content_type": None,
            },
            "brand": {
                "label": "Brand",
                "required": False,
                "statutory": False,
                "aliases": ["brand", "brand_name", "make", "manufacturer", "mfg"],
                "content_type": None,
            },
            "category": {
                "label": "Category",
                "required": False,
                "statutory": False,
                "aliases": ["category", "item_category", "cat", "group", "product_group", "prod_cat"],
                "content_type": None,
            },
            "department": {
                "label": "Department",
                "required": False,
                "statutory": False,
                "aliases": ["department", "dept", "division"],
                "content_type": None,
            },
            "mrp": {
                "label": "Maximum Retail Price (MRP)",
                "required": False,
                "statutory": False,
                "aliases": ["mrp", "maximum_retail_price", "retail_price", "list_price", "max_retail_price"],
                "content_type": "NUMBER",
            },
            "selling_price": {
                "label": "Selling Price",
                "required": False,
                "statutory": False,
                "aliases": ["selling_price", "sales_price", "rate", "sp", "unit_price", "price", "sale_rate"],
                "content_type": "NUMBER",
            },
            "cost_price": {
                "label": "Cost / Purchase Price",
                "required": False,
                "statutory": False,
                "aliases": ["cost_price", "purchase_price", "cp", "landing_cost", "buy_price", "cost"],
                "content_type": "NUMBER",
            },
            "hsn_code": {
                "label": "HSN Code",
                "required": False,
                "statutory": True,
                "aliases": ["hsn_code", "hsn", "sac", "tariff_code", "hsn_sac"],
                "content_type": None,
            },
            "tax_rate": {
                "label": "GST Tax Rate (%)",
                "required": False,
                "statutory": True,
                "aliases": ["tax_rate", "gst_rate", "tax_percent", "gst_percent", "tax_pct", "gst", "vat_rate"],
                "content_type": "NUMBER",
            },
            "barcode": {
                "label": "Barcode / EAN",
                "required": False,
                "statutory": False,
                "aliases": ["barcode", "bar_code", "ean", "upc", "ean13", "gtin", "upc_code"],
                "content_type": "BARCODE",
            },
            "color": {
                "label": "Color / Shade",
                "required": False,
                "statutory": False,
                "aliases": ["color", "colour", "shade", "col"],
                "content_type": None,
            },
            "size": {
                "label": "Size / Fit",
                "required": False,
                "statutory": False,
                "aliases": ["size", "dimension", "fit", "sz"],
                "content_type": None,
            },
        },
        DataBridgeEntityType.CUSTOMER: {
            "name": {
                "label": "Customer Name",
                "required": True,
                "statutory": False,
                "aliases": ["customer_name", "name", "client_name", "party_name", "buyer_name", "account_name"],
                "content_type": None,
            },
            "phone": {
                "label": "Mobile Phone Number",
                "required": True,
                "statutory": False,
                "aliases": ["phone", "mobile", "mobile_no", "contact_no", "cell", "phone_number", "customer_phone"],
                "content_type": "PHONE",
            },
            "email": {
                "label": "Email Address",
                "required": False,
                "statutory": False,
                "aliases": ["email", "email_id", "email_address", "mail"],
                "content_type": "EMAIL",
            },
            "gstin": {
                "label": "GSTIN (Statutory)",
                "required": False,
                "statutory": True,
                "aliases": ["gstin", "gst_no", "gst_number", "gst", "tin_no", "tax_id"],
                "content_type": "GSTIN",
            },
            "pan": {
                "label": "PAN Number",
                "required": False,
                "statutory": True,
                "aliases": ["pan", "pan_no", "pan_number", "permanent_acc_no"],
                "content_type": "PAN",
            },
            "credit_limit": {
                "label": "Credit Limit",
                "required": False,
                "statutory": False,
                "aliases": ["credit_limit", "max_credit", "allowed_credit"],
                "content_type": "NUMBER",
            },
            "address_line1": {
                "label": "Address Line 1",
                "required": False,
                "statutory": False,
                "aliases": ["address", "address_line1", "street", "street_address", "billing_address"],
                "content_type": None,
            },
            "city": {
                "label": "City",
                "required": False,
                "statutory": False,
                "aliases": ["city", "town", "district"],
                "content_type": None,
            },
            "state": {
                "label": "State / Province",
                "required": False,
                "statutory": False,
                "aliases": ["state", "province", "region"],
                "content_type": None,
            },
            "pincode": {
                "label": "Pincode / Postal Code",
                "required": False,
                "statutory": False,
                "aliases": ["pincode", "pin_code", "postal_code", "zip", "zip_code"],
                "content_type": "PINCODE",
            },
        },
        DataBridgeEntityType.SUPPLIER: {
            "name": {
                "label": "Supplier Name",
                "required": True,
                "statutory": False,
                "aliases": ["supplier_name", "vendor_name", "supplier", "vendor", "party_name", "seller_name"],
                "content_type": None,
            },
            "code": {
                "label": "Supplier Code",
                "required": False,
                "statutory": False,
                "aliases": ["supplier_code", "vendor_code", "code", "supp_code", "vendor_id"],
                "content_type": None,
            },
            "phone": {
                "label": "Phone Number",
                "required": False,
                "statutory": False,
                "aliases": ["phone", "mobile", "mobile_no", "contact_no", "phone_number"],
                "content_type": "PHONE",
            },
            "email": {
                "label": "Email Address",
                "required": False,
                "statutory": False,
                "aliases": ["email", "email_id", "email_address", "mail"],
                "content_type": "EMAIL",
            },
            "gstin": {
                "label": "GSTIN (Statutory)",
                "required": False,
                "statutory": True,
                "aliases": ["gstin", "gst_no", "gst_number", "gst", "supplier_gstin", "vendor_gstin"],
                "content_type": "GSTIN",
            },
            "pan": {
                "label": "PAN Number",
                "required": False,
                "statutory": True,
                "aliases": ["pan", "pan_no", "pan_number"],
                "content_type": "PAN",
            },
            "payment_terms": {
                "label": "Payment Terms (Days)",
                "required": False,
                "statutory": False,
                "aliases": ["payment_terms", "terms", "credit_days", "pay_terms"],
                "content_type": "NUMBER",
            },
            "msme_number": {
                "label": "MSME / Udyam Number",
                "required": False,
                "statutory": True,
                "aliases": ["msme_number", "msme_no", "udyam_no", "udyam_number", "msme"],
                "content_type": None,
            },
        },
        DataBridgeEntityType.PURCHASE_ORDER: {
            "order_no": {
                "label": "Purchase Order Number",
                "required": True,
                "statutory": False,
                "aliases": ["po_number", "order_no", "po_no", "purchase_order_no", "doc_no"],
                "content_type": None,
            },
            "order_date": {
                "label": "PO Date",
                "required": True,
                "statutory": False,
                "aliases": ["order_date", "po_date", "date", "purchase_date"],
                "content_type": "DATE",
            },
            "supplier_name": {
                "label": "Supplier / Vendor Name",
                "required": True,
                "statutory": False,
                "aliases": ["supplier_name", "vendor_name", "supplier", "vendor", "party_name"],
                "content_type": None,
            },
            "item_code": {
                "label": "Item / SKU Code",
                "required": True,
                "statutory": False,
                "aliases": ["item_code", "sku", "product_code", "article_no", "code"],
                "content_type": None,
            },
            "quantity": {
                "label": "Order Quantity",
                "required": True,
                "statutory": False,
                "aliases": ["quantity", "qty", "ordered_qty", "order_qty", "units"],
                "content_type": "NUMBER",
            },
            "unit_price": {
                "label": "Unit Price / Rate",
                "required": True,
                "statutory": False,
                "aliases": ["unit_price", "rate", "cost_price", "purchase_rate", "price"],
                "content_type": "NUMBER",
            },
            "tax_rate": {
                "label": "Tax Rate (%)",
                "required": False,
                "statutory": True,
                "aliases": ["tax_rate", "gst_rate", "tax_percent", "gst_pct"],
                "content_type": "NUMBER",
            },
        },
        DataBridgeEntityType.SALES_INVOICE: {
            "invoice_no": {
                "label": "Invoice Number",
                "required": True,
                "statutory": False,
                "aliases": ["invoice_no", "inv_no", "bill_no", "bill_number", "doc_no"],
                "content_type": None,
            },
            "invoice_date": {
                "label": "Invoice Date",
                "required": True,
                "statutory": False,
                "aliases": ["invoice_date", "inv_date", "date", "bill_date"],
                "content_type": "DATE",
            },
            "customer_phone": {
                "label": "Customer Mobile Phone",
                "required": True,
                "statutory": False,
                "aliases": ["customer_phone", "mobile", "phone", "customer_mobile", "phone_no"],
                "content_type": "PHONE",
            },
            "item_code": {
                "label": "Item / SKU Code",
                "required": True,
                "statutory": False,
                "aliases": ["item_code", "sku", "product_code", "barcode", "code"],
                "content_type": None,
            },
            "quantity": {
                "label": "Billed Quantity",
                "required": True,
                "statutory": False,
                "aliases": ["quantity", "qty", "billed_qty", "units"],
                "content_type": "NUMBER",
            },
            "unit_price": {
                "label": "Selling Rate",
                "required": True,
                "statutory": False,
                "aliases": ["unit_price", "selling_price", "rate", "price", "sp"],
                "content_type": "NUMBER",
            },
            "tax_rate": {
                "label": "Tax Rate (%)",
                "required": False,
                "statutory": True,
                "aliases": ["tax_rate", "gst_rate", "tax_percent", "gst"],
                "content_type": "NUMBER",
            },
        },
        DataBridgeEntityType.STOCK_TRANSFER: {
            "transfer_no": {
                "label": "Transfer Number",
                "required": True,
                "statutory": False,
                "aliases": ["transfer_no", "st_number", "dispatch_no", "doc_no", "challan_no"],
                "content_type": None,
            },
            "source_warehouse": {
                "label": "Source Warehouse / Store",
                "required": True,
                "statutory": False,
                "aliases": ["source_warehouse", "from_warehouse", "source_store", "from_store", "source_loc"],
                "content_type": None,
            },
            "dest_warehouse": {
                "label": "Destination Warehouse / Store",
                "required": True,
                "statutory": False,
                "aliases": ["dest_warehouse", "to_warehouse", "target_store", "to_store", "dest_loc"],
                "content_type": None,
            },
            "item_code": {
                "label": "Item / SKU Code",
                "required": True,
                "statutory": False,
                "aliases": ["item_code", "sku", "product_code", "barcode"],
                "content_type": None,
            },
            "quantity": {
                "label": "Transfer Quantity",
                "required": True,
                "statutory": False,
                "aliases": ["quantity", "qty", "transfer_qty", "units"],
                "content_type": "NUMBER",
            },
        },
    }

    @classmethod
    def normalize_token(cls, raw: str) -> str:
        """Normalizes header string: strips punctuation, underscores, and collapses whitespace."""
        if not raw:
            return ""
        s = raw.strip().lower()
        # Convert camelCase to space separated
        s = re.sub(r"([a-z])([A-Z])", r"\1 \2", s)
        # Replace dashes, underscores, periods with spaces
        s = re.sub(r"[_\-\.\/\\#:]+", " ", s)
        # Collapse multiple spaces
        s = re.sub(r"\s+", " ", s).strip()
        return s

    @classmethod
    def calculate_similarity(cls, str1: str, str2: str) -> float:
        """Calculates token-normalized similarity between two header strings (0.0 to 1.0)."""
        norm1 = cls.normalize_token(str1)
        norm2 = cls.normalize_token(str2)
        if norm1 == norm2:
            return 1.0
        
        # Exact compact string match (e.g. "itemcode" == "itemcode")
        compact1 = norm1.replace(" ", "")
        compact2 = norm2.replace(" ", "")
        if compact1 == compact2:
            return 0.98

        # Sequence matcher ratio
        ratio = difflib.SequenceMatcher(None, norm1, norm2).ratio()

        # Word token overlap (Jaccard similarity)
        tokens1 = set(norm1.split())
        tokens2 = set(norm2.split())
        if tokens1 and tokens2:
            jaccard = len(tokens1 & tokens2) / len(tokens1 | tokens2)
            # Weighted average between sequence ratio and token jaccard
            combined = (ratio * 0.6) + (jaccard * 0.4)
            return round(combined, 4)

        return round(ratio, 4)

    @classmethod
    def profile_sample_content(cls, values: List[Any]) -> Optional[str]:
        """Profiles a list of sample row values to detect dominant statutory/data pattern."""
        valid_values = [str(v).strip() for v in values if v is not None and str(v).strip() != ""]
        if not valid_values:
            return None

        total = len(valid_values)
        gstin_hits = sum(1 for v in valid_values if cls.REGEX_GSTIN.match(v))
        pan_hits = sum(1 for v in valid_values if cls.REGEX_PAN.match(v))
        phone_hits = sum(1 for v in valid_values if cls.REGEX_PHONE.match(v.replace("+91", "").replace(" ", "").replace("-", "")))
        email_hits = sum(1 for v in valid_values if cls.REGEX_EMAIL.match(v))
        barcode_hits = sum(1 for v in valid_values if cls.REGEX_BARCODE.match(v))
        date_hits = sum(1 for v in valid_values if cls.REGEX_DATE.match(v))
        pincode_hits = sum(1 for v in valid_values if cls.REGEX_PINCODE.match(v))

        threshold = 0.5  # Majority of samples match pattern

        if gstin_hits / total >= threshold:
            return "GSTIN"
        if pan_hits / total >= threshold:
            return "PAN"
        if phone_hits / total >= threshold:
            return "PHONE"
        if email_hits / total >= threshold:
            return "EMAIL"
        if barcode_hits / total >= threshold:
            return "BARCODE"
        if date_hits / total >= threshold:
            return "DATE"
        if pincode_hits / total >= threshold:
            return "PINCODE"

        return None

    @classmethod
    def detect_schema(cls, req: DataBridgeSchemaDetectRequest) -> DataBridgeSchemaDetectResponse:
        """
        Executes automated schema detection across input headers and sample rows.
        Returns recommendations, confidence scores, and missing required field reports.
        """
        catalog = cls.ENTITY_FIELD_CATALOG.get(req.entity_type)
        if not catalog:
            # Fallback for entities using generic Item catalog or base
            catalog = cls.ENTITY_FIELD_CATALOG[DataBridgeEntityType.ITEM]

        # Extract sample values per header index if sample_rows provided
        column_samples: Dict[str, List[Any]] = {h: [] for h in req.headers}
        if req.sample_rows:
            for row in req.sample_rows[:10]:
                for h in req.headers:
                    val = row.get(h)
                    if val is not None:
                        column_samples[h].append(val)

        mapped_results: List[DataBridgeColumnMapping] = []
        assigned_field_keys: Set[str] = set()

        for idx, raw_header in enumerate(req.headers):
            header_clean = raw_header.strip()
            norm_header = cls.normalize_token(header_clean)
            samples = column_samples.get(raw_header, [])
            detected_content_type = cls.profile_sample_content(samples)

            candidates: List[DataBridgeCandidateMatch] = []

            for field_key, field_def in catalog.items():
                field_label = field_def["label"]
                aliases = field_def["aliases"]
                expected_content_type = field_def.get("content_type")

                # Tier 1: Exact alias match
                exact_match = False
                for al in aliases:
                    if norm_header == cls.normalize_token(al) or header_clean.lower() == al.lower():
                        exact_match = True
                        break

                if exact_match:
                    candidates.append(
                        DataBridgeCandidateMatch(
                            field_key=field_key,
                            field_label=field_label,
                            score=1.0,
                            reason="EXACT_ALIAS_MATCH",
                        )
                    )
                    continue

                # Tier 2: Token similarity
                best_sim = 0.0
                for al in aliases:
                    sim = cls.calculate_similarity(header_clean, al)
                    if sim > best_sim:
                        best_sim = sim

                # Tier 3: Content profiling boost
                if detected_content_type and expected_content_type and detected_content_type == expected_content_type:
                    # Content matched statutory profile (e.g. GSTIN, PAN, Phone)
                    best_sim = max(best_sim, 0.70) + 0.25
                    best_sim = min(best_sim, 0.98)
                    reason = f"CONTENT_PROFILED_{detected_content_type}"
                else:
                    reason = "TOKEN_SIMILARITY"

                if best_sim >= 0.40:
                    candidates.append(
                        DataBridgeCandidateMatch(
                            field_key=field_key,
                            field_label=field_label,
                            score=round(best_sim, 4),
                            reason=reason,
                        )
                    )

            # Sort candidate matches by score descending
            candidates.sort(key=lambda c: c.score, reverse=True)

            if not candidates or candidates[0].score < 0.40:
                mapped_results.append(
                    DataBridgeColumnMapping(
                        source_header=header_clean,
                        source_index=idx,
                        mapped_field_key=None,
                        mapped_field_label=None,
                        confidence="UNMAPPED",
                        confidence_score=0.0,
                        match_reason="NO_SIGNIFICANT_MATCH",
                        candidates=[],
                    )
                )
                continue

            top_match = candidates[0]
            top_field_def = catalog.get(top_match.field_key, {})
            is_req = top_field_def.get("required", False)
            is_stat = top_field_def.get("statutory", False)

            # Tier 4: Ambiguity check
            is_ambiguous = False
            if len(candidates) > 1 and candidates[0].score >= 0.70 and candidates[1].score >= 0.70:
                score_diff = abs(candidates[0].score - candidates[1].score)
                if score_diff <= 0.06:
                    is_ambiguous = True

            # Confidence categorization
            if is_ambiguous:
                conf_level = "AMBIGUOUS"
            elif top_match.score >= 0.95:
                conf_level = "EXACT" if top_match.reason == "EXACT_ALIAS_MATCH" else "HIGH"
            elif top_match.score >= 0.75:
                conf_level = "HIGH"
            elif top_match.score >= 0.60:
                conf_level = "MEDIUM"
            else:
                conf_level = "LOW"

            if conf_level in ("EXACT", "HIGH", "MEDIUM") and not is_ambiguous:
                assigned_field_keys.add(top_match.field_key)

            mapped_results.append(
                DataBridgeColumnMapping(
                    source_header=header_clean,
                    source_index=idx,
                    mapped_field_key=top_match.field_key,
                    mapped_field_label=top_match.field_label,
                    confidence=conf_level,
                    confidence_score=top_match.score,
                    is_required=is_req,
                    is_statutory=is_stat,
                    is_ambiguous=is_ambiguous,
                    match_reason=top_match.reason,
                    candidates=candidates[:5],
                )
            )

        # Tier 5: Completeness validation
        missing_fields: List[DataBridgeMissingField] = []
        for f_key, f_def in catalog.items():
            if f_def.get("required", False) and f_key not in assigned_field_keys:
                missing_fields.append(
                    DataBridgeMissingField(
                        field_key=f_key,
                        field_label=f_def["label"],
                        is_statutory=f_def.get("statutory", False),
                        reason=f"Mandatory field '{f_def['label']}' is not mapped to any column.",
                    )
                )

        exact_cnt = sum(1 for c in mapped_results if c.confidence == "EXACT")
        high_cnt = sum(1 for c in mapped_results if c.confidence == "HIGH")
        med_cnt = sum(1 for c in mapped_results if c.confidence == "MEDIUM")
        low_cnt = sum(1 for c in mapped_results if c.confidence == "LOW")
        ambig_cnt = sum(1 for c in mapped_results if c.confidence == "AMBIGUOUS")
        unmap_cnt = sum(1 for c in mapped_results if c.confidence == "UNMAPPED")

        is_valid = (len(missing_fields) == 0) and (ambig_cnt == 0)

        return DataBridgeSchemaDetectResponse(
            entity_type=req.entity_type.value,
            columns=mapped_results,
            exact_count=exact_cnt,
            high_count=high_cnt,
            medium_count=med_cnt,
            low_count=low_cnt,
            ambiguous_count=ambig_cnt,
            unmapped_count=unmap_cnt,
            missing_required_fields=missing_fields,
            is_valid_for_import=is_valid,
            analyzed_at=datetime.now(timezone.utc).isoformat(),
        )
