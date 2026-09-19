-- APPLICATION LAYER MIGRATION PREPARATION

**Status:** Pre-implementation planning
**Date:** 2026-09-01
**Scope:** Application code changes required after database migration. These changes do NOT affect the live database until deployment is coordinated with database switchover.

---

## 1. ORM Model Updates

### Current State: `backend/models.py` or SQLAlchemy models

The app currently uses a single `Product` model that maps to the `products` table. After migration, this must be split into canonical models.

### Required Changes

#### Before (Current)
```python
class Product(Base):
    __tablename__ = 'products'
    
    id = Column(BigInteger, primary_key=True)
    uuid = Column(UUID, unique=True)
    code = Column(String(100), unique=True)
    name = Column(String(500))
    sku = Column(String(100))
    style_code = Column(String(100))
    price = Column(Numeric(12, 2))
    mrp = Column(Numeric(12, 2))
    cost_price = Column(Numeric(12, 2))
    barcode = Column(String(500))
    secondary_barcodes = Column(Text)
    color = Column(String(100))
    size = Column(String(100))
    stock = Column(Numeric(12, 2))
    reserved_stock = Column(Numeric(12, 2))
    category_id = Column(BigInteger, ForeignKey('categories.id'))
    brand_id = Column(BigInteger, ForeignKey('brands.id'))
    # ... 40+ more columns
```

#### After (Target)
```python
class Item(Base):
    __tablename__ = 'items'
    
    id = Column(BigInteger, primary_key=True)
    uuid = Column(UUID, unique=True)
    company_id = Column(BigInteger)
    branch_id = Column(BigInteger)
    code = Column(String(100), unique=True)
    name = Column(String(500))
    category_id = Column(BigInteger, ForeignKey('item_categories.id'))
    brand_id = Column(BigInteger, ForeignKey('item_brands.id'))
    status = Column(String(50))
    is_active = Column(Boolean)
    is_deleted = Column(Boolean)
    
    # Relationships
    variants = relationship('ItemVariant', back_populates='item')
    barcodes = relationship('ItemBarcode', back_populates='item')
    prices = relationship('ItemPrice', back_populates='item')
    stocks = relationship('ItemStock', back_populates='item')
    attributes = relationship('ItemAttribute', back_populates='item')
    media = relationship('ItemMedia', back_populates='item')

class ItemVariant(Base):
    __tablename__ = 'item_variants'
    
    id = Column(BigInteger, primary_key=True)
    item_id = Column(BigInteger, ForeignKey('items.id'))
    variant_sku = Column(String(100), unique=True)
    variant_name = Column(String(500))
    variant_code = Column(String(100))
    attributes_json = Column(JSON)
    mrp = Column(Numeric(12, 2))
    selling_price = Column(Numeric(12, 2))
    cost_price = Column(Numeric(12, 2))
    
    # Relationships
    item = relationship('Item', back_populates='variants')
    barcodes = relationship('ItemBarcode', back_populates='variant')

class ItemBarcode(Base):
    __tablename__ = 'item_barcodes'
    
    id = Column(BigInteger, primary_key=True)
    item_id = Column(BigInteger, ForeignKey('items.id'))
    variant_id = Column(BigInteger, ForeignKey('item_variants.id'))
    barcode = Column(String(500), unique=True)
    barcode_type = Column(String(50))
    is_primary = Column(Boolean)
    
    # Relationships
    item = relationship('Item', back_populates='barcodes')
    variant = relationship('ItemVariant', back_populates='barcodes')

class ItemPrice(Base):
    __tablename__ = 'item_prices'
    
    id = Column(BigInteger, primary_key=True)
    item_id = Column(BigInteger, ForeignKey('items.id'))
    variant_id = Column(BigInteger, ForeignKey('item_variants.id'))
    price_book_id = Column(BigInteger, ForeignKey('price_books.id'))
    mrp = Column(Numeric(12, 2))
    selling_price = Column(Numeric(12, 2))
    cost_price = Column(Numeric(12, 2))
    
    # Relationships
    item = relationship('Item', back_populates='prices')

class ItemStock(Base):
    __tablename__ = 'item_stock'
    
    id = Column(BigInteger, primary_key=True)
    item_id = Column(BigInteger, ForeignKey('items.id'))
    variant_id = Column(BigInteger, ForeignKey('item_variants.id'))
    warehouse_id = Column(BigInteger)
    quantity_on_hand = Column(Numeric(12, 2))
    quantity_reserved = Column(Numeric(12, 2))
    batch_no = Column(String(100))
    
    # Relationships
    item = relationship('Item', back_populates='stocks')

class ItemAttribute(Base):
    __tablename__ = 'item_attributes'
    
    id = Column(BigInteger, primary_key=True)
    item_id = Column(BigInteger, ForeignKey('items.id'))
    variant_id = Column(BigInteger, ForeignKey('item_variants.id'))
    attribute_key = Column(String(100))
    attribute_value = Column(Text)
    
    # Relationships
    item = relationship('Item', back_populates='attributes')

class ItemMedia(Base):
    __tablename__ = 'item_media'
    
    id = Column(BigInteger, primary_key=True)
    item_id = Column(BigInteger, ForeignKey('items.id'))
    variant_id = Column(BigInteger, ForeignKey('item_variants.id'))
    media_url = Column(String(1000))
    media_type = Column(String(50))
    is_primary = Column(Boolean)
    
    # Relationships
    item = relationship('Item', back_populates='media')
```

