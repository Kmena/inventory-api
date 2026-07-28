# Architectural Action Plan

## 1. Objective
Keep architecture-facing documentation synchronized with the real repository state after `p23-repository-test-failure-contract-alignment` and the completed repository-governance follow-up tasks `TASK-026` and `TASK-027`, preserve the reduced supported public runtime plus the interim post-login transition landing, record the now-passing repository-wide aggregate and Redis-path validation baselines, and plan only the remaining bounded follow-up work still visible after implementation.

## 2. Scope
In scope for the current plan:
- preserve the reduced active public runtime under `src/public/`
- preserve the `410 Gone` gate for deprecated legacy HTML routes under `/root/*.html`, `/warehouse/*.html`, and `/agent/*.html`
- preserve relocation of the retired functional legacy browser runtime to `legacy-public-runtime/`
- preserve the supported interim post-login landing at `/migration.html?mode=post-login-transition`
- preserve the dual-mode migration screen behavior for deprecated-route `410` rendering and supported post-login transition rendering
- preserve auth/session backend APIs and the current cookie-session browser model
- preserve the official aggregate test-runner baseline in `scripts/run-tests.js`
- preserve canonical runtime-contract ownership under `docs/**` with `internal-docs/**` retained only as auxiliary support material
- preserve the dedicated Redis-path validation lane through `npm run test:redis-path` and `.github/workflows/redis-browser-session-tests.yml`
- keep docs, validators, manifest metadata, runtime-contract artifacts, and tests aligned to the reduced supported contract
- track remaining follow-up work such as eventual functional replacement of the interim post-login transition landing and optional test-noise cleanup

## 3. Out of scope
- reactivating legacy HTML pages as supported runtime
- implementing the SPA
- redesigning backend auth APIs beyond the already implemented cookie-session model
- changing database schema or migrations for this slice
- production-code changes beyond already implemented `p21` + `p22` + `p23` + `TASK-026` + `TASK-027`

## 4. Requirements addressed
This plan reflects the implemented reduced-runtime baseline plus the `p22` follow-through and `p23` repository-test-alignment requirements observable in code and tests:
- only the reduced supported public pages remain in the active runtime
- deprecated legacy HTML routes under `root/**`, `warehouse/**`, and `agent/**` continue to return the common migration screen from the same URL with HTTP `410 Gone` and no redirect
- post-login browser landings for retired-runtime-dependent roles no longer point to `/root/*.html`, `/warehouse/*.html`, or `/agent/*.html`
- the supported interim post-login landing is `/migration.html?mode=post-login-transition`
- `src/public/migration.html` and `src/public/migration.js` distinguish deprecated-route rendering from supported post-login transition rendering
- validators, tests, manifest metadata, and docs govern the reduced contract and the transition landing explicitly
- `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` remain outside the HTML deprecation scope
- `tests/browser-auth-compatibility-inventory.test.js` now aligns to the reduced supported public runtime instead of retired browser files
- `POST /api/auth/logout` is now explicitly classified in the runtime-contract governance baseline
- reviewed runtime-contract artifacts under `docs/**` are now the canonical governance source, with `internal-docs/**` retained only as auxiliary support material
- `npm run test` now boots a stable default test environment through `scripts/run-tests.js` by defaulting to `NODE_ENV=test` and `BROWSER_SESSION_STORE_MODE=memory` unless explicitly overridden
- the supported Redis-backed browser-session path now has an explicit validation command and hosted CI lane via `npm run test:redis-path` and `.github/workflows/redis-browser-session-tests.yml`

