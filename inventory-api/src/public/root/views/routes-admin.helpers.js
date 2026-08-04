(function attachRootShellRoutesAdminHelpers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function filterRoutes(routes, searchTerm) {
    const normalizedSearchTerm = normalizeText(searchTerm);
    return (Array.isArray(routes) ? routes : []).filter((route) => {
      if (!normalizedSearchTerm) {
        return true;
      }
      return [route?.code, route?.name]
        .filter(Boolean)
        .some((value) => normalizeText(value).includes(normalizedSearchTerm));
    });
  }

  function summarizeOverview(overview) {
    const routes = Array.isArray(overview?.routes) ? overview.routes : [];
    const summary = overview?.summary || {};
    return {
      routesCount: Number(summary.routesCount || routes.length || 0),
      subzonesCount: Number(summary.subzonesCount || 0),
      storesCount: Number(summary.storesCount || 0),
      assignedAgentsCount: Number(summary.assignedAgentsCount || 0),
    };
  }

  function buildMapModel(stores) {
    const mappableStores = (Array.isArray(stores) ? stores : []).filter((store) => {
      const latitude = store?.latitude;
      const longitude = store?.longitude;
      if (latitude === null || latitude === undefined || latitude === '' || longitude === null || longitude === undefined || longitude === '') {
        return false;
      }
      return Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
    });
    if (!mappableStores.length) {
      return {
        hasMapData: false,
        points: [],
        bounds: null,
      };
    }

    const latitudes = mappableStores.map((store) => Number(store.latitude));
    const longitudes = mappableStores.map((store) => Number(store.longitude));
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const latitudeSpan = Math.max(0.01, maxLatitude - minLatitude);
    const longitudeSpan = Math.max(0.01, maxLongitude - minLongitude);

    return {
      hasMapData: true,
      bounds: {
        minLatitude,
        maxLatitude,
        minLongitude,
        maxLongitude,
      },
      points: mappableStores.map((store) => ({
        id: store.id,
        name: store.name,
        code: store.code,
        latitude: Number(store.latitude),
        longitude: Number(store.longitude),
        x: 24 + (((Number(store.longitude) - minLongitude) / longitudeSpan) * 352),
        y: 24 + ((1 - ((Number(store.latitude) - minLatitude) / latitudeSpan)) * 192),
      })),
    };
  }

  function buildRoutePayload(formData) {
    return {
      code: String(formData.get('code') || '').trim(),
      name: String(formData.get('name') || '').trim(),
      visitFrequencyDays: Number(formData.get('visitFrequencyDays') || 0),
      nearLimitDays: Number(formData.get('nearLimitDays') || 0),
      isActive: formData.get('isActive') === 'on',
    };
  }

  function buildGoalsPayload(rows) {
    return {
      goals: (Array.isArray(rows) ? rows : [])
        .map((row) => ({
          title: String(row.title || '').trim(),
          periodLabel: String(row.periodLabel || '').trim() || null,
          targetAmount: Number(row.targetAmount || 0),
          currentAmount: Number(row.currentAmount || 0),
          notes: String(row.notes || '').trim() || null,
          isActive: row.isActive !== false,
        }))
        .filter((row) => row.title),
    };
  }

  rootShell.register('views.routesAdminHelpers', {
    buildGoalsPayload,
    buildMapModel,
    buildRoutePayload,
    filterRoutes,
    normalizeText,
    summarizeOverview,
  });
}(window));
