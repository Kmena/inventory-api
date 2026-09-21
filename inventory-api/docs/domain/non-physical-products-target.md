# Non-Physical Commercial Products Target Domain + UX

Planning artifact only. No production implementation is included.

## 1. Executive summary

Inventori should support non-physical commercial products without pretending they are stock. The target model separates:

```text
What is sold: Product
What the customer currently owns/has active: CustomerEntitlement
What is financially charged: Order / Invoice
What settles the charge: Payment
What physically exists: Inventory
```

Target principles:

- `Product` remains the catalog/commercial offering.
- Product nature and inventory behavior are separate.
- `controlsInventory` is explicit and persisted.
- Services, subscriptions, memberships/affiliations, and simple courses never require stock, lots, warehouses/locations, reservations, stock movements, or dispatch stock consumption.
- Subscription, membership/affiliation, and course access are not primarily product kinds; they are commercial lifecycle/entitlement behavior attached to a non-inventory product offering.
- Payments continue to pay invoices, not products or subscriptions directly.
- Existing virtual warehouse types `COURSES_VIRTUAL` and `AFFILIATIONS_VIRTUAL` become legacy for new product modeling. They must not be used for new services/subscriptions/memberships/courses.

Smallest coherent MVP:

1. Product catalog supports physical goods and non-inventory service-like offerings.
2. Product inventory behavior is controlled by persisted `controlsInventory`.
3. Orders may contain mixed inventory and non-inventory items.
4. Approval reserves stock only for inventory-controlled items.
5. Dispatch consumes stock only for inventory-controlled items; non-inventory items are ignored by inventory dispatch.
6. A `CustomerEntitlement`-style customer-owned lifecycle entity represents active subscriptions, memberships/affiliations, and simple course access.
7. MVP uses validity-based/manual lifecycle, not automatic recurring billing.
8. Invoice/payment are reused with minimal additions for line-level invoice snapshots identified as a dependency.

## 2. Evidence and current-state baseline

This target plan is based on:

- `docs/domain/non-physical-products-current-state.md`
- `docs/ui-ux/inventory-target-ux.md`
- `specs/non-physical-products-domain/*`
- `specs/inventory-target-ux/*`
- Repository validation of Prisma, services, repositories, schemas, and frontend views.

Confirmed current-state evidence:

- `Product` is a broad catalog/inventory/commercial model in `prisma/schema.prisma`.
- `Product.productType` is `String @default("FINISHED_PRODUCT")`, not a clean enum for product nature.
- `Product.requiresLot`, `requiresExpiration`, `lotStrategy`, `allowedWarehouses`, quantities, and stock relations already exist, but `controlsInventory` does not.
- `src/schemas/product.schema.js` currently accepts arbitrary `productType`; `lotStrategy` accepts only literal `TRACKED` on write.
- `OrderItem.productId` is required; current order lines always reference a `Product`.
- `approveOrder` in `src/services/order.service.js` delegates to `inventoryService.reserveStockForOrder`.
- `reserveStockForOrder` currently loops all order items, auto-assigns a sellable warehouse if absent, reserves warehouse stock, reserves lots unless `lotStrategy === 'NONE'`, and creates `RESERVE` movements.
- `dispatchOrder` currently loops all order items, validates reservations, decrements stock, creates `OUT` movements, and marks the order `DELIVERED`.
- `billing-trigger.service.js` calculates invoice amount from order items and creates an invoice idempotently by `orderId`; it has no product-type logic.
- `Invoice` has `clientId`, optional `orderId`, `number`, `amount`, `status`, dates, and `payments`; there is no runtime `InvoiceItem` model.
- `Payment` references `Invoice` and has a lifecycle independent from product inventory behavior.
- `WarehouseType` contains `COURSES_VIRTUAL` and `AFFILIATIONS_VIRTUAL`; no runtime `CourseOffering`, `CourseEnrollment`, `AffiliationPlan`, `ClientAffiliation`, `Subscription`, or `CustomerSubscription` model exists.

## 3. Target separation: what is sold vs what customer owns

### 3.1 Product = what is sold

`Product` describes a commercial offering or managed catalog item:

- physical good;
- service;
- subscription plan/offering;
- membership/affiliation offering;
- simple course offering.

It owns stable catalog/commercial data:

- name/code/description;
- price and currency;
- tax classification;
- sellable/catalog visibility;
- whether inventory applies;
- optional default validity/renewal metadata for offerings that create customer entitlements.

### 3.2 CustomerEntitlement = what customer currently has active

A customer-owned lifecycle entity should represent:

> Customer X currently has the right/access/validity for Product Y from date A to date B with status Z.

Recommended backend/domain name: `CustomerEntitlement`.

Recommended Spanish UI labels vary by product/offering subtype:

- Suscripción activa
- Membresía activa
- Afiliación activa
- Curso adquirido / acceso a curso

Why not only `CustomerSubscription`?

- It is clear for monthly plans but too narrow for course access and annual membership validity.
- Repository evidence does not justify separate runtime engines for subscriptions, memberships, affiliations, and course access.
- A generic `CustomerEntitlement` is justified here because it directly models the concrete cross-cutting business concept: a customer-owned commercial right/service validity.

What it must not do:

- It must not duplicate Product catalog data as a new product.
- It must not duplicate Invoice/Payment as a second accounting source.
- It must not create inventory stock, locations, lots, or movements.
- It must not become a benefits/rules engine in MVP.

## 4. Product taxonomy decision

### Options evaluated

| Option | Summary | Result |
|---|---|---|
| A | `productKind`: `GOOD`, `SERVICE`, `SUBSCRIPTION`, `MEMBERSHIP` | Rejected as persistence model because it overloads nature with lifecycle and does not handle course cleanly. |
| B | `productKind`: `GOOD`, `SERVICE`; independent capabilities like `controlsInventory`, `recurring`, `hasValidity` | Accepted as base direction. |
| C | Capability model with UI presets | Final recommendation. Use explicit fields, constrain combinations through validation, and expose business-friendly presets in UI. |

### Final recommendation

Persist orthogonal fields, not an ever-growing commercial-product enum:

```text
Product
- productNature: GOOD | SERVICE
- controlsInventory: boolean
- commercialBehavior: STANDARD | ENTITLEMENT
- entitlementKind: SUBSCRIPTION | MEMBERSHIP | AFFILIATION | COURSE | SERVICE_PERIOD   nullable, only for commercialBehavior=ENTITLEMENT
- defaultValidityUnit/defaultValidityCount nullable
- billingInterval nullable, optional/future-facing for manual renewal cadence
```

