# Advisor Review

## 1. Source
Basado en:
- `docs/audit/audit.json`
- revisión del estado actual documentado en `current-state.md`
- decisiones aprobadas en `decisions.md`

## 2. Findings reviewed

### AUD-001: Tenant isolation inconsistente en clientes
- **Status:** Accepted
- **Reason:** Defecto crítico de seguridad con impacto cross-tenant.
- **Planned handling:** Aplicar scoping por `companyId` en lectura, actualización y eliminación de clientes.

### AUD-002: Tenant isolation inconsistente en facturas
- **Status:** Accepted
- **Reason:** Exposición y mutación de facturas fuera del tenant.
- **Planned handling:** Derivar tenant vía `Invoice -> Client.companyId` y validar referencias.

### AUD-003: Tenant isolation inconsistente en pagos
- **Status:** Accepted
- **Reason:** Pagos pueden operar sobre facturas de otra empresa.
- **Planned handling:** Derivar tenant vía `Payment -> Invoice -> Client.companyId`.

### AUD-012: Exposición pública de documentos
- **Status:** Accepted
- **Reason:** Riesgo crítico de fuga documental.
- **Planned handling:** Mover documentos a almacenamiento privado y servirlos por endpoint autenticado.

### AUD-013: Logging sensible en ambientes no-dev
- **Status:** Accepted
- **Reason:** Riesgo de exposición de detalles internos y datos sensibles.
- **Planned handling:** Reducir logging fuera de `development`.

## 3. Deferred or out-of-scope findings
- Paginación de listados: Deferred
- Hardening completo de Docker/runtime: Deferred
- Soft delete uniforme: Deferred
- Rate limiting de login: Deferred

## 4. Reviewer conclusion
Los hallazgos aceptados están correctamente incorporados al alcance P0 de estabilización y trazados en:
- `requirements.md`
- `architecture.md`
- `implementation-plan.md`
- `tasks.md`

## 5. Notes for implementation
- No implementar hallazgos fuera de este alcance.
- No rediseñar arquitectura más allá de cambios incrementales en `routes -> services -> repositories`.
- Mantener evidencia por tarea en `traceability.md` e `implementation-report.md`.
