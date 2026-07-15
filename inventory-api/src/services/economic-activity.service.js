const ACTIVITIES = [
  { code: '471101', name: 'Venta al por menor en supermercados' },
  { code: '471102', name: 'Venta al por menor en pulperias y abastecedores' },
  { code: '472101', name: 'Venta al por menor de alimentos, bebidas y tabaco' },
  { code: '561001', name: 'Restaurantes, sodas y servicios de comida' },
  { code: '562100', name: 'Servicio de catering' },
  { code: '463000', name: 'Comercio al por mayor de alimentos, bebidas y tabaco' },
  { code: '469000', name: 'Comercio al por mayor no especializado' },
  { code: '477300', name: 'Venta al por menor de productos farmaceuticos' },
  { code: '475200', name: 'Venta al por menor de articulos de ferreteria' },
  { code: '452000', name: 'Mantenimiento y reparacion de vehiculos automotores' },
  { code: '492300', name: 'Transporte de carga por carretera' },
  { code: '620100', name: 'Programacion informatica' },
  { code: '702000', name: 'Actividades de consultoria de gestion' },
  { code: '681000', name: 'Actividades inmobiliarias con bienes propios o arrendados' },
  { code: '960200', name: 'Peluqueria y otros tratamientos de belleza' },
];

function searchActivities(query) {
  const normalizedQuery = query?.toString().trim().toLowerCase();
  if (!normalizedQuery) {
    return ACTIVITIES;
  }

  return ACTIVITIES.filter((activity) => (
    activity.code.includes(normalizedQuery)
    || activity.name.toLowerCase().includes(normalizedQuery)
  ));
}

module.exports = {
  searchActivities,
};
