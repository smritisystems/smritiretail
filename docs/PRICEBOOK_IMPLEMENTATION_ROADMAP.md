<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Classification: Internal
  Document     : PriceBook Implementation Roadmap
-->

# 🗺️ PRICE BOOK SYSTEM - IMPLEMENTATION ROADMAP

**Version:** 1.0  
**Last Updated:** 2026-09-05  
**Status:** READY FOR DEVELOPMENT  
**Estimated Timeline:** 4-6 weeks  

---

## Executive Summary

This roadmap provides a phased approach to implement the PriceBook system across three key areas:

1. **Backend Services** (2 weeks) - APIs, business logic, database
2. **Frontend UI** (2 weeks) - Forms, dashboards, calculations
3. **Integration & Testing** (1-2 weeks) - E2E testing, data migration, go-live

**Key Deliverables:**
✅ Complete Price Book management  
✅ Customer tier management  
✅ Hierarchical pricing resolution  
✅ Audit trail and history  
✅ User-friendly UI for non-technical staff  

---

## Related Documentation

Before implementing, review these documents in this order:

1. **PRICEBOOK_BLUEPRINT_FOR_USERS.md**
   - Read this first if you're new to PriceBook concept
   - Explains business logic in simple terms
   - Contains real-world examples
   - Shows UI/UX mockups
   - Good for training non-technical users

2. **PRICEBOOK_TECHNICAL_IMPLEMENTATION.md**
   - Technical details for developers
   - API endpoint specifications
   - Database schema and indexes
   - Component structures
   - Form validation rules
   - Error handling patterns
   - Performance optimization

3. **This Roadmap (PRICEBOOK_IMPLEMENTATION_ROADMAP.md)**
   - Phase-by-phase implementation plan
   - Team roles and responsibilities
   - Timeline and milestones
   - Risk mitigation
   - Testing strategy
   - Go-live checklist

---

## PHASE 1: BACKEND FOUNDATION (Week 1-2)

### 1.0: Universal Import Foundation

This is a shared capability, not a PriceBook-only feature. Build it before individual import buttons so barcode, SKU, quantity, MRP, selling price, and cost price behave consistently across modules.

- [ ] Define the normalized import row contract
- [ ] Add tenant-aware barcode/SKU/item-code resolution
- [ ] Add preview endpoint with row-level status
- [ ] Add explicit target authorization for each activity
- [ ] Add commit endpoint with idempotency key and audit record
- [ ] Support `CREATE`, `UPDATE`, `ADD_STOCK`, `ADD_LINE`, and `PRINT` actions
- [ ] Never synthesize unknown products without user confirmation
- [ ] Return downloadable error rows for correction and re-import

**Initial targets:** Item Master, Price Book, Purchase Inward, Sales Order, Sales Return, Stock Adjustment, and Label Printing.

**Acceptance criterion:** A single file containing `Barcode`, `Qty`, `MRP`, `Selling Price`, and `Cost Price` can be previewed and committed to any authorized target without target-specific parsing code.

### 1.1: Database Schema Preparation

**Tasks:**
- [ ] Verify all tables exist in tenant database (smritiXXX)
  - [ ] price_books
  - [ ] price_book_entries
  - [ ] customer_price_tiers
  - [ ] audit_logs (for tracking changes)
  
- [ ] Create required indexes for performance
  - [ ] See TECHNICAL_IMPLEMENTATION.md for index definitions
  
- [ ] Set up audit logging triggers
  - [ ] Log all INSERT/UPDATE/DELETE on price books
  - [ ] Track user, timestamp, old value, new value

**Owner:** Database Administrator  
**Effort:** 2-3 days  
**Deliverable:** Database ready for API implementation

---

### 1.2: API Endpoint Implementation

**Tasks:**

#### Core Endpoints
- [ ] **Price Book CRUD**
  - [ ] POST /api/v1/pricing/books (Create)
  - [ ] GET /api/v1/pricing/books (List with filters)
  - [ ] GET /api/v1/pricing/books/{id} (Get single)
  - [ ] PATCH /api/v1/pricing/books/{id} (Update)
  - [ ] DELETE /api/v1/pricing/books/{id} (Archive/Soft delete)

