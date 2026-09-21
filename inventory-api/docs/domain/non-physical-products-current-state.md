# Non-Physical Products Current-State and Domain Analysis

Discovery artifact only. No production code was changed and this is not a final implementation specification.

## 1. Purpose and context

This analysis resolves domain uncertainty discovered by `docs/ui-ux/inventory-target-ux.md`: the current Warehouse model contains virtual types for courses and affiliations, but the target inventory direction requires that a non-physical product must not be represented as a virtual warehouse/location.

Required context reviewed:

- `docs/ui-ux/inventory-target-ux.md`
- `docs/ui-ux/inventory-current-state.md`
- `specs/inventory-target-ux/domain-analysis.md`
- `specs/inventory-target-ux/architecture.md`
- `specs/inventory-target-ux/decisions.md`
- `specs/inventory-target-ux/risks.md`
- `specs/inventory-target-ux/requirements.md`

Repository evidence was independently verified in Prisma models, migrations, schemas, services, repositories, frontend views, seed data, tests, and documentation.

## 2. Evidence base

Key files inspected:

- Product model/API:
  - `prisma/schema.prisma`
  - `src/schemas/product.schema.js`
  - `src/services/product.service.js`
  - `src/repositories/product.repository.js`
  - `src/public/root/views/products-admin.js`
  - `src/public/root/views/products-admin.renderers.js`
- Warehouse/location model:
  - `src/lib/warehouse-types.js`
  - `src/schemas/warehouse.schema.js`
  - `src/services/warehouse.service.js`
  - `src/public/root/views/warehouses-admin.renderers.js`
  - `prisma/migrations/20260618001000_add_warehouses_foundation/migration.sql`
  - `prisma/seed.js`
  - `tests/warehouses-view-characterization.test.js`
- Order/sales behavior:
  - `src/schemas/order.schema.js`
  - `src/services/order.service.js`
  - `src/services/order-access-policy.service.js`
  - `src/services/inventory.service.js`
  - `src/services/inventory-transaction-support.service.js`
  - `src/repositories/order.repository.js`
  - `src/services/agent-workspace.service.js`
  - `src/repositories/agent-workspace.repository.js`
- Invoice/payment behavior:
  - `prisma/schema.prisma`
  - `src/schemas/invoice.schema.js`
  - `src/services/invoice.service.js`
  - `src/repositories/invoice.repository.js`
  - `src/services/billing-trigger.service.js`
  - `src/services/payment.service.js`
- Legacy/planned docs:
  - `docs/ERD_v1.md`
  - `docs/er_mvp_prd.md`
  - `docs/vistas/warehouses-view-spec.md`

## 3. What is a Product today?

### 3.1 Current Product model

Confirmed in `prisma/schema.prisma`, `Product` is the general commercial/inventory catalog entity. It has:

- Catalog fields: `code`, `sku`, `barcode`, `name`, `description`, `categoryId`, `subcategoryId`, `inCatalog`, `isActive`.
- Commercial fields: `currency`, `price`, tax fields, `ProductPrice[]`.
- Inventory quantity fields: `quantity`, `reservedQuantity`, `minStock`, `maxStock`, `standbyStock`.
- Classification fields:
  - `sourcingMethod` enum: `PRODUCTION_ONLY`, `PURCHASE_ONLY`, `PRODUCTION_OR_PURCHASE`.
  - `inventoryType` enum: `RAW_MATERIAL`, `PACKAGING`, `WORK_IN_PROCESS`, `FINISHED_GOOD`.
  - `productType` string defaulting to `FINISHED_PRODUCT`.
  - `sellableKind` string defaulting to `STANDARD`.
- Inventory traceability fields: `requiresLot`, `requiresExpiration`, `lotStrategy` defaulting to `TRACKED`.
- Relations to orders, inventory, lots, procurement, production, suppliers, allowed warehouses, and prices.

### 3.2 How products are classified today

Current classification is overloaded:

| Field/concept | Current use | Domain meaning today | Evidence |
|---|---|---|---|
| `Category.categoryType` | System categories `PT`, `MP`, `EM` | Finished product/raw material/packaging grouping | `src/services/product.service.js` `SYSTEM_CATEGORIES` |
| `Product.inventoryType` | Derived from category | Inventory role/category | `deriveInventoryTypeFromCategoryType` in `src/services/product.service.js` |
| `Product.productType` | Free string; defaults/derived values like `FINISHED_PRODUCT`, `RAW_MATERIAL`, `PACKAGING` | Not a clean physical/service/subscription taxonomy | `prisma/schema.prisma`, `src/schemas/product.schema.js`, `buildProductWriteData` |
| `Product.sellableKind` | Free string; defaults `STANDARD` or `NON_SELLABLE` | Sellability marker, not product kind taxonomy | `deriveSellableKind` in `src/services/product.service.js` |
| `Product.lotStrategy` | Defaults `TRACKED`; schema only accepts literal `TRACKED` on write | Lot strategy, but not fully implemented as enum | `src/schemas/product.schema.js` |

### 3.3 Does every product currently assume inventory?

The database model does not require a stock row for every product, and product creation from the current UI starts with zero quantity. However, several commercial/operational paths assume sellable products are inventory-backed:

- Agent sellable product list is built from `warehouseLotStock` rows with `quantity > 0` and sellable non-virtual warehouse filters in `src/repositories/agent-workspace.repository.js`.
- Agent order creation calls `assertAgentOrderItemsAvailable` in `src/services/agent-workspace.service.js`, which rejects any product absent from sellable stock.
- Order approval calls `inventoryService.reserveStockForOrder` in `src/services/order.service.js`, which reserves warehouse stock for every order item.
- Dispatch calls `inventoryService.dispatchOrder`, which decrements warehouse/product stock for every order item.

Therefore: **not every product has inventory at rest, but every product sold through the current stock-reserving order flow is treated as if it needs inventory availability.**

### 3.4 Does every product require a lot?

Stock-entry creation requires an internal lot number:

- `src/services/inventory.service.js` `registerStockEntryInTransaction` throws `Toda existencia requiere numero de lote interno` if no `internalLotNumber`/`lotNumber` is supplied.
- `Lot.internalLotNumber` is required in `prisma/schema.prisma`.

Reservation/dispatch has partial non-lot logic:

- `reserveStockForOrder` uses lot allocations unless `context.product.lotStrategy === 'NONE'`.
- `dispatchOrder` uses lot override logic only when `lotStrategy !== 'NONE'`.

But API write schema currently only allows `lotStrategy: 'TRACKED'`, so supported non-lot product configuration is incomplete.

### 3.5 Must every sellable item be a Product?

Current order line schema requires `productId` for every item (`src/schemas/order.schema.js`). `OrderItem.productId` is required in `prisma/schema.prisma`. Therefore, every sellable order line is currently a `Product`.

### 3.6 Do services/subscriptions/memberships/courses exist today?

Runtime implementation status:

| Concept | Implemented runtime model? | Evidence |
|---|---:|---|
| Service | No explicit model or enum | Search found no service product taxonomy beyond generic code/service filenames. |
| Subscription | No runtime domain entity | No `Subscription`/`CustomerSubscription` model, route, service, schema, or repository found. |
| Membership/Affiliation | No runtime domain entity | No `AffiliationPlan` or `ClientAffiliation` in Prisma runtime schema. |
| Course | No runtime domain entity | No `CourseOffering`/`CourseEnrollment` in Prisma runtime schema. |
| Course/affiliation as virtual warehouse types | Yes as warehouse enum values and UI options | `COURSES_VIRTUAL`, `AFFILIATIONS_VIRTUAL` in migration, schema, lib, tests. |

Legacy/planned docs do mention course and affiliation entities (`docs/ERD_v1.md`, `docs/er_mvp_prd.md`), but these are not implemented in the current Prisma schema. Notably, `docs/er_mvp_prd.md` proposed courses/affiliations using virtual lots and virtual warehouses; this is the exact direction now being reconsidered.

## 4. Overloaded virtual warehouse concepts

### 4.1 Current virtual warehouse types