Naming may be adjusted during implementation, but the concepts should remain separate.

### Business-facing UI presets

The Product form may present presets for clarity:

| UI preset | productNature | controlsInventory | commercialBehavior | entitlementKind |
|---|---|---:|---|---|
| Producto físico | GOOD | default true, editable | STANDARD | null |
| Servicio | SERVICE | false | STANDARD | null |
| Suscripción | SERVICE | false | ENTITLEMENT | SUBSCRIPTION |
| Membresía | SERVICE | false | ENTITLEMENT | MEMBERSHIP |
| Afiliación | SERVICE | false | ENTITLEMENT | AFFILIATION |
| Curso | SERVICE | false | ENTITLEMENT | COURSE |

This gives users understandable choices without making `SUBSCRIPTION` a low-level product kind.

## 5. `controlsInventory` target definition

### Meaning

`controlsInventory` answers one question:

> Should this product participate in stock, lot, reservation, movement, location, receipt, dispatch, and inventory availability flows?

### Representation

Recommendation: persist as a boolean field on `Product`.

Rationale:

- The primary decision is binary: inventory applies or it does not.
- Tracking granularity is already represented by `requiresLot`, `requiresExpiration`, and `lotStrategy`/future `inventoryTrackingMode`.
- An enum such as `NO_INVENTORY`, `STOCK_ONLY`, `LOT`, `LOT_EXPIRATION` would duplicate existing traceability fields and make transitions harder.

Recommended complementary field for inventory-controlled products:

```text
inventoryTrackingMode: STOCK_ONLY | LOT | LOT_EXPIRATION
```

This can be implemented using existing fields if preferred:

- `requiresLot=false`, `requiresExpiration=false` -> stock-only with system lot internally if needed;
- `requiresLot=true`, `requiresExpiration=false` -> business-visible lot;
- `requiresLot=true`, `requiresExpiration=true` -> business-visible lot + expiration.

### Defaults

For new products:

- UI preset `Producto físico`: `controlsInventory=true` by default, editable to false if the company sells non-stock physical goods by exception.
- UI preset `Servicio`, `Suscripción`, `Membresía`, `Afiliación`, `Curso`: `controlsInventory=false`, not editable unless product is reclassified as physical/good.

For existing products:

- Products with stock/lots/movements should default to `controlsInventory=true`.
- Products with category types `PT`, `MP`, `EM` and no explicit review should default to `controlsInventory=true` to preserve current behavior.
- Do not infer service/subscription from zero stock.
- Products without stock but created under current inventory categories should remain physical/inventory-controlled until manually reclassified.

### Change rules

| Change | Allowed? | Rule |
|---|---:|---|
| `false -> true` | Yes with configuration | Requires inventory configuration before stock operations. |
| `true -> false` with no stock, no reservations, no lots/movements, no purchase/production refs | Possible | Treat as reclassification; audit it. |
| `true -> false` with historical transactions | Restricted | Requires admin-only migration/reclassification flow; historical inventory remains visible. |
| `true -> false` with current on-hand/reserved stock | No | Must deplete/adjust stock and release reservations first. |
| Non-inventory entitlement product -> inventory controlled | No through normal UI | Create a new product or perform explicit admin reclassification. |

### Validation invariants

- If `controlsInventory=false`:
  - `requiresLot=false`.
  - `requiresExpiration=false`.
  - `lotStrategy`/tracking mode is `NONE` or equivalent.
  - `allowedWarehouseIds` must be empty/ignored.
  - initial lots/stock are rejected.
  - inventory summary shows `No aplica`.
- If `controlsInventory=true`:
  - inventory configuration is available.
  - location restrictions may be configured.
  - stock-only products must use backend-supported transparent system-lot behavior or a stock model change; users must not invent lot numbers.
- `requiresExpiration=true` implies `requiresLot=true` and `controlsInventory=true`.
- `allowedWarehouseIds` only has meaning when `controlsInventory=true`.

## 6. Service MVP

### Smallest useful behavior

A service is a non-inventory sellable Product with no active customer lifecycle unless configured as an entitlement.

Example: Installation Service, ₡25,000.

Flow:

```text
Create service product -> Add to order -> Approve commercial order -> Invoice -> Payment
```

Rules:

- No stock reservation.
- No lot.
- No warehouse/location.
- No inventory movement.
- No dispatch stock consumption.
- No separate service fulfillment status in MVP.

Why no service fulfillment status in MVP?

- Current repository has order approval/dispatch but no service work-order, scheduling, technician, or appointment domain.
- Adding `PENDING/COMPLETED` for services would imply operational tracking not otherwise supported.
- MVP can treat service sale as commercially fulfilled at order approval or completion of the order lifecycle depending on existing order policy. If the business later needs technician completion, create a separate service-fulfillment spec.

## 7. Subscription MVP

### What is the commercial offering?

The subscription plan/offering is a Product:

```text
Product: Plan Premium Mensual
productNature=SERVICE
controlsInventory=false
commercialBehavior=ENTITLEMENT
entitlementKind=SUBSCRIPTION
price=10000 CRC
optional defaultValidity=1 month
optional billingInterval=MONTHLY
```

### What represents “Customer A currently has Subscription X”?

A `CustomerEntitlement` record.

Recommended MVP fields:

| Field | MVP status | Reason |
|---|---|---|
| `id` | Required | Identity. |
| `companyId` | Required | Tenant scope. |
| `customerId` / `clientId` | Required | Owner. Current model uses `Client`; field should align with repository naming. |
| `productId` | Required | Offering/plan. |
| `sourceOrderId` | Required if created from order | Trace commercial origin. Nullable for manual migration/import. |
| `sourceInvoiceId` | Optional MVP | Useful when activation policy depends on invoice/payment; can be nullable if invoice not yet created. |
| `status` | Required | `ACTIVE`, `CANCELLED`, `EXPIRED`. |
| `startDate` | Required | Validity start. |
| `endDate` | Optional but required for validity-based offerings | Null may mean open-ended. |
| `cancelledAt` | Optional | Audit cancellation date. |
| `cancellationReason` | Optional | Business note. |
| `priceSnapshot` | Required | Preserve amount agreed at activation/renewal. |
| `currencySnapshot` | Required | Preserve currency. |
| `billingInterval` | Optional MVP | Useful for subscription display/manual renewal cadence; not needed for one-time course. |
| `nextBillingDate` | Future | Needed for automatic recurring billing, not MVP. |
| `autoRenew` | Future | Requires scheduler/jobs and policy. |
| `metadata` | Optional | Minimal extension hook for labels only; avoid rules engine. |
| `createdAt/updatedAt` | Required | Audit. |

