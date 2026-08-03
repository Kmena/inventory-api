# Coding Standards

## 1. Propósito

Este documento define los estándares obligatorios para:

* calidad y mantenibilidad del código;
* arquitectura y separación de responsabilidades;
* diseño y acceso a bases de datos;
* seguridad;
* manejo de errores;
* observabilidad;
* pruebas automatizadas;
* contenedores;
* integración continua;
* documentación;
* generación y modificación de código mediante agentes de IA.

Estas reglas aplican a código nuevo, correcciones, refactorizaciones, migraciones y código generado por herramientas automáticas.

El objetivo no es alcanzar perfección teórica, sino producir software:

* correcto;
* legible;
* seguro;
* probado;
* fácil de modificar;
* observable;
* desplegable;
* consistente con la arquitectura documentada.

---

# 2. Prioridad de las reglas

Cuando exista conflicto entre reglas, se debe seguir este orden:

1. Seguridad y protección de datos.
2. Integridad de la información.
3. Reglas del negocio.
4. Arquitectura aprobada.
5. Compatibilidad con comportamiento existente.
6. Pruebas automatizadas.
7. Mantenibilidad.
8. Rendimiento.
9. Preferencias de estilo.

No se debe comprometer la integridad o seguridad para reducir líneas de código o simplificar una implementación.

---

# 3. Reglas generales

## 3.1 Simplicidad

* Aplicar KISS: preferir la solución más simple que satisfaga correctamente el requerimiento.
* Aplicar YAGNI: no implementar funcionalidades hipotéticas que no estén en la especificación.
* Aplicar DRY con criterio.
* No abstraer código solamente porque dos fragmentos se parecen.
* Crear una abstracción cuando exista un concepto compartido y estable.
* Evitar código excesivamente genérico.
* Evitar metaprogramación innecesaria.
* Preferir código explícito sobre código difícil de entender.

## 3.2 Cambios controlados

Todo cambio debe:

* responder a una especificación, defecto o tarea;
* tener alcance claro;
* mantener el comportamiento no relacionado;
* evitar cambios masivos innecesarios;
* incluir pruebas cuando cambie el comportamiento;
* actualizar documentación cuando corresponda.

No se deben combinar en el mismo cambio:

* una funcionalidad nueva;
* una migración arquitectónica amplia;
* actualización masiva de dependencias;
* reformateo completo del repositorio;
* refactorizaciones no relacionadas.

## 3.3 Regla del boy scout

Se permite mejorar ligeramente el área modificada, pero:

* la mejora debe estar relacionada con el cambio;
* no debe ampliar considerablemente el alcance;
* no debe cambiar comportamiento sin pruebas;
* no debe convertirse en una reescritura.

---

# 4. Convenciones de nombres

## 4.1 Nombres descriptivos

Los nombres deben expresar intención.

Incorrecto:

```text
data
temp
obj
item2
x
doProcess
handleStuff
manager
utils
```

Correcto:

```text
pendingApproval
inventoryMovement
invoiceTotal
calculateAvailableStock
approveProductionOrder
```

## 4.2 Términos del dominio

Se debe utilizar el lenguaje definido por el negocio.

El mismo concepto no debe tener nombres distintos en diferentes capas.

Ejemplo incorrecto:

```text
Product
Article
Item
Material
```

cuando todos representan el mismo concepto.

El nombre debe coincidir con el lenguaje ubicuo definido en:

```text
docs/architecture.md
docs/current-state.md
docs/domain-glossary.md
```

## 4.3 Booleanos

Los booleanos deben leerse como condiciones:

```text
isActive
hasPermission
canApprove
shouldNotify
requiresSupervisorApproval
```

Evitar:

```text
active
permission
flag
statusBool
```

## 4.4 Funciones

Los nombres de funciones deben iniciar con un verbo y describir el resultado:

```text
calculateInvoiceTotal
findOrderById
approveInventoryMovement
validateAvailableStock
publishOrderCreated
```

## 4.5 Clases y módulos

Las clases deben representar conceptos claros.

Evitar nombres genéricos como:

```text
Helper
Manager
Processor
Handler
Common
GeneralService
Utils
```

Solo se permite `Handler` cuando representa explícitamente un manejador de comando, consulta o evento.

---

# 5. Funciones y métodos

## 5.1 Responsabilidad única

Una función debe realizar una tarea coherente.

No debe mezclar:

* validación HTTP;
* reglas de negocio;
* persistencia;
* envío de correo;
* publicación de eventos;
* transformación de respuestas.

Ejemplo incorrecto:

```text
createOrder()
  valida request
  consulta inventario
  calcula precio
  guarda orden
  envía correo
  construye respuesta HTTP
```

Separación recomendada:

```text
OrderController
  -> CreateOrderUseCase
      -> Order aggregate
      -> InventoryPort
      -> OrderRepository
      -> EventPublisher
```

## 5.2 Tamaño

No existe un límite absoluto, pero se utilizan las siguientes señales:

* más de 30 líneas: revisar responsabilidad;
* más de 50 líneas: justificar;
* más de 3 niveles de anidación: refactorizar;
* más de 4 parámetros: considerar un objeto de entrada;
* múltiples bloques `try/catch`: revisar diseño;
* múltiples efectos secundarios: separar responsabilidades.

Estas cifras son indicadores, no sustituyen el juicio técnico.

## 5.3 Parámetros

