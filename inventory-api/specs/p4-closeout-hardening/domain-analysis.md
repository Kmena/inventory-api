# Domain Analysis

## 1. Domain overview
This closeout affects cross-cutting technical domains rather than introducing a new business feature. The main impacted domains are:
- repository documentation and traceability
- financial derived-state correctness
- authorization governance
- quality automation
- release/build automation

## 2. Domain boundaries
### 2.1 Documentation and traceability domain
**Purpose:** keep repository evidence auditable and navigable.

**Current issue:** active and derived docs refer to missing `specs/p3-*` and `specs/p4-*` artifacts.

**Business impact:** inability to reconstruct approved change intent and closure from the repository alone.

### 2.2 Financial derived-state domain
**Purpose:** compute invoice applied/pending amounts and approval overpayment checks.

**Current issue:** persistence uses `Decimal`, but derived logic converts to `Number` in:
- `src/services/invoice-financial-state.js`
- `src/services/payment.service.js`
- `src/services/agent-workspace.service.js`

**Business impact:** monetary drift risk in approval and debt visibility logic.

### 2.3 Authorization governance domain
**Purpose:** control access to platform/global and tenant-level operations.

**Current issue:** mixed role-based and permission-based guards across nearby routes and domains.

**Business impact:** governance difficulty, harder reviewability, greater chance of inconsistent future access changes.

### 2.4 Quality automation domain
**Purpose:** ensure repeatable lint/type/test validation.

**Current issue:** no versioned CI workflow and test execution depends on manual file enumeration.

**Business impact:** silent omission of new tests and operational dependence on local/manual verification.

### 2.5 Release automation domain
**Purpose:** produce reproducible build outputs for future releases.

**Current issue:** no versioned release/build publication workflow.

**Business impact:** release preparation remains manual and less auditable.

## 3. Core domain entities and concepts
### 3.1 Financial concepts
- Invoice amount
- Approved payments
- Applied amount
- Pending amount
- Overpayment prevention
- Paid-at derivation

### 3.2 Access concepts
- Global roles (`root`)
- Legacy administrative role boundaries (`admin`)
- Tenant-granular permissions
- Transition candidates from role to permission

### 3.3 Delivery concepts
- Quality gate
- Artifact
- Version tag
- Published image
- No-deploy release boundary

## 4. Confirmed domain invariants
- Database monetary fields already use Prisma `Decimal`.
- Global/platform boundaries still rely on role semantics in current routes.
- Fine-grained tenant actions already have a permission model available in parts of the system.
- The current suite uses `node:test` and can be standardized without changing product semantics.
- CD scope approved for this initiative stops before deploy.

## 5. Proposed domain evolution
### 5.1 Documentation domain evolution
From broken references -> to fully navigable spec-backed closure.

### 5.2 Financial domain evolution
From binary-number derived logic -> to deterministic decimal helper backed logic.

### 5.3 Authorization domain evolution
From dispersed mixed guards -> to centrally documented policy with progressive operational migration toward permissions.

### 5.4 Quality domain evolution
From manual local verification -> to versioned CI plus automatic test discovery.

### 5.5 Release domain evolution
From manual build/release preparation -> to controlled build-and-publish automation without deploy.

## 6. Domain rules to preserve
- No widening of effective access during authorization cleanup.
- No change in public HTTP contracts unless separately approved.
- No deploy automation in this initiative.
- No schema migration solely for monetary hardening if `Decimal` reuse is sufficient.

## 7. Domain risks
- Hidden historical reliance on `Number` rounding behavior.
- Difficulty separating role-only routes from permission-transition routes without codifying policy inventory.
- Drift between root-level and nested spec locations if both remain in use.

## 8. Domain conclusion
This initiative is a cross-cutting hardening and closeout package. The highest-value domain changes are:
1. documentation repair
2. monetary correctness hardening
3. authorization governance centralization
4. CI/test automation
5. build/publication automation without deploy