## 5. Current problems addressed
Problems already corrected by `p21` + `p22` + `p23` and the completed governance follow-up tasks:
- active public runtime no longer exposes functional legacy HTML screens beyond the intended supported surface
- `src/public/root/**`, `src/public/warehouse/**`, and `src/public/agent/**` no longer define authenticated post-login landings
- public-runtime validators and tests now distinguish supported post-login transition behavior from deprecated-route `410` behavior
- the browser-compatibility inventory test now matches the approved reduced public runtime
- `POST /api/auth/logout` is no longer left unclassified in runtime-contract governance
- the official aggregate suite no longer depends on callers manually setting test-safe browser-session environment variables
- reviewed `docs/**` artifacts are now the canonical runtime-contract governance source instead of sharing that role with `internal-docs/**`
- the supported Redis-backed browser-session path now has an explicit repeatable validation lane outside the stable memory-mode aggregate suite

Problems still open after `TASK-026` and `TASK-027`:
- the supported post-login landing for retired-runtime-dependent roles remains informational and not yet a functional replacement UI
- focused and aggregate tests can emit expected audit-log noise for database unavailability while still passing
- docs/tests/validators/manifest metadata must continue staying synchronized so legacy runtime is not accidentally reintroduced as supported
- the latest baseline governance audit is acceptable at `8.8/10`, but the warning below the `9.5` target shows residual governance hardening work remains

## 6. Domains affected
- Embedded browser runtime
- Identity and access
- Repository/platform governance
- CI/workflow governance
- Cross-cutting architecture documentation

## 7. Behavior to preserve
- `src/public/` remains the only active public runtime directory
- supported HTML remains limited to `/`, `/index.html`, `/no-access.html`, and `/migration.html`
- deprecated legacy HTML routes keep returning `410 Gone` and the migration screen from the same URL without redirect
- `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` remain supported
- `legacy-public-runtime/` remains outside the served runtime
- public-runtime governance stays intentionally bounded and does not resume treating `root/**`, `warehouse/**`, or `agent/**` as supported browser runtime
- `npm run typecheck` remains bounded to the approved reduced public-runtime seam (`shared/session.js`, `shared/auth.js`, `login.js`)
- the post-login transition landing remains a supported 200 response distinct from the deprecated-route `410 Gone` contract

## 8. Defects to correct
### Medium
- the interim post-login transition landing in `src/public/login.js` should eventually be replaced by real supported functional destinations
- canonical `docs/**` ownership must stay explicit so auxiliary `internal-docs/**` material does not drift back into perceived source-of-truth status
- Redis-backed browser-session coverage must remain explicit even though the aggregate test runner now defaults to memory mode for stability

### Low
- focused and aggregate tests can emit expected audit-log noise for database unavailability while still passing
- preserved `legacy-public-runtime/` inventory may drift over time because it is no longer governed as active runtime

## 9. Future architectural changes
Incremental future changes now visible:
1. keep the reduced public-runtime baseline as the supported contract;
2. keep legacy HTML deprecation enforced at the HTTP boundary;
3. preserve canonical runtime-contract artifact ownership under `docs/**` unless a later approved governance model explicitly changes it;
4. preserve the aggregate test-runner bootstrap contract (`NODE_ENV=test`, `BROWSER_SESSION_STORE_MODE=memory` by default) unless a later approved slice deliberately changes the test baseline;
5. keep the dedicated Redis-path validation lane explicit rather than folding Redis dependence back into the default aggregate suite;
6. avoid re-expanding typecheck, validator, or runtime support back into retired legacy HTML surfaces;
7. replace the interim post-login transition landing only when approved final supported destinations exist;
8. decide later whether `legacy-public-runtime/` should remain as transition inventory or move to a stronger archival model;
9. optionally reduce expected database-unavailable audit-log noise in focused browser/runtime tests if it begins to hide meaningful failures.

## 10. Database changes
No database change is planned for this post-implementation refresh.

## 11. API and integration changes
No immediate API contract change is planned.

Current integration posture to preserve:
- auth/session APIs remain stable;
- `POST /api/auth/logout` remains part of the governed runtime contract baseline;
- the deprecated legacy HTML contract is now an HTTP `410` response contract, not a redirect contract;
- `legacy-public-runtime/` is not an active integration surface.