---

## 2. API Endpoint Updates

### Current Endpoints (Legacy)

```python
@app.get("/api/products")
async def list_products():
    # Query: products table
    return products

@app.get("/api/products/{product_id}")
async def get_product(product_id: int):
    # Query: products table
    return product

@app.get("/api/products/search?code={code}")
async def search_products_by_code(code: str):
    # Query: products.code
    return products
```

### New Endpoints (Target)

```python
@app.get("/api/items")
async def list_items():
    # Query: items table
    return items

@app.get("/api/items/{item_id}")
async def get_item(item_id: int):
    # Query: items + variants + prices + stock
    item = db.query(Item).filter(Item.id == item_id).first()
    return {
        **item,
        variants: [v for v in item.variants],
        pricing: [p for p in item.prices],
        stock: [s for s in item.stocks]
    }

@app.get("/api/items/search?code={code}")
async def search_items_by_code(code: str):
    # Query: items.code
    return db.query(Item).filter(Item.code.like(f'%{code}%')).all()

@app.get("/api/variants/{variant_id}")
async def get_variant(variant_id: int):
    # Query: item_variants
    variant = db.query(ItemVariant).filter(ItemVariant.id == variant_id).first()
    return {
        **variant,
        item: variant.item,
        barcodes: [b for b in variant.barcodes],
        pricing: [p for p in variant.prices if p.variant_id == variant_id]
    }

@app.get("/api/items/barcode/{barcode}")
async def lookup_by_barcode(barcode: str):
    # Query: item_barcodes for scan lookup
    barcode_record = db.query(ItemBarcode).filter(
        ItemBarcode.barcode == barcode
    ).first()
    return {
        item_id: barcode_record.item_id,
        variant_id: barcode_record.variant_id,
        item: barcode_record.item,
        variant: barcode_record.variant
    }

@app.post("/api/items")
async def create_item(item_data: ItemCreateRequest):
    # Insert: items table
    # Then create variants, barcodes, pricing in separate calls
    item = Item(**item_data)
    db.add(item)
    db.commit()
    return item

@app.post("/api/items/{item_id}/variants")
async def add_variant(item_id: int, variant_data: VariantCreateRequest):
    # Insert: item_variants table
    variant = ItemVariant(item_id=item_id, **variant_data)
    db.add(variant)
    db.commit()
    return variant

@app.post("/api/items/{item_id}/prices")
async def set_pricing(item_id: int, price_data: PriceCreateRequest):
    # Insert: item_prices table
    price = ItemPrice(item_id=item_id, **price_data)
    db.add(price)
    db.commit()
    return price
```

---

## 3. Search & Lookup Service Updates

### Current `UnifiedItemCatalog` or similar

```python
# From src/services/unifiedFieldCatalog.ts
class UnifiedItemCatalog:
    
    async def lookup_item_by_code(self, code: str):
        # Current: Query products.code
        return db.query(Product).filter(Product.code == code).first()
    
    async def lookup_item_by_sku(self, sku: str):
        # Current: Query products.sku
        return db.query(Product).filter(Product.sku == sku).first()
    
    async def lookup_by_barcode(self, barcode: str):
        # Current: Query products.barcode or item_barcodes (fragmented)
        return db.query(Product).filter(Product.barcode == barcode).first()
```

