# DEF-PRD-002 — Checklist de validación manual E2E
**Flujo:** QA rejection → REPLACEMENT_RECOVERY → same-lot execution gate → reconciliation
**Objetivo:** Ejecutar los 5 pasos del §18 del action-plan y registrar evidencia de que el flujo completo funciona.
**Estado:** ⬜ Pendiente — completar cada ítem y anotar los IDs reales obtenidos.

---

## Variables que vas a ir llenando

```
BASE_URL=http://localhost:3000
COOKIE=""                   # se llena en el paso 0
ORDER_ID=""                 # se llena en el paso 2
PROCESSING_STAGE_ID=""      # se llena en el paso 3 (GET order)
RECOLECTION_ID=""           # se llena en el paso 5 (response del inspection)
PRODUCT_ID=""               # producto de la receta con stock
LOT_ID_CORRECTO=""          # lote confirmado en el paso 6
LOT_ID_INCORRECTO=""        # cualquier otro lotId que exista en el sistema
```

---

## Paso 0 — Autenticación

```bash
curl -s -c /tmp/inv-cookie.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"TU_EMAIL","password":"TU_PASSWORD"}' | jq .
```

- [ ] Respuesta `200` con `{ user: { ... } }`
- [ ] Guardá la cookie: `COOKIE=$(cat /tmp/inv-cookie.txt | grep -o 'session=\S*')`

> Si el server usa JWT en header en lugar de cookie, ajustá todos los `-b /tmp/inv-cookie.txt` por `-H "Authorization: Bearer TU_TOKEN"`.

---

## Paso 1 — Encontrar una orden IN_PROGRESS (o crearla)

### Opción A: buscar una orden existente
```bash
curl -s -b /tmp/inv-cookie.txt "$BASE_URL/api/production/orders" | jq '.[] | select(.status=="IN_PROGRESS") | {id, status, stages: [.stages[]|{id,name,stageType,status}]}'
```

- [ ] Anotá `ORDER_ID` de una orden `IN_PROGRESS` que tenga una etapa `PROCESSING` sin ejecutar.
- [ ] Anotá `PROCESSING_STAGE_ID` = el `id` de esa etapa PROCESSING.

### Opción B: crear orden desde cero
> Necesitás: `recipeVersionId` aprobado, `productId`, `originWarehouseId`, `destinationWarehouseId`, `responsibleUserId`, y un lote con stock.

```bash
# 1. Crear
curl -s -b /tmp/inv-cookie.txt -X POST "$BASE_URL/api/production/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": TU_PRODUCT_ID,
    "recipeVersionId": TU_RECIPE_VERSION_ID,
    "quantity": 10,
    "originWarehouseId": TU_WAREHOUSE_ORIGEN_ID,
    "destinationWarehouseId": TU_WAREHOUSE_DESTINO_ID,
    "responsibleUserId": TU_USER_ID,
    "productionLotCode": "TEST-DEF-PRD-002"
  }' | jq '{id, status}'

# 2. Submit
curl -s -b /tmp/inv-cookie.txt -X POST "$BASE_URL/api/production/orders/$ORDER_ID/submit" | jq '{id, status}'

# 3. Approve
curl -s -b /tmp/inv-cookie.txt -X POST "$BASE_URL/api/production/orders/$ORDER_ID/approve" \
  -H "Content-Type: application/json" -d '{}' | jq '{id, status}'

# 4. Start
curl -s -b /tmp/inv-cookie.txt -X POST "$BASE_URL/api/production/orders/$ORDER_ID/start" | jq '{id, status}'
```

- [ ] Orden en estado `IN_PROGRESS`
- [ ] `ORDER_ID` anotado
- [ ] `PROCESSING_STAGE_ID` anotado (ver etapas con `GET /api/production/orders/$ORDER_ID`)

---

## Paso 2 — Ejecutar la etapa PROCESSING (con consumos)

> Reemplazá `PRODUCT_ID`, `LOT_ID_CORRECTO` y los timestamps.