### Minimum lifecycle

Statuses:

- `ACTIVE`: customer currently has access/validity.
- `CANCELLED`: intentionally ended before natural expiration or no longer valid by user action.
- `EXPIRED`: validity period ended.

Rejected/deferred statuses:

- `DRAFT`: creation can be transactionally immediate; not needed unless manual pre-activation workflow is added.
- `PAUSED`: defer; no current business/process evidence.
- `PENDING_PAYMENT`: defer; derive payment status from invoice/payment. Do not duplicate accounting state in entitlement.

Allowed transitions:

```text
ACTIVE -> CANCELLED
ACTIVE -> EXPIRED
EXPIRED -> ACTIVE    only by renewal creating/extending entitlement, audited
CANCELLED -> ACTIVE  not by default; prefer new entitlement or explicit admin reactivate decision
```

Expiration can be derived for display from `endDate < today`, but persisted `EXPIRED` is useful for filtering/reporting. If no background job exists, UI/API should treat past-end active records as “Vencida” and a future job can normalize status later.

## 8. Billing model decision

### Models evaluated

| Model | Meaning | MVP result |
|---|---|---|
| A Recurring billing | System automatically creates invoices every billing period | Deferred. Requires scheduler/job infrastructure, retry/dunning policy, invoice item support, activation/payment policy. |
| B Validity-based sale | Customer buys a period/access; one order/invoice; entitlement remains active for that period | MVP. Smallest coherent model and supports annual memberships, simple courses, and manually renewed subscriptions. |
| C Unified lifecycle supporting both | Same entitlement model with optional future recurrence fields | Target architecture. MVP implements manual/validity mode only while keeping fields extensible. |

### Final recommendation

MVP subscription means: a non-inventory Product offering that creates a customer entitlement with a start/end validity period. Renewal is manual. Automatic recurring invoice generation is **not** in MVP.

## 9. Billing interval and renewal cadence

Recommended values for product offering defaults:

- `MONTHLY`
- `QUARTERLY`
- `YEARLY`

`CUSTOM` is not MVP. Use `defaultValidityCount + defaultValidityUnit` for annual membership/course validity. Custom intervals can be future if business proves need.

Where interval belongs:

- Product offering: default cadence/validity for the plan.
- CustomerEntitlement: snapshot/copy at activation time for historical meaning and possible customer-specific override later.

Customer-specific overrides:

- Not MVP except editing start/end dates during manual creation/renewal.
- Do not implement pricing tiers or override engines in MVP.

## 10. Price model

Use product current price to propose charges, but snapshot price at order/invoice/entitlement creation.

Target rule:

- Product price changes must not silently rewrite existing entitlements or historical invoices.
- `OrderItem.unitPrice` already snapshots unit price.
- `CustomerEntitlement.priceSnapshot` should snapshot agreed price/currency for display and renewal context.
- `InvoiceItem`/line snapshots are recommended as a dependency to preserve billable detail when invoices include mixed product/service/subscription lines.

Business policy for renewals:

- MVP default: renewal uses current product price unless user manually overrides through approved order/pricing flow.
- Existing active customers remain at their original `priceSnapshot` until renewal or explicit plan change.

## 11. Membership / affiliation target

Membership/affiliation does not need a separate runtime domain in MVP.

Recommended model:

```text
Product(entitlementKind=MEMBERSHIP or AFFILIATION) -> CustomerEntitlement
```

Reasoning:

- Repository has no implemented affiliation lifecycle.
- Planned docs tied affiliations to virtual lots/warehouses, which is rejected.
- Annual validity, cancellation, renewal, and customer ownership are the same lifecycle shape as subscription MVP.
- Separate entities can be introduced later only if memberships require benefits, tiers, credentials, approvals, or domain-specific rules.

UI may use Spanish labels “Membresía” and “Afiliación” even if backend uses `CustomerEntitlement`.

## 12. Course target

MVP Course is a simple non-inventory commercial offering:

```text
Product(entitlementKind=COURSE) -> CustomerEntitlement
```

Flow:

```text
Create course product -> customer buys course -> invoice/payment -> course entitlement visible on customer
```

Out of scope:

- classes;
- teachers;
- schedules;
- attendance;
- course capacity;
- LMS content;
- grade/completion tracking.

If course capacity/enrollment becomes necessary, create a future Course/Enrollment spec. Do not use `COURSES_VIRTUAL` or lots for capacity.

## 13. Relationships among core entities

```text
Product
  describes offering and inventory applicability

Order / OrderItem
  captures commercial sale intent and price/quantity at sale time

Invoice / InvoiceItem (target dependency)
  captures billable financial document and immutable line details

Payment
  settles an invoice, independent of product/inventory type

CustomerEntitlement
  captures customer-owned active right/validity/access created by a non-inventory entitlement offering

Inventory
  captures physical stock only for products with controlsInventory=true
```

`CustomerEntitlement` may reference Product, Customer/Client, source Order, and source Invoice. It should not reference Payment directly in MVP; payment status is derived from invoice/payment records.

## 14. Order flow target

### OrderItem policy

Each order item is evaluated independently:

```text
OrderItem.product.controlsInventory=true
  -> validate stock
  -> reserve stock on approval
  -> consume stock on dispatch
  -> create stock movements

OrderItem.product.controlsInventory=false
  -> skip stock validation
  -> skip reservation
  -> skip stock consumption
  -> no stock movement
  -> may create CustomerEntitlement if product commercialBehavior=ENTITLEMENT
```

### Approval

Non-inventory items may still require order approval because approval is commercial/credit/office control, not just inventory reservation. Approval should:

- validate customer/order policy;
- reserve stock only for inventory-controlled lines;
- create invoice through billing trigger as current behavior does, if that remains policy;
- not require a warehouse when the order contains only non-inventory lines;
- require a warehouse only if at least one item controls inventory.

### Dispatch

Dispatch is physical stock fulfillment. Target behavior:

- For inventory-controlled lines: consume reserved stock and create `OUT` movements.
- For non-inventory lines: ignore for stock dispatch.
- If order contains only non-inventory lines, dispatch should not be required for inventory. The order may move to a commercial completed/delivered state on approval or a separate “complete non-inventory order” action.