| Current type | Current use | Physical inventory? | Product workaround? | Keep / Change / Deprecate |
|---|---|---:|---:|---|
| `ADMIN_VIRTUAL` | Seeded as `V-ADMIN`; described as administrative virtual warehouse for returns/retentions | Not physical; may represent logical stock state | Not directly product workaround | Keep as candidate logical inventory location, pending business definition |
| `COURSES_VIRTUAL` | Available in schema/UI/tests; description says products without physical storage such as courses | No physical inventory | Yes, explicitly product workaround | Deprecate for new usage after migration review |
| `AFFILIATIONS_VIRTUAL` | Available in schema/UI/tests; description says memberships/affiliations without physical inventory | No physical inventory | Yes, explicitly product workaround | Deprecate for new usage after migration review |

Evidence:

- `src/lib/warehouse-types.js` describes `COURSES_VIRTUAL` as a virtual warehouse for products without physical storage such as courses and `AFFILIATIONS_VIRTUAL` for memberships/affiliations.
- `src/services/warehouse.service.js` derives `isVirtual` from `warehouseType` and forces virtual warehouses to non-sellable.
- `src/repositories/agent-workspace.repository.js` excludes virtual warehouses from sellable product availability.
- Seed data only creates `ADMIN_VIRTUAL`, not course/affiliation virtual warehouses (`prisma/seed.js`).
- Tests characterize UI creation/filtering of `COURSES_VIRTUAL`, but do not establish commercial behavior (`tests/warehouses-view-characterization.test.js`).

### 4.2 Why this is overloaded

A warehouse/location answers “where is stock?” A course, service, membership, or subscription answers “what was sold or what entitlement exists?” Current virtual warehouse values mix these questions by encoding product-offering types as inventory places.

## 5. Non-physical product scenarios

### A. Service: Installation service, price 25,000

| Question | Current support |
|---|---|
| Can it be a Product? | Partially. Product can be created with arbitrary `productType` string through backend, but UI has no service option. |
| Can it be added to an order? | Technically yes through generic `OrderItem.productId`, but current agent catalog and approval flow require sellable stock. |
| Can it be invoiced? | Partially. Invoice can reference an order and amount, but no invoice items exist. Billing from order calculates amount from order items. |
| Can it be paid? | Yes if an invoice exists; payments only reference invoice and amount. |
| Requires stock/location/lot today? | Commercial order approval currently requires sellable warehouse and stock reservation; manual invoice does not. |
| Fulfillment state? | Not supported separately. Current order statuses are physical-dispatch oriented (`APPROVED`, `DELIVERED`). |
| Scheduling? | Not supported and not required for this domain decision. |

Conclusion: services are **not coherently supported** in current order flow. They can be manually invoiced as an amount but cannot safely pass normal product→order→stock approval without inventory changes.

### B. Subscription: Monthly service, price 10,000/month

| Capability | Status | Evidence |
|---|---|---|
| Product/plan catalog record | PARTIALLY SUPPORTED | Product can represent offering, but no recurring attributes. |
| Recurring billing concept | NOT SUPPORTED | No subscription scheduler/domain model; billing trigger is per order. |
| Start date/end date | NOT SUPPORTED | No subscription/customer entitlement model. |
| Billing interval | NOT SUPPORTED | No field/model. |
| Renewal date / next billing date | NOT SUPPORTED | No field/model. |
| Automatic renewal | NOT SUPPORTED | No scheduler/process. |
| Manual renewal | DOMAIN DECISION REQUIRED | Could be another order/invoice today, but no lifecycle state. |
| Active/paused/cancelled/expired states | NOT SUPPORTED | No customer subscription entity. |
| Customer ownership | NOT SUPPORTED beyond invoices/orders | Invoice proves transaction, not active subscription. |
| Payment status | PARTIALLY SUPPORTED | Payment lifecycle exists per invoice/payment, not subscription. |
| Invoice generation | PARTIALLY SUPPORTED | Per order via `billing-trigger.service.js`, or manual invoice create. |
| Price changes over time | PARTIALLY SUPPORTED | `ProductPrice` has `validFrom/validTo`, order item copies unit price. No subscription price snapshot. |
| Cancellation effects on invoices | DOMAIN DECISION REQUIRED | Invoice cancellation/payment reversal exist, but not subscription cancellation. |