* Evitar parámetros booleanos que cambien completamente el comportamiento.
* Evitar listas largas de argumentos.
* No pasar objetos grandes cuando solo se requieren algunos campos.
* Usar objetos de comando o DTO cuando representen una entrada coherente.
* No usar objetos genéricos sin tipo.

Incorrecto:

```text
createUser(name, email, role, company, active, sendEmail, validate)
```

Correcto:

```text
createUser(CreateUserCommand)
```

## 5.4 Retornos

* El retorno debe ser predecible.
* No retornar tipos distintos dependiendo del camino.
* No usar valores mágicos para representar errores.
* No retornar entidades de persistencia directamente desde APIs.
* No retornar `null` cuando un resultado explícito sea más seguro.

## 5.5 Efectos secundarios

Los efectos secundarios deben ser visibles.

Una función llamada:

```text
calculateTotal()
```

no debe:

* guardar datos;
* enviar notificaciones;
* modificar estado global;
* publicar eventos.

---

# 6. Condicionales y complejidad

## 6.1 Anidamiento

Usar retornos tempranos para evitar anidamiento excesivo.

Incorrecto:

```text
if user exists
  if user active
    if user has permission
      execute
```

Correcto:

```text
if user does not exist
  return error

if user is inactive
  return error

if user lacks permission
  return error

execute
```

## 6.2 Condiciones complejas

Las condiciones complejas deben extraerse a funciones o políticas con nombre.

Incorrecto:

```text
if order.status == PENDING &&
   user.role == SUPERVISOR &&
   order.total > 0 &&
   !order.cancelled
```

Correcto:

```text
if approvalPolicy.canApprove(order, user)
```

## 6.3 Complejidad ciclomática

Objetivo recomendado:

```text
Complejidad por función <= 10
```

Cuando supere este valor:

* dividir responsabilidades;
* utilizar guard clauses;
* extraer políticas;
* reemplazar condicionales repetidos;
* revisar el modelo de dominio.

No se debe reducir complejidad ocultándola en funciones mal nombradas.

---

# 7. Clases, módulos y componentes

## 7.1 Cohesión

Una clase o módulo debe agrupar comportamiento relacionado.

Una clase con muchas razones para cambiar debe dividirse.

Señales de baja cohesión:

* depende de muchas áreas del sistema;
* tiene muchos campos no utilizados por todos los métodos;
* contiene métodos de negocio, persistencia y presentación;
* cambia por requerimientos no relacionados.

## 7.2 Acoplamiento

* Depender de interfaces o puertos en límites arquitectónicos.
* No crear interfaces para cada clase sin una necesidad real.
* Evitar dependencias circulares.
* Evitar módulos globales que conozcan todos los dominios.
* No acceder a datos internos de otro dominio directamente.

## 7.3 Estado global

No se permite estado global mutable salvo justificación técnica explícita.

Se debe evitar:

* singletons con estado mutable;
* variables globales;
* cachés sin estrategia de invalidación;
* configuración modificable en tiempo de ejecución sin control.

---

# 8. Arquitectura

## 8.1 Fuente de verdad

La arquitectura aprobada se documenta en:

```text
docs/architecture.md
```

El estado realmente implementado se documenta en:

```text
docs/current-state.md
```

Cuando ambos documentos difieran, se debe reportar una desviación arquitectónica.

## 8.2 Arquitectura hexagonal por dominio

La organización recomendada es:

```text
src/
  domains/
    inventory/
      domain/
      application/
      adapters/
        inbound/
        outbound/
    sales/
      domain/
      application/
      adapters/
        inbound/
        outbound/
```

## 8.3 Dominio

El dominio puede contener:

* entidades;
* Value Objects;
* agregados;
* raíces de agregado;
* servicios de dominio;
* eventos de dominio;
* excepciones de dominio;
* reglas y políticas del negocio.

El dominio no debe depender de:

* frameworks web;
* ORM;
* bases de datos;
* controladores;
* servicios de correo;
* sistemas de archivos;
* SDK de nube;
* bibliotecas de infraestructura.

## 8.4 Aplicación

La capa de aplicación puede contener:

* casos de uso;
* comandos;
* consultas;
* handlers;
* puertos de entrada;
* puertos de salida;
* DTO de aplicación;
* coordinación de transacciones;
* coordinación de autorización;
* publicación de eventos.

La capa de aplicación coordina el dominio, pero no debe contener reglas centrales del negocio que pertenezcan al dominio.

## 8.5 Adaptadores de entrada

Ejemplos:

* controladores REST;
* resolvers GraphQL;
* consumidores de mensajes;
* comandos CLI;
* tareas programadas;
* interfaces de usuario.

Responsabilidades permitidas:

* recibir entrada;
* autenticar;
* validar formato básico;
* transformar entrada a comandos;
* llamar casos de uso;
* transformar resultados a respuestas.

No deben:

* ejecutar reglas centrales de negocio;
* acceder directamente a tablas;
* controlar transacciones complejas;
* modificar agregados sin un caso de uso.

## 8.6 Adaptadores de salida

Ejemplos:

* repositorios Prisma;
* repositorios SQL;
* clientes HTTP;
* publicadores de eventos;
* almacenamiento de archivos;
* proveedores de correo.

Deben implementar puertos definidos por la aplicación o el dominio.

## 8.7 Regla de dependencias

La dirección debe ser:

