# Actualizacion PRD - catalogo, productos terminados y precios

Este documento complementa el PRD base con reglas funcionales para catalogo de productos terminados y calculo comercial de precios.

## Alcance agregado

El sistema debe permitir administrar desde catalogo los productos terminados que pueden venderse, asi como su precio general y los ajustes comerciales aplicables.

## Clasificacion del catalogo

El catalogo no debe limitarse a materia prima, envases y producto terminado. La base de datos debe contemplar como minimo:

- materia prima
- envases
- tapas
- etiquetas
- producto terminado
- miscelaneos

Cada categoria principal debe tener subclasificaciones propias. Por ejemplo:

- materia prima: azucar, acidos, esencias, colorantes
- envases: botella, galon, bolsa, caja
- tapas: rosca, presion, seguridad
- etiquetas: frontal, trasera, cuello, promocional
- producto terminado: linea, familia comercial, presentacion
- miscelaneos: limpieza, oficina, mantenimiento, seguridad industrial

Los productos de limpieza y el material de oficina deben registrarse bajo miscelaneos con su subclasificacion correspondiente.

## Jerarquia y administracion de articulos

Reglas:

- El catalogo maneja articulos; un articulo puede ser materia prima, envase, tapa, etiqueta, producto terminado o miscelaneo.
- Solo el administrador de proveeduria puede crear articulos nuevos.
- El usuario administrativo administrador y el administrador de proveeduria pueden definir categorias, subcategorias, descripciones y asignarlas a los articulos cuando tengan permiso activo.
- El usuario administrativo administrador y el administrador de proveeduria pueden registrar precios de compra o precio general, segun el tipo de articulo.
- El precio minimo calculado por formula es solo una recomendacion.
- El precio general publicado no puede cambiar sin autorizacion de `root`.
- El regente de produccion puede modificar valores caracteristicos necesarios para producir, por ejemplo unidad, densidad y factor de conversion a kilos para liquidos.
- El regente de produccion no debe crear materias primas desde la formula; si falta una materia prima, debe solicitar su alta a proveeduria.

## Proveeduria, proveedores y ordenes de compra

Reglas:

- El jefe de proveeduria registra proveedores.
- Para cada proveedor debe registrarse que productos del inventario vende.
- Los productos vendidos por proveedor pueden ser materias primas existentes en el sistema.
- Proveeduria puede registrar posibles materias primas sustitutas ofrecidas por proveedor.
- Las ordenes de compra deben ligarse a proveedor y a productos ofrecidos por ese proveedor.
- Si la compra se acepta y se recibe, debe ingresarse al inventario con lote, ficha de ingreso/cuarentena y movimiento trazable.
- La compra aceptada no debe saltarse QA ni autorizaciones de ingreso a bodega.
- Si se acepta una materia prima sustituta que afecta una formula, produccion debe crear o revisar una nueva version de formula.
- Las versiones de formula deben conservarse en historial.
- Una version de formula con sustituto no debe borrar ni reemplazar destructivamente versiones anteriores.
- El jefe de proveeduria debe revisar si hoy falta alguna materia prima porque llego al minimo.
- Proveeduria contacta proveedores y registra precio del dia por producto.
- El sistema debe comparar cotizaciones y permitir seleccionar la opcion mas barata, considerando disponibilidad y tiempo de entrega.
- La opcion seleccionada debe enviarse a gerencia con estadisticas y justificacion de la seleccion.
- Si gerencia aprueba, la orden se manda a comprar.
- Si gerencia rechaza, se registran nuevas indicaciones y proveeduria vuelve a contactar proveedores.
- La orden aprobada debe generar desglose para financiero contable como cuenta por pagar.
- Al llegar el proveedor, debe entregar COA cuando aplique.
- QA firma o valida el COA y se registra la cuarentena.
- QA realiza pruebas AQL para productos medidos en unidades o analisis de calidad con COA cuando aplique.
- Todo producto que entra debe ligar su lote a COA de entrada, etiqueta de cuarentena y pruebas de calidad necesarias.
- Una vez aprobado, la materia prima se recibe en bodega de producto aprobado con firma del encargado de bodega.
- Antes de enviarlo a bodega de materia prima, debe registrarse/generarse etiqueta interna.

## Permisos administrables

El administrador debe poder configurar que puede o no puede hacer cada tipo de usuario mediante permisos.

Reglas:

- Los roles agrupan usuarios, pero la autorizacion real depende de permisos.
- No todos los usuarios pueden aprobar todos los tipos de operacion.
- Las salidas de bodega, entradas a bodega y transferencias entre bodegas deben poder requerir permisos diferentes.
- Una transferencia puede requerir aprobacion de bodega origen y aprobacion de bodega destino.
- El sistema debe impedir que un usuario apruebe una operacion si su rol no tiene el permiso requerido.
- Los cambios de permisos deben quedar auditados.

## Zonas, subzonas, rutas y agentes

La cartera de clientes debe organizarse territorialmente para ventas y seguimiento.

Reglas:

- Toda tienda de cliente debe estar asignada a una subzona.
- Un cliente puede operar varias tiendas en distintas subzonas.
- Toda subzona pertenece a una zona.
- Las zonas, subzonas y rutas deben tener identificador unico.
- Las rutas agrupan una o varias subzonas.
- Las rutas se asignan a agentes comerciales.
- Un agente puede tener una o varias rutas asignadas.
- Una ruta puede tener uno o varios agentes asignados.
- La asignacion de agente a ruta debe manejar vigencia para conservar historial.
- Las actividades de venta y seguimiento deben registrarse por cliente, agente, ruta, tipo de actividad, estado y fecha.
- Un agente solo debe gestionar clientes de sus rutas activas, salvo permisos administrativos.

## Roles operativos de ventas

La seccion de ventas debe manejar una jerarquia operativa configurable por permisos.

Roles minimos:

- administrador / gerente de ventas
- subadministrador / supervisor
- empleado / agente

Reglas:

- El gerente de ventas puede crear subadministradores, asignar tareas, revisar resultados y calificar subadministradores.
- El gerente de ventas puede crear rutas, asignarlas a subadministradores, asignar agentes y limitar el alcance operativo.
- El gerente de ventas puede modificar informacion de clientes cuando tenga permiso activo.
- El supervisor solo puede ver rutas, agentes, clientes, prospectos y analisis dentro de su alcance asignado.
- El supervisor puede asignar rutas dentro de su alcance.
- El supervisor revisa hojas de cobro e inventario.
- El supervisor aprueba cambios en la hoja de clientes cuando tenga permiso activo.
- El agente llena informacion de clientes y propone nuevos clientes mediante una hoja de alta.
- Para crear un cliente nuevo se debe recolectar la informacion especifica definida por negocio.
- La hoja de alta debe indicar si el cliente sera de contado o si solicita credito.
- Si el cliente sera de contado, se registra sin formulario de credito.
- Si el cliente solicita credito, se debe llenar formulario de solicitud de credito.
- El formulario de solicitud de credito se envia al area de credito y cobro.
- Credito y cobro deben revisar y resolver la solicitud con estados separados.
- Si se aprueba la apertura, se crea o confirma el codigo unico del cliente.
- Si no se aprueba credito, el cliente puede quedar como contado si la politica comercial lo permite.
- Los clientes tienen clasificaciones definidas por root o por un rol con permiso equivalente.
- La clasificacion de cliente debe ser configurable y auditable.
- Una razon social puede estar asignada a varias tiendas.
- Una tienda solo puede tener una razon social.
- Cada tienda debe registrar latitud, longitud y referencia textual de ubicacion.
- La tienda puede registrar direccion, horario de atencion y tipo de tienda.
- Cada tienda debe asociarse a una subzona para rutas y analisis territorial.
- La informacion de representantes, responsables y empleados de tienda debe incluir nombre, identificacion, cargo, correo, telefonos, fechas importantes o cumpleanos, rol desempenado y comentarios.
- El alta de cliente debe recolectar referencias comerciales, personales o de cobro cuando aplique.
- El alta de cliente debe recolectar documentos requeridos para apertura y credito.
- Los documentos deben registrar tipo, numero o identificador, archivo o URL, vigencia, estado y notas.
- La solicitud de credito debe registrar limite solicitado.
- Si se aprueba credito, debe registrar limite aprobado.
- Si el cliente inicia con deuda o saldo migrado, debe registrarse deuda inicial.
- La deuda inicial aprobada debe alimentar el saldo de credito del cliente y quedar auditable.
- El sistema debe registrar que agente crea o propone cada cliente nuevo.
- La creacion de clientes nuevos puede configurarse como meta de agente.
- La meta debe registrar periodo, objetivo, avance y estado.
- El status activo de un cliente depende de si ha realizado compras en los ultimos `n` meses.
- El valor `n` debe ser configurable por root o permiso equivalente.
- Si el cliente compro dentro del periodo configurado, queda activo; si no, queda inactivo.
- Las acciones de cada rol deben validarse por permisos configurables, no solo por el nombre del rol.

## Hojas de trabajo del agente

El agente debe tener acceso operativo a las siguientes hojas.