### Target (Canonical)

```python
class CanonicalItemCatalog:
    
    async def lookup_item_by_code(self, code: str, company_id: int):
        # Query: items.code (canonical)
        return db.query(Item).filter(
            Item.code == code,
            Item.company_id == company_id
        ).first()
    
    async def lookup_variant_by_sku(self, sku: str, company_id: int):
        # Query: item_variants.variant_sku (canonical)
        return db.query(ItemVariant).filter(
            ItemVariant.variant_sku == sku,
            ItemVariant.company_id == company_id
        ).first()
    
    async def lookup_by_barcode(self, barcode: str, company_id: int):
        # Query: item_barcodes.barcode (canonical lookup authority)
        barcode_record = db.query(ItemBarcode).filter(
            ItemBarcode.barcode == barcode,
            ItemBarcode.company_id == company_id
        ).first()
        if barcode_record:
            return {
                'item': barcode_record.item,
                'variant': barcode_record.variant,
                'barcode_id': barcode_record.id
            }
        return None
    
    async def get_item_with_pricing(self, item_id: int, price_book_id: int = None):
        # Query: items + item_prices
        item = db.query(Item).filter(Item.id == item_id).first()
        if item:
            prices = db.query(ItemPrice).filter(
                ItemPrice.item_id == item_id
            )
            if price_book_id:
                prices = prices.filter(ItemPrice.price_book_id == price_book_id)
            return {
                'item': item,
                'variants': item.variants,
                'pricing': prices.all()
            }
        return None
    
    async def get_item_stock_position(self, item_id: int, variant_id: int = None, warehouse_id: int = None):
        # Query: item_stock (consolidated inventory view)
        query = db.query(ItemStock).filter(ItemStock.item_id == item_id)
        if variant_id:
            query = query.filter(ItemStock.variant_id == variant_id)
        if warehouse_id:
            query = query.filter(ItemStock.warehouse_id == warehouse_id)
        return query.all()
```

---

## 4. Frontend Updates (React Components)

### Sales Order Grid Component

**File:** `src/components/sales/SalesOrderFormPremium.tsx`

**Current:** Uses `products` table directly
**Target:** Use canonical items/variants/pricing APIs

```typescript
// Before
const fetchProductOptions = async () => {
  const { data } = await api.get('/products', {
    params: { company_id: currentCompany.id }
  });
  setProductOptions(data.map(p => ({
    id: p.id,
    label: p.code + ' - ' + p.name,
    code: p.code,
    price: p.price,
    sku: p.sku,
    mrp: p.mrp
  })));
};

// After
const fetchItemOptions = async () => {
  const { data } = await api.get('/api/items', {
    params: { company_id: currentCompany.id }
  });
  setItemOptions(data.map(item => ({
    id: item.id,
    label: item.code + ' - ' + item.name,
    code: item.code,
    variants: item.variants.map(v => ({
      id: v.id,
      sku: v.variant_sku,
      name: v.variant_name,
      price: v.selling_price,
      mrp: v.mrp
    }))
  })));
};

// Barcode lookup
const handleBarcodeScanned = async (barcode: string) => {
  // Before: query products.barcode
  // After: query item_barcodes canonical lookup
  const { data } = await api.get(`/api/items/barcode/${barcode}`, {
    params: { company_id: currentCompany.id }
  });
  if (data) {
    const item = data.item;
    const variant = data.variant;
    // Populate line item with canonical item/variant data
    addLineItem({
      item_id: item.id,
      variant_id: variant?.id,
      quantity: 1,
      unit_price: variant?.selling_price || item.prices[0]?.selling_price,
      mrp: variant?.mrp || item.prices[0]?.mrp
    });
  }
};
```

### Item Master Component

**File:** `src/components/itemMaster/ItemMasterGrid.tsx`

**Current:** Direct products table binding
**Target:** Canonical items table with variants/pricing tabs