```text
Adaptador de entrada
        ↓
Puerto de entrada
        ↓
Caso de uso
        ↓
Dominio
        ↓
Puerto de salida
        ↑
Adaptador de salida
```

Las capas internas no deben importar implementaciones externas.

## 8.8 Comunicación entre dominios

Un dominio no debe:

* consultar directamente tablas privadas de otro dominio;
* importar entidades internas de otro dominio;
* modificar agregados de otro dominio;
* compartir modelos ORM como contratos.

La comunicación debe realizarse mediante:

* puertos;
* contratos públicos;
* casos de uso;
* eventos;
* APIs internas;
* modelos de integración.

---

# 9. Validación

## 9.1 Validación por frontera

Cada capa valida lo que le corresponde.

### Adaptador de entrada

Valida:

* formato;
* campos obligatorios;
* tipos;
* longitud;
* sintaxis;
* estructura del request.

### Aplicación

Valida:

* existencia de recursos;
* permisos para ejecutar el caso de uso;
* precondiciones de operación;
* coordinación entre componentes.

### Dominio

Protege:

* invariantes;
* estados válidos;
* transiciones;
* reglas del negocio.

### Base de datos

Protege:

* integridad referencial;
* unicidad;
* campos obligatorios;
* restricciones estructurales.

## 9.2 Entradas externas

Toda entrada externa se considera no confiable:

* request HTTP;
* archivo;
* variable de entorno;
* evento;
* cola;
* respuesta de API;
* argumento CLI;
* dato importado;
* contenido generado por IA.

Debe validarse antes de utilizarse.

---

# 10. Manejo de errores

## 10.1 Reglas obligatorias

* No usar bloques `catch` vacíos.
* No ocultar excepciones.
* No retornar éxito cuando una operación falló.
* No exponer stack traces al cliente.
* No exponer SQL, tokens, rutas internas o secretos.
* No registrar la misma excepción repetidamente en todas las capas.
* Preservar la causa original cuando se traduzcan errores.

## 10.2 Tipos de errores

Separar:

### Errores de dominio

Ejemplos:

```text
InsufficientStock
CreditLimitExceeded
ApprovalRequired
InvalidProductionState
```

### Errores de aplicación

Ejemplos:

```text
OrderNotFound
UserNotAuthorized
DuplicateRequest
```

### Errores de infraestructura

Ejemplos:

```text
DatabaseUnavailable
ExternalServiceTimeout
MessageBrokerUnavailable
```

Los detalles de infraestructura no deben filtrarse hacia el dominio.

## 10.3 Mensajes

Los mensajes internos deben incluir contexto suficiente:

```text
Failed to approve inventory movement
movementId=...
warehouseId=...
```

No deben incluir:

* contraseña;
* token;
* número completo de tarjeta;
* información personal sensible;
* contenido completo de documentos;
* secretos.

---

# 11. Seguridad

## 11.1 Secretos

No se permite guardar en código:

* contraseñas;
* API keys;
* tokens;
* certificados privados;
* cadenas de conexión productivas;
* claves de cifrado.

Los secretos deben almacenarse en:

* secret manager;
* variables de entorno seguras;
* mecanismos de secretos del orquestador;
* archivos locales ignorados exclusivamente para desarrollo.

Los archivos `.env` reales no deben incluirse en Git.

Se permite:

```text
.env.example
```

sin valores sensibles.

## 11.2 Autenticación y autorización

* Autenticación y autorización son controles distintos.
* Todo endpoint protegido debe validar autorización.
* No confiar únicamente en controles de interfaz.
* Validar acceso al recurso específico.
* Aplicar mínimo privilegio.
* Las operaciones administrativas deben ser auditables.

## 11.3 Consultas

* Usar consultas parametrizadas.
* No concatenar valores externos en SQL.
* No construir comandos del sistema con entrada sin validar.
* No ejecutar código generado dinámicamente sin control.
* No confiar en nombres de archivos enviados por el usuario.

## 11.4 Datos sensibles

* Minimizar la recolección.
* Minimizar el almacenamiento.
* Cifrar en tránsito.
* Aplicar cifrado en reposo cuando corresponda.
* Enmascarar en logs.
* Definir retención y eliminación.
* Restringir acceso por rol y necesidad.

## 11.5 Dependencias

* Mantener un archivo de bloqueo de versiones.
* Revisar vulnerabilidades conocidas.
* Evitar dependencias sin mantenimiento.
* Eliminar dependencias no utilizadas.
* No actualizar dependencias críticas sin pruebas.
* Automatizar análisis de vulnerabilidades en CI.

---

# 12. Base de datos

## 12.1 Fuente de verdad

Las decisiones del modelo se documentan mediante:

* ERD;
* migraciones;
* restricciones;
* documentación de dominio;
* decisiones arquitectónicas.

El ORM no sustituye las reglas de integridad de la base de datos.

## 12.2 Nombres

Usar una convención consistente.

Ejemplo recomendado:

```text
Tablas: snake_case plural
Columnas: snake_case
Primary keys: id
Foreign keys: <entity>_id
Índices: idx_<table>_<columns>
Unique constraints: uq_<table>_<columns>
Foreign keys: fk_<table>_<referenced_table>
Check constraints: chk_<table>_<rule>
```

No mezclar convenciones dentro del mismo proyecto.

## 12.3 Llaves primarias

Toda tabla transaccional debe tener una llave primaria estable.

La llave:

