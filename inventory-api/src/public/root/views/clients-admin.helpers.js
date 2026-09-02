(function attachRootShellClientsAdminHelpers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function filterClients(clients, searchTerm, classificationFilter, statusFilter) {
    const normalizedSearchTerm = normalizeText(searchTerm);
    return (Array.isArray(clients) ? clients : []).filter((client) => {
      const matchesClassification = !classificationFilter || classificationFilter === 'all'
        || String(client?.clientClassificationId || client?.classification?.id || '') === String(classificationFilter);
      if (!matchesClassification) {
        return false;
      }

      const matchesStatus = !statusFilter || statusFilter === 'all'
        || (statusFilter === 'active' && client?.isActive !== false)
        || (statusFilter === 'inactive' && client?.isActive === false);
      if (!matchesStatus) {
        return false;
      }

      if (!normalizedSearchTerm) {
        return true;
      }

      return [
        client?.name,
        client?.code,
        client?.legalId,
        client?.phone,
        client?.classification?.name,
        client?.commercialName,
      ]
        .filter(Boolean)
        .some((value) => normalizeText(value).includes(normalizedSearchTerm));
    });
  }

  function summarizeClients(clients) {
    const safeClients = Array.isArray(clients) ? clients : [];
    return {
      total: safeClients.length,
      active: safeClients.filter((client) => client.isActive !== false).length,
      withStores: safeClients.filter((client) => Number(client.storesCount || client.stores?.length || 0) > 0).length,
      withDocuments: safeClients.filter((client) => Number(client.documents?.length || 0) > 0).length,
    };
  }

  function buildClientPayload(formData) {
    const numericFields = new Set(['clientClassificationId', 'paymentDays', 'creditLimit', 'creditBalance']);
    const allowedFields = [
      'clientClassificationId',
      'code',
      'name',
      'legalName',
      'commercialName',
      'legalId',
      'documentType',
      'economicActivityCode',
      'economicActivityName',
      'emailBilling',
      'emailCourtesy',
      'phone',
      'address',
      'province',
      'canton',
      'district',
      'paymentType',
      'paymentDays',
      'creditLimit',
    ];

    return allowedFields.reduce((payload, fieldName) => {
      const rawValue = formData.get(fieldName);
      if (rawValue === null || rawValue === undefined) {
        return payload;
      }
      const value = String(rawValue).trim();
      if (!value) {
        return payload;
      }
      payload[fieldName] = numericFields.has(fieldName) ? Number(value) : value;
      return payload;
    }, {});
  }

  function buildStorePayload(formData) {
    const payload = {
      name: String(formData.get('name') || '').trim(),
      subregionId: Number(formData.get('subregionId') || 0),
    };

    const optionalFields = ['code', 'storeType', 'locationReference', 'attentionSchedule', 'phone', 'address', 'province', 'canton', 'district'];
    for (const fieldName of optionalFields) {
      const value = String(formData.get(fieldName) || '').trim();
      if (value) {
        payload[fieldName] = value;
      }
    }

    const latitudeValue = String(formData.get('latitude') || '').trim();
    const longitudeValue = String(formData.get('longitude') || '').trim();
    if (latitudeValue) {
      payload.latitude = Number(latitudeValue);
    }
    if (longitudeValue) {
      payload.longitude = Number(longitudeValue);
    }

    return payload;
  }

  function buildReferencePayload(formData) {
    const payload = {
      name: String(formData.get('name') || '').trim(),
    };
    for (const fieldName of ['contact', 'phone1', 'phone2', 'approvedBy']) {
      const value = String(formData.get(fieldName) || '').trim();
      if (value) {
        payload[fieldName] = value;
      }
    }
    for (const fieldName of ['termDays', 'amount']) {
      const value = String(formData.get(fieldName) || '').trim();
      if (value) {
        payload[fieldName] = Number(value);
      }
    }
    payload.approved = formData.get('approved') === 'on';
    return payload;
  }

  function buildDocumentPayload(formData) {
    return {
      documentType: String(formData.get('documentType') || '').trim(),
      documentNumber: String(formData.get('documentNumber') || '').trim(),
      fileName: String(formData.get('fileName') || '').trim(),
      mimeType: String(formData.get('mimeType') || '').trim() || undefined,
      fileContentBase64: String(formData.get('fileContentBase64') || '').trim(),
      notes: String(formData.get('notes') || '').trim(),
    };
  }

  rootShell.register('views.clientsAdminHelpers', {
    buildClientPayload,
    buildDocumentPayload,
    buildReferencePayload,
    buildStorePayload,
    filterClients,
    normalizeText,
    summarizeClients,
  });
}(window));