Conclusion: subscription should not be only a product type if lifecycle/billing renewal is required. Product can define the plan/offering; a customer-owned lifecycle entity is needed for active subscriptions.

### C. Membership / affiliation: Annual membership, price 25,000, validity 1 year

Runtime support is the same as subscription: no `AffiliationPlan`, no `ClientAffiliation`, no validity status in current Prisma schema.

Domain analysis:

- A membership/affiliation is commercially similar to a subscription when it has validity, renewal, and customer ownership.
- It may differ in business vocabulary and benefits, but repository evidence does not justify a separate runtime engine yet.
- Existing planned docs (`docs/er_mvp_prd.md`) proposed `AffiliationPlan` and `ClientAffiliation`, but also tied them to virtual lots/warehouses, which should be rejected for the new direction.

Recommendation: treat membership/affiliation as a **subscription/entitlement use case** unless future business rules prove a separate lifecycle is needed.

### D. Course

Current runtime status:

- No `CourseOffering` or `CourseEnrollment` model in `prisma/schema.prisma`.
- `COURSES_VIRTUAL` exists only as a warehouse type/option.
- Planned docs proposed courses with capacity controlled by virtual lots (`docs/er_mvp_prd.md`), but this is not implemented.

Domain interpretation:

- A course can be a non-physical sellable product/offering.
- If it needs seat capacity, schedule, instructor, enrollment, completion, etc., that is a course/enrollment domain, not inventory stock.
- Do not build an LMS in the inventory/product spec.

Recommendation: for MVP commercial purposes, Course should be modeled as a **non-inventory product/offering**. Course-specific scheduling/capacity/enrollment should be a separate future specification if needed.

## 6. Sales order behavior and physical inventory assumptions

Current flow:

```text
Product → OrderItem → approveOrder → reserveStockForOrder → dispatchOrder → generateBillingOnDispatch → Invoice → Payment
```

Physical inventory assumptions:

1. `OrderItem` always requires `productId`.
2. Order validation only checks product belongs to company (`order-access-policy.service.js`); it does not check product kind.
3. Agent product catalog is stock-derived:
   - `findSellableProductAvailabilityRows` reads `warehouseLotStock` where quantity > 0 and warehouse is non-virtual/sellable.
   - `assertAgentOrderItemsAvailable` rejects products without sellable stock.
4. Approval reserves stock for each order item in `reserveStockForOrder`.
5. If order has no warehouse, approval auto-assigns first sellable warehouse; if none exists, it fails.
6. Reservation calls `changeWarehouseStock` with positive reserved delta; this requires available stock.
7. For tracked products, reservation calls `reserveLots`; insufficient lots fail approval.
8. Dispatch decrements warehouse/product stock for every order item.

Implication for non-inventory products:

- A monthly subscription quantity 1 would currently fail normal agent order flow if it has no stock row/lot in a sellable physical warehouse.
- If manually added to a back-office order, approval/dispatch would still try to reserve/decrement inventory unless backend logic is changed.

Backend assumptions that force inventory behavior:

- Order approval delegates to inventory service for all items.
- Sellable catalog for agents is availability-driven rather than catalog-driven.
- Billing trigger is attached to approval/dispatch, not a general commercial fulfillment event.
- Order fulfillment state is `DELIVERED`, which is physical-dispatch language.

## 7. Invoice and payment behavior

### 7.1 Invoice model

Current `Invoice` model in `prisma/schema.prisma` has:

- `clientId`
- optional `orderId`
- `number`
- `amount`
- `status`
- `issuedAt`, `dueAt`, `paidAt`
- `payments[]`

There is **no `InvoiceItem` model** in the current runtime schema. Invoice does not directly require Product. Product-level detail comes indirectly through the referenced order, if present.

### 7.2 Can non-physical products be invoiced?