* no debe depender de un dato editable;
* no debe reutilizarse;
* no debe cambiar durante la vida del registro.

## 12.4 Llaves foráneas

Las relaciones deben utilizar llaves foráneas cuando la consistencia sea responsabilidad de la misma base de datos.

Toda eliminación debe definir explícitamente:

```text
RESTRICT
CASCADE
SET NULL
```

No depender del comportamiento por defecto sin revisarlo.

`CASCADE` debe utilizarse únicamente cuando la eliminación de los registros hijos sea siempre válida como parte del mismo ciclo de vida.

## 12.5 Restricciones

Usar restricciones para proteger integridad:

* `NOT NULL`;
* `UNIQUE`;
* `FOREIGN KEY`;
* `CHECK`;
* claves primarias.

Ejemplos:

```text
quantity >= 0
total_amount >= 0
start_date <= end_date
status IN (...)
```

Las reglas críticas deben protegerse tanto en dominio como en base de datos cuando sea viable.

## 12.6 Tipos de datos

* Usar tipos adecuados.
* No almacenar fechas como texto.
* No almacenar números como texto.
* No almacenar booleanos como `0`, `1`, `"Y"` o `"N"` salvo integración heredada.
* No usar punto flotante para dinero.
* Usar tipos decimales con precisión definida para montos.
* Definir claramente unidades para cantidades.
* Guardar timestamps con estrategia consistente de zona horaria.
* Preferir UTC para persistencia y convertir en los límites del sistema.

## 12.7 Dinero

Todo campo monetario debe definir:

* moneda;
* precisión;
* escala;
* regla de redondeo;
* momento de redondeo.

Nunca usar:

```text
float
double
```

para cálculos monetarios.

## 12.8 Estados

Los estados deben ser explícitos.

No usar múltiples booleanos que permitan combinaciones inválidas:

```text
isApproved
isRejected
isPending
isCancelled
```

Preferir:

```text
status = PENDING | APPROVED | REJECTED | CANCELLED
```

Las transiciones deben validarse en el dominio.

## 12.9 Auditoría

Para operaciones relevantes registrar:

* quién realizó la operación;
* cuándo;
* acción;
* entidad afectada;
* identificador;
* estado anterior cuando corresponda;
* estado nuevo;
* motivo;
* identificador de correlación.

No almacenar secretos o datos excesivos en auditoría.

## 12.10 Borrado

Para información histórica o transaccional:

* no eliminar físicamente salvo requisito explícito;
* utilizar estado inactivo, archivado o soft delete cuando corresponda;
* mantener trazabilidad;
* evitar que soft-deleted rows aparezcan accidentalmente.

El soft delete no debe aplicarse automáticamente a todas las tablas.

## 12.11 Transacciones

Usar transacciones cuando varias operaciones deban completarse de forma atómica.

Ejemplos:

* confirmar orden y descontar inventario;
* registrar pago y actualizar saldo;
* finalizar producción y registrar productos;
* aprobar movimiento y actualizar existencias.

Las transacciones deben:

* ser cortas;
* evitar llamadas HTTP externas dentro de la transacción;
* usar un nivel de aislamiento adecuado;
* manejar reintentos cuando exista conflicto;
* no mantener bloqueos durante procesamiento lento.

## 12.12 Concurrencia

No utilizar el patrón inseguro:

```text
leer valor
modificar en memoria
guardar valor
```

sin considerar concurrencia.

Utilizar según el caso:

* actualización atómica;
* versión del registro;
* optimistic locking;
* bloqueo explícito;
* constraints;
* transacciones;
* claves de idempotencia.

## 12.13 Idempotencia

Las operaciones que puedan repetirse deben soportar idempotencia.

Ejemplos:

* pagos;
* recepción de eventos;
* creación de órdenes desde integraciones;
* callbacks;
* reintentos automáticos.

Una solicitud repetida no debe duplicar efectos.

## 12.14 Índices

Crear índices basados en consultas reales.

Considerar índices para:

* llaves foráneas;
* filtros frecuentes;
* búsquedas;
* ordenamientos;
* joins;
* restricciones únicas.

No crear índices indiscriminadamente.

Cada índice:

* consume almacenamiento;
* aumenta costo de escritura;
* requiere mantenimiento;
* debe justificar su utilidad.

Antes de agregar un índice, revisar el plan de ejecución cuando sea posible.

## 12.15 Consultas

Evitar:

* `SELECT *`;
* consultas dentro de ciclos;
* problema N+1;
* traer columnas innecesarias;
* cargar conjuntos sin paginación;
* ordenar grandes volúmenes sin índice;
* consultas sin límites en endpoints.

## 12.16 Paginación

Todo listado potencialmente grande debe tener paginación.

La respuesta debe definir:

* tamaño máximo;
* orden estable;
* cursor o página;
* criterios de filtrado.

Para grandes volúmenes se recomienda paginación por cursor.

## 12.17 Migraciones

Toda modificación de esquema debe realizarse mediante migración versionada.

Una migración debe:

* ser reproducible;
* ejecutarse en ambientes limpios;
* estar revisada;
* considerar volumen de datos;
* considerar bloqueos;
* incluir estrategia de rollback o mitigación;
* separar cambios destructivos;
* evitar pérdida silenciosa de datos.

## 12.18 Cambios destructivos

Para eliminar o renombrar columnas aplicar preferiblemente:

```text
Expand
Migrate
Contract
```

Ejemplo:

1. Crear nueva columna.
2. Escribir en ambas columnas.
3. Migrar datos.
4. Leer de la nueva columna.
5. Verificar.
6. Eliminar la antigua en otra versión.

## 12.19 Datos iniciales

Separar:

* migraciones de esquema;
* datos de catálogo;
* datos de prueba;
* datos de desarrollo.

Los seed scripts deben ser idempotentes cuando sea posible.

---

# 13. Repositorios y ORM

## 13.1 Repositorios

Un repositorio debe representar una colección o mecanismo de persistencia del dominio.

Ejemplos:

```text
OrderRepository
InventoryMovementRepository
ProductRepository
```

Evitar repositorios genéricos universales que expongan directamente operaciones CRUD sin intención de dominio.

## 13.2 ORM

Las entidades ORM no deben utilizarse automáticamente como:

* entidades de dominio;
* DTO de API;
* modelos de eventos;
* contratos entre dominios.

Se deben usar mapeadores cuando exista una separación real entre modelos.

## 13.3 Consultas específicas

Se permiten consultas especializadas para reportes y lecturas.

No es obligatorio reconstruir agregados completos para consultas de lectura que no modifican comportamiento.

Los modelos de lectura:

* no deben permitir modificar el dominio;
* pueden estar optimizados;
* deben seguir controles de seguridad y autorización.

---

# 14. APIs

## 14.1 Contratos

Las APIs deben tener contratos explícitos:

* entrada;
* salida;
* errores;
* códigos de estado;
* autenticación;
* autorización;
* versionamiento cuando sea necesario.

## 14.2 DTO

No exponer directamente:

* modelos ORM;
* tablas;
* entidades internas;
* excepciones técnicas;
* estructura privada de otros dominios.

## 14.3 Códigos HTTP

Usar códigos coherentes:

```text
200: operación exitosa
201: recurso creado
204: operación exitosa sin contenido
400: entrada inválida
401: no autenticado
403: no autorizado
404: recurso no encontrado
409: conflicto de estado o duplicado
422: regla de negocio no satisfecha, cuando aplique
500: error interno no controlado
503: dependencia temporalmente no disponible
```

## 14.4 Versionamiento

No versionar anticipadamente sin necesidad.

Cuando exista un contrato público con consumidores externos, definir estrategia de compatibilidad y deprecación.

---

# 15. Logs y observabilidad

## 15.1 Logs estructurados

Preferir logs estructurados con campos como:

```text
timestamp
level
service
environment
operation
correlationId
userId
entityId
duration
result
errorCode
```

## 15.2 Niveles

### ERROR

Fallo que requiere atención o impide una operación.

### WARN

Condición inesperada, recuperable o de riesgo.

### INFO

Eventos relevantes del negocio o ciclo de vida.

### DEBUG

Información detallada para diagnóstico.

No registrar cada línea de ejecución.

## 15.3 Correlación

Toda operación distribuida debe utilizar un identificador de correlación.

Debe propagarse a:

* logs;
* llamadas entre servicios;
* eventos;
* tareas en background;
* auditoría cuando aplique.

## 15.4 Métricas

Medir según el tipo de aplicación:

* tiempo de respuesta;
* tasa de errores;
* throughput;
* uso de recursos;
* conexiones;
* profundidad de colas;
* reintentos;
* fallos de dependencias;
* métricas de negocio relevantes.

## 15.5 Health checks

Separar:

```text
liveness
readiness
startup
```

* `liveness`: indica si el proceso sigue funcionando.
* `readiness`: indica si puede recibir tráfico.
* `startup`: permite inicializaciones lentas sin reinicios prematuros.

No incluir operaciones costosas en cada health check.

---

# 16. Pruebas

## 16.1 Reglas generales

Todo cambio funcional debe incluir pruebas adecuadas.

No se considera terminado un cambio si:

* las pruebas fallan;
* no se ejecutaron;
* fueron eliminadas sin justificación;
* se modificaron solamente para ocultar un defecto;
* dependen de orden;
* son inestables.

## 16.2 Pirámide de pruebas

Se debe priorizar:

1. Pruebas unitarias de dominio.
2. Pruebas de casos de uso.
3. Pruebas de integración de adaptadores.
4. Pruebas end-to-end de flujos críticos.

No sustituir pruebas de dominio con grandes pruebas end-to-end.

## 16.3 Casos mínimos

Para cada regla relevante probar:

* caso exitoso;
* entrada inválida;
* regla de negocio;
* caso límite;
* error de dependencia;
* autorización;
* concurrencia o idempotencia cuando aplique.

## 16.4 Caracterización

Antes de refactorizar código heredado sin pruebas:

* crear pruebas de caracterización;
* capturar el comportamiento actual;
* diferenciar comportamiento correcto de defectos conocidos;
* no asumir que todo comportamiento existente debe preservarse.

## 16.5 Independencia

Las pruebas deben:

* poder ejecutarse en cualquier orden;
* limpiar sus datos;
* evitar dependencia entre casos;
* controlar tiempo y aleatoriedad;
* no depender de servicios externos reales salvo pruebas específicas.

## 16.6 Dobles de prueba

Usar mocks únicamente en límites externos.

No simular excesivamente el dominio.

Preferir:

* objetos reales para Value Objects y entidades;
* fakes para repositorios simples;
* stubs para respuestas externas;
* mocks para verificar interacciones relevantes.

## 16.7 Cobertura