## 12. Container and deployment changes
No new container or deployment change is currently required.

Container baseline to preserve:
- `node:24-bullseye-slim`
- multi-stage build
- non-root runtime
- readiness healthcheck
- Redis-backed supported non-test browser-session baseline

## 13. Security changes
Security posture to preserve:
- reduced public browser exposure through removal of functional legacy HTML from the active runtime
- same-origin cookie-session auth model for supported browser flows
- same-origin `Origin` validation for mutating cookie-authenticated requests
- strict CSP on the supported public documents and deprecated legacy HTML responses that serve the migration page

Future security follow-up may include:
- replacing the interim post-login transition landing with final supported routes
- continuing broader HTTPS/cookie hardening and optional test-noise cleanup work
- preserving the browser-session HTTPS migration tracked as a residual risk and follow-up dependency in `specs/p11-https-browser-session-migration/`

## 14. Test strategy
Continue validating the implemented repository baseline through:
1. `npm run validate:public-runtime`
2. `npm run test -- --silent`
3. `npm run lint -- --quiet`
4. `npm run typecheck`
5. `npm run build`
6. focused browser/runtime and contract suites when the slice touches those seams

Recorded post-implementation evidence supplied by the user:
- `node --test tests/runtime-contract-governance.test.js tests/openapi-contract-consistency.test.js tests/critical-contract-governance.test.js` passed
- `npm run lint -- --quiet` passed
- `npm run test:redis-path` passed
- `npm run validate:workflow-baseline` passed
- `node --test tests/workflow-baseline-characterization.test.js` passed
- `npm run test -- --silent` passed
- baseline governance audit score: `8.8/10` (acceptable, no meaningful regression found; warning remains below `9.5`)

Test-baseline notes to preserve:
- `npm run test` now routes through `scripts/run-tests.js`
- the runner defaults to `NODE_ENV=test` and `BROWSER_SESSION_STORE_MODE=memory` unless explicitly overridden
- `npm run test:redis-path` and `.github/workflows/redis-browser-session-tests.yml` preserve explicit coverage for the supported Redis-backed non-default path
- `tests/p2-hardening-constraints.test.js` remains environment-gated outside the plain aggregate path
- passing runs can still emit expected database-unavailable audit noise

## 15. Migration stages
### Stage 1 — Completed
- Reduce the active public runtime to the supported minimal baseline in `src/public/`

### Stage 2 — Completed
- Introduce the common migration response for deprecated legacy HTML routes with `410 Gone` and no redirect

### Stage 3 — Completed
- Relocate the preserved functional legacy runtime to `legacy-public-runtime/`

### Stage 4 — Completed
- Rewrite public-runtime validators and tests to govern the reduced supported contract

### Stage 5 — Completed
- Refresh repository documentation to match the reduced runtime state

### Stage 6 — Completed
- Replace historical post-login HTML aliases with the supported interim transition landing at `/migration.html?mode=post-login-transition` and distinguish that mode from deprecated-route `410` rendering

### Stage 7 — Completed
- Realign repository test and runtime-contract governance to the reduced supported runtime, classify `POST /api/auth/logout`, and stabilize the aggregate test runner bootstrap through `scripts/run-tests.js`

### Stage 8 — Completed
- Converge canonical runtime-contract governance onto reviewed `docs/**` artifacts and keep `internal-docs/**` auxiliary only

### Stage 9 — Completed
- Add the explicit Redis-path validation command and hosted workflow lane while preserving the stable memory-mode aggregate suite

### Stage 10 — Proposed
- Replace the interim post-login transition landing with real supported destinations once the next approved browser shell or SPA entrypoints exist

### Stage 11 — Proposed
- Reduce expected database-unavailable audit-log noise if it begins to hide meaningful failures or blocks governance-score improvement

