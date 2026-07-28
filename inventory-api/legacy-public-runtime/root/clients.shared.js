(function attachRootClientsShared(global) {
  const inventoryAuth = global.InventoryAuth;
  const COSTA_RICA_CENTER = { latitude: 9.7489, longitude: -83.7534 };
  const COSTA_RICA_BOUNDS = {
    north: 11.3,
    south: 8.0,
    west: -86.2,
    east: -82.3,
  };

  function optional(value) {
    const normalized = value?.toString().trim();
    return normalized || undefined;
  }

  function optionalNumber(value) {
    const normalized = optional(value);
    if (normalized === undefined) {
      return undefined;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function setMessage(element, text, isError = false) {
    element.textContent = text;
    element.className = 'message';
    if (isError) {
      element.classList.add('error');
    }
  }

  async function downloadProtectedFile(session, fileUrl, fileName, fallbackMessage = 'No se pudo descargar el documento') {
    return inventoryAuth.downloadProtectedFile(session, fileUrl, {
      fileName,
      fallbackMessage,
    });
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function lngToPercent(longitude) {
    return ((longitude - COSTA_RICA_BOUNDS.west) / (COSTA_RICA_BOUNDS.east - COSTA_RICA_BOUNDS.west)) * 100;
  }

  function latToPercent(latitude) {
    return ((COSTA_RICA_BOUNDS.north - latitude) / (COSTA_RICA_BOUNDS.north - COSTA_RICA_BOUNDS.south)) * 100;
  }

  function percentToLng(percent) {
    return COSTA_RICA_BOUNDS.west + (percent / 100) * (COSTA_RICA_BOUNDS.east - COSTA_RICA_BOUNDS.west);
  }

  function percentToLat(percent) {
    return COSTA_RICA_BOUNDS.north - (percent / 100) * (COSTA_RICA_BOUNDS.north - COSTA_RICA_BOUNDS.south);
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result?.toString() || '';
        const [, base64 = ''] = result.split(',');
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado'));
      reader.readAsDataURL(file);
    });
  }

  global.RootClientsShared = {
    COSTA_RICA_CENTER,
    COSTA_RICA_BOUNDS,
    optional,
    optionalNumber,
    setMessage,
    downloadProtectedFile,
    clamp,
    lngToPercent,
    latToPercent,
    percentToLng,
    percentToLat,
    readFileAsBase64,
  };
})(window);