La cobertura es un indicador, no una garantía.

Objetivos recomendados:

```text
Dominio crítico: >= 90%
Aplicación: >= 80%
Proyecto general: >= 75%
```

No agregar pruebas sin valor únicamente para aumentar el porcentaje.

---

# 17. Contenedores

## 17.1 Principio general

Un contenedor debe ejecutar una responsabilidad principal.

No incluir en la misma imagen:

* aplicación;
* base de datos;
* servidor de correo;
* tareas administrativas no relacionadas.

## 17.2 Imagen base

* Usar imágenes oficiales o aprobadas.
* Utilizar versiones específicas.
* Evitar tags flotantes como `latest`.
* Preferir imágenes mínimas compatibles.
* Revisar vulnerabilidades de la imagen.
* Actualizar imágenes base de manera controlada.

Ejemplo:

```dockerfile
FROM node:24.4.0-bookworm-slim
```

Evitar:

```dockerfile
FROM node:latest
```

Para máxima reproducibilidad puede fijarse también el digest.

## 17.3 Multi-stage build

Utilizar compilación multietapa cuando exista compilación o dependencias de desarrollo.

Ejemplo:

```dockerfile
FROM node:24.4.0-bookworm-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:24.4.0-bookworm-slim AS build

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:24.4.0-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

USER node

CMD ["node", "dist/main.js"]
```

La imagen final no debe contener:

* compiladores innecesarios;
* código fuente si no es requerido;
* pruebas;
* caches;
* herramientas administrativas innecesarias;
* secretos.

## 17.4 Usuario sin privilegios

El proceso no debe ejecutarse como `root`.

Se debe usar:

```dockerfile
USER app
```

o el usuario no privilegiado provisto por la imagen.

Cualquier excepción debe documentarse y justificarse.

## 17.5 `.dockerignore`

Todo repositorio debe tener `.dockerignore`.

Ejemplo:

```text
.git
.github
node_modules
coverage
dist
tmp
.env
.env.*
!.env.example
*.log
docs/internal
.vscode
.idea
```

No incluir secretos ni archivos innecesarios en el contexto de construcción.

## 17.6 Dependencias

Utilizar instalación reproducible:

```text
npm ci
pip install con lock file
poetry install
mvn dependency locks cuando aplique
```

No depender de versiones abiertas en producción.

## 17.7 Capas

Ordenar instrucciones para aprovechar caché:

1. Copiar manifiestos de dependencias.
2. Instalar dependencias.
3. Copiar código.
4. Compilar.
5. Preparar imagen final.

Agrupar comandos relacionados sin crear capas innecesarias.

## 17.8 Secretos durante build

No usar:

```dockerfile
ARG DATABASE_PASSWORD
ENV API_KEY=...
COPY .env .
```

Los secretos no deben quedar en las capas.

Utilizar mecanismos seguros de secretos de BuildKit o del sistema de CI.

## 17.9 Configuración

La configuración debe inyectarse en tiempo de ejecución.

No construir una imagen diferente por ambiente cuando solo cambia configuración.

La misma imagen debe poder ejecutarse en:

```text
development
staging
production
```

con configuración externa.

## 17.10 Sistema de archivos

Preferir contenedores inmutables.

Cuando sea posible:

* root filesystem de solo lectura;
* volúmenes únicamente para datos necesarios;
* directorios temporales explícitos;
* no guardar estado permanente dentro del contenedor.

## 17.11 Señales y apagado

La aplicación debe:

* manejar `SIGTERM`;
* dejar de aceptar trabajo;
* finalizar solicitudes activas;
* cerrar conexiones;
* liberar recursos;
* terminar dentro del tiempo configurado.

Se debe evitar envolver el proceso principal en scripts que no propaguen señales.

Usar forma exec:

```dockerfile
CMD ["node", "dist/main.js"]
```

Evitar:

```dockerfile
CMD node dist/main.js
```

## 17.12 Health check

Agregar health check cuando la plataforma no lo administre externamente.

