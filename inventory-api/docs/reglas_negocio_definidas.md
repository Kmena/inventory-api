# Reglas de negocio definidas

Este documento consolida las reglas de negocio definidas para el proyecto a partir del PRD, la documentacion fiscal, el modelo Prisma y los servicios actuales.

## Alcance general

- El MVP 1 cubre administracion de empresas, usuarios, roles, permisos basicos, clientes, tiendas, zonas, subzonas, rutas, productos, proveedores, lotes, inventario, ventas basicas, pagos basicos y preparacion fiscal.
- Produccion avanzada, formulas completas, QA por etapas, agentes avanzados, hojas de cobro completas y facturacion electronica directa completa quedan como fases posteriores, salvo decision expresa de incluirlas.
- El sistema debe conservar trazabilidad operativa desde proveedor y compra hasta lote, inventario, movimiento, pedido y factura interna.
- Las operaciones criticas deben registrar usuario, fecha y, cuando aplique, motivo o comentario.

## Empresas, usuarios, roles y permisos

- Todo usuario operativo debe pertenecer a una empresa.
- Todo usuario debe tener un rol para operar dentro del sistema.
- Las acciones sensibles se validan por permisos activos, no solo por el nombre del rol.
- Crear productos, ingresar inventario, aprobar movimientos y facturar requieren permiso.
- Los cambios de permisos deben quedar auditados.
- No todos los usuarios pueden aprobar todos los tipos de operacion.
- Las entradas de bodega, salidas de bodega y transferencias pueden requerir permisos diferentes.
- Una transferencia puede requerir aprobacion de bodega origen y aprobacion de bodega destino.
- El sistema debe impedir que un usuario apruebe una operacion si su rol no tiene el permiso requerido.
- Los roles pueden ser globales o pertenecer a una empresa.
- Los permisos se asignan a roles mediante relaciones unicas por rol y permiso.

## Clientes, razones sociales, tiendas y credito

- Un cliente pertenece a una empresa.
- El codigo de cliente debe ser unico dentro de la empresa cuando se define.
- Una razon social puede estar asignada a varias tiendas.
- Una tienda solo puede tener una razon social.
- Al crear un cliente de empresa desde el flujo actual, se crea o reutiliza una razon social con la informacion fiscal disponible.
- Un cliente puede tener una o varias tiendas.
- Cada tienda pertenece a un cliente.
- El codigo de tienda debe ser unico dentro del cliente cuando se define.
- Una tienda debe pertenecer a una subzona.
- La tienda debe estar ligada a una subzona valida de la zona seleccionada.
- Una tienda puede registrar zona, subzona, direccion, provincia, canton, distrito, telefono, latitud y longitud.
- Cada tienda debe registrar ubicacion suficiente para rutas y analisis territorial.
- El alta de cliente debe indicar si el cliente sera de contado o si solicita credito.
- Si el cliente es de contado, no aplica formulario de credito.
- Si el cliente solicita credito, debe completarse solicitud de credito.
- Credito y cobro revisan solicitudes de credito con estados separados.
- Si se aprueba credito, debe registrarse limite aprobado.
- El credito se maneja con limite, saldo y facturas pendientes.
- Si el cliente inicia con deuda o saldo migrado, debe registrarse deuda inicial auditable.
- Un cliente debe estar activo para generar pedidos nuevos.
- El estado activo de cliente puede depender de compras realizadas en los ultimos `n` meses.
- El valor `n` debe ser configurable por root o permiso equivalente.
- Los clientes pueden tener contactos, referencias comerciales, personales o de cobro.
- La informacion de representantes o trabajadores de tienda debe incluir nombre, cargo, correo, telefonos y comentarios cuando aplique.

## Zonas, subzonas y rutas

- Toda zona pertenece a una empresa.
- El nombre de zona debe ser unico dentro de la empresa.
- Toda subzona pertenece a una zona.
- El nombre de subzona debe ser unico dentro de su zona.
- Una tienda debe pertenecer a una subzona.
- Las rutas agrupan una o varias subzonas.
- Las zonas, subzonas y rutas permiten clasificar ventas desde el MVP 1.
- Una ruta puede tener uno o varios agentes asignados.
- La asignacion de agente a ruta debe manejar vigencia para conservar historial.
- Un agente solo debe gestionar clientes de sus rutas activas, salvo permisos administrativos.

## Catalogo, productos y precios