### Hoja de cobro

- Debe registrar pagos recibidos por cliente.
- Debe mostrar al agente el historial visible de cuentas por cobrar de sus clientes asignados.
- Debe registrar la frecuencia real de pago para calcular confianza de pago.
- La metrica de confianza y sus umbrales deben ser configurables por root.

### Hoja de inventario

- Debe registrar inventario observado o reportado durante la visita al cliente.
- Debe quedar asociada a cliente, ruta, agente y fecha.
- Debe poder ser revisada por supervisor.

### Hoja conozca a sus clientes

- Debe registrar nombres de dependientes.
- Debe registrar frecuencia de pago percibida, calificacion, cumpleanos, gustos y datos personales relevantes.
- Debe registrar ubicacion de tienda con latitud, longitud y referencia.
- Debe registrar responsables y empleados de tienda con identificacion, cargo, contacto, fechas importantes, rol y comentarios.
- Debe considerar que una razon social puede tener varias tiendas, pero una tienda solo pertenece a una razon social.
- Debe registrar analisis de competencia: producto, tamano y precio.
- Debe registrar publicidad aceptada por el cliente, por ejemplo rotulos, demostradora, afiches u otros tipos configurables.

### Hoja de ruta

- Debe funcionar como bitacora de visita.
- Debe registrar cuando el agente llega a un cliente, cuando sale, resultado de visita y notas.
- Debe asociarse a cliente, ruta y agente.

## Analitica historica de ventas

El sistema debe permitir analizar ventas por territorio y formato comercial.

Reglas:

- Las ventas deben poder graficarse historicamente por zona.
- Las ventas deben poder graficarse historicamente por subzona.
- Debe poder definirse una vista por zona o por formato comercial.
- Debe poder calcularse ponderado mensual.
- Debe poder consultarse historico mensual por zona, subzona y formato cuando aplique.
- El ponderado debe conservar monto vendido, conteo de pedidos, valor de ponderacion y resultado ponderado.
- Las graficas deben derivarse de ventas/facturas confirmadas.
- El historico debe conservarse para analisis y no depender solo de recalcular en pantalla.

## Bodegas y stock disponible para venta

No todas las bodegas deben considerarse disponibles para venta. La base debe permitir varias bodegas por tipo.

Tipos minimos:

- cuarentena
- proceso
- producto terminado
- general u operativa

Reglas:

- Solo bodegas marcadas como fuente de venta pueden reservar o despachar pedidos.
- Las bodegas de cuarentena no pueden vender directamente.
- Las bodegas de proceso no pueden vender directamente salvo configuracion excepcional.
- Puede existir mas de una bodega de cuarentena, proceso o producto terminado.
- El sistema debe validar la configuracion de la bodega, no depender solo del nombre.

## Ficha de cuarentena y aprobación de ingreso

Todo producto de ingreso debe tener trazabilidad formal antes de quedar disponible.

Reglas:

- Se debe registrar lote interno.
- Se debe registrar lote del manufacturador cuando el proveedor lo informe.
- Al ingresar producto debe crearse ficha de cuarentena o revisión QA.
- La ficha debe indicar producto, lote interno, lote del manufacturador, proveedor, cantidad, bodega, resultado QA, observaciones y estado.
- La ficha debe ser aprobada o rechazada por un usuario autorizado.
- Un lote con ficha pendiente no puede pasar a bodega vendible.
- Un lote rechazado por QA debe quedar bloqueado o rechazado.
- Cada etapa del proceso debe requerir autorización de un encargado con permiso activo.
- Las entradas y movimientos hacia diferentes bodegas deben registrar solicitante, autorizador, bodega origen, bodega destino y fecha.
- El sistema no debe permitir movimientos entre etapas si la autorización requerida no existe.

## Alertas por lote y salidas extraordinarias

El sistema debe alertar cuando exista riesgo operativo sobre un lote o una salida no ordinaria.

Reglas:

- Debe alertarse cuando un lote este cerca de su fecha de vencimiento.
- El umbral de alerta de vencimiento debe ser configurable por empresa o producto.
- Un lote vencido no puede venderse.
- Un lote en cuarentena no puede venderse.
- Un lote con QA rechazado o fallido no puede venderse.
- Si un producto sale por motivo extraordinario, debe registrarse el motivo.
- Motivos extraordinarios minimos: vencimiento de lote, falla QA, daño, riesgo de contaminacion y excepcion manual.
- Una salida por vencimiento de lote o falla QA debe generar alerta.
- La alerta debe indicar producto, lote, bodega, severidad, motivo y estado.