Ejemplo conceptual:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD application-health-check
```

No incluir credenciales en el health check.

## 17.13 Recursos

Los contenedores deben tener:

* límites de memoria;
* solicitudes o reservas;
* límites de CPU;
* políticas de reinicio;
* timeouts;
* límites de conexiones.

La aplicación debe comportarse correctamente al alcanzar límites.

## 17.14 Docker Compose

`docker-compose.yml` puede utilizarse para desarrollo e integración local.

Debe:

* usar variables;
* evitar secretos reales;
* incluir health checks;
* definir dependencias por disponibilidad, no solo por orden;
* usar volúmenes con propósito claro;
* evitar publicar puertos innecesarios;
* separar configuración de desarrollo y producción.

No asumir que `depends_on` significa que el servicio ya está listo para recibir conexiones.

## 17.15 Base de datos en contenedor

Para desarrollo:

* usar volumen persistente;
* fijar versión;
* usar health check;
* no exponer el puerto públicamente si no es necesario;
* utilizar credenciales exclusivas de desarrollo.

Para producción:

* evaluar un servicio administrado;
* definir backups;
* probar restauración;
* monitorear capacidad;
* configurar alta disponibilidad cuando sea requerida.

## 17.16 Escaneo

La CI debe escanear:

* imagen;
* dependencias;
* sistema operativo base;
* secretos;
* configuración insegura.

Una vulnerabilidad crítica debe bloquear el despliegue, salvo excepción formal con:

* justificación;
* mitigación;
* responsable;
* fecha de expiración.

---

# 18. Configuración y ambientes

## 18.1 Variables de entorno

La configuración dependiente del ambiente debe estar fuera del código.

Ejemplos:

```text
DATABASE_URL
LOG_LEVEL
PORT
EXTERNAL_API_URL
FEATURE_FLAG_...
```

## 18.2 Validación de configuración

La aplicación debe validar su configuración durante el inicio.

Debe fallar rápidamente cuando:

* falta una variable obligatoria;
* una URL es inválida;
* un número está fuera de rango;
* la combinación de opciones es inconsistente.

No esperar hasta la primera solicitud para detectar configuración inválida.

## 18.3 Ambientes

Mantener la mayor paridad posible entre:

* desarrollo;
* integración;
* staging;
* producción.

Las diferencias deben ser configuración, capacidad o infraestructura, no cambios arbitrarios en el comportamiento.

---

# 19. Dependencias externas

## 19.1 Timeouts

Toda llamada externa debe definir timeout.

No depender de timeouts infinitos o predeterminados no verificados.

## 19.2 Reintentos

Los reintentos deben:

* tener límite;
* utilizar backoff;
* agregar jitter cuando corresponda;
* aplicarse solo a errores recuperables;
* respetar idempotencia;
* evitar tormentas de solicitudes.

## 19.3 Circuit breaker

Considerar circuit breaker cuando una dependencia:

* falla frecuentemente;
* tiene latencia alta;
* puede saturar el sistema;
* es crítica para múltiples operaciones.

## 19.4 Resiliencia

Definir:

* comportamiento ante indisponibilidad;
* fallback válido;
* colas;
* procesamiento diferido;
* compensaciones;
* errores visibles al usuario.

No ocultar errores críticos devolviendo datos falsos o vacíos.

---

# 20. Eventos y mensajería

## 20.1 Eventos

Los eventos deben representar hechos ocurridos y nombrarse en pasado:

```text
OrderCreated
InventoryMovementApproved
ProductionOrderCompleted
PaymentRegistered
```

## 20.2 Contratos

Los eventos deben tener:

* nombre;
* versión;
* identificador;
* fecha;
* origen;
* correlación;
* payload explícito.

## 20.3 Consumidores

Los consumidores deben ser:

* idempotentes;
* tolerantes a duplicados;
* capaces de manejar mensajes inválidos;
* observables;
* configurados con estrategia de reintento;
* compatibles con dead-letter queue cuando aplique.

## 20.4 Publicación confiable

Cuando sea necesario mantener consistencia entre base de datos y eventos, considerar:

* transactional outbox;
* procesamiento posterior;
* compensación.

No asumir que guardar en base de datos y publicar un evento son atómicos por ejecutarse consecutivamente.

---

# 21. Documentación

## 21.1 Documentos mínimos

```text
docs/
  current-state.md
  architecture.md
  tasks.md
  coding_standard.md
```

Opcionales según el proceso:

```text
docs/
  action-plan.md
  domain-glossary.md
  audit/
    current-code-audit.md
    final-audit.md
  adr/