Because current `OrderStatus` only has `DRAFT`, `APPROVED`, `IN_PRODUCTION`, `DELIVERED`, `CANCELLED`, `REJECTED`, the implementation spec must decide whether to reuse `DELIVERED` for commercial completion or add a more neutral status such as `FULFILLED`. For MVP, if avoiding enum migration is preferred, non-inventory-only orders may be marked `DELIVERED` by a non-stock completion operation with clear UI wording “Completado”, not “Despachado”.

### Mixed order example

Order #100:

- Coffee bags x10, `controlsInventory=true`.
- Installation service x1, `controlsInventory=false`.
- Monthly membership x1, `controlsInventory=false`, `commercialBehavior=ENTITLEMENT`.

Target lifecycle:

1. Draft order includes all three lines.
2. Approval validates order and reserves only coffee bags.
3. Invoice is generated for all lines.
4. Payment proceeds against invoice.
5. Dispatch consumes only coffee bag stock.
6. Installation service creates no inventory record.
7. Membership entitlement is activated according to activation policy.
8. Final state shows physical line dispatched, non-inventory lines fulfilled/no-inventory, entitlement active if activated.

## 15. Activation trigger decision

Options:

| Trigger | Pros | Cons | Decision |
|---|---|---|---|
| Order approval | Simple, aligns with current invoice-on-approval behavior | May activate before payment; risky for cash/transfer verification | Not universal; acceptable configurable/default for credit customers only if business approves. |
| Invoice creation | Aligns commercial charge with entitlement | Still may be unpaid | Possible for credit/on-account policies. |
| Payment approval | Protects access until money verified | Credit customers may legitimately activate before payment; current cash/transfer payments may be pending approval | Recommended MVP default for cash/transfer; business policy needed for credit. |
| Manual activation | Maximum control | More user work | Include as admin override/alternative if payment policy unclear. |

Final MVP recommendation:

- Default activation policy should be **business-configurable or explicitly approved** before implementation.
- Safe default if no policy exists: activate entitlement after invoice is created and either:
  - payment is approved for cash/transfer orders; or
  - order/invoice is approved for credit/on-account customers.
- Mark as **DECISION NEEDED** for exact policy because current repository has payment conditions (`CASH`, `TRANSFER`, `CREDIT`) and pending payment approval flows; automatic activation on order approval may grant access before funds are verified.

Implementation planner should not silently choose one activation trigger.

## 16. Invoice model target

Current `Invoice` has no line items. For non-physical products, especially mixed orders, line-level financial snapshots become important.

Minimum dependency:

Add an `InvoiceItem` or equivalent immutable line snapshot before robust non-physical billing goes beyond generic order totals.

Recommended minimum `InvoiceItem` fields:

- `invoiceId`
- `productId` nullable for manual lines but set for order-derived lines
- `orderItemId` nullable
- `customerEntitlementId` nullable for subscription/membership/course charges after entitlement creation
- `descriptionSnapshot`
- `quantity`
- `unitPrice`
- `discountAmount` / `totalDiscount`
- `taxCategorySnapshot`
- `taxRateSnapshot`
- `lineTotal`
- `lineKind`: `PHYSICAL_GOOD`, `SERVICE`, `ENTITLEMENT`

Why this matters:

- Invoice amount alone cannot show what portion was coffee, service, membership, or course.
- Future Hacienda/electronic invoicing likely requires line detail and service/product tax classification.
- Payment can remain unchanged because it pays invoice totals.

MVP fallback if invoice items are deferred:

- Mixed order charges can still be calculated from `OrderItem` snapshots, but standalone/manual subscription renewals and invoice detail remain weak.
- Therefore, invoice items are a **backend dependency for a robust MVP**; they should be included in the implementation spec unless deliberately deferred with known limitations.

## 17. Payment model target

Payment should remain product-agnostic:

```text
Payment -> Invoice
```

Rules:

- Do not add `productId` to Payment.
- Do not duplicate payment status in `CustomerEntitlement`.
- Customer entitlement screens may display derived financial status from linked invoice/payment, but accounting truth remains invoice/payment.
- Cancellation of entitlement does not cancel payments or invoices automatically.

## 18. Renewal target

MVP renewal is manual.

Manual renewal flow:

```text
CustomerEntitlement -> Renew -> create order/invoice or renewal charge -> payment/approval -> extend endDate or create successor entitlement
```

Recommended MVP behavior:

- Create a new order/invoice for the renewal period.
- On activation of renewal, either extend existing entitlement if same product and continuous period, or create a successor entitlement linked to previous one.
- The simpler MVP is to extend existing entitlement and append audit/history event; if audit-event detail is insufficient, create successor records.

Automatic renewal is deferred to P2/Future because it requires:

- scheduler/background job;
- next billing date policy;
- invoice generation job;
- retry/dunning rules;
- payment method handling;
- cancellation-at-period-end policy.

## 19. Cancellation target

MVP supports immediate cancellation only.

Rules:

- Set status `CANCELLED`.
- Set `cancelledAt` and optional reason.
- Do not delete entitlement.
- Do not delete invoices/payments.
- Do not reverse payments automatically.
- Do not adjust credit balances automatically unless a future billing/credit note policy says so.

Cancel at period end is deferred. It requires a scheduled future cancellation or additional state such as `cancelAtPeriodEnd`.

## 20. Expiration target

Expiration means the entitlement validity period ended.

- If `endDate` exists and is before the current date, the entitlement should display as expired even if persisted status still says `ACTIVE`.
- Persisted status `EXPIRED` is desirable for reporting and filters.
- If no scheduler exists, expiration can be derived in read models and normalized by a future daily job.
- MVP may implement derived expiration first and a manual/background normalization later.

## 21. Product creation target UX

Recommended UX uses business presets plus progressive disclosure.

### Product create/edit base

```text
+ Nuevo producto --------------------------------------------------+
| Información general                                             |
| Nombre * [____________________________]                         |
| Código [____________]  SKU [____________]                       |
| Descripción [___________________________________________]        |
| Precio [________] Moneda [CRC v]  En catálogo [x]               |
| Impuestos / CABYS [____________________]                        |
|                                                                 |
| Tipo de oferta                                                  |
| ( ) Producto físico                                             |
| ( ) Servicio                                                    |
| ( ) Suscripción                                                 |
| ( ) Membresía                                                   |
| ( ) Afiliación                                                  |
| ( ) Curso                                                       |
|                                                                 |
| [Continuar] [Cancelar]                                          |
+-----------------------------------------------------------------+
```