```typescript
// Before
const loadItems = async () => {
  const { data } = await api.get('/products');
  setItems(data);
};

// After
const loadItems = async () => {
  const { data } = await api.get('/api/items', {
    params: {
      company_id: currentCompany.id,
      include_variants: true,
      include_pricing: true
    }
  });
  setItems(data);
};

// Add variant
const handleAddVariant = async (item_id: number, variant_data) => {
  await api.post(`/api/items/${item_id}/variants`, {
    variant_sku: variant_data.sku,
    variant_name: variant_data.name,
    attributes_json: variant_data.attributes,
    selling_price: variant_data.price,
    mrp: variant_data.mrp
  });
  refreshItems();
};

// Update pricing
const handleUpdatePrice = async (item_id: number, variant_id: number, price_data) => {
  await api.post(`/api/items/${item_id}/prices`, {
    variant_id,
    selling_price: price_data.selling_price,
    mrp: price_data.mrp,
    cost_price: price_data.cost_price
  });
  refreshItems();
};
```

---

## 5. Reports & Queries

### Current Item Reports

```sql
-- Before
SELECT
  p.code,
  p.name,
  p.sku,
  p.price,
  p.stock,
  p.category,
  p.brand
FROM products p
WHERE p.company_id = ?
ORDER BY p.code;
```

### Target Item Reports

```sql
-- After
SELECT
  i.code,
  i.name,
  iv.variant_sku,
  iv.selling_price,
  ist.quantity_on_hand,
  ic.name AS category,
  ib.name AS brand
FROM items i
LEFT JOIN item_variants iv ON i.id = iv.item_id
LEFT JOIN item_stock ist ON iv.id = ist.variant_id
LEFT JOIN item_categories ic ON i.category_id = ic.id
LEFT JOIN item_brands ib ON i.brand_id = ib.id
WHERE i.company_id = ?
  AND i.is_deleted = false
ORDER BY i.code;
```

---

## 6. Testing Strategy

### Unit Tests

```python
# backend/tests/test_canonical_item_model.py
def test_item_creation():
    item = Item(code='TEST-001', name='Test Item')
    assert item.code == 'TEST-001'

def test_variant_creation():
    item = create_test_item()
    variant = ItemVariant(item_id=item.id, variant_sku='TEST-S-RED')
    assert variant.item_id == item.id

def test_barcode_lookup():
    item = create_test_item()
    variant = create_test_variant(item)
    barcode = ItemBarcode(item_id=item.id, variant_id=variant.id, barcode='123456789')
    lookup = ItemBarcode.query.filter_by(barcode='123456789').first()
    assert lookup.item_id == item.id
```

### Integration Tests

```python
# backend/tests/test_item_api.py
def test_create_item_api():
    response = client.post('/api/items', json={
        'code': 'TEST-001',
        'name': 'Test Item'
    })
    assert response.status_code == 201

def test_add_variant_api():
    item_id = create_test_item().id
    response = client.post(f'/api/items/{item_id}/variants', json={
        'variant_sku': 'TEST-S-RED',
        'variant_name': 'Small Red'
    })
    assert response.status_code == 201

def test_barcode_lookup_api():
    create_test_item_with_barcode('123456789')
    response = client.get('/api/items/barcode/123456789')
    assert response.status_code == 200
```

---

## 7. Deployment Checklist

- [ ] All ORM models updated and tested
- [ ] All API endpoints implemented and tested
- [ ] Search/lookup services migrated to canonical schema
- [ ] React components updated to use new APIs
- [ ] Reports updated to query new schema
- [ ] Database migration validated in staging
- [ ] Application deployed to staging and tested against migrated schema
- [ ] Rollback plan documented and tested
- [ ] Monitoring and alerting configured for new schema
- [ ] Production cutover window scheduled
- [ ] Database switchover and app deployment coordinated

---

## 8. Rollback Plan (Application)

If the database migration is rolled back:

1. Revert application to previous commit (before canonical schema changes)
2. Application reconnects to v1_backup schema (legacy products table)
3. All API calls automatically work against legacy schema
4. No data loss; legacy schema is still available

---

## Notes

- All application changes are safe to develop and test in parallel with database migration
- No code needs to be deployed until database is ready
- Use feature flags if gradual rollout is desired (query both schemas during transition)
- Keep old Product model as legacy bridge initially if needed for dual-write during transition period