- [ ] **Price Book Entries**
  - [ ] POST /api/v1/pricing/books/{book_id}/entries (Add product)
  - [ ] GET /api/v1/pricing/books/{book_id}/entries (List products)
  - [ ] PATCH /api/v1/pricing/books/{book_id}/entries/{entry_id} (Update price)
  - [ ] DELETE /api/v1/pricing/books/{book_id}/entries/{entry_id} (Remove product)

- [ ] **Customer Tiers**
  - [ ] POST /api/v1/pricing/tiers (Create)
  - [ ] GET /api/v1/pricing/tiers (List)
  - [ ] PATCH /api/v1/pricing/tiers/{id} (Update)
  - [ ] DELETE /api/v1/pricing/tiers/{id} (Delete)

#### Pricing Resolution
- [ ] POST /api/v1/pricing/resolve (Single item price)
- [ ] POST /api/v1/pricing/resolve/bulk (Cart/Order pricing)

#### Audit & Reporting
- [ ] GET /api/v1/pricing/audit-log (View changes history)
- [ ] GET /api/v1/pricing/books/{id}/history (Price history for product)

**Owner:** Backend Developer (Senior)  
**Effort:** 5-6 days  
**Acceptance Criteria:**
- All endpoints return correct HTTP status codes
- All validations implemented as per TECHNICAL_IMPLEMENTATION.md
- Comprehensive error messages
- API documentation auto-generated (Swagger/OpenAPI)

---

### 1.3: Business Logic Implementation

**Tasks:**
- [ ] **Pricing Resolution Engine**
  - [ ] Implement 4-level hierarchical resolution
  - [ ] Quantity tier matching logic
  - [ ] Date validity gating
  - [ ] Default price book fallback
  - [ ] Customer tier discount application

- [ ] **Validation Layer**
  - [ ] Unique constraints (code, tier codes)
  - [ ] Price validation (selling ≤ MRP)
  - [ ] Date range validation
  - [ ] Quantity tier sequencing
  - [ ] Margin thresholds

- [ ] **Audit Trail**
  - [ ] Track all price changes
  - [ ] Record user, timestamp, old/new values
  - [ ] Implement audit log queries

**Owner:** Backend Developer (Senior)  
**Effort:** 4-5 days  
**Testing:** Unit tests for all business logic

---

### 1.4: Integration with Existing Systems

**Tasks:**
- [ ] **Item Master Integration**
  - [ ] Verify price book entries link correctly to items
  - [ ] Handle variant pricing (if variants used)
  - [ ] Fallback to item master base price

- [ ] **Customer/CRM Integration**
  - [ ] Link customer profiles to price tiers
  - [ ] Auto-load customer tier when pricing
  - [ ] Support for customer tier assignment

- [ ] **Order/Sales Integration**
  - [ ] Call pricing resolver when sales order created
  - [ ] Apply resolved price to order line items
  - [ ] Lock price at order time (historical pricing)

**Owner:** Integration Developer  
**Effort:** 3-4 days

---

## PHASE 2: FRONTEND IMPLEMENTATION (Week 3-4)

### 2.1: Component Development

**2.1.1: Price Book List & Management**

**Tasks:**
- [ ] **PriceBookList Component**
  - [ ] Display all price books in table/card view
  - [ ] Status color coding (ACTIVE/INACTIVE/ARCHIVED)
  - [ ] Default indicator (✓)
  - [ ] Quick filters (status, channel, date range)
  - [ ] Pagination support

- [ ] **PriceBookForm Component**
  - [ ] Create new price book form
  - [ ] Edit existing price book
  - [ ] Field validation with error messages
  - [ ] Date picker for validity period
  - [ ] Save/Cancel buttons
  - [ ] Success/error notifications

- [ ] **Actions**
  - [ ] Create Price Book button
  - [ ] Edit Price Book button
  - [ ] Archive Price Book button (with confirmation)
  - [ ] Duplicate Price Book
  - [ ] View Details