- A manual invoice can be created for a client with an amount and optional order (`src/schemas/invoice.schema.js`, `src/services/invoice.service.js`). It does not require product type or inventory.
- Auto-billing from orders calculates amount from order items (`src/services/billing-trigger.service.js`) and creates one invoice per order.
- Invoice generation is called after order approval and after dispatch; it is idempotent by `orderId`.

Therefore:

- Services/subscriptions can be represented as **manual invoices** today only as generic amounts, without line-level product detail.
- They cannot safely use full order auto-billing unless order approval/fulfillment is changed to bypass inventory for non-inventory lines.

### 7.3 Payment behavior

Payment references an invoice, amount, method, status, evidence, and approval/reversal lifecycle. Payment logic does not inspect product type. If an invoice exists, payment lifecycle is broadly usable for physical and non-physical charges.

### 7.4 Hacienda/electronic invoicing dependency

Relevant repository evidence includes fiscal references and Hacienda taxpayer lookup, but current invoice model does not contain invoice line items or product/service tax classification details. Any future electronic invoicing detail may require product/service classification, but that is outside this discovery scope.

## 8. Customer relationship: purchase vs active entitlement

Current model can represent:

```text
Customer/Client → Order → OrderItems → Product
Customer/Client → Invoice → Payments
```

Current model cannot represent:

```text
Customer/Client → Active Subscription/Membership/Course Enrollment → Product/Plan → lifecycle state
```

An invoice proves a transaction; it does not prove current subscription validity, membership status, renewal state, course enrollment status, or entitlement benefits.

Potential future domain entity alternatives:

| Alternative | Meaning | Pros | Cons |
|---|---|---|---|
| `CustomerSubscription` | Customer owns a recurring plan | Clear for recurring services/memberships | Too narrow for courses or one-time entitlements |
| `CustomerEntitlement` | Customer owns access/rights from a product/plan | General for memberships/courses/services | More abstract; may need subtype/metadata |
| Separate `ClientAffiliation`, `CourseEnrollment`, `Subscription` | Explicit domains | Clear specialized behavior | More models and workflows; not justified for MVP unless business rules require |

Recommendation: for minimum subscription/membership resolution, use a generic customer-owned lifecycle concept in analysis terms, but defer final naming until a dedicated subscription/entitlement spec.

## 9. Product type taxonomy options

### Option A: `PHYSICAL`, `SERVICE`, `SUBSCRIPTION`, `MEMBERSHIP`

Advantages:

- Simple UI labels.
- Directly answers non-physical inventory behavior.

Problems:

- Mixes product identity with commercial behavior/lifecycle.
- Subscription and membership may both be service-like offerings with recurring/validity behavior.
- Course does not fit cleanly unless more enum values keep growing.

Compatibility:

- Requires migrating overloaded `productType` values.
- Could be implemented as new `productKind`, not current `productType`.

### Option B: `PHYSICAL`, `SERVICE`; subscription/membership modeled separately

Advantages:

- Product kind remains about the nature of the offering.
- Subscription/membership lifecycle moves to customer-owned domain where it belongs.
- Avoids forcing every recurring/validity scenario into product enum.

Problems:

- UI must explain that a subscription plan may be a service product with recurring behavior.
- Needs additional domain model for actual active subscriptions.

Compatibility:

- Fits current Product-as-catalog pattern.
- Requires adding inventory control and recurring behavior separately.

### Option C: `GOOD`, `SERVICE` plus independent capabilities

Example capabilities:

- `productKind`: `GOOD` or `SERVICE`
- `controlsInventory`
- `requiresLot`
- `requiresExpiration`
- `isSellable`
- `isRecurring` / lifecycle plan config

Advantages:

- Most orthogonal and future-proof.
- Separates inventory from sellability and recurring behavior.
- Handles physical goods without inventory and services with/without recurrence.

Problems:

- Requires careful migration and validation to avoid too many independent combinations.
- More backend work than a simple enum.

Compatibility:

- Aligns with existing fields but requires formalizing them and adding `controlsInventory`.

### Option D: Retain current category/productType model

Advantages:

- Minimal immediate migration.

Problems:

- Current model is already confusing and cannot express non-inventory sellable products safely.
- Leaves virtual warehouse workaround unresolved.

Recommendation: **Option C with constrained UI presets** is the strongest domain fit. The UI can show friendly presets such as “Producto físico”, “Servicio”, “Suscripción”, “Membresía/Afiliación”, and “Curso”, but persistence should prefer orthogonal capability fields where possible.

## 10. Capability-based model evaluation

Recommended direction:

| Capability | Purpose | Current status |
|---|---|---|
| `productKind` | Nature of offering: physical good vs service/non-physical | Missing; current `productType` overloaded |
| `controlsInventory` | Whether order/receipt/inventory logic applies | Missing explicit field |
| `requiresLot` | Business lot tracking | Exists but not fully authoritative |
| `requiresExpiration` | Expiration tracking | Exists |
| `isSellable` / `inCatalog` | Visible in sales catalog | `inCatalog` exists |
| `isRecurring` | Plan can create recurring/renewal charges | Missing |
| Customer entitlement/subscription state | Customer owns active access/membership | Missing |

This model matches repository needs because the main blocker is not just a product label; it is that order/inventory logic needs to know whether a line controls inventory.

## 11. Subscription domain boundary

If subscriptions are required beyond one-off charges, a separate domain entity is eventually necessary.

### Minimum MVP

- Customer/client
- Product/plan reference
- Status: minimally active/cancelled/expired or equivalent
- Start date
- Optional end date/valid until
- Billing interval or renewal cadence only if recurring billing is in scope
- Price snapshot if future invoices must remain stable independent of catalog price

### Future

- Pause/resume
- Automatic renewal job
- Proration
- Discounts/promotions
- Usage-based billing
- Multiple billing anchors
- Dunning/retry policy

### Unnecessary for current inventory spec

- Full SaaS subscription platform
- Payment processor automation
- Complex entitlement benefits engine

## 12. Membership / affiliation boundary

Membership/affiliation can likely share the same lifecycle engine as subscription if it has:

- Customer
- Plan/product
- Start date
- End/validity date
- Status
- Renewal behavior

It should become separate only if business rules require materially different behavior such as member benefits, tiers, credentials, or approval workflows. Repository evidence does not currently justify a separate implementation engine.

## 13. Backward compatibility and migration

### Existing products

Do not automatically infer service/subscription/membership from current `productType` strings, category, stock, or warehouse usage. Safe migration approach:

- Existing products default to `UNKNOWN`/`LEGACY` or `GOOD` with `controlsInventory` inferred only if conservative and reviewed.
- Products with stock/lots/movements should remain inventory-controlled physical goods unless manually reclassified.
- Products without stock should not automatically become services; they may be new physical products with zero stock.

### Existing warehouses

- Preserve `Warehouse.id` and `warehouseId` references for orders, lots, movements, receipts, production, and audit history.
- Treat Warehouse→Location as UI terminology first.
- For `COURSES_VIRTUAL` and `AFFILIATIONS_VIRTUAL`, audit actual tenant data before deprecation/migration.
- Do not delete enum values until historical rows and compatibility are handled.

### Existing invoices/orders/payments

- Preserve all historical order, invoice, payment, stock movement, lot, and audit records.
- If new product kind fields are added, historical order line behavior should be based on snapshots or explicit legacy mode where needed.

## 14. Target conceptual business flows

### Physical product

```text
Create product → Configure inventory → Receive/create initial stock → Sell → Reserve/consume inventory → Invoice → Payment
```

### Service

```text
Create service product → Sell/order service → Fulfill or mark complete if needed → Invoice → Payment
```

No stock, location, lot, reservation, or dispatch requirement.

### Subscription

```text
Create subscription product/plan → Customer subscribes → Customer subscription/entitlement becomes active → Billing event → Invoice → Payment → Renewal/cancellation as applicable
```

### Membership / affiliation

```text
Create membership offering/plan → Customer acquires membership → Validity starts → Invoice/payment → Active membership → Expiration/renewal
```

