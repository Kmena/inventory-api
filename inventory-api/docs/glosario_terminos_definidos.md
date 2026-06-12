# Glosario de terminos definidos

Este glosario consolida los terminos usados en el PRD, reglas de negocio, modelo de datos y flujos actuales del sistema.

## A

### Actividad economica

Codigo y nombre que identifican la actividad comercial o fiscal de una empresa, razon social o cliente. Se usa para preparacion de facturacion electronica y datos fiscales.

### Ajuste comercial

Regla que modifica el precio final de un producto a partir del precio general. Puede representar promocion, bonificacion, regalia o descuento. No reemplaza el precio general.

### Alerta de inventario

Aviso generado por riesgo operativo relacionado con lote, producto o bodega. Ejemplos: lote cercano a vencimiento, lote vencido, falla QA o salida extraordinaria.

### Alta de cliente

Proceso para crear o proponer un cliente nuevo. Puede incluir datos comerciales, fiscales, tiendas, contactos, referencias, documentos, condiciones de pago y solicitud de credito.

### Ambiente de Hacienda

Entorno fiscal usado para facturacion electronica. Puede ser pruebas o produccion.

### Articulo

Elemento del catalogo. Puede ser materia prima, envase, tapa, etiqueta, producto terminado o miscelaneo.

### Autorizacion

Aprobacion dada por un usuario con permiso activo para ejecutar una operacion sensible, como entrada de bodega, salida, transferencia, cambio de precio o aprobacion de credito.

## B

### Bitacora

Registro historico de acciones, eventos o cambios relevantes. Debe conservar usuario, fecha y contexto de la accion cuando aplique.

### Bodega

Ubicacion logica u operativa donde se controla inventario. Puede ser fisica o virtual.

### Bodega fisica

Bodega que representa inventario real y puede participar en movimientos fisicos, recepciones, ventas, cuarentena o devoluciones.

### Bodega origen

Bodega desde la cual sale inventario en una transferencia o movimiento.

### Bodega destino

Bodega hacia la cual entra inventario en una transferencia o movimiento.

### Bodega vendible

Bodega configurada como fuente valida para alimentar ventas.

### Bodega virtual

Bodega usada para trazabilidad de productos no fisicos, como cursos o afiliaciones. No debe alimentar movimientos fisicos, produccion, cuarentena ni devoluciones.

### BOM

Lista de materiales generada a partir de una formula maestra, la cantidad final solicitada y el porcentaje de cada componente.

### Bonificacion

Ajuste comercial que otorga beneficio al cliente, usualmente mediante producto o valor adicional, sin reemplazar el precio general.

## C

### CABYS/CABIS

Catalogo fiscal de bienes y servicios requerido para validaciones fiscales en Costa Rica. Aplica a productos, impuestos y facturacion electronica cuando se implemente.

### Canton

Division territorial usada en direcciones de clientes, tiendas, razones sociales y configuracion fiscal.

### Categoria

Clasificacion principal de articulos o productos dentro del inventario. En el modelo pertenece a un inventario.

### Certificado fiscal

Certificado digital del emisor usado para firmar XML de comprobantes electronicos ante Hacienda.

### Cliente

Entidad comercial a la que se le venden productos o servicios. Pertenece a una empresa, puede tener razon social, tiendas, contactos, referencias, credito, pedidos y facturas.

### Cliente activo

Cliente habilitado para generar pedidos nuevos. Su actividad puede depender de compras dentro de un periodo configurable.

### Codigo de cliente

Identificador interno del cliente. Debe ser unico dentro de la empresa cuando se define.

### Codigo de producto

Identificador interno del producto. Debe ser unico dentro de la empresa cuando se define.

### Codigo de ruta

Identificador operativo asociado a una zona o subzona para clasificacion territorial y seguimiento comercial.

### Codigo de tienda

Identificador interno de una tienda. Debe ser unico dentro del cliente cuando se define.

### Comprobante electronico