```bash
curl -s -b /tmp/inv-cookie.txt \
  -X POST "$BASE_URL/api/production/orders/$ORDER_ID/stages/$PROCESSING_STAGE_ID/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "startedAt": "2026-09-02T08:00:00Z",
    "endedAt":   "2026-09-02T10:00:00Z",
    "consumptions": [
      {
        "productId": '"$PRODUCT_ID"',
        "lotId":     '"$LOT_ID_CORRECTO"',
        "quantity":  5
      }
    ],
    "waste": [],
    "actualParameters": [],
    "evidence": []
  }' | jq '{id, status}'
```

- [ ] Respuesta `200` o `201`, etapa queda en estado `COMPLETED` o `EXECUTED`
- [ ] Anotá el `id` de la ejecución si aparece en la respuesta (puede servir para troubleshooting)

---

## Paso 3 — ✅ AC-1: Rechazar la etapa SIN consumos directos en la inspección

> Este paso valida que el `relevantInputScope` incluye materiales de etapas previas aunque la inspección no tenga consumos propios.

```bash
curl -s -b /tmp/inv-cookie.txt \
  -X POST "$BASE_URL/api/production/orders/$ORDER_ID/stages/$PROCESSING_STAGE_ID/inspections" \
  -H "Content-Type: application/json" \
  -d '{
    "result": "REJECTED",
    "observations": "Material contaminado, requiere reposicion. Test DEF-PRD-002.",
    "requiresReplacementStage": true,
    "replacementItems": [
      {
        "productId": '"$PRODUCT_ID"',
        "quantity": 5,
        "unit": "KG",
        "notes": "Reponer lote danado"
      }
    ]
  }' | jq '.'
```

- [ ] Respuesta `200` con `result: "REJECTED"`
- [ ] El campo `relevantInputScope` **no está vacío** — contiene los materiales consumidos en etapas previas
- [ ] El campo `requiresReplacementStage: true` aparece en la respuesta
- [ ] Anotá `RECOLECTION_ID` desde `response.recolectionStage.id` o hacé `GET /api/production/orders/$ORDER_ID` y buscá la etapa con `recoveryType: "REPLACEMENT_RECOVERY"`

```bash
# Para encontrar RECOLECTION_ID:
curl -s -b /tmp/inv-cookie.txt "$BASE_URL/api/production/orders/$ORDER_ID" \
  | jq '.recolectionStages[] | select(.recoveryType=="REPLACEMENT_RECOVERY") | {id, status, recoveryType}'
```

- [ ] `RECOLECTION_ID` anotado

---

## Paso 4 — ✅ AC-2: Verificar que la etapa REPLACEMENT_RECOVERY aparece en el warehouse UI

```bash
curl -s -b /tmp/inv-cookie.txt "$BASE_URL/api/production/orders/$ORDER_ID" \
  | jq '{
      id,
      status,
      recolectionStages: [.recolectionStages[] | {id, recoveryType, status, entries: .entries}]
    }'
```

- [ ] Existe al menos una entrada en `recolectionStages` con `recoveryType: "REPLACEMENT_RECOVERY"`
- [ ] Esa etapa está en estado `PENDING` o similar (aún no confirmada)
- [ ] Si tenés el warehouse UI abierto en el browser: la tarjeta de la orden muestra la sección de reposición

---

## Paso 5 — ✅ AC-3: Confirmar la recuperación con entradas por lote

```bash
curl -s -b /tmp/inv-cookie.txt \
  -X POST "$BASE_URL/api/production/orders/$ORDER_ID/recolections/$RECOLECTION_ID/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Confirmacion de reposicion con lote de reemplazo. Test DEF-PRD-002.",
    "entries": [
      {
        "productId": '"$PRODUCT_ID"',
        "lotId":     '"$LOT_ID_CORRECTO"',
        "quantity":  5,
        "unit":      "KG"
      }
    ]
  }' | jq '{status, entries: .entries}'
```

