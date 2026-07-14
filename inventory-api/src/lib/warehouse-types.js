const WAREHOUSE_TYPES = [
  {
    value: 'GENERAL',
    label: 'General',
    description: 'Bodega comodin para operaciones internas o transitorias.',
    isVirtual: false,
    defaultSellableSource: false,
  },
  {
    value: 'RAW_MATERIAL',
    label: 'Materia prima',
    description: 'Almacena insumos y materiales base para produccion.',
    isVirtual: false,
    defaultSellableSource: false,
  },
  {
    value: 'FINISHED_GOODS',
    label: 'Producto terminado',
    description: 'Bodega fisica para producto disponible para venta o despacho.',
    isVirtual: false,
    defaultSellableSource: true,
  },
  {
    value: 'PACKAGING',
    label: 'Empaque',
    description: 'Resguarda envases, tapas, etiquetas y materiales de empaque.',
    isVirtual: false,
    defaultSellableSource: false,
  },
  {
    value: 'QUARANTINE',
    label: 'Cuarentena',
    description: 'Aisla lotes pendientes de revision o liberacion.',
    isVirtual: false,
    defaultSellableSource: false,
  },
  {
    value: 'RETURNS',
    label: 'Devoluciones',
    description: 'Recibe producto devuelto para analisis o reproceso.',
    isVirtual: false,
    defaultSellableSource: false,
  },
  {
    value: 'PRODUCTION',
    label: 'Produccion',
    description: 'Soporta consumos y recepciones internas del proceso productivo.',
    isVirtual: false,
    defaultSellableSource: false,
  },
  {
    value: 'ADMIN_VIRTUAL',
    label: 'Administrativa virtual',
    description: 'Bodega virtual para devoluciones y retenciones administrativas.',
    isVirtual: true,
    defaultSellableSource: false,
  },
  {
    value: 'COURSES_VIRTUAL',
    label: 'Virtual',
    description: 'Bodega virtual para productos sin almacenamiento fisico, como cursos u otras ofertas no inventariables.',
    isVirtual: true,
    defaultSellableSource: false,
  },
  {
    value: 'AFFILIATIONS_VIRTUAL',
    label: 'Afiliaciones virtual',
    description: 'Representa membresias o afiliaciones sin inventario fisico.',
    isVirtual: true,
    defaultSellableSource: false,
  },
];

const WAREHOUSE_TYPE_MAP = new Map(WAREHOUSE_TYPES.map((item) => [item.value, item]));

function getWarehouseTypeDefinition(value) {
  return WAREHOUSE_TYPE_MAP.get(value) || WAREHOUSE_TYPE_MAP.get('GENERAL');
}

function isVirtualWarehouseType(value) {
  return Boolean(getWarehouseTypeDefinition(value)?.isVirtual);
}

module.exports = {
  WAREHOUSE_TYPES,
  getWarehouseTypeDefinition,
  isVirtualWarehouseType,
};