Documento fiscal generado para Hacienda, como factura, tiquete, nota de credito o nota de debito electronica.

### Configuracion fiscal

Datos necesarios para emitir comprobantes ante Hacienda: identificacion, actividad economica, direccion, ambiente, certificado, credenciales, sucursal y terminal.

### Consecutivo fiscal

Numero secuencial asignado a un comprobante fiscal por empresa, tipo de documento, sucursal y terminal. Debe asignarse de forma transaccional y no duplicarse.

### Contacto de cliente

Persona relacionada con un cliente. Puede registrar nombre, rol, correo, telefono y movil.

### Contado

Condicion de pago en la que no aplica aprobacion de credito y cobro. Puede pagarse antes o contra entrega segun politica.

### Credito

Condicion comercial en la que el cliente paga despues. Se controla mediante limite, saldo, dias de pago, facturas pendientes y revisiones de credito/cobro.

### Credito y cobro

Area o rol responsable de revisar solicitudes de credito, saldos, historico de pago, facturas abiertas y estado del cliente.

### Cuarentena

Estado o bodega de control para productos recibidos que aun no estan aprobados para venta o uso. Un lote en cuarentena no debe venderse.

### Cuenta por pagar

Obligacion financiera generada por una compra aprobada hacia un proveedor.

### Cupo

Cantidad maxima disponible para un curso u oferta no fisica. El sistema no debe permitir inscripciones por encima del cupo disponible.

## D

### Descuento

Reduccion aplicada al precio de un item de pedido. Debe conservarse historicamente en el detalle del pedido.

### Deuda inicial

Saldo migrado o deuda previa con la que puede iniciar un cliente. Debe quedar auditable y alimentar el saldo de credito.

### Direccion fiscal

Direccion registrada para efectos fiscales de una empresa, razon social o receptor.

### Distrito

Division territorial usada en direcciones de clientes, tiendas, razones sociales y configuracion fiscal.

### Documento comercial

Documento interno o comercial asociado a una venta, factura o pedido. Debe preservar datos historicos de productos, precios, lotes e impuestos.

## E

### Empresa

Entidad principal propietaria de usuarios, roles, inventario, clientes, productos, proveedores, pedidos, configuracion fiscal y secuencias fiscales.

### Envase

Tipo de articulo del catalogo usado como material de empaque o contenedor.

### Estado comercial

Estado operativo de pedido, factura o pago. Debe mantenerse separado del estado fiscal.

### Estado fiscal

Estado de un comprobante ante Hacienda. Debe mantenerse separado del estado comercial.

### Evidencia historica

Registro o archivo que respalda una operacion pasada, como XML firmado, respuesta de Hacienda, comprobante de pago, aprobacion o bitacora.

## F

### Factura

Documento de cobro asociado a un cliente y opcionalmente a un pedido. Puede tener pagos y estados como pendiente, parcial, pagada o cancelada.

### Factura electronica

Comprobante fiscal electronico emitido ante Hacienda.

### Factura interna

Documento comercial interno usado para preservar datos historicos de productos, lotes, precios e impuestos, aun si la emision fiscal completa queda para una fase posterior.

### FiscalSequence

Entidad del modelo que controla consecutivos fiscales por empresa, tipo de documento, sucursal y terminal.

### Formula

Definicion de componentes y porcentajes necesarios para producir un producto. Debe usar materias primas existentes, activas y registradas en catalogo.

### Formula maestra

Formula valida para produccion. Solo puede ser maestra si todos sus componentes existen y el porcentaje total suma 100%.

## G

### Geocodificacion

Proceso para obtener o validar ubicacion geografica, como latitud y longitud, a partir de datos de direccion.

### Glosario

Documento de referencia que define terminos usados por negocio, producto y desarrollo.

## H

### Hacienda

Ministerio de Hacienda de Costa Rica. Recibe, valida y responde comprobantes electronicos.

### Historial de estados

