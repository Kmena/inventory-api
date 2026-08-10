(() => {
'use strict';

const AgentShell = /** @type {any} */ (window).AgentShell;

let _session = null;
let _stores = [];
let _goals = [];
let _selectedStoreId = null;

const state = {
  // Sesión
  getSession() { return _session; },
  setSession(s) { _session = s; },

  // Stores (lista de tiendas priorizada)
  getStores() { return _stores; },
  setStores(stores) { _stores = Array.isArray(stores) ? stores : []; },

  // Metas activas
  getGoals() { return _goals; },
  setGoals(goals) { _goals = Array.isArray(goals) ? goals : []; },

  // ID de la tienda seleccionada (persiste entre navegaciones)
  getSelectedStoreId() { return _selectedStoreId; },
  setSelectedStoreId(id) { _selectedStoreId = id ?? null; },
};

AgentShell.register('state', state);

})();
