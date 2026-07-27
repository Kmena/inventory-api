# Decisions

## Planning decisions
1. Este spec es follow-up del cierre de workflow governance/restore readiness.
2. `.env.production.example` se asume artefacto contractual real salvo evidencia en contra.
3. El objetivo preferido es que `validate:operational-readiness` siga el mismo modelo público que restore readiness.

## Resolved decision
### OD-001
**Decision provided by human direction:** basta inicialmente con `docs/production-baseline.md` + `docs/production-operations-runbook.md` para el contrato público de operational readiness.

**Conditional rule for a third document:** solo crear un documento público adicional si durante la implementación aparece alguna de estas señales:
- el validador necesita reglas operativas que no caben claramente en los 2 docs actuales;
- observabilidad, hardening y readiness quedan mezclados de forma confusa;
- los tests/documentación terminan demasiado ambiguos para auditar.