- [ ] Respuesta `200`, etapa de recolección pasa a `COMPLETED`
- [ ] `entries` en la respuesta contiene el lote confirmado
- [ ] Verificá en DB que existen filas en `production_recolection_entries` para este `recolectionId`

---

## Paso 6 — ✅ AC-4: Intentar re-ejecutar con un lote INCORRECTO → debe fallar

> Usá cualquier `LOT_ID_INCORRECTO` que NO sea el que confirmaste en el paso 5.

```bash
curl -s -b /tmp/inv-cookie.txt \
  -X POST "$BASE_URL/api/production/orders/$ORDER_ID/stages/$PROCESSING_STAGE_ID/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "startedAt": "2026-09-02T11:00:00Z",
    "endedAt":   "2026-09-02T12:00:00Z",
    "consumptions": [
      {
        "productId": '"$PRODUCT_ID"',
        "lotId":     '"$LOT_ID_INCORRECTO"',
        "quantity":  5
      }
    ],
    "waste": [],
    "actualParameters": [],
    "evidence": []
  }' | jq '{statusCode, code, message}'
```

- [ ] Respuesta `400` con `code: "validation_error"`
- [ ] El mensaje menciona que el lote no fue recolectado / no está cubierto por la recuperación

---

## Paso 7 — Re-ejecutar con el lote CORRECTO → debe pasar

```bash
curl -s -b /tmp/inv-cookie.txt \
  -X POST "$BASE_URL/api/production/orders/$ORDER_ID/stages/$PROCESSING_STAGE_ID/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "startedAt": "2026-09-02T11:00:00Z",
    "endedAt":   "2026-09-02T12:00:00Z",
    "consumptions": [
      {
        "productId": '"$PRODUCT_ID"',
        "lotId":     '"$LOT_ID_CORRECTO"',
        "quantity":  5
      }
    ],
    "waste": [],
    "actualParameters": [],
    "evidence": []
  }' | jq '{id, status}'
```

- [ ] Respuesta `200` o `201`, etapa ejecutada correctamente

---

## Paso 8 — ✅ AC-5: Reconciliar el balance recuperado

```bash
curl -s -b /tmp/inv-cookie.txt \
  -X POST "$BASE_URL/api/production/orders/$ORDER_ID/recolections/$RECOLECTION_ID/reconciliation" \
  -H "Content-Type: application/json" \
  -d '{
    "outcomes": [
      {
        "productId": '"$PRODUCT_ID"',
        "lotId":     '"$LOT_ID_CORRECTO"',
        "quantity":  5,
        "outcome":   "USED",
        "notes":     "Cantidad total usada en re-ejecucion. Test DEF-PRD-002."
      }
    ]
  }' | jq '{complete, remainingBalances}'
```

- [ ] Respuesta `200`
- [ ] `complete: true`
- [ ] `remainingBalances` vacío o en cero para todos los productos

---

## Resultado final

| Paso | AC validado | Resultado | Notas |
|---|---|---|------|
| 3 | AC-1: relevantInputScope con materiales previos | ⬜ PASS / FAIL | |
| 4 | AC-2: REPLACEMENT_RECOVERY visible en UI/API | ⬜ PASS / FAIL | |
| 5 | AC-3: confirmación con lot-level entries | ⬜ PASS / FAIL | |
| 6 | AC-4: gate rechaza lote no recuperado (400) | ⬜ PASS / FAIL | |
| 8 | AC-5: reconciliación complete=true | ⬜ PASS / FAIL | |

**Fecha de ejecución:** _______________
**Ejecutado por:** _______________
**Versión del servidor:** _______________
**Todos los pasos PASS:** ⬜ Sí → DEF-PRD-002 puede cerrarse

---

> Una vez que todos los ítems están marcados como PASS, actualizá `docs/current-state.md` §14 removiendo DEF-PRD-002 y `docs/audit/current-code-audit.md` para reflejar el cierre.