**Owner:** Frontend Developer (Mid/Senior)  
**Effort:** 4-5 days  
**Acceptance Criteria:**
- Smooth form validation UX
- Clear error messages
- Loading states visible
- Responsive design (mobile/tablet/desktop)

---

**2.1.2: Product Entry Management**

**Tasks:**
- [ ] **ProductEntryList Component**
  - [ ] Show all products in current price book
  - [ ] Display MRP, selling price, tiers count
  - [ ] Auto-calculated margin % display
  - [ ] Search/filter by product name
  - [ ] Pagination

- [ ] **AddProductForm Component**
  - [ ] F2-based product selector (from item master)
  - [ ] Variant selector (if applicable)
  - [ ] MRP input (read-only or editable?)
  - [ ] Base selling price input
  - [ ] Cost price input
  - [ ] Dynamic volume tier entry
  - [ ] Add/remove tier UI

- [ ] **VolumeTierManager Component**
  - [ ] Tier 1 (default) - read only initially
  - [ ] Add new tier button
  - [ ] Each tier: min_qty, selling_price, cost_price
  - [ ] Real-time margin calculation
  - [ ] Validation: qty sequence, price decreasing
  - [ ] Delete tier button (except Tier 1)

- [ ] **Bulk Import**
  - [ ] CSV template downloader
  - [ ] File upload button
  - [ ] Progress bar during import
  - [ ] Success/error report (X products imported, Y failed)

**Owner:** Frontend Developer (Mid)  
**Effort:** 5-6 days

---

**2.1.3: Customer Tier Management**

**Tasks:**
- [ ] **TierList Component**
  - [ ] List all customer tiers
  - [ ] Show linked price book
  - [ ] Show discount percentage
  - [ ] Show customer count

- [ ] **CreateTierForm Component**
  - [ ] Tier name input
  - [ ] Tier code input (auto-suggest uppercase)
  - [ ] Price book selector (optional)
  - [ ] Discount % input (0-100)
  - [ ] Description textarea

- [ ] **AssignCustomerUI**
  - [ ] In customer profile: "Select Price Tier" dropdown
  - [ ] Shows current tier
  - [ ] Auto-updates pricing preview

**Owner:** Frontend Developer (Junior/Mid)  
**Effort:** 3-4 days

---

### 2.2: Dashboard & Reporting

**Tasks:**
- [ ] **Pricing Dashboard**
  - [ ] Summary cards: Total books, active books, products, tiers
  - [ ] Recent changes timeline
  - [ ] Quick access buttons (Create, Import, etc)
  - [ ] Key metrics (avg margin %, upcoming expiries)

- [ ] **Price Calculator Tool**
  - [ ] Customer selector (F2 lookup)
  - [ ] Product selector (F2 lookup)
  - [ ] Quantity input
  - [ ] "Calculate Price" button
  - [ ] Show: base price, tier applied, customer discount, final price
  - [ ] Print/Share result option

- [ ] **Audit Log Viewer**
  - [ ] Timeline of all price changes
  - [ ] Filters: date range, user, action type
  - [ ] Show: what changed, from/to values, who, when
  - [ ] Export report option

**Owner:** Frontend Developer (Mid)  
**Effort:** 4-5 days

---

### 2.3: State Management & API Integration

**Tasks:**
- [ ] **Redux Store Setup**
  - [ ] pricing slice (price books, entries, tiers)
  - [ ] Actions: fetch, create, update, delete
  - [ ] Selectors: getActivePriceBooks, getTierByCode, etc
  - [ ] Loading states, error handling

- [ ] **API Client Integration**
  - [ ] Axios/Fetch wrapper for pricing endpoints
  - [ ] Error interceptors for common errors
  - [ ] Success notification handling
  - [ ] Request/response logging (dev mode)

- [ ] **Caching Strategy**
  - [ ] Cache price books for 5 minutes
  - [ ] Cache customer tiers for 10 minutes
  - [ ] Invalidate on updates
  - [ ] Manual refresh button

**Owner:** Frontend Developer (Senior)  
**Effort:** 3-4 days

---

### 2.4: Form Validation & UX Polish

**Tasks:**
- [ ] **Client-Side Validation**
  - [ ] All validations from TECHNICAL_IMPLEMENTATION.md
  - [ ] Real-time validation feedback
  - [ ] Disable submit until valid

