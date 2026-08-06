(function attachRootShellLotsAdminState(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  function createInitialState() {
    return {
      lots: [],
      filteredLots: [],
      filters: {
        searchTerm: '',
        warehouseId: '',
        qaStatus: '',
        lotStatus: '',
        expiry: 'all',
        alertStatus: 'all',
      },
      gate: { passed: false, reason: '' },
      alertsAvailable: false,
      warehousesAvailable: false,
      selectedLotId: null,
      drawerOpen: false,
      showQaForm: false,
      loading: false,
    };
  }

  rootShell.register('views.lotsAdminState', {
    createInitialState,
  });
}(window));