Likely shares subscription/entitlement lifecycle unless business rules diverge.

### Course

Minimum commercial flow:

```text
Create course offering as non-inventory product → Customer buys/enrolls → Invoice/payment → Enrollment/access tracked by future course/entitlement domain if needed
```

No LMS should be added to product/inventory scope.

## 15. UI impact guidance

Product create/edit should use progressive disclosure:

```text
Tipo / naturaleza: [Producto físico | Servicio | ...]

If physical/good:
  Controlar existencias? [Sí/No]
  If yes: lot tracking, expiration, allowed locations, initial inventory

If service/non-physical:
  Inventory: No aplica
  No location/lot/stock fields

If recurring/validity behavior selected:
  Show only minimal plan fields approved by subscription/entitlement spec
```

Important UI guidance:

- Do not show `0 stock / 0 lotes / 0 bodegas` for non-inventory products.
- Do not expose virtual warehouse choices as a way to sell non-physical offerings.
- Keep Product Detail catalog-first; subscription/customer lifecycle belongs elsewhere.

## 16. Domain decision matrix

| Question | Current behavior | Recommended direction | Confidence | Backend impact | Blocks Inventory spec? |
|---|---|---|---|---|---|
| Product taxonomy | `productType` string overloaded with inventory/category values | Add/define `productKind` or equivalent; avoid overloading current string | High | Medium migration/API change | Yes |
| `controlsInventory` | Missing explicit field; order flow assumes inventory for sellable lines | Make independent explicit capability | High | High order/inventory changes | Yes |
| Services | No explicit support; can be product only superficially | Non-inventory sellable product kind/capability | High | Medium/high | Yes |
| Subscriptions | No runtime entity | Product/plan plus customer-owned subscription/entitlement when lifecycle needed | High | New domain model | Partially |
| Memberships/affiliations | Only virtual warehouse type and planned docs | Treat as entitlement/subscription use case unless rules diverge | Medium/high | New domain model later | Partially |
| Courses | Only virtual warehouse type and planned docs | Non-inventory product; course/enrollment future spec if needed | Medium | Later new domain model | Partially |
| Virtual warehouses | Include course/affiliation product workarounds | Keep only legitimate logical inventory locations; deprecate product-workaround types | High | Migration/restriction | Yes |
| Recurring billing | Not supported | Future subscription/entitlement spec; do not build into inventory spec | High | New capability | No for P1, yes for subscription feature |
| Customer subscription state | Not supported | Needed for active lifecycle beyond invoice | High | New model | No for inventory-only, yes for subscriptions |
| Inventory validation | Applied to all approved/dispatched order items | Skip inventory for non-inventory lines; preserve for physical stock | High | High | Yes |
| Lot requirements | Mandatory for stock entries; incomplete `lotStrategy=NONE` | Lots only for inventory-controlled products; no fake lots for non-inventory | High | Medium/high | Yes |
| Order fulfillment | Physical approval/reservation/dispatch oriented | Separate inventory fulfillment from commercial/non-inventory fulfillment | Medium | High | Yes for selling non-inventory |
| Invoice generation | Invoice has no line items; order billing creates amount | Can bill non-physical via manual invoice; order billing needs non-inventory line support | Medium | Medium | No for inventory, yes for commercial UX |
| Payments | Invoice-based; product-agnostic | Reuse payment lifecycle | High | Low | No |

## 17. Recommended inventory spec updates

After human approval, return these decisions to `specs/inventory-target-ux/`:

1. Canonical taxonomy should not be `productType = physical/service/subscription/membership` alone. Prefer `productKind` + independent capabilities.
2. `controlsInventory` must be independent and explicit.
3. Non-inventory products must bypass stock, lot, movement, warehouse, reservation, and dispatch requirements.
4. Virtual locations must mean logical inventory places, not non-physical product types.
5. `COURSES_VIRTUAL` and `AFFILIATIONS_VIRTUAL` should be deprecated for new product modeling and migration-reviewed for historical data.
6. Product creation UX should show inventory configuration only when `controlsInventory=true`.
7. Inventory summaries should display `No aplica` for non-inventory products.
8. Agent/order catalog behavior must be revised before non-inventory products can be sold through the normal order flow.