## Catalogo de productos terminados

- Los productos terminados se activan o desactivan desde el catalogo de productos.
- La desactivacion es logica: no elimina el producto ni borra historial.
- Un producto terminado inactivo no puede agregarse a pedidos nuevos.
- Un producto terminado inactivo no puede asociarse a promociones, bonificaciones o regalias nuevas.
- Los pedidos, facturas, lotes, movimientos de inventario y formulas historicas deben seguir mostrando el producto aunque este inactivo.

## Productos no fisicos: cursos y afiliaciones

No todo producto vendible representa inventario fisico.

Reglas:

- Un producto vendible puede ser fisico, curso o afiliacion.
- Los productos fisicos usan inventario, lotes y bodegas cuando aplique.
- Los cursos y afiliaciones tambien deben conservar trazabilidad de lote y bodega usando bodegas virtuales.
- Debe existir una bodega virtual de cursos para almacenar los lotes que referencian cursos u ofertas de curso.
- Debe existir una bodega virtual de afiliaciones para almacenar los lotes que referencian tipos o planes de afiliacion.
- Las bodegas virtuales de cursos y afiliaciones no deben alimentar movimientos fisicos, produccion, cuarentena ni devoluciones.
- Los cursos deben manejar cupos limitados.
- Cada curso u oferta creada debe tener un lote virtual asociado para controlar sus cupos.
- Una venta de curso debe registrar la inscripcion del cliente.
- El sistema no debe permitir inscribir clientes por encima del cupo disponible.
- Las afiliaciones deben manejar vigencia y estado.
- Cada tipo o plan de afiliacion debe tener un lote virtual asociado.
- El numero de lote interno del plan de afiliacion debe ser igual al codigo del tipo o plan de afiliacion.
- Cada afiliacion activa de cliente debe tener un codigo unico en la relacion cliente-plan.
- Las afiliaciones deben generar cobros recurrentes cada cierto tiempo.
- La frecuencia de cobro de afiliacion debe ser configurable por plan.
- Un cliente puede tener afiliaciones activas, suspendidas, canceladas o vencidas.
- Las facturas recurrentes de afiliacion deben conservar trazabilidad hacia el plan y el cliente.

## Precio general

- Todo producto terminado vendible debe tener un precio general activo.
- El precio general es la base del calculo del precio de venta.
- El cambio del precio general aplica hacia adelante y no modifica pedidos historicos.
- El precio general solo puede modificarse con autorizacion de root.
- El precio minimo calculado por costos de formula es solo una recomendacion.
- El calculo de precio minimo no debe actualizar el precio general automaticamente.

## Formulas maestras y BOM automatico

- En produccion el termino de negocio es formula, no receta.
- Las formulas las crea el regente de produccion o un usuario con permiso equivalente.
- Una formula solo puede incluir materias primas existentes, activas y registradas en catalogo.
- Si una materia prima no existe en catalogo, la formula queda en borrador o incompleta.
- Una formula solo puede ser formula maestra si todos sus componentes existen y el porcentaje total suma 100%.
- Si la formula no suma 100%, no se puede usar para venta ni para orden formal de produccion.
- La formula maestra define porcentajes de componentes, no cantidades finales.
- El BOM se genera automaticamente a partir de la formula maestra, la cantidad final solicitada y el porcentaje de cada componente.
- `BOMItem.calculated_quantity` representa la cantidad real que debe alistarse por materia prima.
- Toda formula debe tener historial de versiones.
- Una materia prima sustituta aceptada por proveeduria puede generar una nueva version de formula.
- Cada version debe conservar snapshot de componentes, porcentajes, usuario, fecha y motivo.
- BOM, orden de produccion y calculo de costo deben poder conservar la version de formula utilizada.

## Promocion, bonificacion y regalia

- Las promociones, bonificaciones y regalias modifican el precio final a partir del precio general.
- Estos ajustes comerciales deben tener tipo, vigencia, estado y valor o regla de calculo.
- Un ajuste comercial no debe reemplazar ni borrar el precio general del producto.
- Solo se pueden aplicar ajustes comerciales activos y vigentes.

## Facturacion y pedido

- El modulo operativo se llama facturacion.
- Cualquier usuario autorizado puede registrar pedidos.
- El agente de ventas monta el pedido registrando productos, descuentos y condiciones solicitadas por el cliente.
- El cliente puede hacer o solicitar un pedido, pero el sistema debe registrar el usuario interno que lo captura.
- Al agregar un producto al pedido, el sistema debe tomar el precio general vigente.
- Si aplica promocion, bonificacion o regalia, el sistema calcula el precio final.
- El detalle del pedido debe conservar:
  - precio general usado
  - ajuste comercial aplicado, si existe
  - monto descontado o bonificado
  - precio final usado para el total