## 16. Risks and mitigations
| Risk | Level | Mitigation |
|---|---|---|
| Legacy HTML runtime is accidentally reintroduced into `src/public/` or treated as supported again | High | Keep `validate-public-runtime`, browser/runtime characterization tests, and docs aligned to the reduced inventory |
| Future work expands typecheck/runtime governance back into retired legacy pages | Medium | Preserve bounded allowlist and explicit task guidance against re-expansion |
| Interim post-login transition landing can still frustrate users because it remains informational only | Medium | Keep the behavior documented now and replace the transition landing only when approved supported destinations exist |
| Future changes accidentally collapse supported post-login transition mode back into deprecated-route semantics | Medium | Keep dual-mode migration rendering covered by validator, smoke tests, browser tests, and docs/manifest updates |
| Auxiliary `internal-docs/**` material is mistakenly treated as canonical contract truth again | Medium | Keep authoritative runtime-contract governance under reviewed `docs/**` artifacts and limit `internal-docs/**` to non-canonical support material |
| Memory-mode defaults hide regressions in the supported Redis-backed browser-session path | Medium | Preserve explicit Redis-path tests/CI and document that aggregate stability defaults do not replace non-default-path validation |
| Acceptable-but-subtarget governance scoring (`8.8/10`) is misread as full closure | Medium | Keep the warning visible in architecture-facing docs and limit future claims to “acceptable with residual warning” until the score improves |
| Expected database-unavailable audit-log noise obscures real test failures | Low | Keep the issue documented and reduce or isolate the noise if it begins to hide meaningful failures |
| Preserved `legacy-public-runtime/` inventory drifts or is misread as active support | Low | Keep docs explicit that it is preserved inventory outside the active runtime |

## 17. Rollback or recovery strategy
- Do not reactivate legacy HTML runtime from `legacy-public-runtime/` as an implicit rollback.
- If future follow-up work regresses the reduced runtime contract, revert only the affected documentation/governance or bounded landing-route slice.
- Preserve the current `410 Gone` gate, reduced `src/public/` inventory, and supported post-login transition landing unless a new approved spec explicitly changes the supported browser contract.

## 18. Manual validation
For future follow-up work, manually confirm:
- `src/public/` still contains only the reduced supported inventory
- `legacy-public-runtime/` remains outside the served runtime
- representative legacy HTML routes under `root`, `warehouse`, and `agent` still return the migration response with HTTP `410 Gone` and no redirect
- `/`, `/index.html`, `/no-access.html`, and `/migration.html` still load successfully
- `/migration.html?mode=post-login-transition` still behaves as the supported interim post-login landing and hides the 410 status note
- `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` still behave as supported
- `login.js` landing behavior is documented as the approved interim transition landing until a later slice defines final functional destinations
- `npm run test -- --silent` still passes under the official runner baseline
- `npm run test:redis-path` and `npm run validate:workflow-baseline` still pass when touching repository governance or browser-session storage seams
- validators/tests/manifest metadata still govern the reduced public-runtime contract rather than retired legacy pages
- canonical runtime-contract artifacts remain under `docs/**` and any auxiliary `internal-docs/**` material does not compete with them

## 19. Approval status
**Status:** Documentation refresh now reflects the implemented `p21` + `p22` browser-runtime posture, `p23` repository-test alignment, and the completed governance follow-up tasks `TASK-026` and `TASK-027`. The repository now documents the reduced supported public runtime, the `410 Gone` gate for deprecated legacy HTML routes, relocation of the functional legacy browser runtime to `legacy-public-runtime/`, the approved interim post-login transition landing at `/migration.html?mode=post-login-transition`, explicit runtime-contract coverage for `POST /api/auth/logout`, canonical runtime-contract ownership under `docs/**`, the auxiliary-only role of `internal-docs/**`, the stable aggregate test baseline behind `npm run test`, and the explicit Redis-path validation lane. Remaining future work is limited to final functional replacement of the transition landing and optional signal-improvement cleanup such as reducing expected test noise and improving the governance score beyond the current acceptable `8.8/10`.