- El catalogo maneja articulos: materia prima, envase, tapa, etiqueta, producto terminado o miscelaneo.
- Los productos de limpieza y material de oficina se registran como miscelaneos con subclasificacion.
- Todo producto debe tener categoria y subcategoria segun el PRD.
- Todo producto vendible debe tener precio general activo.
- El precio general es la base del calculo del precio de venta.
- El cambio de precio general aplica hacia adelante y no modifica pedidos historicos.
- El precio general publicado solo puede modificarse con autorizacion de root.
- El precio minimo calculado por formula es solo una recomendacion.
- El calculo de precio minimo no debe actualizar automaticamente el precio general.
- El codigo de producto debe ser unico dentro de la empresa cuando se define.
- Un producto terminado inactivo no puede agregarse a pedidos nuevos.
- Un producto terminado inactivo no puede asociarse a promociones, bonificaciones o regalias nuevas.
- La desactivacion de producto es logica y no borra historial.
- Pedidos, facturas, lotes, movimientos y formulas historicas deben seguir mostrando productos inactivos.
- Las promociones, bonificaciones y regalias modifican el precio final a partir del precio general.
- Los ajustes comerciales deben tener tipo, vigencia, estado y valor o regla de calculo.
- Un ajuste comercial no reemplaza ni borra el precio general.
- Solo se pueden aplicar ajustes comerciales activos y vigentes.
- El detalle del pedido debe conservar precio general usado, ajuste aplicado, descuento o bonificacion, precio final y total.
- El historico del pedido no debe recalcularse automaticamente cuando cambie el catalogo.

## Proveedores y compras

- Un proveedor pertenece a una empresa.
- El nombre de proveedor debe ser unico dentro de la empresa.
- Un producto puede tener varios proveedores.
- Para cada proveedor debe registrarse que productos del inventario vende.
- Las ordenes de compra deben ligarse a proveedor y productos ofrecidos por ese proveedor.
- Una orden de compra debe tener estado.
- La recepcion de compra debe crear o actualizar lotes.
- La recepcion debe crear movimiento de inventario tipo `IN`.
- El lote recibido debe registrar lote interno y lote del manufacturador cuando aplique.
- Si la compra se acepta y se recibe, debe ingresarse al inventario con lote, ficha de ingreso o cuarentena y movimiento trazable.
- La compra aceptada no debe saltarse QA ni autorizaciones de ingreso a bodega.
- Si se acepta una materia prima sustituta que afecta una formula, produccion debe crear o revisar una nueva version de formula.
- Las versiones de formula deben conservar historial y no reemplazar destructivamente versiones anteriores.
- La orden aprobada debe generar desglose para financiero contable como cuenta por pagar.

## Inventario, bodegas, lotes y movimientos

- Todo lote pertenece a un producto.
- Segun el PRD, todo lote debe pertenecer tambien a una bodega.
- Todo movimiento de inventario debe referenciar producto, lote, bodega, cantidad, tipo y usuario.
- Los tipos de movimiento definidos en el modelo son `IN`, `OUT`, `ADJUSTMENT`, `RESERVE` y `RELEASE`.
- Solo bodegas configuradas como fuente vendible pueden alimentar ventas.
- Bodegas virtuales no alimentan movimientos fisicos.
- Un lote vencido, rechazado o en cuarentena no debe estar disponible para venta.
- El sistema debe alertar lotes cercanos a vencimiento.
- El umbral de vencimiento debe ser configurable por empresa o producto.
- Un lote con QA rechazado o fallido no puede venderse.
- Si un producto sale por motivo extraordinario, debe registrarse el motivo.
- Motivos extraordinarios minimos: vencimiento de lote, falla QA, dano, riesgo de contaminacion y excepcion manual.
- Una salida por vencimiento de lote o falla QA debe generar alerta.
- Las entradas y movimientos entre bodegas deben registrar solicitante, autorizador, bodega origen, bodega destino y fecha.
- El sistema no debe permitir movimientos entre etapas si no existe la autorizacion requerida.

## Ventas, pedidos y entregas