Mapping is internal; the user does not need to understand `productNature`, `commercialBehavior`, or `entitlementKind`.

### Physical inventory configuration

```text
+ Inventario ------------------------------------------------------+
| Producto físico: Café molido                                    |
| ¿Controlar inventario?  (x) Sí  ( ) No                          |
|                                                                 |
| Trazabilidad                                                    |
| ( ) Existencias sin lote visible                                |
| (x) Lotes                                                       |
| ( ) Lotes + vencimiento                                         |
|                                                                 |
| Ubicaciones permitidas                                          |
| (x) Cualquier ubicación activa                                  |
| ( ) Restringir a ubicaciones seleccionadas                      |
|                                                                 |
| [Configurar existencia inicial] [Guardar]                       |
+-----------------------------------------------------------------+
```

### Non-inventory service configuration

```text
+ Servicio --------------------------------------------------------+
| Servicio: Instalación                                           |
| Inventario                                                      |
| No aplica. Los servicios no usan existencias, lotes ni          |
| ubicaciones.                                                    |
|                                                                 |
| Comportamiento comercial                                        |
| (x) Venta simple                                                |
| ( ) Crear vigencia/acceso para el cliente                       |
|                                                                 |
| [Guardar servicio]                                              |
+-----------------------------------------------------------------+
```

### Subscription offering configuration

```text
+ Suscripción -----------------------------------------------------+
| Oferta: Plan Premium                                            |
| Inventario: No aplica                                           |
|                                                                 |
| Vigencia predeterminada                                         |
| Duración [1] [Mes v]                                            |
| Renovación: Manual (MVP)                                        |
| Periodicidad sugerida [Mensual v]                               |
|                                                                 |
| Precio [10000] Moneda [CRC]                                     |
| [Guardar suscripción]                                           |
+-----------------------------------------------------------------+
```

### Membership/affiliation configuration

```text
+ Membresía / Afiliación -----------------------------------------+
| Oferta: Afiliación anual                                        |
| Inventario: No aplica                                           |
| Vigencia predeterminada [1] [Año v]                             |
| Renovación: Manual                                              |
| Precio [120000] CRC                                             |
| [Guardar]                                                       |
+-----------------------------------------------------------------+
```

## 22. Customer UX target

Smallest useful UX:

- Customer detail should expose a section or tab for active commercial rights.
- Suggested label: `Suscripciones y membresías` or broader `Accesos y vigencias` if courses are included.

### Customer active entitlements

```text
+ Cliente: Supermercado Central ----------------------------------+
| [General] [Pedidos] [Facturas] [Pagos] [Suscripciones y accesos]|
|                                                                 |
| Suscripciones y accesos                                         |
| + Nueva suscripción / acceso                                    |
|                                                                 |
| Producto             Tipo          Estado     Vigencia           |
| Plan Premium         Suscripción   Activa     2026-01-01 a ...  |
| Membresía anual      Membresía     Activa     2026-01-01 a ...  |
| Curso Excel Básico   Curso         Activa     Sin vencimiento    |
|                                                                 |
| [Ver] [Renovar] [Cancelar]                                      |
+-----------------------------------------------------------------+
```

### Customer subscription creation

```text
+ Nueva suscripción / acceso -------------------------------------+
| Cliente: Supermercado Central                                   |
| Oferta * [Plan Premium Mensual v]                               |
| Tipo: Suscripción                                               |
| Precio snapshot: ₡10,000                                        |
| Inicio [2026-01-01]                                             |
| Fin [2026-02-01]                                                |
| Origen                                                         |
| (x) Crear desde pedido/factura                                  |
| ( ) Activación manual autorizada                                |
|                                                                 |
| [Activar] [Cancelar]                                            |
+-----------------------------------------------------------------+
```

### Subscription detail

```text
+ Suscripción: Plan Premium --------------------------------------+
| Cliente: Supermercado Central                                   |
| Estado: Activa                                                  |
| Vigencia: 2026-01-01 a 2026-02-01                               |
| Precio acordado: ₡10,000                                        |
| Origen: Pedido #100 / Factura INV-100                           |
| Pagos: Ver factura                                              |
|                                                                 |
| Acciones: [Renovar] [Cancelar]                                  |
| Historial                                                       |
| - Activada por pedido #100                                      |
| - Pago aprobado ...                                             |
+-----------------------------------------------------------------+
```

## 23. Mixed order UX

```text
+ Pedido #100 -----------------------------------------------------+
| Cliente: Supermercado Central                                   |
| Bodega: BOD-PT (solo requerida por items con inventario)         |
|                                                                 |
| Producto               Tipo              Cant.  Inventario       |
| Café bolsa             Producto físico   10     Reserva requerida|
| Instalación            Servicio          1      No aplica        |
| Plan Premium           Suscripción       1      No aplica        |
|                                                                 |
| Resumen inventario                                              |
| - Café bolsa: disponible 50, se reservarán 10                   |
| - 2 items no usan inventario                                    |
|                                                                 |
| Total: ₡_____                                                   |
| [Aprobar] [Rechazar]                                            |
+-----------------------------------------------------------------+
```

After approval/payment/dispatch:

```text
+ Pedido #100 - Estado -------------------------------------------+
| Inventario                                                      |
| Café bolsa: Reservado / Despachado                              |
| Instalación: No aplica                                          |
| Plan Premium: No aplica                                         |
|                                                                 |
| Suscripciones/accesos                                           |
| Plan Premium: Pendiente de activación / Activa                  |
|                                                                 |
| Factura: INV-100  Pago: Pendiente/Aprobado                      |
+-----------------------------------------------------------------+
```

## 24. Required target flows

### A. Sell a physical product

| Area | Target behavior |
|---|---|
| Product | `productNature=GOOD`, `controlsInventory=true`. |
| Order | Item added; warehouse required at approval/dispatch if inventory line exists. |
| Inventory | Validate availability, reserve on approval, consume on dispatch, create movements. |
| Invoice | Includes physical product line. |
| Payment | Pays invoice. |
| Customer lifecycle | None unless separately configured. |
| Final state | Stock reduced; invoice/payment history preserved. |

### B. Sell a service

