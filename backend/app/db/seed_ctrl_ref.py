"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.40.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import asyncio
import uuid
from decimal import Decimal
from datetime import datetime, timezone
import psycopg2
from psycopg2.extras import execute_values


def seed_control_reference_data():
    """
    Synchronous authoritative seeder for smritisys and tenant databases.
    """
    for db_name in ["smritisys", "smriti001", "smriti002"]:
        print(f"\n--- Seeding Reference Master Data into [{db_name}] ---")
        try:
            conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db_name}")
            cur = conn.cursor()

            # 1. Countries
            countries = [
                ("ctry_in", "IN", "IND", "356", "India", "+91", "INR", True),
                ("ctry_us", "US", "USA", "840", "United States", "+1", "USD", True),
                ("ctry_ae", "AE", "ARE", "784", "United Arab Emirates", "+971", "AED", True),
                ("ctry_gb", "GB", "GBR", "826", "United Kingdom", "+44", "GBP", True),
                ("ctry_sg", "SG", "SGP", "702", "Singapore", "+65", "SGD", True),
                ("ctry_de", "DE", "DEU", "276", "Germany", "+49", "EUR", True),
                ("ctry_au", "AU", "AUS", "036", "Australia", "+61", "AUD", True),
                ("ctry_ca", "CA", "CAN", "124", "Canada", "+1", "CAD", True),
            ]
            execute_values(
                cur,
                """
                INSERT INTO countries_ref (id, code, iso3, numeric_code, name, phone_code, default_currency, is_active)
                VALUES %s
                ON CONFLICT (code) DO UPDATE SET
                    name = EXCLUDED.name,
                    phone_code = EXCLUDED.phone_code,
                    default_currency = EXCLUDED.default_currency,
                    is_active = EXCLUDED.is_active;
                """,
                countries,
            )

            # 2. All 36 Indian States & UTs with official GST 2-digit state codes (01..38, 97)
            indian_states = [
                ("st_in_01", "ctry_in", "IN", "JK", "Jammu & Kashmir", "01", "UNION_TERRITORY", True),
                ("st_in_02", "ctry_in", "IN", "HP", "Himachal Pradesh", "02", "STATE", True),
                ("st_in_03", "ctry_in", "IN", "PB", "Punjab", "03", "STATE", True),
                ("st_in_04", "ctry_in", "IN", "CH", "Chandigarh", "04", "UNION_TERRITORY", True),
                ("st_in_05", "ctry_in", "IN", "UK", "Uttarakhand", "05", "STATE", True),
                ("st_in_06", "ctry_in", "IN", "HR", "Haryana", "06", "STATE", True),
                ("st_in_07", "ctry_in", "IN", "DL", "Delhi", "07", "UNION_TERRITORY", True),
                ("st_in_08", "ctry_in", "IN", "RJ", "Rajasthan", "08", "STATE", True),
                ("st_in_09", "ctry_in", "IN", "UP", "Uttar Pradesh", "09", "STATE", True),
                ("st_in_10", "ctry_in", "IN", "BR", "Bihar", "10", "STATE", True),
                ("st_in_11", "ctry_in", "IN", "SK", "Sikkim", "11", "STATE", True),
                ("st_in_12", "ctry_in", "IN", "AR", "Arunachal Pradesh", "12", "STATE", True),
                ("st_in_13", "ctry_in", "IN", "NL", "Nagaland", "13", "STATE", True),
                ("st_in_14", "ctry_in", "IN", "MN", "Manipur", "14", "STATE", True),
                ("st_in_15", "ctry_in", "IN", "MZ", "Mizoram", "15", "STATE", True),
                ("st_in_16", "ctry_in", "IN", "TR", "Tripura", "16", "STATE", True),
                ("st_in_17", "ctry_in", "IN", "ML", "Meghalaya", "17", "STATE", True),
                ("st_in_18", "ctry_in", "IN", "AS", "Assam", "18", "STATE", True),
                ("st_in_19", "ctry_in", "IN", "WB", "West Bengal", "19", "STATE", True),
                ("st_in_20", "ctry_in", "IN", "JH", "Jharkhand", "20", "STATE", True),
                ("st_in_21", "ctry_in", "IN", "OR", "Odisha", "21", "STATE", True),
                ("st_in_22", "ctry_in", "IN", "CG", "Chhattisgarh", "22", "STATE", True),
                ("st_in_23", "ctry_in", "IN", "MP", "Madhya Pradesh", "23", "STATE", True),
                ("st_in_24", "ctry_in", "IN", "GJ", "Gujarat", "24", "STATE", True),
                ("st_in_26", "ctry_in", "IN", "DN", "Dadra & Nagar Haveli and Daman & Diu", "26", "UNION_TERRITORY", True),
                ("st_in_27", "ctry_in", "IN", "MH", "Maharashtra", "27", "STATE", True),
                ("st_in_29", "ctry_in", "IN", "KA", "Karnataka", "29", "STATE", True),
                ("st_in_30", "ctry_in", "IN", "GA", "Goa", "30", "STATE", True),
                ("st_in_31", "ctry_in", "IN", "LD", "Lakshadweep", "31", "UNION_TERRITORY", True),
                ("st_in_32", "ctry_in", "IN", "KL", "Kerala", "32", "STATE", True),
                ("st_in_33", "ctry_in", "IN", "TN", "Tamil Nadu", "33", "STATE", True),
                ("st_in_34", "ctry_in", "IN", "PY", "Puducherry", "34", "UNION_TERRITORY", True),
                ("st_in_35", "ctry_in", "IN", "AN", "Andaman & Nicobar Islands", "35", "UNION_TERRITORY", True),
                ("st_in_36", "ctry_in", "IN", "TS", "Telangana", "36", "STATE", True),
                ("st_in_37", "ctry_in", "IN", "AP", "Andhra Pradesh", "37", "STATE", True),
                ("st_in_38", "ctry_in", "IN", "LA", "Ladakh", "38", "UNION_TERRITORY", True),
                ("st_in_97", "ctry_in", "IN", "OT", "Other Territory", "97", "SPECIAL_ZONE", True),
            ]
            execute_values(
                cur,
                """
                INSERT INTO states_ref (id, country_id, country_code, state_code, name, gst_state_code, state_type, is_active)
                VALUES %s
                ON CONFLICT (country_code, state_code) DO UPDATE SET
                    name = EXCLUDED.name,
                    gst_state_code = EXCLUDED.gst_state_code,
                    state_type = EXCLUDED.state_type,
                    is_active = EXCLUDED.is_active;
                """,
                indian_states,
            )

            # 3. Currencies
            currencies = [
                ("curr_inr", "INR", "Indian Rupee", "₹", "Paisa", 2, "BEFORE", True),
                ("curr_usd", "USD", "US Dollar", "$", "Cent", 2, "BEFORE", True),
                ("curr_eur", "EUR", "Euro", "€", "Cent", 2, "BEFORE", True),
                ("curr_gbp", "GBP", "British Pound", "£", "Penny", 2, "BEFORE", True),
                ("curr_aed", "AED", "UAE Dirham", "د.إ", "Fils", 2, "AFTER", True),
                ("curr_sgd", "SGD", "Singapore Dollar", "S$", "Cent", 2, "BEFORE", True),
                ("curr_cad", "CAD", "Canadian Dollar", "C$", "Cent", 2, "BEFORE", True),
            ]
            execute_values(
                cur,
                """
                INSERT INTO currencies_ref (id, code, name, symbol, subunit, decimal_places, symbol_position, is_active)
                VALUES %s
                ON CONFLICT (code) DO UPDATE SET
                    name = EXCLUDED.name,
                    symbol = EXCLUDED.symbol,
                    subunit = EXCLUDED.subunit,
                    decimal_places = EXCLUDED.decimal_places,
                    symbol_position = EXCLUDED.symbol_position,
                    is_active = EXCLUDED.is_active;
                """,
                currencies,
            )

            # 4. Units of Measurement (UOM)
            uoms = [
                ("uom_pcs", "PCS", "Pieces", "COUNT", "PCS", False, True),
                ("uom_nos", "NOS", "Numbers", "COUNT", "NOS", False, True),
                ("uom_kg", "KG", "Kilograms", "WEIGHT", "KGS", True, True),
                ("uom_gm", "GM", "Grams", "WEIGHT", "GMS", True, True),
                ("uom_ltr", "LTR", "Litres", "VOLUME", "LTR", True, True),
                ("uom_ml", "ML", "Millilitres", "VOLUME", "MLT", True, True),
                ("uom_mtr", "MTR", "Metres", "LENGTH", "MTR", True, True),
                ("uom_box", "BOX", "Box", "COUNT", "BOX", False, True),
                ("uom_pac", "PAC", "Packets", "COUNT", "PAC", False, True),
                ("uom_doz", "DOZ", "Dozens", "COUNT", "DOZ", False, True),
            ]
            execute_values(
                cur,
                """
                INSERT INTO uoms_ref (id, code, name, category, uqc_code, decimal_allowed, is_active)
                VALUES %s
                ON CONFLICT (code) DO UPDATE SET
                    name = EXCLUDED.name,
                    category = EXCLUDED.category,
                    uqc_code = EXCLUDED.uqc_code,
                    decimal_allowed = EXCLUDED.decimal_allowed,
                    is_active = EXCLUDED.is_active;
                """,
                uoms,
            )

            # 5. UOM Conversions
            conversions = [
                ("uconv_kg_gm", "KG", "GM", Decimal("1000.000000"), True),
                ("uconv_ltr_ml", "LTR", "ML", Decimal("1000.000000"), True),
                ("uconv_doz_pcs", "DOZ", "PCS", Decimal("12.000000"), True),
                ("uconv_doz_nos", "DOZ", "NOS", Decimal("12.000000"), True),
            ]
            execute_values(
                cur,
                """
                INSERT INTO uom_conversions_ref (id, from_uom, to_uom, conversion_factor, is_system)
                VALUES %s
                ON CONFLICT (from_uom, to_uom) DO UPDATE SET
                    conversion_factor = EXCLUDED.conversion_factor,
                    is_system = EXCLUDED.is_system;
                """,
                conversions,
            )

            # 6. Tax Reference Slabs
            taxes = [
                ("tax_0", "GST", "GST_0", "GST 0% (Zero Rated)", Decimal("0.00"), Decimal("0.00"), Decimal("0.00"), Decimal("0.00"), "Statutory GST Zero Rate", True),
                ("tax_5", "GST", "GST_5", "GST 5%", Decimal("5.00"), Decimal("2.50"), Decimal("2.50"), Decimal("5.00"), "Statutory GST 5% Slab", True),
                ("tax_12", "GST", "GST_12", "GST 12%", Decimal("12.00"), Decimal("6.00"), Decimal("6.00"), Decimal("12.00"), "Statutory GST 12% Slab", True),
                ("tax_18", "GST", "GST_18", "GST 18%", Decimal("18.00"), Decimal("9.00"), Decimal("9.00"), Decimal("18.00"), "Standard Statutory GST 18% Slab", True),
                ("tax_28", "GST", "GST_28", "GST 28%", Decimal("28.00"), Decimal("14.00"), Decimal("14.00"), Decimal("28.00"), "Luxury / Demerit Statutory GST 28% Slab", True),
                ("tax_exempt", "GST", "GST_EXEMPT", "GST Exempt", Decimal("0.00"), Decimal("0.00"), Decimal("0.00"), Decimal("0.00"), "Statutory Exempted Goods & Services", True),
            ]
            execute_values(
                cur,
                """
                INSERT INTO tax_references_ref (id, tax_type, code, name, rate, cgst_rate, sgst_rate, igst_rate, description, is_active)
                VALUES %s
                ON CONFLICT (code) DO UPDATE SET
                    name = EXCLUDED.name,
                    rate = EXCLUDED.rate,
                    cgst_rate = EXCLUDED.cgst_rate,
                    sgst_rate = EXCLUDED.sgst_rate,
                    igst_rate = EXCLUDED.igst_rate,
                    description = EXCLUDED.description,
                    is_active = EXCLUDED.is_active;
                """,
                taxes,
            )

            # 7. Retail HSN & SAC Codes
            hsn_codes = [
                ("hsn_6109", "6109", "HSN", "T-shirts, singlets and other vests, knitted or crocheted", Decimal("5.00"), Decimal("0.00"), True),
                ("hsn_6203", "6203", "HSN", "Men's or boys' suits, ensembles, jackets, trousers", Decimal("12.00"), Decimal("0.00"), True),
                ("hsn_6403", "6403", "HSN", "Footwear with outer soles of rubber, plastics, leather", Decimal("18.00"), Decimal("0.00"), True),
                ("hsn_8471", "8471", "HSN", "Automatic data processing machines, POS terminals, computers", Decimal("18.00"), Decimal("0.00"), True),
                ("hsn_1001", "1001", "HSN", "Wheat and meslin (foodgrains)", Decimal("0.00"), Decimal("0.00"), True),
                ("sac_9983", "9983", "SAC", "Other professional, technical and business services", Decimal("18.00"), Decimal("0.00"), True),
            ]
            execute_values(
                cur,
                """
                INSERT INTO hsn_sac_codes_ref (id, code, code_type, description, gst_rate, compensation_cess_rate, is_active)
                VALUES %s
                ON CONFLICT (code) DO UPDATE SET
                    code_type = EXCLUDED.code_type,
                    description = EXCLUDED.description,
                    gst_rate = EXCLUDED.gst_rate,
                    compensation_cess_rate = EXCLUDED.compensation_cess_rate,
                    is_active = EXCLUDED.is_active;
                """,
                hsn_codes,
            )

            # 8. Languages & Locales
            languages = [
                ("lang_en", "en", "English", "English", "Latin", False, True),
                ("lang_hi", "hi", "Hindi", "हिन्दी", "Devanagari", False, True),
                ("lang_mr", "mr", "Marathi", "मराठी", "Devanagari", False, True),
                ("lang_gu", "gu", "Gujarati", "ગુજરાતી", "Gujarati", False, True),
                ("lang_ta", "ta", "Tamil", "தமிழ்", "Tamil", False, True),
                ("lang_ar", "ar", "Arabic", "العربية", "Arabic", True, True),
            ]
            execute_values(
                cur,
                """
                INSERT INTO languages_ref (id, code, name, native_name, script, is_rtl, is_active)
                VALUES %s
                ON CONFLICT (code) DO UPDATE SET
                    name = EXCLUDED.name,
                    native_name = EXCLUDED.native_name,
                    script = EXCLUDED.script,
                    is_rtl = EXCLUDED.is_rtl,
                    is_active = EXCLUDED.is_active;
                """,
                languages,
            )

            locales = [
                ("loc_en_in", "en-IN", "en", "IN", "DD/MM/YYYY", "12H", "INDIAN_LAKH_CRORE", "Asia/Kolkata", True, True),
                ("loc_hi_in", "hi-IN", "hi", "IN", "DD/MM/YYYY", "12H", "INDIAN_LAKH_CRORE", "Asia/Kolkata", False, True),
                ("loc_mr_in", "mr-IN", "mr", "IN", "DD/MM/YYYY", "12H", "INDIAN_LAKH_CRORE", "Asia/Kolkata", False, True),
                ("loc_en_us", "en-US", "en", "US", "MM/DD/YYYY", "12H", "INTERNATIONAL_MILLION", "America/New_York", False, True),
                ("loc_ar_ae", "ar-AE", "ar", "AE", "DD/MM/YYYY", "12H", "INTERNATIONAL_MILLION", "Asia/Dubai", False, True),
            ]
            execute_values(
                cur,
                """
                INSERT INTO locales_ref (id, code, language_code, country_code, date_format, time_format, number_system, timezone, is_default, is_active)
                VALUES %s
                ON CONFLICT (code) DO UPDATE SET
                    language_code = EXCLUDED.language_code,
                    country_code = EXCLUDED.country_code,
                    date_format = EXCLUDED.date_format,
                    number_system = EXCLUDED.number_system,
                    timezone = EXCLUDED.timezone,
                    is_default = EXCLUDED.is_default,
                    is_active = EXCLUDED.is_active;
                """,
                locales,
            )

            # 9. Translation Keys & Multi-Lingual Values (English baseline, Hindi, Marathi)
            keys = [
                ("tk_save", "common.save", "COMMON", "Save button label", "Save"),
                ("tk_cancel", "common.cancel", "COMMON", "Cancel action label", "Cancel"),
                ("tk_delete", "common.delete", "COMMON", "Delete action label", "Delete"),
                ("tk_search", "common.search", "COMMON", "Search input placeholder", "Search"),
                ("tk_pos_open", "pos.shift.open", "POS", "Open Register Shift", "Open POS Shift"),
                ("tk_pos_close", "pos.shift.close", "POS", "Close Register Shift", "Close POS Shift"),
                ("tk_tax_inv", "billing.tax_invoice", "BILLING", "Tax Invoice Header", "Tax Invoice"),
                ("tk_stock_val", "inventory.stock_valuation", "INVENTORY", "Stock Valuation Header", "Stock Valuation"),
            ]
            for tk_id, k, cat, desc, d_text in keys:
                cur.execute(
                    """
                    INSERT INTO translation_keys_ref (id, key, category, description, default_text)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (key) DO UPDATE SET
                        category = EXCLUDED.category,
                        description = EXCLUDED.description,
                        default_text = EXCLUDED.default_text;
                    """,
                    (tk_id, k, cat, desc, d_text),
                )

            # Map key -> id for translations
            cur.execute("SELECT key, id FROM translation_keys_ref;")
            key_id_map = dict(cur.fetchall())

            translations = [
                # Hindi
                (key_id_map.get("common.save"), "hi", "सहेजें", 1, True),
                (key_id_map.get("common.cancel"), "hi", "रद्द करें", 1, True),
                (key_id_map.get("common.delete"), "hi", "हटाएं", 1, True),
                (key_id_map.get("common.search"), "hi", "खोजें", 1, True),
                (key_id_map.get("pos.shift.open"), "hi", "पीओएस शिफ्ट खोलें", 1, True),
                (key_id_map.get("pos.shift.close"), "hi", "पीओएस शिफ्ट बंद करें", 1, True),
                (key_id_map.get("billing.tax_invoice"), "hi", "टैक्स इनवॉयस", 1, True),
                (key_id_map.get("inventory.stock_valuation"), "hi", "स्टॉक मूल्यांकन", 1, True),
                # Marathi
                (key_id_map.get("common.save"), "mr", "जतन करा", 1, True),
                (key_id_map.get("common.cancel"), "mr", "रद्द करा", 1, True),
                (key_id_map.get("common.delete"), "mr", "हटवा", 1, True),
                (key_id_map.get("common.search"), "mr", "शोधा", 1, True),
                (key_id_map.get("pos.shift.open"), "mr", "पीओएस शिफ्ट उघडा", 1, True),
                (key_id_map.get("pos.shift.close"), "mr", "पीओएस शिफ्ट बंद करा", 1, True),
                (key_id_map.get("billing.tax_invoice"), "mr", "कर बीजक", 1, True),
                (key_id_map.get("inventory.stock_valuation"), "mr", "साठा मूल्यांकन", 1, True),
            ]
            valid_translations = [
                (f"tr_{lang}_{kid[:8]}", kid, lang, text, v, apprv)
                for kid, lang, text, v, apprv in translations
                if kid is not None
            ]
            execute_values(
                cur,
                """
                INSERT INTO translations_ref (id, key_id, language_code, translation_text, version, is_approved)
                VALUES %s
                ON CONFLICT (key_id, language_code) DO UPDATE SET
                    translation_text = EXCLUDED.translation_text,
                    is_approved = EXCLUDED.is_approved;
                """,
                valid_translations,
            )

            # 10. Platform Reference Constants
            prefs = [
                ("pref_pm_cash", "PAYMENT_METHODS", "CASH", "Cash Payment", '{"channel": "OFFLINE", "requires_ref": false}', 1, True, True),
                ("pref_pm_upi", "PAYMENT_METHODS", "UPI", "Unified Payments Interface (UPI)", '{"channel": "DIGITAL", "requires_ref": true}', 2, True, True),
                ("pref_pm_card", "PAYMENT_METHODS", "CARD", "Debit / Credit Card (POS EDC)", '{"channel": "DIGITAL", "requires_ref": true}', 3, True, True),
                ("pref_pm_cn", "PAYMENT_METHODS", "CREDIT_NOTE", "Credit Note Settlement", '{"channel": "INTERNAL", "requires_ref": true}', 4, True, True),
                ("pref_stat_issued", "INVOICE_STATUS", "ISSUED", "Tax Invoice Issued", '{"is_final": true, "allows_edit": false}', 1, True, True),
                ("pref_stat_cancelled", "INVOICE_STATUS", "CANCELLED", "Tax Invoice Voided / Cancelled", '{"is_final": true, "allows_edit": false}', 2, True, True),
                ("pref_ord_retail", "ORDER_TYPES", "RETAIL_POS", "Retail Point-of-Sale Transaction", '{"ledger": "RETAIL"}', 1, True, True),
                ("pref_ord_dist", "ORDER_TYPES", "B2B_DISTRIBUTION", "B2B Wholesale / Distributor Order", '{"ledger": "WHOLESALE"}', 2, True, True),
            ]
            execute_values(
                cur,
                """
                INSERT INTO platform_reference_data (id, category, code, label, data, sort_order, is_system, is_active)
                VALUES %s
                ON CONFLICT (category, code) DO UPDATE SET
                    label = EXCLUDED.label,
                    data = EXCLUDED.data::jsonb,
                    sort_order = EXCLUDED.sort_order,
                    is_active = EXCLUDED.is_active;
                """,
                prefs,
            )

            conn.commit()
            conn.close()
            print(f"Successfully seeded reference data into [{db_name}].")
        except Exception as e:
            print(f"Error seeding [{db_name}]: {e}")


if __name__ == "__main__":
    seed_control_reference_data()