- [ ] **Error Handling**
  - [ ] User-friendly error messages
  - [ ] Duplicate code? → Suggest alternative
  - [ ] Date range error? → Show correct format
  - [ ] Network error? → Retry button

- [ ] **Loading & Async States**
  - [ ] Loading spinners on buttons
  - [ ] "Saving..." indicators
  - [ ] Skeleton loaders for lists
  - [ ] Optimistic updates where appropriate

- [ ] **Accessibility**
  - [ ] Keyboard navigation (Tab, Enter, Escape)
  - [ ] Screen reader labels
  - [ ] ARIA attributes for modals/alerts

**Owner:** Frontend Developer (Mid/Senior)  
**Effort:** 3-4 days

---

## PHASE 3: INTEGRATION & TESTING (Week 5-6)

### 3.1: End-to-End Testing

**Tasks:**
- [ ] **Manual E2E Scenarios**

  **Scenario 1: Create Retail Price Book**
  - [ ] Create price book (name, code, channel=RETAIL)
  - [ ] Add 5 products
  - [ ] Add volume tiers for each
  - [ ] Set as default
  - [ ] Activate
  - [ ] Order via POS → Price applied correctly

  **Scenario 2: Promotional Campaign**
  - [ ] Create Diwali price book (date-limited)
  - [ ] Add 50+ products via CSV import
  - [ ] Set 30% discount prices
  - [ ] Activate on Oct 1
  - [ ] Customer orders during campaign → gets discount
  - [ ] Campaign ends Oct 15 → prices revert to default

  **Scenario 3: Wholesale Tier Setup**
  - [ ] Create TIER-WHOLESALE tier
  - [ ] Link to PB-WHOLESALE book
  - [ ] Assign ABC Distributors to tier
  - [ ] Place order → Uses tier's price book + discount

  **Scenario 4: Price Changes**
  - [ ] Active price book
  - [ ] Change product price
  - [ ] Verify audit log records change
  - [ ] New orders use new price
  - [ ] Old orders keep old price

  **Scenario 5: Error Handling**
  - [ ] Try to create duplicate code → Error
  - [ ] Try selling_price > MRP → Error
  - [ ] Try to set default when one exists → Warning
  - [ ] Invalid date range → Error

**Owner:** QA Engineer  
**Effort:** 5-6 days

---

### 3.2: Performance Testing

**Tasks:**
- [ ] **Load Testing**
  - [ ] 100 concurrent price calculation requests
  - [ ] Response time < 100ms
  - [ ] No database connection pool exhaustion

- [ ] **Bulk Operations**
  - [ ] Import 1000 product prices from CSV
  - [ ] Complete in < 30 seconds
  - [ ] Database not locked

- [ ] **Database Query Performance**
  - [ ] Price resolution query < 10ms (with indexes)
  - [ ] List price books < 50ms
  - [ ] All indexes verified in use (EXPLAIN PLAN)

**Owner:** DevOps/Database Administrator  
**Effort:** 2-3 days

---

### 3.3: Data Migration (If Applicable)

**Tasks:**
- [ ] **Historical Pricing Data**
  - [ ] If existing prices in old system, migrate to new
  - [ ] Preserve date when prices were set
  - [ ] Link to existing items/variants

- [ ] **Customer Tier Assignment**
  - [ ] If customers have "customer_type" field, map to tiers
  - [ ] Set default tier for unmapped customers

- [ ] **Validation After Migration**
  - [ ] Sample check: 10 random orders
  - [ ] Verify prices match historical data
  - [ ] No orphaned price entries

**Owner:** Data Analyst + Backend Developer  
**Effort:** 2-3 days (depends on data volume)

---

### 3.4: User Training & Documentation

**Tasks:**
- [ ] **Create Training Materials**
  - [ ] Video tutorial: Create first price book (5 min)
  - [ ] Video tutorial: Add products & tiers (8 min)
  - [ ] Video tutorial: Create customer tier (3 min)
  - [ ] Quick reference guide (PDF)