| Area | Target behavior |
|---|---|
| Product | `productNature=SERVICE`, `controlsInventory=false`, `commercialBehavior=STANDARD`. |
| Order | Item added without warehouse/stock requirement. Approval may still be required. |
| Inventory | No validation, reservation, movement, or dispatch. |
| Invoice | Includes service line. |
| Payment | Pays invoice. |
| Customer lifecycle | None in MVP. |
| Final state | Financial sale recorded; no inventory records. |

### C. Sell a subscription

| Area | Target behavior |
|---|---|
| Product | SERVICE, no inventory, ENTITLEMENT, SUBSCRIPTION, default validity/cadence. |
| Order | Item added; no warehouse/stock. |
| Inventory | No operation. |
| Invoice | Includes subscription charge line. |
| Payment | Pays invoice; payment approval may trigger activation depending policy. |
| Customer lifecycle | Create/activate `CustomerEntitlement` for validity period. |
| Final state | Entitlement active or pending activation; no stock records. |

### D. Sell annual membership/affiliation

| Area | Target behavior |
|---|---|
| Product | SERVICE, ENTITLEMENT, MEMBERSHIP or AFFILIATION, default validity 1 year. |
| Order | Item added without inventory. |
| Inventory | No operation. |
| Invoice | Includes membership/affiliation line. |
| Payment | Pays invoice. |
| Customer lifecycle | Entitlement active for one year. |
| Final state | Membership/affiliation visible under customer. |

### E. Sell a course

| Area | Target behavior |
|---|---|
| Product | SERVICE, ENTITLEMENT, COURSE. |
| Order | Item added without inventory. |
| Inventory | No operation. |
| Invoice | Includes course charge. |
| Payment | Pays invoice. |
| Customer lifecycle | Course entitlement/access visible under customer. |
| Final state | Customer has course access; no LMS/capacity. |

### F. Mixed order: physical + service

| Area | Target behavior |
|---|---|
| Product | One inventory item; one service item. |
| Order | Single order allowed. |
| Inventory | Reserve/dispatch physical item only. |
| Invoice | Both lines included. |
| Payment | Pays total invoice. |
| Customer lifecycle | None for service. |
| Final state | Physical stock consumed; service recorded financially. |

### G. Mixed order: physical + subscription

| Area | Target behavior |
|---|---|
| Product | Inventory item plus entitlement product. |
| Order | Single order allowed. |
| Inventory | Reserve/dispatch physical item only. |
| Invoice | Both lines included. |
| Payment | Pays invoice. |
| Customer lifecycle | Subscription entitlement created/activated by approved policy. |
| Final state | Stock consumed; entitlement active/pending; payment history preserved. |

### H. Renew a subscription/membership

| Area | Target behavior |
|---|---|
| Product | Existing entitlement offering. |
| Order | Renewal creates order or invoice line for renewal period. |
| Inventory | No operation. |
| Invoice | Renewal charge line. |
| Payment | Pays renewal invoice. |
| Customer lifecycle | Extend existing entitlement or create successor record. MVP recommends extension with audit. |
| Final state | New end date / active period. |

### I. Cancel a subscription

| Area | Target behavior |
|---|---|
| Product | Unchanged. |
| Order | Historical orders unchanged. |
| Inventory | No operation. |
| Invoice | Historical invoices unchanged. |
| Payment | Historical payments unchanged. |
| Customer lifecycle | Entitlement status set to `CANCELLED`, `cancelledAt` recorded. |
| Final state | Customer no longer active; financial records preserved. |

## 25. ASCII target domain diagram

```text
                         +----------------+
                         |    Product     |
                         |----------------|
                         | productNature  |
                         | controlsInv.   |
                         | behavior       |
                         | entitlementKind|
                         +-------+--------+
                                 |
             +-------------------+-------------------+
             |                                       |
 controlsInventory=true                    controlsInventory=false
             |                                       |
+------------v-------------+          +--------------v-------------+
| Inventory domain          |          | Commercial non-inventory    |
|---------------------------|          | offering                    |
| Warehouse/Location        |          |-----------------------------|
| Stock                     |          | Service sale                |
| Lot                       |          | Subscription offering       |
| Movement                  |          | Membership/Affiliation      |
+------------+-------------+          | Course access               |
             |                        +--------------+--------------+
             |                                       |
             v                                       v
        OrderItem --------------------------> CustomerEntitlement
             |                               (only entitlement products)
             v
          Order
             |
             v
        Invoice / InvoiceItem
             |
             v
          Payment
```

## 26. Domain invariants

- INV-001: `controlsInventory=false` products never create inventory reservations.
- INV-002: `controlsInventory=false` products never create inventory stock movements.
- INV-003: `controlsInventory=false` products never require warehouse/location assignment.
- INV-004: `controlsInventory=false` products never require lot or expiration tracking.
- INV-005: `requiresExpiration=true` implies `requiresLot=true` and `controlsInventory=true`.
- INV-006: `allowedWarehouseIds` is only meaningful for `controlsInventory=true` products.
- INV-007: Non-physical products must not be represented by virtual warehouses, fake stock, or fake lots.
- INV-008: Virtual inventory locations represent logical/physical inventory placement only, not services, subscriptions, memberships, affiliations, or courses.
- INV-009: `COURSES_VIRTUAL` and `AFFILIATIONS_VIRTUAL` must not be offered for new product modeling.
- INV-010: Payments pay invoices and do not directly pay products or entitlements.
- INV-011: Entitlement cancellation must not delete or mutate historical invoices/payments.
- INV-012: Product price changes must not mutate historical orders, invoices, payments, or active entitlement price snapshots.
- INV-013: Mixed orders reserve/consume inventory only for inventory-controlled lines.
- INV-014: Entitlement payment status is derived from linked invoice/payment; it is not a duplicate payment ledger.
- INV-015: Course MVP access must not create inventory lots or stock capacity records.

## 27. Decision records

### DEC-001 Product taxonomy

**Decision:** Use `productNature=GOOD|SERVICE` plus independent capabilities and UI presets.

**Rationale:** Avoids overloading Product with lifecycle labels while giving business users simple choices.

**Alternatives rejected:** `GOOD|SERVICE|SUBSCRIPTION|MEMBERSHIP`; keep current `productType`; separate Product/Offering rewrite.

**Backend impact:** Add validated fields or equivalent; migrate/keep legacy `productType` carefully.

**Frontend impact:** Product form becomes preset-driven with progressive disclosure.

**Migration impact:** Existing products default conservatively to physical/good inventory-controlled unless evidence/manual review says otherwise.

### DEC-002 `controlsInventory`

