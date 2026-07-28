# Domain Analysis
## Scope boundary
Este spec cubre la migración real del baseline runtime/CI a Node.js 24 LTS. No cubre cierres de tenant isolation, repository boundary ni expansión general de typecheck salvo donde la validación de plataforma lo toque indirectamente.

## Affected domain concepts
- **Runtime baseline:** versión Node usada por app, scripts y contenedor.
- **Prisma bootstrap compatibility:** compatibilidad entre Node 24, cliente Prisma generado y patrón actual CommonJS.
- **CI baseline:** versión Node usada por jobs obligatorios y de release.
- **Recovery path:** capacidad de revertir o aislar regresiones de plataforma sin ambigüedad.

## Actors and goals
- **Platform maintainer:** mover el baseline a Node 24 con evidencia real.
- **Backend implementer:** resolver incompatibilidades de Prisma/tooling sin romper comportamiento externo.
- **Architecture reviewer:** confirmar que el cambio es acotado y trazable a P0-003.
- **QA/reviewer:** verificar validaciones mínimas por plataforma relevantes.

## Business rules in domain terms
- No basta con cambiar versiones declarativas; la plataforma debe probar build y runtime reales.
- Los fallos Node 24 deben clasificarse como regresiones de migración, no mezclarse con el rename-lock Windows preexistente.
- Cualquier actualización de dependencias debe tener razón explícita ligada a compatibilidad Node 24.
- El cambio debe preservar el contrato externo de la aplicación.

## Boundaries and invariants
- `package.json`, `Dockerfile` y workflows son parte del contrato de baseline y deben moverse coordinadamente.
- `src/lib/prisma.js` y scripts de Prisma son el boundary técnico principal para la incompatibilidad observada.
- La validación mínima bajo Node 24 debe cubrir Linux CI y, cuando aplique, Windows Prisma build y Docker/runtime smoke.

## Known unknowns
- Si el error `PrismaClient is not a constructor` se resuelve solo con upgrade de Prisma o también requiere cambios en bootstrap/import patterns.
- Si Playwright o dependencias auxiliares requerirán ajustes menores adicionales bajo Node 24.
- Si el workflow Windows seguirá fallando solo por rename-lock baseline o revelará un modo de fallo nuevo bajo Node 24.

## Recommended framing
Tratar este substream como migración de baseline soportado con foco en compatibilidad Prisma/runtime. El éxito no es “usar Node 24”, sino poder demostrar que la cadena package -> build -> runtime -> Docker -> CI funciona o que cualquier excepción restante queda aislada y aprobada.