- [ ] **Conduct Training Sessions**
  - [ ] Pricing Manager training (2 hours)
  - [ ] Sales Manager training (1 hour)
  - [ ] Customer Service training (30 min)

- [ ] **Setup Sandbox**
  - [ ] Test environment with sample data
  - [ ] Let users practice before go-live
  - [ ] Provide test items/customers

**Owner:** Product Manager + Trainer  
**Effort:** 3-4 days

---

## PHASE 4: GO-LIVE & SUPPORT (Week 6)

### 4.1: Pre-Go-Live Checklist

**Database:**
- [ ] All indexes created and verified
- [ ] Backup taken
- [ ] Audit logging enabled
- [ ] Connection pooling configured

**Backend:**
- [ ] All API endpoints tested
- [ ] Error handling complete
- [ ] Logging configured (INFO level)
- [ ] Rate limiting set (if needed)
- [ ] CORS configured for frontend origin

**Frontend:**
- [ ] All components tested
- [ ] Mobile responsive verified
- [ ] Browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] Performance tested (lighthouse score > 80)
- [ ] Error handling verified

**Security:**
- [ ] Authentication/authorization verified
- [ ] API request validation complete
- [ ] SQL injection prevention verified
- [ ] HTTPS enabled
- [ ] Secrets not in code

**Operations:**
- [ ] Monitoring/alerting setup
- [ ] Log aggregation (ELK, Datadog, etc)
- [ ] Runbook created for common issues
- [ ] Escalation procedures defined

---

### 4.2: Staged Rollout

**Recommendation:** Deploy in phases to minimize risk

**Phase A: Internal Testing (1 day)**
- [ ] Team uses system in production DB
- [ ] Real data, real scenarios
- [ ] Smoke tests pass

**Phase B: Pilot Customers (3-5 days)**
- [ ] 2-3 friendly customers use system
- [ ] Get feedback
- [ ] Verify pricing in live orders

**Phase C: Full Rollout (1 day)**
- [ ] All customers get access
- [ ] Support team on high alert
- [ ] Monitor error rates

---

### 4.3: Post-Go-Live Support (Week 6+)

**First Week Priority:**
- [ ] Daily check-in call with business team
- [ ] Monitor error logs for any issues
- [ ] Quick fixes for any bugs found
- [ ] User question support line

**Ongoing Support:**
- [ ] Weekly sync with product team
- [ ] Monitor system performance
- [ ] Collect user feedback
- [ ] Plan improvements

---

## TEAM STRUCTURE & ROLES

### Recommended Team Composition

**Backend Team (2 people):**
- Lead Backend Developer (Senior) - 40 hrs/wk
  - Overall architecture
  - API implementation
  - Database optimization
  - Code review

- Backend Developer (Mid) - 40 hrs/wk
  - API implementation
  - Business logic
  - Unit tests
  - Integration work

**Frontend Team (2 people):**
- Lead Frontend Developer (Senior) - 40 hrs/wk
  - Component architecture
  - State management
  - Performance optimization
  - Code review

- Frontend Developer (Mid) - 40 hrs/wk
  - Component development
  - Form validation
  - UI/UX implementation

**QA Team (1 person):**
- QA Engineer - 40 hrs/wk
  - Test planning
  - Manual testing
  - Test automation
  - Performance testing

**Database/DevOps (1 person, part-time):**
- Database Administrator - 20 hrs/wk
  - Schema verification
  - Index creation
  - Performance tuning
  - Backup/recovery

**Product/Management (1 person, part-time):**
- Product Manager - 20 hrs/wk
  - Requirements clarification
  - Training materials
  - Go-live coordination

**Total: 6 people, ~240 hours over 6 weeks**

---

## RISK MITIGATION

### Risk 1: Performance Degradation Under Load

**Risk:** Large product catalogs (10k+ items) with complex pricing

**Mitigation:**
- Create proper database indexes (done in Phase 1.1)
- Load test early (Week 4)
- Implement caching (done in Phase 2.3)
- Monitor query performance (ongoing)

---

### Risk 2: Data Accuracy Issues

**Risk:** Prices calculated incorrectly, margins negative

