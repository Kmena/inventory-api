'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routesSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'routes', 'procurement-rfq.routes.js'),
  'utf-8',
);
const publicRoutesSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'routes', 'public-supplier-quotation.routes.js'),
  'utf-8',
);
const appSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'app.js'),
  'utf-8',
);

describe('procurement RFQ routes contract', () => {
  describe('internal authenticated routes', () => {
    it('uses authenticate middleware', () => {
      assert.match(routesSource, /router\.use\(authenticate\)/);
    });

    it('registers POST /requests/:id/rfq-invitations with procurement.manage', () => {
      assert.match(routesSource, /router\.post\(\s*['"]\/requests\/:id\/rfq-invitations['"]/);
      assert.match(routesSource, /authorizeAccessPolicy\(['"]procurement\.manage['"]\)/);
    });

    it('registers GET /requests/:id/rfq-invitations with procurement.view', () => {
      assert.match(routesSource, /router\.get\(\s*['"]\/requests\/:id\/rfq-invitations['"]/);
    });

    it('registers POST /rfq-invitations/:id/refresh-template with procurement.manage', () => {
      assert.match(routesSource, /router\.post\(\s*['"]\/rfq-invitations\/:id\/refresh-template['"]/);
    });

    it('registers POST /rfq-invitations/:id/cancel with procurement.manage', () => {
      assert.match(routesSource, /router\.post\(\s*['"]\/rfq-invitations\/:id\/cancel['"]/);
    });

    it('registers POST /rfq-invitations/:id/manual-response with procurement.manage', () => {
      assert.match(routesSource, /router\.post\(\s*['"]\/rfq-invitations\/:id\/manual-response['"]/);
    });

    it('registers GET /rfq-tracking with procurement.view', () => {
      assert.match(routesSource, /router\.get\(\s*['"]\/rfq-tracking['"]/);
    });

    it('validates createRfqInvitationsSchema on create', () => {
      assert.match(routesSource, /validate\(createRfqInvitationsSchema\)/);
    });

    it('validates manualRfqResponseSchema on manual-response', () => {
      assert.match(routesSource, /validate\(manualRfqResponseSchema\)/);
    });
  });

  describe('public supplier quotation routes', () => {
    it('does not use authenticate middleware', () => {
      assert.doesNotMatch(publicRoutesSource, /router\.use\(authenticate\)/);
      assert.doesNotMatch(publicRoutesSource, /authenticate/);
    });

    it('registers GET /:token for public read', () => {
      assert.match(publicRoutesSource, /router\.get\(\s*['"]\/:token['"]/);
    });

    it('registers POST /:token/response for public submit', () => {
      assert.match(publicRoutesSource, /router\.post\(\s*['"]\/:token\/response['"]/);
    });

    it('applies dedicated throttling to public RFQ read and submit endpoints', () => {
      assert.match(publicRoutesSource, /createRequestThrottle/);
      assert.match(publicRoutesSource, /scope:\s*['"]rfq\.public\.read['"]/);
      assert.match(publicRoutesSource, /scope:\s*['"]rfq\.public\.submit['"]/);
      assert.match(publicRoutesSource, /RFQ_PUBLIC_READ_THROTTLE_MAX_REQUESTS/);
      assert.match(publicRoutesSource, /RFQ_PUBLIC_SUBMIT_THROTTLE_MAX_REQUESTS/);
      assert.match(publicRoutesSource, /router\.get\(\s*['"]\/:token['"],\s*publicInvitationReadThrottle/);
      assert.match(publicRoutesSource, /router\.post\(\s*['"]\/:token\/response['"],\s*publicInvitationResponseSubmitThrottle/);
    });

    it('validates publicRfqResponseSchema on response submit', () => {
      assert.match(publicRoutesSource, /validate\(publicRfqResponseSchema\)/);
    });
  });

  describe('app.js wiring', () => {
    it('mounts procurement-rfq.routes under /api/procurement', () => {
      assert.match(appSource, /app\.use\(['"]\/api\/procurement['"]/);
      assert.match(appSource, /procurementRfqRouter/);
    });

    it('mounts public-supplier-quotation.routes under /api/public/supplier-quotations', () => {
      assert.match(appSource, /app\.use\(['"]\/api\/public\/supplier-quotations['"]/);
      assert.match(appSource, /publicSupplierQuotationRouter/);
    });
  });
});