Registro de los cambios de estado de un pedido, factura, solicitud o proceso. Debe guardar usuario, fecha, motivo y comentario cuando aplique.

### Hoja de alta

Formulario o flujo para registrar o proponer un cliente nuevo.

### Hoja de cobro

Registro operativo de pagos recibidos por agente y montos entregados a administracion.

### Hoja de inventario de ruta

Registro de inventario observado o reportado durante una visita a cliente. Debe asociarse a cliente, ruta, agente y fecha.

## I

### Identificacion fiscal

Numero y tipo de identificacion usado para empresa, razon social, cliente o receptor fiscal.

### Inscripcion

Registro creado cuando se vende un curso a un cliente.

### Inventario

Conjunto de articulos, productos, lotes, existencias y movimientos controlados por la empresa.

### Item de pedido

Linea de detalle de un pedido. Debe conservar producto, cantidad, precio general usado, descuentos, precio final y total.

## L

### Latitud

Coordenada geografica usada para ubicar una tienda.

### Limite de credito

Monto maximo aprobado para compras a credito de un cliente.

### Longitud

Coordenada geografica usada para ubicar una tienda.

### Lote

Agrupacion trazable de producto. Puede registrar proveedor, factura, numero de lote, fecha de produccion, vencimiento, entrada y cantidad.

### Lote interno

Numero o identificador creado por la empresa para controlar un lote recibido o producido.

### Lote virtual

Lote usado para trazabilidad de cursos o afiliaciones, sin representar inventario fisico.

## M

### Materia prima

Articulo usado como componente de una formula o proceso productivo.

### Miscelaneo

Tipo de articulo para productos que no son materia prima, envase, tapa, etiqueta ni producto terminado. Ejemplos: limpieza, oficina, mantenimiento y seguridad industrial.

### Movimiento de inventario

Registro que afecta o reserva inventario. Debe indicar producto, lote, cantidad, tipo, origen y fecha. Los tipos definidos son entrada, salida, ajuste, reserva y liberacion.

## N

### Nota de credito

Documento que corrige o reduce una factura original. Puede generar saldo a favor y no debe modificar destructivamente la factura original.

### Nota de debito

Documento que aumenta el monto o deuda sobre una factura original. Debe estar ligado a la factura original.

## O

### Orden de compra

Documento o flujo de compra ligado a proveedor y productos ofrecidos por ese proveedor. Debe tener estado.

### Orden de produccion

Documento o flujo que planifica produccion de una cantidad, posiblemente asociado a pedido y formula.

## P

### Pago

Registro de dinero recibido contra una factura. Puede ser total o parcial y debe conservar metodo, monto y referencia.

### Pago parcial

Abono aplicado a una o varias facturas. Debe generar o asociarse a un recibo de dinero.

### Pedido

Solicitud comercial de venta. Pertenece a una empresa y puede ligarse a cliente, usuario, aprobador, items, facturas y ordenes de produccion.

### Pedido aprobado

Pedido que ya paso las revisiones requeridas y puede avanzar hacia proforma, facturacion o entrega segun flujo.

### Permiso

Capacidad configurada para autorizar acciones sobre un modulo. Los permisos se asignan a roles.

### Precio final

Precio usado en el total del item despues de aplicar descuentos, promociones, bonificaciones o regalias.

### Precio general

Precio base de venta de un producto vendible. Debe estar activo y sus cambios aplican solo hacia adelante.

### Precio minimo

Precio calculado por costos de formula. Es una recomendacion y no cambia automaticamente el precio general.

### Producto

Articulo gestionado por empresa. Puede tener codigo, categoria, formula, precio, cantidad, inventario, lotes, proveedores y participacion en pedidos.

### Producto fisico

Producto que usa inventario, lotes y bodegas cuando aplica.

### Producto terminado

Producto vendible final. Puede activarse o desactivarse logicamente desde catalogo.

### Producto vendible

Producto que puede agregarse a pedidos. Puede ser fisico, curso o afiliacion.