```

## 21.2 Código autoexplicativo

Los comentarios deben explicar:

* por qué existe una decisión;
* restricción externa;
* comportamiento no evidente;
* riesgo;
* regla de negocio;
* solución temporal.

No deben repetir lo que el código ya dice.

Incorrecto:

```text
Increment counter by one.
```

Correcto:

```text
A retry increments the attempt before execution because the provider
counts the initial request as attempt number one.
```

## 21.3 ADR

Las decisiones arquitectónicas importantes deben registrarse mediante Architecture Decision Records.

Cada ADR debe incluir:

* contexto;
* decisión;
* alternativas;
* consecuencias;
* estado;
* fecha.

---

# 22. Git y pull requests

## 22.1 Commits

Los commits deben:

* tener un propósito;
* ser revisables;
* evitar archivos no relacionados;
* incluir pruebas correspondientes;
* no contener secretos;
* no incluir binarios sin justificación.

## 22.2 Pull request

Todo PR debe incluir:

* problema;
* solución;
* alcance;
* archivos o dominios afectados;
* pruebas ejecutadas;
* migraciones;
* riesgos;
* validación manual;
* evidencias cuando aplique.

## 22.3 Tamaño

Preferir cambios pequeños e incrementales.

Si el cambio es grande, dividirlo en:

1. pruebas de caracterización;
2. extracción de interfaces;
3. migración de lógica;
4. cambio de adaptadores;
5. limpieza;
6. eliminación de código anterior.

---

# 23. Integración continua

La CI debe ejecutar como mínimo:

```text
install
format check
lint
typecheck
unit tests
integration tests
build
dependency scan
secret scan
container build
container scan
```

Cuando existan migraciones:

```text
migration validation
clean database migration test
```

No se permite aprobar código con:

* build roto;
* pruebas fallando;
* errores de tipado;
* vulnerabilidades críticas sin excepción;
* migraciones inválidas;
* secretos detectados.

---

# 24. Definition of Done

Una tarea se considera terminada únicamente cuando:

* cumple los criterios de aceptación;
* respeta la arquitectura;
* respeta este documento;
* incluye pruebas;
* pasan las pruebas existentes;
* pasa lint;
* pasa typecheck;
* compila;
* las migraciones fueron verificadas;
* no contiene secretos;
* actualiza documentación;
* se revisó el diff;
* se documentaron riesgos pendientes;
* se comprobó el funcionamiento en contenedor cuando aplique.

---

# 25. Reglas para agentes de IA

Todo agente que analice o modifique el repositorio debe:

1. Leer `docs/coding_standard.md`.
2. Leer `docs/current-state.md`.
3. Leer `docs/architecture.md`.
4. Leer `docs/tasks.md`.
5. Revisar la estructura y convenciones existentes.
6. No modificar código antes de tener un plan aprobado, cuando el flujo lo requiera.
7. No inventar resultados de pruebas.
8. No indicar que algo funciona sin haberlo validado.
9. No ampliar el alcance sin documentarlo.
10. No cambiar arquitectura silenciosamente.
11. No eliminar pruebas para obtener resultados exitosos.
12. No agregar dependencias sin justificarlo.
13. No introducir secretos.
14. No modificar migraciones ejecutadas en ambientes compartidos.
15. Actualizar la documentación correspondiente.

## 25.1 Salida obligatoria del implementador

Después de implementar, el agente debe reportar:

```text
Resumen
Tareas implementadas
Archivos modificados
Decisiones tomadas
Desviaciones del plan
Pruebas ejecutadas
Resultado de pruebas
Lint
Typecheck
Build
Migraciones
Validación en contenedor
Riesgos pendientes
Validación manual requerida
```

## 25.2 Prohibiciones

El agente no debe:

* realizar una reescritura completa sin aprobación;
* corregir problemas no relacionados;
* inventar reglas de negocio;
* interpretar defectos actuales como requerimientos;
* suponer que un test existente representa comportamiento correcto;
* cambiar contratos públicos sin documentarlo;
* bajar controles de seguridad;
* desactivar validaciones;
* comentar código defectuoso en lugar de corregirlo;
* ocultar errores;
* marcar tareas como completadas sin evidencia.

---

# 26. Excepciones al estándar

Una regla puede incumplirse únicamente cuando exista una excepción documentada.

La excepción debe incluir:

```text
Regla:
Motivo:
Alternativas consideradas:
Riesgo:
Mitigación:
Responsable:
Fecha de revisión:
Fecha de expiración:
```

Las excepciones permanentes deben convertirse en una decisión arquitectónica.

---

# 27. Lista de verificación para auditoría

## Código

* [ ] Los nombres expresan intención.
* [ ] Las funciones tienen responsabilidad clara.
* [ ] No existe anidamiento excesivo.
* [ ] No hay duplicación injustificada.
* [ ] No existen efectos secundarios ocultos.
* [ ] No existe código muerto.
* [ ] No hay secretos.
* [ ] Los errores se manejan correctamente.

## Arquitectura

* [ ] El dominio no depende de infraestructura.
* [ ] Los controladores no contienen reglas de negocio.
* [ ] Los casos de uso dependen de puertos.
* [ ] Los adaptadores implementan puertos.
* [ ] No existen dependencias circulares.
* [ ] Los dominios tienen límites explícitos.
* [ ] No se comparten modelos ORM entre dominios.

## Base de datos

* [ ] Existen primary keys.
* [ ] Las relaciones tienen foreign keys apropiadas.
* [ ] Las restricciones críticas están definidas.
* [ ] Los tipos de datos son correctos.
* [ ] Los montos no usan punto flotante.
* [ ] Las operaciones atómicas usan transacciones.
* [ ] La concurrencia fue considerada.
* [ ] Las consultas grandes tienen paginación.
* [ ] Los índices responden a consultas reales.
* [ ] Las migraciones son seguras y reproducibles.

## Seguridad

* [ ] Las entradas externas se validan.
* [ ] Las consultas son parametrizadas.
* [ ] Existe autorización por recurso.
* [ ] Los datos sensibles no aparecen en logs.
* [ ] Las dependencias fueron escaneadas.
* [ ] Los secretos se gestionan externamente.

## Pruebas

* [ ] Existen pruebas de dominio.
* [ ] Existen pruebas de casos de uso.
* [ ] Existen pruebas de integración.
* [ ] Se cubren errores y casos límite.
* [ ] Las pruebas son deterministas.
* [ ] No existen pruebas desactivadas sin justificación.

## Contenedores

* [ ] La imagen base está fijada.
* [ ] Se utiliza una imagen confiable.
* [ ] Existe `.dockerignore`.
* [ ] Se utiliza multi-stage build cuando corresponde.
* [ ] La imagen final no contiene dependencias innecesarias.
* [ ] El proceso no ejecuta como root.
* [ ] No existen secretos en capas.
* [ ] Se manejan señales de apagado.
* [ ] Existen health checks adecuados.
* [ ] La imagen fue escaneada.
* [ ] Se definieron límites de recursos.

---

# 28. Resultado de cumplimiento

El auditor debe clasificar el resultado como:

## Compliant

Cumple las reglas obligatorias y no presenta hallazgos relevantes.

## Compliant with observations

Cumple las reglas críticas, pero existen mejoras menores.

## Partially compliant

Existen incumplimientos importantes que requieren un plan.

## Non-compliant

Existen violaciones de arquitectura, integridad, seguridad o calidad que impiden aprobar el cambio.

## Critical remediation required

Existen riesgos críticos de:

* seguridad;
* pérdida de datos;
* corrupción;
* autorización;
* disponibilidad;
* resultados incorrectos.
