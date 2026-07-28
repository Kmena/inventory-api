# Heavy Endpoints Baseline

## Scope
This baseline governs the initial P7 prioritized endpoints:
- `GET /api/agent/stores`
- `GET /api/agent/stores/:storeId`
- `GET /api/clients`
- `GET /api/clients/company`
- `GET /api/invoices/inconsistencies`
- `GET /api/inventory/stocks`
- `GET /api/payments`
- `POST /api/products/import`

## Artifact
- Machine-readable baseline: `docs/heavy-endpoints-baseline.json`

## Interpretation
- `payloadClass` classifies the governed endpoint according to the approved initial workload expectations.
- `responseBytes` is derived from representative fixture serialization, not from a production traffic capture.
- `resultCount` is the logical volume used for drift detection:
  - collection length for `items`, `stores` or `invoices`
  - combined `items + lots` for inventory stocks
  - total `created + updated + skipped` for product import summaries
  - `1` for governed single-resource detail responses
- `responseShape` and `costDrivers` explain why the endpoint is treated as heavy in this phase.

## Drift detection
`tests/heavy-endpoint-governance.test.js` validates that:
- the prioritized endpoint set remains aligned with the approved specification;
- concrete runtime paths normalize to the governed route patterns;
- the middleware captures `endpointKey`, `routePattern`, `payloadClass`, `responseBytes`, `resultCount` and `responseShape` for governed JSON responses;
- the baseline JSON stays aligned with the representative fixtures used by the governance tests.

## Current limitation
This first phase is a factual, versioned baseline for drift detection. It does not yet impose hard latency budgets or production APM thresholds.
