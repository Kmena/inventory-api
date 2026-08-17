'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serviceSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'procurement-rfq.service.js'),
  'utf8',
);

describe('procurement RFQ audit coverage', () => {
  it('imports audit helper', () => {
    assert.match(serviceSource, /require\('\.\.\/lib\/audit'\)/);
  });

  it('records invitation lifecycle audit events', () => {
    assert.match(serviceSource, /procurement\.rfq_invitation\.create/);
    assert.match(serviceSource, /procurement\.rfq_invitation\.template_generate/);
    assert.match(serviceSource, /procurement\.rfq_invitation\.template_refresh/);
    assert.match(serviceSource, /procurement\.rfq_invitation\.cancel/);
  });

  it('records response audit events', () => {
    assert.match(serviceSource, /procurement\.rfq_response\.submit/);
    assert.match(serviceSource, /procurement\.rfq_response\.manual_capture/);
    assert.match(serviceSource, /procurement\.rfq_response\.reject_token/);
  });

  it('uses safe audit recording wrapper', () => {
    assert.match(serviceSource, /recordAuditEventSafelyIfAvailable/);
  });

  it('does not include token-bearing fields inside audit metadata payloads', () => {
    const auditPayloadSnippets = serviceSource.match(/metadata:\s*\{[\s\S]*?\}/g) || [];
    for (const snippet of auditPayloadSnippets) {
      assert.doesNotMatch(snippet, /rawToken/);
      assert.doesNotMatch(snippet, /tokenHash\s*:/);
      assert.doesNotMatch(snippet, /secureLink\s*:/);
    }
  });

  it('accepts request context for internal and public audit recording', () => {
    assert.match(serviceSource, /createRfqInvitations\([^)]*req = null/);
    assert.match(serviceSource, /refreshInvitationTemplate\([^)]*req = null/);
    assert.match(serviceSource, /cancelInvitation\([^)]*req = null/);
    assert.match(serviceSource, /getPublicInvitation\([^)]*req = null/);
    assert.match(serviceSource, /submitPublicResponse\([^)]*req = null/);
    assert.match(serviceSource, /submitManualResponse\([^)]*req = null/);
  });
});
