# Tipo de comercio — catálogo base CIIU4 para spec

Fuente base consultada:
- `C:\Users\kmena\Documents\proyectos\inventory-api\docs\CorrespondenciaATVCIIU3-TRIBUCRCIIU4-Completo.pdf`

## Recomendación para el spec

Si el objetivo es clasificar clientes/tiendas por actividad comercial, lo mínimo sano es guardar:

- `tradeTypeCode`: código CIIU4/TRIBU-CR
- `tradeTypeLabel`: descripción normalizada del código

Ejemplo de payload:

```json
{
  "tradeTypeCode": "4772.0",
  "tradeTypeLabel": "Venta al por menor de productos farmacéuticos y medicinales, cosméticos y artículos de tocador en comercios especializados"
}
```

## Decisión sugerida

- **No guardar solo texto libre** para el tipo de comercio.
- **Sí guardar código + descripción**.
- El código debe ser el valor canónico; la descripción sirve para UX, reportes y debugging.

## Valores válidos de muestra para el spec

Estos salen del PDF de correspondencia ATV ↔ TRIBU-CR CIIU4 y sirven como catálogo base inicial para comercio minorista, mayorista y food service.

| Código CIIU4 | Descripción | Ejemplo ATV detectado en el PDF |
|---|---|---|
| `4711.1` | Venta al por menor en supermercados, almacenes y similares | `521101` Supermercados y almacenes de abarrotes en cadena |
| `4711.2` | Venta al por menor en minisuper, pulperías y similares | `521201` Abastecedores, pulperías o mini-super |
| `4711.2` | Venta al por menor en minisuper, pulperías y similares | `521202` Pulperías (mini-super) (sin cantina) |
| `4719.1` | Venta al por menor en tiendas por departamentos | `521901` Tiendas o almacenes por departamentos |
| `4719.9` | Venta al por menor en bazares y otros establecimientos no especializados n.c.p. | `523201` Bazares |
| `4721.9` | Venta al por menor de otros alimentos | `522001` Comercio al por menor de confites y otros productos relacionados (confitería) |
| `4721.9` | Venta al por menor de otros alimentos | `523916` Comercio al por menor de alimentos y productos n.c.p. incluidos en canasta básica |
| `4722.0` | Venta al por menor de bebidas en comercios especializados | `522012` Comercio al por menor de bebidas gaseosas y carbonatadas |
| `4722.0` | Venta al por menor de bebidas en comercios especializados | `522013` Comercio al por menor de agua embotellada |
| `4723.0` | Venta al por menor de tabaco en comercios especializados | `522016` Comercio al por menor de productos de tabaco |
| `4771.1` | Venta al por menor de prendas de vestir y artículos de cuero en almacenes especializados | `523205` Venta al por menor de prendas de vestir, ropa y zapatos (tiendas) |
| `4772.0` | Venta al por menor de productos farmacéuticos y medicinales, cosméticos y artículos de tocador en comercios especializados | `523101` Farmacias |
| `4772.0` | Venta al por menor de productos farmacéuticos y medicinales, cosméticos y artículos de tocador en comercios especializados | `523102` Venta al por menor de cosméticos y perfumería |
| `4772.0` | Venta al por menor de productos farmacéuticos y medicinales, cosméticos y artículos de tocador en comercios especializados | `522003` Macrobióticas |
| `5610.0` | Actividades de restaurantes y de servicios móviles de comidas | `552002` Cafeterías |
| `5610.0` | Actividades de restaurantes y de servicios móviles de comidas | `552004` Servicio de restaurante, cafeterías, sodas y otros expendios de comida |
| `5610.0` | Actividades de restaurantes y de servicios móviles de comidas | `552005` Sodas |
| `5610.0` | Actividades de restaurantes y de servicios móviles de comidas | `552007` Otros expendios de comidas |
| `5610.0` | Actividades de restaurantes y de servicios móviles de comidas | `522011` Preparación, servicio y venta de frutas picadas y bebidas de frutas y/o legumbres |
| `4630.4` | Venta al por mayor de licores, bebidas y tabaco | `512209` Comercio al por mayor de productos de tabaco |
| `4630.4` | Venta al por mayor de licores, bebidas y tabaco | `512210` Comercio al por mayor de bebidas con contenido alcohólico |
| `4630.4` | Venta al por mayor de licores, bebidas y tabaco | `512213` Comercio al por mayor de bebidas gaseosas y carbonatadas |
| `4630.4` | Venta al por mayor de licores, bebidas y tabaco | `512217` Comercio al por mayor de vinos, bebidas fermentadas y no fermentadas |
| `4630.4` | Venta al por mayor de licores, bebidas y tabaco | `512225` Comercio al por mayor de bebidas no alcohólicas y agua embotellada |
| `4630.4` | Venta al por mayor de licores, bebidas y tabaco | `512234` Comercio al por mayor de cerveza importada |
| `4630.9` | Venta al por mayor de otros alimentos | `512201` Comercio al por mayor de alimentos, granos básicos, carnes y demás comestibles |
| `4630.9` | Venta al por mayor de otros alimentos | `512204` Comercio al por mayor de productos lácteos |
| `4630.9` | Venta al por mayor de otros alimentos | `512208` Comercio al por mayor de productos de confitería |
| `4630.9` | Venta al por mayor de otros alimentos | `512211` Comercio al por mayor de otros alimentos n.c.p. |
| `4630.9` | Venta al por mayor de otros alimentos | `512222` Comercio al por mayor de café empacado, envasado, enlatado, soluble y descafeinado |
| `4630.9` | Venta al por mayor de otros alimentos | `512232` Comercio al por mayor de productos sustitutos del azúcar |
| `4630.9` | Venta al por mayor de otros alimentos | `512233` Comercio al por mayor de carnes de todo tipo |
| `4630.9` | Venta al por mayor de otros alimentos | `512237` Comercio al por mayor de alimentos y productos n.c.p. exentos de ventas |
| `4649.2` | Venta al por mayor de productos farmacéuticos, veterinarios y artículos de tocador | `513602` Venta al por mayor de productos veterinarios gravados con IVA |
| `4649.2` | Venta al por mayor de productos farmacéuticos, veterinarios y artículos de tocador | `519003` Venta al por mayor de equipo, artículos y accesorios de belleza, cosméticos e higiene personal |