- Un pedido pertenece a una empresa.
- Un pedido puede ligarse a cliente, usuario capturador y usuario aprobador.
- Los estados base del modelo son `DRAFT`, `APPROVED`, `IN_PRODUCTION`, `DELIVERED` y `CANCELLED`.
- El PRD define estados comerciales adicionales para revision, rechazo, proforma, facturacion, entrega, pago, vencimiento y cancelacion.
- Todo pedido debe conservar historial de estados.
- Cada cambio de estado debe registrar usuario, fecha, motivo y comentario.
- Un pedido debe conservar cliente, tienda y ruta asociada cuando aplique.
- El pedido debe validar cliente activo, producto, precio, lote y stock.
- El cliente puede solicitar un pedido, pero el sistema debe registrar el usuario interno que lo captura.
- Al agregar un producto al pedido, el sistema debe tomar el precio general vigente.
- Si aplica promocion, bonificacion o regalia, el sistema calcula el precio final.
- Cada item fisico vendido debe ligar producto, lote y bodega.
- El inventario no se descuenta al registrar ni al aprobar el pedido.
- El inventario se descuenta hasta que se factura, usando la factura como origen del movimiento de salida.
- Personal administrativo revisa condiciones de venta, descuentos, bonificaciones, regalias y validez comercial.
- Credito y cobro deben revisar saldo, historico de pago, facturas abiertas y estado del cliente cuando la venta es a credito.
- En ventas de contado no aplica aprobacion de credito y cobro.
- En contado contra entrega debe validarse mercaderia antes de entregar o facturar.
- La entrega debe ser confirmada por el transportista.
- Para marcar un pedido como entregado debe existir firma de recibido, datos de quien recibe y fecha/hora de entrega.
- El pedido pasa a pagado cuando la factura asociada queda sin saldo.
- Todo pedido debe conservarse aunque sea rechazado, cancelado, facturado, entregado, pagado o vencido.

## Facturas, pagos, notas y credito comercial

- Una factura pertenece a un cliente y puede estar ligada a un pedido.
- Los estados de factura definidos son `PENDING`, `PARTIAL`, `PAID` y `CANCELLED`.
- La factura interna o documento comercial debe preservar datos historicos de productos, lotes, precios e impuestos.
- Los pagos pueden ser totales o parciales.
- Todo pago debe adjuntar comprobante: SINPE, transferencia, ticket de efectivo, factura o documento equivalente.
- Si el pago lo recibe el agente, debe registrarse en hoja de cobro.
- Cuando el agente entrega efectivo, el monto entregado debe cotejarse contra el monto registrado.
- Un usuario administrativo debe firmar recibido del efectivo entregado por el agente.
- En credito, el cliente paga despues mediante los metodos aceptados.
- Los pagos parciales se registran como abonos a una o varias facturas.
- Cada abono debe generar o asociarse a un recibo de dinero.
- Si el pago cubre totalmente una factura, debe marcarse como pagada.
- Una nota de credito por devolucion debe ligarse a la factura original.
- La nota de credito genera saldo a favor del cliente para compras posteriores.
- La nota de credito no elimina ni modifica destructivamente la factura original.
- La nota de debito aumenta el monto o deuda sobre una factura y debe ligarse a la factura original.
- La factura debe registrar los lotes de los productos facturados.
- En devoluciones, un administrador debe cotejar que el lote devuelto coincida con el lote facturado.
- Si el lote devuelto no coincide con el lote facturado, la devolucion queda rechazada o en revision.
- Control de calidad debe validar si el producto devuelto vuelve a bodega, se reprocesa o se destruye.

## Facturacion fiscal Costa Rica

- Cada empresa representa un cliente/tenant independiente del SaaS para efectos de facturacion electronica.
- La empresa puede almacenar referencias seguras a los datos fiscales necesarios para emitir ante Hacienda.
- La configuracion fiscal debe incluir identificacion, actividad economica, direccion, correo, telefono, ambiente, certificado o referencias seguras, credenciales y codigos de sucursal/terminal.
- Una empresa puede tener configuracion separada para pruebas y produccion.
- Cada empresa debe usar sus propias credenciales y llave/certificado de Hacienda.
- Una empresa no puede emitir documentos fiscales sin configuracion fiscal activa y validada.
- Un usuario o proceso de una empresa no puede usar credenciales fiscales de otra empresa.
- Un comprobante emitido debe conservar la configuracion fiscal usada o una referencia inmutable a ella.
- La configuracion fiscal usada por un comprobante debe pertenecer a la misma empresa emisora.
- Los consecutivos fiscales se controlan por empresa, tipo de comprobante, sucursal y terminal.
- La asignacion de consecutivo debe ser transaccional.
- No se deben generar consecutivos duplicados aunque existan solicitudes concurrentes.
- Una clave o consecutivo asignado a un comprobante emitido no debe editarse.
- Si el envio falla, el consecutivo no debe reutilizarse sin regla fiscal explicita.
- El estado fiscal debe estar separado del estado comercial de pedido, factura y pago.
- Una factura aceptada por Hacienda no se edita destructivamente.
- Las correcciones se hacen con nota de credito, nota de debito o documento relacionado.
- El XML firmado y la respuesta de Hacienda son evidencia historica.
- Todo intento de envio o consulta ante Hacienda debe quedar en bitacora.
- Los errores de Hacienda deben conservarse con mensaje y payload.
- Si Hacienda rechaza, el sistema debe permitir correccion controlada, no edicion libre del documento emitido.
- El inventario debe descontarse segun politica configurada: al facturar o al aceptar Hacienda.

## Productos no fisicos