**Mitigation:**
- Comprehensive validation layer (Phase 1.3)
- Test all 5 scenarios in Phase 3.1
- Audit trail logs all changes
- Sample verification after migration

---

### Risk 3: User Adoption Challenges

**Risk:** Staff not using system, falling back to manual processes

**Mitigation:**
- Clear, simple UI (Phase 2)
- Comprehensive training (Phase 3.4)
- Support team ready for go-live
- Sandbox environment for practice

---

### Risk 4: Integration Issues

**Risk:** PriceBook not integrating with sales, CRM, inventory

**Mitigation:**
- Integration testing in Phase 1.4
- E2E scenarios test full workflow (Phase 3.1)
- Fallback: item master base price still works
- Monitoring of integration calls

---

### Risk 5: Date/Timezone Issues

**Risk:** Prices apply at wrong dates (time zone confusion)

**Mitigation:**
- Store all dates in UTC
- Convert to user's timezone only for display
- Clear UI indicators (show timezone)
- Test date boundaries thoroughly

---

## SUCCESS METRICS

### After Go-Live

**Functional Metrics:**
- ✅ 100% of price orders use PriceBook system
- ✅ Pricing accuracy: 99.9%+ correct calculations
- ✅ Audit trail: 100% of price changes logged
- ✅ Response time: < 100ms for price calculation

**Adoption Metrics:**
- ✅ 90%+ staff trained within 1 week
- ✅ 95%+ staff using system correctly by week 2
- ✅ Support ticket rate: < 5 per week after stabilization

**Business Metrics:**
- ✅ Pricing changes deployed faster (vs manual updates)
- ✅ Promotional campaigns easier to manage
- ✅ Wholesale discount tiers simplify negotiations
- ✅ Audit trail provides compliance proof

---

## TIMELINE SUMMARY

```
WEEK 1-2:  Backend Development
  ├─ Database prep (Days 1-3)
  ├─ API implementation (Days 3-10)
  ├─ Business logic (Days 8-12)
  └─ Integration (Days 10-14)

WEEK 3-4:  Frontend Development
  ├─ Components (Days 15-20)
  ├─ Dashboard & reporting (Days 19-23)
  ├─ State management (Days 22-25)
  └─ Validation & UX polish (Days 23-27)

WEEK 5-6:  Testing & Go-Live
  ├─ E2E Testing (Days 28-34)
  ├─ Performance testing (Days 29-32)
  ├─ Data migration (Days 33-36)
  ├─ Training (Days 34-37)
  └─ Go-live (Day 38)

WEEK 6+:   Support & Monitoring
  └─ Ongoing support & improvements
```

---

## NEXT STEPS

1. **Now:** Read PRICEBOOK_BLUEPRINT_FOR_USERS.md (business understanding)
2. **Day 1:** Read PRICEBOOK_TECHNICAL_IMPLEMENTATION.md (technical details)
3. **Day 2:** Finalize team assignment and roles
4. **Day 3:** Setup database environment
5. **Day 4:** Begin Phase 1 implementation
6. **Week 6:** Launch to production!

---

## Success Checklist for Launch

- [ ] All unit tests passing
- [ ] All E2E test scenarios passing
- [ ] Performance tests meet targets
- [ ] Data migration completed and validated
- [ ] User training completed
- [ ] Support team ready with runbooks
- [ ] Monitoring/alerting configured
- [ ] Backup procedures verified
- [ ] Go-live communication sent
- [ ] Go-live team on standby

---

**Document Version:** 1.0  
**Status:** READY FOR KICKOFF  
**Created:** 2026-09-05  
**Approved By:** [System Architect]  
**Launch Target:** Week of 2026-10-13  

---

## Questions?

For clarifications on specific areas:
- **Business Logic:** See PRICEBOOK_BLUEPRINT_FOR_USERS.md (Sections 3-4)
- **Technical Specs:** See PRICEBOOK_TECHNICAL_IMPLEMENTATION.md
- **Workflows:** See PRICEBOOK_BLUEPRINT_FOR_USERS.md (Section 5)
- **UI Mockups:** See PRICEBOOK_BLUEPRINT_FOR_USERS.md (Section 6)

