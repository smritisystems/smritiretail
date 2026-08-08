# Backlog Ticket IM-TICK-002: Product Master Visual Reference & Variant Thumbnail Gallery

**Ticket ID:** IM-TICK-002  
**Module:** Item Master & Inventory Studio  
**Priority:** High  
**Status:** Open (Scoped for Next Operational Sprint)  

## Problem Description
For footwear, apparel, fashion, and retail merchandise, a product master with no visual image reference makes style/color variant verification error-prone. Visual thumbnails in catalog list views and hover preview cards are essential for floor managers and POS operators.

## Technical Specifications
1. **Catalog List & Grid Visual Thumbnails**:
   - Render `primary_image_url` thumbnail (or fallback category icon) in Item Master list view, registry table, and product card views.
   - Support hover preview cards showing multi-angle images (`Front`, `Back`, `Packaging`, `Lifestyle`).

2. **Variant Swatch & Media Integration**:
   - Integrate tagged image gallery into variant matrix tables (e.g. Color/Style variant swatches).
   - Add image URL upload and file dropzone support directly in `ItemMasterFormInspector` Media tab.

## Accept Criteria
- Every product item in list view renders a high-res cropped thumbnail preview.
- Hovering over a SKU card displays a quick popover with variant photo reference.
- Unit tests written under `src/tests/itemMasterVisualGallery.test.ts`.