**Decision:** Persist `controlsInventory` as boolean on Product.

**Rationale:** The inventory boundary is binary; tracking details belong in separate flags/mode.

**Alternatives rejected:** Derive from product type/category; encode all tracking states in one enum only.

**Backend impact:** Product schema/service/repository/order/inventory changes.

**Frontend impact:** Product form and inventory summaries change.

**Migration impact:** Existing stock-bearing products must remain inventory-controlled.

### DEC-003 Subscription modeling

**Decision:** Subscription is an entitlement commercial behavior/offering, not a low-level product kind.

**Rationale:** Product describes plan; customer lifecycle record describes active subscription.

**Alternatives rejected:** Subscription only as productType; full recurring billing platform.

**Backend impact:** Add Product offering metadata and CustomerEntitlement domain.

**Frontend impact:** Product subscription configuration and customer subscription views.

**Migration impact:** None for existing subscription data because runtime subscriptions do not exist; virtual warehouse usage must be audited.

### DEC-004 Membership/Affiliation modeling

**Decision:** Reuse CustomerEntitlement with `entitlementKind=MEMBERSHIP|AFFILIATION`.

**Rationale:** MVP lifecycle matches subscription validity/renewal; repository has no separate implemented affiliation domain.

**Alternatives rejected:** Separate CustomerMembership/ClientAffiliation in MVP; virtual lot/warehouse plan.

**Backend impact:** Same entitlement model.

**Frontend impact:** UI labels can remain membership/affiliation-specific.

**Migration impact:** Audit legacy `AFFILIATIONS_VIRTUAL` rows before cleanup.

### DEC-005 Course modeling

**Decision:** Course MVP is non-inventory entitlement offering, not LMS/course-capacity domain.

**Rationale:** No runtime CourseOffering/CourseEnrollment exists; capacity/scheduling are out of scope.

**Alternatives rejected:** Virtual course warehouse/lots; full LMS.

**Backend impact:** Same entitlement model; future Course spec can extend.

**Frontend impact:** Product preset “Curso” and customer course access list.

**Migration impact:** Audit legacy `COURSES_VIRTUAL` rows before cleanup.

### DEC-006 Customer lifecycle entity

**Decision:** Use `CustomerEntitlement` as target domain name.

**Rationale:** Represents customer-owned rights/access/validity across subscriptions, memberships, affiliations, and simple courses without inventing separate engines.

**Alternatives rejected:** `CustomerSubscription` only; `CustomerOffering`; separate entities per use case for MVP.

**Backend impact:** New table/service/API needed.

**Frontend impact:** Customer detail active subscriptions/access section.

**Migration impact:** New data only initially.

### DEC-007 Activation trigger

**Decision:** Exact default activation trigger is DECISION NEEDED. Recommended safe policy: activate after payment approval for cash/transfer; activate after invoice/order approval for credit if business permits; allow manual admin activation.

**Rationale:** Current payment lifecycle includes pending approval; activating too early can grant unpaid access.

**Alternatives rejected:** Always activate on order approval; always require payment even for credit.

**Backend impact:** Entitlement activation must listen to/coordinate order, invoice, and payment events.

**Frontend impact:** Show pending vs active states if policy requires.

**Migration impact:** None.

### DEC-008 Renewal

**Decision:** MVP renewal is manual.

**Rationale:** Avoid scheduler/billing engine complexity.

**Alternatives rejected:** Automatic recurring billing in MVP.

**Backend impact:** Renewal endpoint/action later; no job required in MVP.

**Frontend impact:** Customer entitlement “Renovar” action.

**Migration impact:** None.

### DEC-009 Recurring billing

**Decision:** Automatic recurring invoice generation is deferred.

**Rationale:** Requires background jobs, next billing policy, payment/dunning rules, and invoice item robustness.

**Alternatives rejected:** Build Stripe-like recurring platform now.

**Backend impact:** Future scheduler/job and billing extensions.

**Frontend impact:** MVP labels renewal as manual.

**Migration impact:** Future nullable fields can be added later.

### DEC-010 Virtual warehouses

**Decision:** `COURSES_VIRTUAL` and `AFFILIATIONS_VIRTUAL` are legacy for new modeling; prevent new user-facing creation after migration plan, preserve existing references.

**Rationale:** They represent product concepts as locations, which violates domain boundary.

**Alternatives rejected:** Delete enum immediately; continue using them for courses/affiliations.

**Backend impact:** Schema/warehouse type filtering and migration audit later.

**Frontend impact:** Hide/mark legacy in location creation.

**Migration impact:** Audit tenant usage; explicit migration later.

### DEC-011 Mixed order behavior

**Decision:** Mixed orders are allowed; inventory operations apply per line only when `controlsInventory=true`.

**Rationale:** Real orders can combine goods, services, and subscriptions; forcing separate orders would harm UX.

**Alternatives rejected:** Separate physical and non-physical orders; fake inventory for non-physical lines.

**Backend impact:** Order approval, reservation, release, dispatch, billing, and agent catalog changes.

**Frontend impact:** Order line UI must show inventory applicability and activation states.

**Migration impact:** Existing orders remain legacy; new behavior applies after product capability fields exist.

## 28. Virtual warehouse cleanup strategy

For new data:

- Do not use `COURSES_VIRTUAL` or `AFFILIATIONS_VIRTUAL` for products.
- Hide them from normal create-location UI or mark as legacy/unavailable.
- Keep legitimate virtual locations only for inventory concepts such as logical inventory placement if business confirms.

For existing data:

1. Preserve enum values and warehouse rows.
2. Audit tenant usage: warehouses, lots, stock movements, products/allowed warehouses, orders.
3. Freeze new creation before migration.
4. Create explicit migration plan only after usage is known.
5. Do not delete historical lots/movements/orders.

## 29. Inventory Target UX integration decisions

Return these decisions to `specs/inventory-target-ux/`:

| Topic | Decision | Inventory spec impact |
|---|---|---|
| `controlsInventory` | Persist explicit boolean on Product. | Resolves inventory-control boundary. |
| Product classification | Use product nature + behavior/capabilities, not `PHYSICAL/SUBSCRIPTION/MEMBERSHIP` enum as persistence model. | Update Product form and architecture. |
| Product form | Use UI presets with progressive disclosure. | Non-inventory inventory sections hidden/No aplica. |
| Non-inventory inventory state | Display `Inventario: No aplica`. | Resolved. |
| Virtual locations | Inventory-only concept; never product type workaround. | Resolved. |
| `COURSES_VIRTUAL` | Legacy for new modeling; audit before migration. | Resolved direction, migration remains. |
| `AFFILIATIONS_VIRTUAL` | Legacy for new modeling; audit before migration. | Resolved direction, migration remains. |
| `allowedWarehouseIds` | Only for `controlsInventory=true`; no UI for non-inventory products. | Resolved. |
| Lot configuration | Only for `controlsInventory=true`; stock-only still needs system-lot/backend policy. | Partially resolved; system-lot implementation still needed. |
| Inventory tabs | Non-inventory products should not appear as stock/lots/movements. | Resolved. |

Inventory specification is now unblocked for product/non-physical boundary decisions, but remains blocked for system-lot behavior, location type/nature details, true transfers, and invoice/order implementation dependencies if included in the same phase.

## 30. MVP / Next / Future scope

| Capability | MVP | Next | Future |
|---|---:|---:|---:|
| Service sales | Yes |  |  |
| Non-inventory order lines | Yes |  |  |
| Mixed orders | Yes |  |  |
| Subscription customer lifecycle | Yes, validity/manual |  |  |
| Membership validity | Yes |  |  |
| Course entitlement/access | Yes, simple |  |  |
| Manual renewal | Yes |  |  |
| Activation policy | Yes, after business decision |  |  |
| Invoice line snapshots | Recommended MVP dependency |  |  |
| Automatic recurring billing |  | Yes/P2 |  |
| Pause/resume |  |  | Yes |
| Proration |  |  | Yes |
| Plan changes |  | Yes/P2 |  |
| Trials |  |  | Yes |
| Usage billing |  |  | Yes |
| Discount schedules |  |  | Yes |
| Capacity management |  |  | Yes, course spec |
| Scheduling/classes/teachers |  |  | Yes, course/LMS spec |
| Membership benefits/rules |  |  | Yes |
| Entitlement rules engine |  |  | Yes |

## 31. Backend/API dependencies

| Dependency | Classification | Notes |
|---|---|---|
| Product capability fields | Backend domain change | `controlsInventory`, product nature, behavior, entitlement kind/default validity. |
| Order approval per-line inventory policy | Backend domain change | Reserve only inventory-controlled lines; no warehouse required for non-inventory-only order. |
| Dispatch per-line inventory policy | Backend domain change | Consume only inventory-controlled lines; handle non-inventory-only orders. |
| Agent catalog query | Backend + frontend change | Must include non-inventory catalog products; not only stock availability. |
| CustomerEntitlement table/service/API | New functional capability | Required for subscriptions/memberships/course access. |
| Invoice line snapshots | Backend domain change | Strong MVP dependency for robust mixed/non-physical billing. |
| Payment changes | Mostly unchanged | May expose derived status to entitlement view; no product coupling. |
| Virtual warehouse legacy filtering | Frontend + small API change | Hide/disable course/affiliation virtual types for new creation. |
| System-lot/non-lot stock | Backend domain change | Inventory spec dependency for physical products without business-visible lot tracking. |

## 32. Readiness report: NON-PHYSICAL PRODUCTS TARGET READINESS

| Question / Gap | Answer | Status |
|---|---|---|
| 1. Final recommended Product taxonomy | `productNature=GOOD|SERVICE` plus `controlsInventory`, `commercialBehavior`, `entitlementKind`, default validity/cadence; UI presets hide complexity. | RESOLVED |
| 2. `controlsInventory` representation | Persisted boolean on Product; tracking details separate. | RESOLVED |
| 3. Is Subscription a Product type, capability, or lifecycle? | Product offering behavior plus customer lifecycle; not low-level product kind. | RESOLVED |
| 4. Entity for active customer subscription | `CustomerEntitlement`. | RESOLVED |
| 5. Can Membership/Affiliation reuse it? | Yes for MVP. | RESOLVED |
| 6. Can Course reuse it? | Yes for simple commercial access; LMS/capacity deferred. | RESOLVED |
| 7. Minimum Service MVP | Non-inventory sellable product; order/invoice/payment; no fulfillment status. | RESOLVED |
| 8. Minimum Subscription MVP | Validity-based/manual customer entitlement from non-inventory product offering. | RESOLVED |
| 9. Recurring automatic invoicing in MVP? | No. Manual renewal only. | RESOLVED |
| 10. What activates a subscription? | Policy needed: recommended payment-approved for cash/transfer, invoice/order-approved for credit if business approves, manual override. | DECISION NEEDED |
| 11. Cancellation | Immediate cancellation; preserve invoices/payments/history. | RESOLVED |
| 12. Renewal | Manual renewal via new order/invoice and entitlement extension/successor. | RESOLVED |
| 13. Mixed orders | Allowed; inventory operations per line only. | RESOLVED |
| 14. Order approval changes | Reserve only inventory-controlled lines; no warehouse for non-inventory-only orders; still commercial approval. | RESOLVED |
| 15. Dispatch changes | Consume only inventory-controlled lines; define completion for non-inventory-only orders. | DECISION NEEDED |
| 16. Invoicing changes | Add line-level invoice snapshots for robust MVP; current invoice amount-only is insufficient long-term. | RESOLVED as dependency |
| 17. Payment unchanged? | Yes conceptually; Payment remains invoice-based. | RESOLVED |
| 18. `COURSES_VIRTUAL` / `AFFILIATIONS_VIRTUAL` | Legacy; hide/prevent new product modeling; audit existing data before migration. | RESOLVED direction |
| 19. Inventory UX blockers resolved | Product taxonomy, controlsInventory, non-inventory No aplica, virtual-location boundary, allowedWarehouse semantics. | RESOLVED |
| 20. Decisions still requiring approval | Activation trigger, non-inventory-only order completion/status wording, exact field names, invoice item MVP inclusion. | DECISION NEEDED |
| 21. Ready for implementation spec? | Yes for domain architecture after human approval of the remaining business policies; not ready for code implementation without those approvals. | DECISION NEEDED |

## 33. Remaining human approvals

1. Activation policy for entitlements: payment-approved vs invoice-created vs manual per payment condition.
2. Whether non-inventory-only orders should reuse `DELIVERED` internally or introduce `FULFILLED`/neutral completion status.
3. Exact database/API field names for product nature/behavior/entitlement kind.
4. Whether InvoiceItem is included in MVP implementation or explicitly deferred with limitations.
5. Whether manual entitlement activation is permitted and who can do it.
