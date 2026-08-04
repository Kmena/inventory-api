(function attachRootShellClientsAdminState(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  function flattenZoneOptions(regions) {
    return (Array.isArray(regions) ? regions : []).flatMap((region) => (region.subregions || []).map((subregion) => ({
      id: subregion.id,
      name: subregion.name,
      regionName: region.name,
    })));
  }

  function getSelectedClient(clients, clientDetailsById, selectedClientId) {
    return clientDetailsById[String(selectedClientId)]
      || (Array.isArray(clients) ? clients : []).find((client) => String(client.id) === String(selectedClientId))
      || null;
  }

  function buildClientsListSummary(totalClients, filteredClients) {
    if (filteredClients === totalClients) {
      return `Consulta ${totalClients} clientes visibles de la empresa.`;
    }

    return `${filteredClients} de ${totalClients} clientes visibles con el filtro actual.`;
  }

  rootShell.register('views.clientsAdminState', {
    buildClientsListSummary,
    flattenZoneOptions,
    getSelectedClient,
  });
}(window));
