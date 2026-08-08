# SMRITI Retail OS — Item Master: User Manual

**Version:** 3.26.0

## 1. Introduction

The Item Master module provides the central product catalog for SMRITI Retail OS. Use this module to create, update, and manage item records, SKU definitions, variants, pricing, and inventory attributes.

## 2. Key Workflows

1. Create new items with a unique SKU and descriptive details.
2. Assign item categories, brands, and inventory groups.
3. Configure pricing, tax settings, and customer price lists.
4. Define variants for size, color, and style.
5. Manage barcode assignment and receiving rules for purchase orders.

## 3. Opening the Item Master

Navigate to the Item Master module from the main workspace or launchpad. The module typically appears under **Inventory** or **Product Catalog** in the application menu.

Once open, the module displays a searchable item table with filters for:

- Item Code / SKU
- Item Name
- Category
- Brand
- Location / Warehouse

## 4. Creating a New Item

To add a new item:

1. Click **New Item** or **Add Item**.
2. Enter the required fields:

| Field | Description |
| --- | --- |
| Item Code / SKU | Unique identifier for the item. Use a consistent SKU scheme for variants and product families. |
| Item Name | Descriptive item name shown on invoices and reports. |
| Category | Business category used for reporting and inventory grouping. |
| Brand | Product brand or manufacturer. |
| Unit of Measure | Default unit for stock movement (e.g., pcs, box, carton). |
| Cost Price | Internal purchase cost for margin calculations. |
| Selling Price / MRP | Default retail selling price for the item. |
| GST / Tax Code | Applicable tax rate or exemption rule. |

3. Click **Save** to register the item in the catalog.

## 5. Managing Item Variants

If the item has multiple variants such as color, size, or style, use the variant section to configure child SKUs:

- Select the variant template or attribute set.
- Define each child SKU with its own barcode and inventory profile.
- Use the variant grid to update pricing or wholesale codes in bulk.

> Note: Variants inherit most master item settings automatically, but you can override price, barcode, and stock rules per variant when needed.

## 6. Price and Tax Settings

The Item Master lets you configure pricing rules at multiple levels:

- Base selling price / MRP
- Cost price
- Customer price groups
- Tax and GST classification

Use the pricing tab to set the default item price and to activate special pricing groups for wholesale or promotional sales.

## 7. Barcode and Label Management

Use the barcode section to assign one or more barcodes to the item or its variants.

- Scan or type an EAN/UPC/QR barcode.
- Verify the barcode is unique before saving.
- Print item labels from the print-label action if supported.

## 8. Inventory and Stock Settings

Configure inventory controls:

- Minimum stock level
- Reorder point
- Maximum stock level
- Warehouse location / bin

These values help purchasing and stock allocation workflows stay optimized.

## 9. Editing Existing Items

To update an existing item:

1. Search for the item using SKU or name.
2. Select the item from the results list.
3. Update the required fields.
4. Click **Save** to preserve changes.

Changing the item code or barcode may affect open purchase orders or sales transactions. Verify dependencies before editing core identifiers.

## 10. Common Tasks

### Find an Item Quickly

- Use the search box with SKU, item name, or barcode.
- Apply filters for category, brand, or stock location.

### Bulk Update Prices

- Use the bulk update action to change cost, selling price, or margin across selected items.
- Preview the change before applying it.

### Deactivate an Item

- Set item status to **Inactive** when it is no longer sold.
- Inactive items remain in history but are excluded from new sales workflows.

## 11. Troubleshooting

- **Item not found:** Confirm the SKU is correct and use partial search when unsure.
- **Barcode conflict:** If saving fails due to duplicate barcode, remove or change the barcode and re-save.
- **Price not updating:** Check whether the item is linked to a pricing group or promotion override.

## 12. Glossary

| Term | Description |
| --- | --- |
| SKU | Stock Keeping Unit, a unique item identifier. |
| Variant | A child item representing a specific combination of size, color, or style. |
| MRP | Maximum Retail Price, the default selling price for retail customers. |
| Price Group | A pricing policy that determines how the item is sold to different customer segments. |