### Promocion

Ajuste comercial vigente que modifica el precio final o condiciones de venta.

### Proveedor

Entidad que vende productos o materias primas a la empresa. Puede estar asociado a varios productos.

### Provincia

Division territorial usada en direcciones de clientes, tiendas, razones sociales y configuracion fiscal.

## Q

### QA

Control de calidad. Revisa, aprueba, rechaza o bloquea lotes y devoluciones segun reglas de calidad.

## R

### Razon social

Entidad legal o fiscal asociada a uno o varios clientes o tiendas. Guarda datos como nombre legal, identificacion, actividad economica, direccion, correo y telefono.

### Recibo de dinero

Documento o registro asociado a un pago o abono.

### Referencia comercial

Dato de respaldo asociado a un cliente para evaluar o documentar credito y relacion comercial.

### Regalia

Ajuste comercial que entrega beneficio adicional al cliente sin reemplazar el precio general.

### Region

Entidad del modelo que representa una zona comercial dentro de una empresa.

### Rol

Perfil asignado a un usuario. Agrupa permisos y puede pertenecer a una empresa o ser global.

### Ruta

Agrupacion operativa de una o varias subzonas para venta, seguimiento y visitas.

## S

### Saldo de credito

Monto pendiente o usado dentro del credito de un cliente.

### Salida extraordinaria

Movimiento de salida de inventario por motivo no ordinario, como vencimiento, falla QA, dano, contaminacion o excepcion manual.

### Secuencia fiscal

Control de numeracion fiscal usado para asignar consecutivos sin duplicados.

### Solicitud de credito

Formulario o flujo para que un cliente solicite condiciones de credito.

### Stock

Existencia disponible o controlada de producto. Puede medirse por producto, lote y bodega.

### Subcategoria

Clasificacion secundaria de un articulo o producto dentro del catalogo.

### Subzona

Subdivision de una zona. En el modelo pertenece a una region y puede agrupar tiendas.

### Sucursal

Codigo fiscal usado junto con terminal y tipo de documento para generar consecutivos ante Hacienda.

## T

### Tapa

Tipo de articulo del catalogo usado como componente o empaque.

### Terminal

Codigo fiscal usado junto con sucursal y tipo de documento para generar consecutivos ante Hacienda.

### Tienda

Punto comercial de un cliente. Pertenece a un cliente y debe asociarse a una subzona. Puede registrar razon social, zona, direccion y coordenadas.

### Tiquete electronico

Tipo de comprobante fiscal electronico reconocido por Hacienda.

### Trabajador o representante de tienda

Persona asociada a una tienda, con datos de identificacion, cargo, contacto, fechas relevantes y comentarios cuando aplique.

### Transferencia de bodega

Movimiento de inventario desde una bodega origen hacia una bodega destino. Puede requerir aprobaciones separadas.

### Trazabilidad

Capacidad de reconstruir el origen, cambios y destino de una operacion, producto, lote, pedido, factura o pago.

## U

### Usuario

Persona con acceso al sistema. Puede pertenecer a empresa, tener rol, estado y participar en pedidos o aprobaciones.

### Usuario autorizador

Usuario que aprueba una operacion sensible gracias a un permiso activo.

## V

### Venta a contado

Venta sin credito. Puede requerir pago previo o contra entrega.

### Venta a credito

Venta donde el cliente paga posteriormente y requiere revision de credito/cobro.

### Version de formula

Snapshot historico de una formula con componentes, porcentajes, usuario, fecha y motivo.

### Visita

Actividad comercial de seguimiento a cliente o tienda. Debe registrar llegada, salida, resultado, notas, cliente, ruta y agente.

## X

### XML firmado

Archivo XML de comprobante electronico firmado con el certificado fiscal del emisor. Es evidencia historica.

## Z

### Zona

Area comercial de una empresa. En el modelo se representa como `Region`; contiene subzonas y permite clasificar ventas, rutas y tiendas.
