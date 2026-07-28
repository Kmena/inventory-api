const audit = require('../../src/lib/audit');

function createNoOpAuditRecorder() {
  return async () => null;
}

function enableDbFreeAuditSeams() {
  const originalRecordAuditEventIfAvailable = audit.recordAuditEventIfAvailable;
  const originalRecordAuditEventSafelyIfAvailable = audit.recordAuditEventSafelyIfAvailable;

  audit.recordAuditEventIfAvailable = createNoOpAuditRecorder();
  audit.recordAuditEventSafelyIfAvailable = createNoOpAuditRecorder();

  return () => {
    audit.recordAuditEventIfAvailable = originalRecordAuditEventIfAvailable;
    audit.recordAuditEventSafelyIfAvailable = originalRecordAuditEventSafelyIfAvailable;
  };
}

module.exports = {
  enableDbFreeAuditSeams,
};
