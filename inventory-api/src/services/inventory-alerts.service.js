const inventoryRepository = require('../repositories/inventory.repository');
const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');
const audit = require('../lib/audit');
const { authScope } = require('./inventory-transaction-support.service');

const INVENTORY_ALERT_READ_PERMISSIONS = ['inventory.view', 'inventory.manage', 'inventory.qa.manage'];
const INVENTORY_ALERT_UPDATE_PERMISSIONS = ['inventory.manage', 'inventory.qa.manage'];

function hasAnyPermission(auth, permissions) {
  const userPermissions = auth?.permissions || [];
  return permissions.some((permission) => userPermissions.includes(permission));
}

function assertHasInventoryAlertPermission(auth, permissions, message) {
  if (!hasAnyPermission(auth, permissions)) {
    throw createHttpError(403, message, 'forbidden');
  }
}

function serializeInventoryAlert(alert) {
  return {
    id: alert.id,
    alertType: alert.alertType,
    severity: alert.severity,
    status: alert.status,
    message: alert.message,
    metadata: alert.metadata || null,
    createdAt: alert.createdAt,
    resolvedAt: alert.resolvedAt,
    product: alert.product || null,
    lot: alert.lot || null,
    warehouse: alert.warehouse || null,
    availableActions: alert.status === 'OPEN'
      ? ['ACKNOWLEDGED', 'RESOLVED']
      : alert.status === 'ACKNOWLEDGED'
        ? ['RESOLVED']
        : [],
  };
}

function mergeInventoryAlertMetadata(existingMetadata, statusTransition) {
  const baseMetadata = existingMetadata && typeof existingMetadata === 'object' && !Array.isArray(existingMetadata)
    ? existingMetadata
    : {};
  const statusHistory = Array.isArray(baseMetadata.statusHistory) ? [...baseMetadata.statusHistory] : [];
  statusHistory.push(statusTransition);

  return {
    ...baseMetadata,
    lastStatusChange: statusTransition,
    statusHistory,
  };
}

function assertInventoryAlertTransition(currentStatus, targetStatus) {
  const allowedTransitions = {
    OPEN: ['ACKNOWLEDGED', 'RESOLVED'],
    ACKNOWLEDGED: ['RESOLVED'],
    RESOLVED: [],
  };

  if (!allowedTransitions[currentStatus]?.includes(targetStatus)) {
    throw createHttpError(409, 'La alerta no permite la transicion solicitada', 'conflict');
  }
}

async function listInventoryAlerts(auth, filters = {}, pagination = null) {
  const { companyId } = authScope(auth);
  assertHasInventoryAlertPermission(auth, INVENTORY_ALERT_READ_PERMISSIONS, 'No tiene permisos para revisar alertas de inventario');

  const alerts = await inventoryRepository.findInventoryAlerts(companyId, filters, pagination);
  if (Array.isArray(alerts)) {
    return alerts.map(serializeInventoryAlert);
  }

  return buildPaginatedResponse(
    alerts.items.map(serializeInventoryAlert),
    pagination,
    alerts.totalItems,
  );
}

async function getInventoryAlert(alertId, auth) {
  const { companyId } = authScope(auth);
  assertHasInventoryAlertPermission(auth, INVENTORY_ALERT_READ_PERMISSIONS, 'No tiene permisos para revisar alertas de inventario');

  const alert = await inventoryRepository.findInventoryAlertById(alertId, companyId);
  if (!alert) {
    throw createHttpError(404, 'Alerta de inventario no encontrada para la empresa', 'not_found');
  }

  return serializeInventoryAlert(alert);
}

async function updateInventoryAlertStatus(alertId, payload, auth, req = null) {
  const { companyId, userId } = authScope(auth);
  assertHasInventoryAlertPermission(auth, INVENTORY_ALERT_UPDATE_PERMISSIONS, 'No tiene permisos para gestionar alertas de inventario');

  const existingAlert = await inventoryRepository.findInventoryAlertById(alertId, companyId);
  if (!existingAlert) {
    throw createHttpError(404, 'Alerta de inventario no encontrada para la empresa', 'not_found');
  }

  assertInventoryAlertTransition(existingAlert.status, payload.status);

  const changedAt = new Date();
  const statusTransition = {
    fromStatus: existingAlert.status,
    toStatus: payload.status,
    changedAt: changedAt.toISOString(),
    changedByUserId: userId.toString(),
    note: payload.note || null,
  };

  const updatedAlert = await inventoryRepository.updateInventoryAlert(alertId, companyId, {
    status: payload.status,
    resolvedAt: payload.status === 'RESOLVED' ? changedAt : existingAlert.resolvedAt,
    metadata: mergeInventoryAlertMetadata(existingAlert.metadata, statusTransition),
  });

  if (!updatedAlert) {
    throw createHttpError(409, 'La alerta no pudo actualizarse', 'conflict');
  }

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'inventory.alert.status.update',
    resourceType: 'inventory_alert',
    resourceId: alertId,
    outcome: 'SUCCESS',
    beforeState: {
      id: existingAlert.id,
      status: existingAlert.status,
      resolvedAt: existingAlert.resolvedAt,
    },
    afterState: {
      id: updatedAlert.id,
      status: updatedAlert.status,
      resolvedAt: updatedAlert.resolvedAt,
    },
    metadata: {
      note: payload.note || null,
      fromStatus: existingAlert.status,
      toStatus: payload.status,
    },
  });

  return serializeInventoryAlert(updatedAlert);
}

module.exports = {
  listInventoryAlerts,
  getInventoryAlert,
  updateInventoryAlertStatus,
};