- Un producto vendible puede ser fisico, temporal o limitado, o una afiliacion.
- Los productos fisicos usan inventario, lotes y bodegas cuando aplique.
- Los productos temporales o limitados y las afiliaciones deben conservar trazabilidad con bodegas virtuales.
- Las bodegas virtuales de productos temporales o limitados y afiliaciones no alimentan movimientos fisicos, produccion, cuarentena ni devoluciones.
- Los productos temporales o limitados deben manejar disponibilidad controlada.
- Cada oferta de producto temporal o limitado debe tener un lote virtual asociado para controlar cupos o disponibilidad.
- Una venta de producto temporal o limitado debe registrar reserva del cliente.
- El sistema no debe permitir reservar o vender por encima de la disponibilidad controlada.
- Las afiliaciones deben manejar vigencia y estado.
- Cada tipo o plan de afiliacion debe tener un lote virtual asociado.
- Cada afiliacion activa de cliente debe tener un codigo unico en la relacion cliente-plan.
- Las afiliaciones deben generar cobros recurrentes segun frecuencia configurable por plan.
- Las facturas recurrentes de afiliacion deben conservar trazabilidad hacia el plan y el cliente.

## Produccion y formulas

- Las formulas las crea el regente de produccion o un usuario con permiso equivalente.
- Una formula solo puede incluir materias primas existentes, activas y registradas en catalogo.
- Si una materia prima no existe en catalogo, la formula queda en borrador o incompleta.
- Una formula solo puede ser formula maestra si todos sus componentes existen y el porcentaje total suma 100%.
- El BOM se genera automaticamente a partir de la formula maestra, la cantidad final solicitada y el porcentaje de cada componente.
- Toda formula debe tener historial de versiones.
- Cada version debe conservar snapshot de componentes, porcentajes, usuario, fecha y motivo.
- BOM, orden de produccion y calculo de costo deben conservar la version de formula utilizada.

## Reporteria, visitas y seguimiento comercial

- Las ventas deben poder analizarse historicamente por zona y subzona.
- Las actividades de venta y seguimiento deben registrarse por cliente, agente, ruta, tipo de actividad, estado y fecha.
- La bitacora de visita debe registrar llegada, salida, resultado y notas.
- La bitacora debe asociarse a cliente, ruta y agente.
- La hoja de inventario de ruta debe registrar inventario observado o reportado durante la visita al cliente.
- La hoja de inventario de ruta debe poder ser revisada por supervisor.
- La metrica de confianza de pago y sus umbrales deben ser configurables por root.

## Reglas ya reflejadas en codigo/modelo actual

- `ClientStore.subregionId` es obligatorio.
- `Region` tiene unicidad por empresa y nombre.
- `Subregion` tiene unicidad por zona y nombre.
- `Client` tiene unicidad por empresa y codigo.
- `ClientStore` tiene unicidad por cliente y codigo.
- `ClientLegalEntity` tiene unicidad por empresa e identificacion.
- `Product` tiene unicidad por empresa y codigo.
- `Supplier` tiene unicidad por empresa y nombre.
- `RecipeIngredient` tiene unicidad por formula y producto.
- `FiscalSequence` tiene unicidad por empresa, tipo de documento, sucursal y terminal.
- El servicio de clientes exige que el usuario tenga empresa para crear/listar clientes de empresa.
- El servicio de tiendas valida que la zona exista en la empresa del usuario.
- El servicio de tiendas valida que la subzona seleccionada pertenezca a la zona seleccionada.
- El servicio de tiendas rechaza codigos duplicados de tienda dentro del cliente.
- El servicio de zonas exige empresa en el usuario administrador.
- El servicio de zonas rechaza zonas duplicadas por nombre dentro de la empresa.
- El servicio de subzonas rechaza subzonas duplicadas por nombre dentro de la zona.

## Reglas pendientes de implementacion o ampliacion

- Historial formal de estados para pedidos y cambios criticos.
- Bitacora minima de acciones criticas.
- Permisos completos por accion sensible.
- Bodegas fisicas y virtuales con configuracion operativa.
- Stock por bodega, lote y producto.
- Alertas de vencimiento, QA y salidas extraordinarias.
- Flujo completo de compras, recepcion, cuarentena y QA.
- Flujo completo de pedidos con aprobaciones administrativas y de credito.
- Descuento de inventario al facturar.
- Facturacion fiscal electronica directa con XML, firma, envio y consulta ante Hacienda.
- Notas de credito/debito fiscales con trazabilidad completa.
- Hojas de cobro, visitas, inventario de ruta y gestion avanzada de agentes.
- Produccion avanzada, formulas versionadas, BOM y ordenes de produccion completas.
