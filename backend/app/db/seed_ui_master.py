"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.42.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import json
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timezone


def seed_ui_master_data():
    """
    Authoritative seeder for Workspace Templates, Profiles, Themes, Design Tokens, and Screen Definitions.
    """
    templates = [
        ("wt_supermarket", "wt_supermarket", "RETAIL_SUPERMARKET", "Retail & Supermarket Workspace", "SUPERMARKET", '["BATCH_EXPIRY_FEFO", "BARCODE", "LABEL_PRINTING"]', '{"default_view": "POS_FAST_BILLING", "widgets": ["DAILY_SALES", "FAST_MOVING_ITEMS", "SHIFT_CASH_DRAWER"]}', True, "ACTIVE", "High-throughput barcode scanning and cash drawer till workspace.", True, False, 1),
        ("wt_apparel", "wt_apparel", "APPAREL_FASHION", "Apparel & Fashion Boutique", "APPAREL", '["STYLE_COLOR_SIZE_MATRIX", "BARCODE", "PROMOTIONS"]', '{"default_view": "MATRIX_BILLING", "widgets": ["SIZE_BREAKDOWN", "TOP_CATEGORIES", "VIP_CUSTOMERS"]}', True, "ACTIVE", "Multi-attribute size/color grid billing with integrated loyalty.", True, False, 1),
        ("wt_distrib", "wt_distrib", "DISTRIBUTION_HUB", "Distribution & Wholesale Hub", "DISTRIBUTION", '["DISTRIBUTION", "WMS", "RULE55_DELIVERY_CHALLAN"]', '{"default_view": "B2B_DISPATCH", "widgets": ["PENDING_DISPATCH", "TRUCK_MANIFEST", "ROUTE_OPTIMIZER"]}', True, "ACTIVE", "B2B wholesale order routing and delivery challan dispatch.", True, False, 1),
        ("wt_pharmacy", "wt_pharmacy", "PHARMACY_HEALTHCARE", "Pharmacy & Healthcare", "PHARMACY", '["BATCH_EXPIRY_FEFO", "SERIAL_IMEI_TRACKING"]', '{"default_view": "RX_DISPENSE", "widgets": ["EXPIRY_ALERTS", "PRESCRIPTION_LOG", "SCHEDULE_H_DRUGS"]}', True, "ACTIVE", "Drug batch expiry control and scheduled prescription billing.", True, False, 1),
        ("wt_restaurant", "wt_restaurant", "RESTAURANT_DINEIN", "Restaurant & Cafe POS", "RESTAURANT", '["TABLE_ORDERING", "POS"]', '{"default_view": "TABLE_GRID", "widgets": ["OCCUPIED_TABLES", "KOT_STATUS", "SPLIT_BILLS"]}', True, "ACTIVE", "Floor plan table ordering and kitchen ticket routing.", True, False, 1),
        ("wt_enterprise", "wt_enterprise", "ENTERPRISE_HQ", "Enterprise Headquarters & Finance", "ENTERPRISE", '["ACCOUNTING", "GST", "REPORTING", "APPROVAL", "AUDIT"]', '{"default_view": "EXECUTIVE_KPI", "widgets": ["CONSOLIDATED_PNL", "GST_LIABILITY", "PENDING_APPROVALS"]}', True, "ACTIVE", "Executive dashboard with automated financial and tax registers.", True, False, 1),
    ]

    profiles = [
        ("prof_sysadmin", "PROF_SYSADMIN", "System Administrator Profile", "SYSADMIN", "WS_ADMIN", '{"density": "COMPACT"}', "theme-smriti-default", '[{"key": "F1", "label": "POS Billing", "route": "/pos/terminal"}, {"key": "F2", "label": "Item Master", "route": "/inventory/items"}]', True, True, False),
        ("prof_manager", "PROF_STORE_MANAGER", "Store Manager Profile", "STORE_MANAGER", "WS_MANAGER", '{"density": "NORMAL"}', "theme-smriti-default", '[{"key": "F1", "label": "Shift Close", "route": "/pos/shift"}, {"key": "F2", "label": "Stock Audit", "route": "/inventory/audit"}]', False, True, False),
        ("prof_cashier", "PROF_CASHIER", "Cashier Billing Profile", "CASHIER", "WS_CASHIER", '{"density": "HIGH_DENSITY"}', "theme-smriti-default", '[{"key": "F1", "label": "New Bill", "route": "/pos/terminal"}, {"key": "F2", "label": "Return Bill", "route": "/pos/returns"}]', False, True, False),
        ("prof_accountant", "PROF_ACCOUNTANT", "Chief Accountant Profile", "ACCOUNTANT", "WS_FINANCE", '{"density": "NORMAL"}', "theme-smriti-default", '[{"key": "F1", "label": "Tax Register", "route": "/finance/tax"}, {"key": "F2", "label": "Day Book", "route": "/finance/daybook"}]', False, True, False),
    ]

    themes = [
        ("theme-smriti-default", "COMP-001", "SMRITI Enterprise Horizon", "Material Symbols Outlined", "default", "Space Grotesk", "Inter", 6, True),
        ("theme-fiori-dark", "COMP-001", "SAP Fiori Horizon Dark", "SAP-icons", "fiori", "72, sans-serif", "72, sans-serif", 8, True),
        ("theme-oled-contrast", "COMP-001", "High Contrast OLED Retro", "Material Symbols Outlined", "contrast", "JetBrains Mono", "JetBrains Mono", 4, True),
    ]

    variants = [
        ("var_def_dark", "theme-smriti-default", "dark", "#3B82F6", "#6366F1", "#F59E0B", "#0F172A", "#1E293B", "#F8FAFC", "#94A3B8", "#334155", "#EF4444", "#10B981", "#F59E0B", True),
        ("var_def_light", "theme-smriti-default", "light", "#2563EB", "#4F46E5", "#D97706", "#F8FAFC", "#FFFFFF", "#0F172A", "#64748B", "#E2E8F0", "#DC2626", "#059669", "#D97706", False),
        ("var_fiori_dark", "theme-fiori-dark", "fiori_dark", "#0A6ED1", "#3B82F6", "#E9730C", "#1C222B", "#29313D", "#FFFFFF", "#B2B8C2", "#3E4957", "#BB0000", "#107E3E", "#E9730C", True),
        ("var_oled_high", "theme-oled-contrast", "high_contrast", "#00FF66", "#00E5FF", "#FFE600", "#000000", "#0D0D0D", "#FFFFFF", "#A0A0A0", "#333333", "#FF0055", "#00FF66", "#FFE600", True),
    ]

    screens = [
        ("scr_pos_bill", "uuid_scr_pos_bill", "SCR_POS_BILLING", 1, "POS Fast Billing Terminal", "POS", "WS_POS", "TRANSACTIONAL", "CASHIER", "POS", "/pos/terminal", "point_of_sale", True, True, True, 25, '{"layout": "SPLIT_PANE", "hotkeys_enabled": true}', "ACTIVE", True, False),
        ("scr_inv_master", "uuid_scr_inv_master", "SCR_INV_MASTER", 1, "Master Product & Inventory Grid", "INVENTORY", "WS_INV", "CATALOG", "STORE_MANAGER", "INVENTORY", "/inventory/items", "inventory_2", True, True, True, 50, '{"layout": "DATA_GRID", "inline_edit": true}', "ACTIVE", True, False),
        ("scr_purch_po", "uuid_scr_purch_po", "SCR_PURCH_ORDER", 1, "Procurement Purchase Order Studio", "PURCHASE", "WS_PURCHASE", "TRANSACTIONAL", "STORE_MANAGER", "PURCHASE", "/purchase/orders", "shopping_cart", True, True, True, 25, '{"layout": "FORM_GRID"}', "ACTIVE", True, False),
        ("scr_sales_inv", "uuid_scr_sales_inv", "SCR_SALES_INVOICE", 1, "B2B Wholesale Tax Invoice Workspace", "SALES", "WS_SALES", "TRANSACTIONAL", "STORE_MANAGER", "SALES", "/sales/invoices", "receipt_long", True, True, True, 25, '{"layout": "DENSE_ENTRY"}', "ACTIVE", True, False),
    ]

    actions = [
        ("act_pos_save", "uuid_act_pos_save", "ACT_POS_SAVE", "Complete Bill & Tender", "pos.action.tender", "PRIMARY_BUTTON", "SCR_POS_BILLING", "FOOTER_BAR", "payments", "success", 1, "POS", False, None, "/api/v1/pos/checkout", "POST", "TENDER_SETTLEMENT", "ACTIVE", True, False),
        ("act_pos_hold", "uuid_act_pos_hold", "ACT_POS_HOLD", "Hold Cart Bill", "pos.action.hold", "SECONDARY_BUTTON", "SCR_POS_BILLING", "FOOTER_BAR", "pause", "neutral", 2, "POS", False, None, "/api/v1/pos/hold", "POST", "HOLD_BILL", "ACTIVE", True, False),
        ("act_pos_cancel", "uuid_act_pos_cancel", "ACT_POS_CANCEL", "Void / Cancel Shift Bill", "pos.action.cancel", "DANGER_BUTTON", "SCR_POS_BILLING", "FOOTER_BAR", "delete", "danger", 3, "POS", True, None, "/api/v1/pos/void", "POST", "VOID_BILL", "ACTIVE", True, False),
    ]

    print("\n--- Seeding Workspace & UI Experience Master Data into [smritisys] ---")
    try:
        conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
        cur = conn.cursor()

        # 1. Workspace Templates
        execute_values(
            cur,
            """
            INSERT INTO workspace_templates (
                id, uuid, code, name, vertical, included_capabilities, layout_config, is_system_template, status, description, is_active, is_deleted, version
            ) VALUES %s
            ON CONFLICT (code) DO UPDATE SET
                name = EXCLUDED.name,
                vertical = EXCLUDED.vertical,
                included_capabilities = EXCLUDED.included_capabilities::jsonb,
                layout_config = EXCLUDED.layout_config::jsonb,
                status = EXCLUDED.status,
                description = EXCLUDED.description,
                is_active = EXCLUDED.is_active;
            """,
            templates,
        )

        # 2. Workspace Profiles
        execute_values(
            cur,
            """
            INSERT INTO smriti_workspace_profiles (
                id, code, name, persona, default_workspace_id, layout_json, theme, shortcuts_json, is_default, is_active, is_deleted
            ) VALUES %s
            ON CONFLICT (code) DO UPDATE SET
                name = EXCLUDED.name,
                persona = EXCLUDED.persona,
                theme = EXCLUDED.theme,
                shortcuts_json = EXCLUDED.shortcuts_json,
                is_default = EXCLUDED.is_default,
                is_active = EXCLUDED.is_active;
            """,
            profiles,
        )

        # 3. Themes & Variants
        execute_values(
            cur,
            """
            INSERT INTO smriti_themes (
                id, company_id, theme_name, icon_pack, illustration_set, font_heading, font_body, border_radius_px, is_active
            ) VALUES %s
            ON CONFLICT (id) DO UPDATE SET
                theme_name = EXCLUDED.theme_name,
                icon_pack = EXCLUDED.icon_pack,
                font_heading = EXCLUDED.font_heading,
                font_body = EXCLUDED.font_body,
                border_radius_px = EXCLUDED.border_radius_px,
                is_active = EXCLUDED.is_active;
            """,
            themes,
        )

        execute_values(
            cur,
            """
            INSERT INTO smriti_theme_variants (
                id, theme_id, variant, primary_color, secondary_color, accent_color, background_color, surface_color, text_primary, text_secondary, border_color, danger_color, success_color, warning_color, is_default
            ) VALUES %s
            ON CONFLICT (id) DO UPDATE SET
                primary_color = EXCLUDED.primary_color,
                secondary_color = EXCLUDED.secondary_color,
                background_color = EXCLUDED.background_color,
                surface_color = EXCLUDED.surface_color,
                text_primary = EXCLUDED.text_primary,
                border_color = EXCLUDED.border_color,
                is_default = EXCLUDED.is_default;
            """,
            variants,
        )

        # 4. Screen Definitions
        execute_values(
            cur,
            """
            INSERT INTO screen_definitions (
                id, uuid, code, version, name, module_code, workspace_code, screen_type, persona_mode, capability_code, route_path, icon_key, searchable, exportable, printable, pagination_default, layout_config, status, is_active, is_deleted
            ) VALUES %s
            ON CONFLICT (code, version) DO UPDATE SET
                name = EXCLUDED.name,
                module_code = EXCLUDED.module_code,
                screen_type = EXCLUDED.screen_type,
                persona_mode = EXCLUDED.persona_mode,
                capability_code = EXCLUDED.capability_code,
                route_path = EXCLUDED.route_path,
                layout_config = EXCLUDED.layout_config::jsonb,
                status = EXCLUDED.status,
                is_active = EXCLUDED.is_active;
            """,
            screens,
        )

        # 5. Action Definitions
        execute_values(
            cur,
            """
            INSERT INTO action_definitions (
                id, uuid, code, name, label_key, action_type, screen_code, placement, icon_key, variant, order_index, required_capability, confirmation_required, target_route, api_endpoint, api_method, workflow_action, status, is_active, is_deleted
            ) VALUES %s
            ON CONFLICT (code) DO UPDATE SET
                name = EXCLUDED.name,
                screen_code = EXCLUDED.screen_code,
                action_type = EXCLUDED.action_type,
                api_endpoint = EXCLUDED.api_endpoint,
                api_method = EXCLUDED.api_method,
                status = EXCLUDED.status,
                is_active = EXCLUDED.is_active;
            """,
            actions,
        )

        conn.commit()
        conn.close()
        print("Successfully seeded Workspace & UI Experience Master Data into [smritisys].")
    except Exception as e:
        print(f"Error seeding [smritisys]: {e}")


if __name__ == "__main__":
    seed_ui_master_data()