- El historico del pedido no debe recalcularse automaticamente cuando cambie el catalogo.
- Personal administrativo revisa condiciones de venta, descuentos, bonificaciones, regalias y validez comercial.
- Solo personal administrativo y credito/cobro pueden aprobar pedidos segun el tipo de revision requerida.
- Si la compra es a credito, credito y cobro debe revisar saldo, historico de pago, facturas abiertas y estado del cliente.
- Bodega genera proforma y factura cuando el pedido tiene aprobaciones requeridas.
- Bodega debe enviar XML a Hacienda y registrar la respuesta.
- El inventario no se descuenta al registrar ni al aprobar el pedido.
- El inventario se descuenta hasta que se factura, usando la factura como origen del movimiento de salida.
- Todo pedido debe conservar historial de estados y no debe eliminarse por rechazo, cancelacion, facturacion, entrega, pago o vencimiento.
- Estados minimos del pedido: borrador, enviado, pendiente de revision administrativa, rechazado por administracion, pendiente de credito/cobro, rechazado por credito, rechazado, aceptado, proforma generada, facturado, entregado, pagado, vencido y cancelado.
- Cada cambio de estado debe registrar usuario, fecha, motivo y comentario.
- La entrega debe ser confirmada por el transportista.
- Para marcar un pedido como entregado debe existir firma de recibido, datos de quien recibe y fecha/hora de entrega.
- El pedido pasa a pagado cuando la factura asociada queda sin saldo.
- El pedido pasa a vencido cuando la factura o saldo supera la fecha de vencimiento configurada.

## Proceso de pago

- Para pago de contado debe indicarse si ya fue pagado o si se paga contra entrega.
- En contado no aplica aprobacion de credito y cobro.
- En contado contra entrega debe validarse mercaderia antes de entregar/facturar.
- Si el cliente ya pago y no hay mercaderia disponible, debe alertarse a administracion para generar orden de esos productos.
- En el mismo caso, debe alertarse a ventas para informar atraso al cliente.
- Todo pago debe adjuntar comprobante: SINPE, transferencia, ticket de efectivo, factura o documento equivalente.
- Si el pago lo recibe el agente, debe registrarse en hoja de cobro.
- Cuando el agente entrega efectivo, el monto entregado debe cotejarse contra el monto registrado en sistema.
- Un usuario administrativo debe firmar recibido del efectivo entregado por el agente.
- En credito, el cliente paga tiempo despues por cualquiera de los metodos aceptados para contado.
- Si el pago se hace al agente, se registra en hoja de cobro.
- Si el pago se hace directo a la empresa, tesoreria/finanzas registra el comprobante en el sistema.
- Si una empresa tiene varias facturas pendientes y paga una parte, se registra como pago parcial.
- Los pagos parciales se registran como abonos a una o varias facturas.
- Cada abono debe generar o asociarse a un recibo de dinero.
- Si el pago cubre totalmente una factura, debe marcarse como pagada y registrarse el comprobante de pago total segun politica fiscal.

## Notas de credito, notas de debito y devoluciones

- Cuando el cliente devuelve producto, debe registrarse una nota de credito ligada a la factura original.
- La nota de credito debe registrarse ante Hacienda y conservar estado/respuesta fiscal.
- La nota de credito genera saldo a favor del cliente para futuras compras.
- El saldo a favor debe quedar registrado a nombre del cliente y poder aplicarse en compras posteriores.
- La nota de credito no elimina ni modifica destructivamente la factura original.
- La nota de debito aumenta el monto o deuda sobre una factura.
- La nota de debito debe estar ligada a la factura original.
- La nota de debito debe registrarse ante Hacienda y conservar estado/respuesta fiscal.
- La factura debe registrar los lotes de los productos facturados.
- Al realizar una nota de credito por devolucion, un administrador debe cotejar que el lote devuelto sea el mismo lote registrado en la factura.
- El administrador debe firmar/aprobar el recibido del producto devuelto.
- Si el lote devuelto no coincide con el lote facturado, la devolucion debe quedar rechazada o en revision.
- El encargado de control de calidad debe validar si el producto devuelto vuelve a bodega, se reprocesa o se destruye.
- Si vuelve a bodega, debe registrarse bodega destino, lote y estado de disponibilidad.
- Si se reprocesa, debe ligarse al flujo u orden de reproceso.
- Si se destruye, debe registrarse motivo, evidencia y salida extraordinaria cuando aplique.