## 18. Non-physical products domain readiness

| Issue | Status | Notes |
|---|---|---|
| Product meaning | RESOLVED | Product is the commercial/catalog offering or item sold/managed, not necessarily stock. |
| `productType` future | DECISION NEEDED | Current field is overloaded; add/replace with clearer taxonomy/capabilities. |
| Independent `controlsInventory` | RESOLVED direction | Required as independent capability. |
| Service behavior | RESOLVED direction | Sellable non-inventory product; no stock/location/lot. |
| Subscription behavior | DECISION NEEDED | Needs separate lifecycle if recurring/active state is required. |
| Membership vs subscription | NON-BLOCKING | Likely same lifecycle engine until business rules diverge. |
| Course behavior | NON-BLOCKING | Non-inventory product; enrollment/capacity future spec. |
| Virtual warehouse misuse | RESOLVED direction / migration BLOCKER | Course/affiliation virtual warehouses are product workarounds; audit data before migration. |
| Current order flow for non-physical products | BLOCKER | Approval/dispatch force inventory. |
| Current invoice/payment flow | PARTIALLY RESOLVED | Manual invoice/payment can work; order auto-billing depends on order changes. |
| CustomerSubscription/Entitlement need | DECISION NEEDED | Needed for lifecycle, not needed for simple one-off service sale. |
| Smallest viable subscription model | DECISION NEEDED | Customer + plan product + status + dates + billing cadence if recurring. |
| Inventory-target-ux blockers | BLOCKER | Taxonomy, controlsInventory, virtual location meaning, order inventory assumptions. |

Explicit answers:

1. **What should Product mean in Inventori?** A catalog/commercial offering or item that may be sold, purchased, produced, or managed; it must not imply physical stock.
2. **Should productType exist?** A product classification should exist, but the current `productType` is overloaded. Prefer a clearer `productKind` plus capabilities, or migrate `productType` carefully.
3. **Should controlsInventory be independent?** Yes. It is the critical capability separating catalog/sales from physical stock behavior.
4. **Is Subscription a product type or a behavior/domain entity?** The plan/offering can be a product; an active customer subscription is a separate customer-owned lifecycle entity when lifecycle/renewal is required.
5. **Is Membership/Affiliation different from Subscription?** Not enough current evidence. It can likely share a subscription/entitlement lifecycle initially.
6. **What should Course be?** A non-inventory commercial product/offering; course-specific enrollment/capacity is a future domain, not a warehouse.
7. **Which existing virtual warehouse concepts are incorrectly modeled?** `COURSES_VIRTUAL` and `AFFILIATIONS_VIRTUAL` are incorrectly product-workaround concepts. `ADMIN_VIRTUAL` may be a legitimate logical inventory location if business confirms.
8. **Can non-physical products use the current order flow?** Not safely. Current approval/dispatch reserves and consumes inventory for every line.
9. **Can they use the current invoice/payment flow?** Payments yes if invoice exists. Invoices partially: manual amount invoices can work, but no invoice items and order auto-billing depends on inventory order flow.
10. **What backend assumptions currently force inventory behavior?** Agent catalog stock availability, approval reservation, required sellable warehouse, lot reservation for tracked products, dispatch stock decrement, and stock-derived sales availability.
11. **Is a CustomerSubscription/Entitlement entity necessary?** Necessary for active lifecycle/validity/renewal; not necessary for a one-off service charge.
12. **What is the smallest viable subscription model?** Customer, product/plan, status, start date, optional end/valid-until, billing interval/next billing only if recurring billing is included, and price snapshot if future invoices must be stable.
13. **Which decisions block inventory-target-ux?** Product taxonomy, `controlsInventory`, non-inventory order behavior, virtual location meaning, and migration/deprecation of course/affiliation virtual warehouses.
14. **What should be a separate future specification?** Subscription/entitlement lifecycle, recurring billing jobs, course enrollment/capacity, membership benefits, electronic invoice line-item/product-service tax classification if required.