## Lista corta para usar ya en un enum o catálogo inicial

```txt
4711.1 | Venta al por menor en supermercados, almacenes y similares
4711.2 | Venta al por menor en minisuper, pulperías y similares
4719.1 | Venta al por menor en tiendas por departamentos
4719.9 | Venta al por menor en bazares y otros establecimientos no especializados n.c.p.
4721.9 | Venta al por menor de otros alimentos
4722.0 | Venta al por menor de bebidas en comercios especializados
4723.0 | Venta al por menor de tabaco en comercios especializados
4771.1 | Venta al por menor de prendas de vestir y artículos de cuero en almacenes especializados
4772.0 | Venta al por menor de productos farmacéuticos y medicinales, cosméticos y artículos de tocador en comercios especializados
5610.0 | Actividades de restaurantes y de servicios móviles de comidas
4630.4 | Venta al por mayor de licores, bebidas y tabaco
4630.9 | Venta al por mayor de otros alimentos
4649.2 | Venta al por mayor de productos farmacéuticos, veterinarios y artículos de tocador
```

## Nota práctica para el spec

Si el módulo solo necesita clasificar tiendas/clientes comerciales comunes, este catálogo corto alcanza para empezar.
Si después ocupás cobertura total del PDF, ahí sí conviene generar un catálogo completo versionado (`json` o tabla semilla) y no seguir copiando filas a mano como cavernícolas.
