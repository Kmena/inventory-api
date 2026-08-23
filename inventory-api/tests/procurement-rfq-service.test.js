'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serviceSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'procurement-rfq.service.js'),
  'utf-8',
);
const repoSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'repositories', 'procurement-rfq.repository.js'),
  'utf-8',
);
const schemaSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'schemas', 'procurement-rfq.schema.js'),
  'utf-8',
);

function loadRfqServiceWithStubs({ repoOverrides = {}, auditOverrides = {} } = {}) {
  const servicePath = path.join(__dirname, '..', 'src', 'services', 'procurement-rfq.service.js');
  const repoPath = path.join(__dirname, '..', 'src', 'repositories', 'procurement-rfq.repository.js');
  const auditPath = path.join(__dirname, '..', 'src', 'lib', 'audit.js');

  const previousServiceModule = require.cache[servicePath];
  const previousRepoModule = require.cache[repoPath];
  const previousAuditModule = require.cache[auditPath];

  const repoStub = {
    transaction: async (work) => work({}),
    findInvitationByTokenHash: async () => null,
    updateInvitation: async () => {
      throw new Error('updateInvitation stub not configured');
    },
    ...repoOverrides,
  };

  const auditStub = {
    recordAuditEventSafelyIfAvailable: async () => {},
    ...auditOverrides,
  };

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: repoStub,
  };
  require.cache[auditPath] = {
    id: auditPath,
    filename: auditPath,
    loaded: true,
    exports: auditStub,
  };
  delete require.cache[servicePath];

  const rfqService = require(servicePath);

  function restore() {
    delete require.cache[servicePath];
    if (previousRepoModule) {
      require.cache[repoPath] = previousRepoModule;
    } else {
      delete require.cache[repoPath];
    }
    if (previousAuditModule) {
      require.cache[auditPath] = previousAuditModule;
    } else {
      delete require.cache[auditPath];
    }
    if (previousServiceModule) {
      require.cache[servicePath] = previousServiceModule;
    }
  }

  return { rfqService, repoStub, restore };
}

describe('procurement RFQ service characterization', () => {
  describe('service exports', () => {
    const rfqService = require('../src/services/procurement-rfq.service');

    it('exports createRfqInvitations function', () => {
      assert.equal(typeof rfqService.createRfqInvitations, 'function');
    });

    it('exports listRfqInvitations function', () => {
      assert.equal(typeof rfqService.listRfqInvitations, 'function');
    });

    it('exports refreshInvitationTemplate function', () => {
      assert.equal(typeof rfqService.refreshInvitationTemplate, 'function');
    });

    it('exports cancelInvitation function', () => {
      assert.equal(typeof rfqService.cancelInvitation, 'function');
    });

    it('exports getPublicInvitation function', () => {
      assert.equal(typeof rfqService.getPublicInvitation, 'function');
    });

    it('exports submitPublicResponse function', () => {
      assert.equal(typeof rfqService.submitPublicResponse, 'function');
    });

    it('exports submitManualResponse function', () => {
      assert.equal(typeof rfqService.submitManualResponse, 'function');
    });

    it('exports getRfqTrackingSummary function', () => {
      assert.equal(typeof rfqService.getRfqTrackingSummary, 'function');
    });

    it('exports buildEmailMachote function', () => {
      assert.equal(typeof rfqService.buildEmailMachote, 'function');
    });

    it('exports buildSecureLink function', () => {
      assert.equal(typeof rfqService.buildSecureLink, 'function');
    });
  });

  describe('service source patterns', () => {
    it('uses secure-token for token generation', () => {
      assert.match(serviceSource, /require.*secure-token/);
    });

    it('uses generateTokenPair for creating tokens', () => {
      assert.match(serviceSource, /generateTokenPair/);
    });

    it('uses hashToken for public lookup', () => {
      assert.match(serviceSource, /hashToken/);
    });

    it('stores PREPARED status on creation', () => {
      assert.match(serviceSource, /status:\s*['"]PREPARED['"]/);
    });

    it('stores RESPONDED status on response', () => {
      assert.match(serviceSource, /status:\s*['"]RESPONDED['"]/);
    });

    it('stores CANCELLED status on cancel', () => {
      assert.match(serviceSource, /status:\s*['"]CANCELLED['"]/);
    });

    it('checks expiration before accepting response', () => {
      assert.match(serviceSource, /expiresAt/);
      assert.match(serviceSource, /expired/i);
    });

    it('validates product belongs to request on public response', () => {
      assert.match(serviceSource, /requestItemIds/);
      assert.match(serviceSource, /invalid_product/);
    });

    it('records PUBLIC_TOKEN as response source for public responses', () => {
      assert.match(serviceSource, /PUBLIC_TOKEN/);
    });

    it('records MANUAL_OFFICE_EMAIL as response source for manual responses', () => {
      assert.match(serviceSource, /MANUAL_OFFICE_EMAIL/);
    });

    it('creates SupplierQuotation in transaction on response', () => {
      assert.match(serviceSource, /createSupplierQuotation/);
      assert.match(serviceSource, /transaction/);
    });

    it('persists EXPIRED lazily and keeps active invitation lookup limited to non-terminal statuses', () => {
      assert.match(serviceSource, /persistExpiredInvitationIfNeeded/);
      assert.match(serviceSource, /status:\s*['"]EXPIRED['"]/);
      assert.match(repoSource, /status:\s*\{\s*in:\s*\['PENDING', 'PREPARED'\]\s*\}/);
    });

    it('tracks open quotation requests even when they still have quotations but no RFQ invitations', () => {
      assert.match(repoSource, /status:\s*['"]OPEN['"]/);
      assert.match(repoSource, /rfqInvitations:\s*\{\s*some:\s*\{\s*\}\s*\}/);
      assert.match(repoSource, /quotations:\s*\{\s*some:\s*\{\s*\}\s*\}/);
      assert.match(serviceSource, /hasInvitations:\s*serializedInvitations\.length > 0/);
      assert.match(serviceSource, /quotationCount:\s*serializedQuotations\.length/);
    });

    it('enriches tracking payloads with quotation summaries and response-source counters', () => {
      assert.match(serviceSource, /function serializeQuotationResponseSummary\(/);
      assert.match(serviceSource, /function serializeQuotationResponseItem\(/);
      assert.match(serviceSource, /respondedInvitationCount/);
      assert.match(serviceSource, /manualResponseCount/);
      assert.match(serviceSource, /publicResponseCount/);
      assert.match(serviceSource, /quotation:\s*serializeQuotationResponseSummary\(inv\.quotation, inv\.responseSource \|\| null\)/);
      assert.match(serviceSource, /quotations:\s*serializedQuotations/);
    });

    it('does not import nodemailer or email dependencies', () => {
      assert.doesNotMatch(serviceSource, /nodemailer/i);
      assert.doesNotMatch(serviceSource, /smtp/i);
    });
  });

  describe('machote generation', () => {
    const { buildEmailMachote, buildSecureLink } = require('../src/services/procurement-rfq.service');

    it('buildSecureLink returns a URL with token param', () => {
      const link = buildSecureLink('test-token-abc');
      assert.match(link, /\/supplier-quote\/\?token=test-token-abc/);
    });

    it('buildEmailMachote returns subject, body and link', () => {
      const invitation = {
        supplier: { name: 'Proveedor Test' },
        purchaseRequest: {
          title: 'Solicitud Test',
          items: [{ productId: 1n, quantity: 10, product: { name: 'Producto A' } }],
        },
        expiresAt: new Date('2026-12-31'),
      };
      const result = buildEmailMachote(invitation, 'raw-token-xyz', invitation.purchaseRequest);
      assert.ok(result.emailSubject.includes('Solicitud Test'));
      assert.ok(result.emailBody.includes('Proveedor Test'));
      assert.ok(result.emailBody.includes('Producto A'));
      assert.ok(result.secureLink.includes('raw-token-xyz'));
      assert.ok(result.expiresAt instanceof Date);
    });
  });

  describe('schema validations', () => {
    const { createRfqInvitationsSchema, publicRfqResponseSchema, manualRfqResponseSchema } = require('../src/schemas/procurement-rfq.schema');

    it('createRfqInvitationsSchema requires supplierIds array', () => {
      const valid = createRfqInvitationsSchema.safeParse({ supplierIds: [1] });
      assert.ok(valid.success);

      const invalid = createRfqInvitationsSchema.safeParse({});
      assert.ok(!invalid.success);

      const empty = createRfqInvitationsSchema.safeParse({ supplierIds: [] });
      assert.ok(!empty.success);
    });

    it('publicRfqResponseSchema requires items array', () => {
      const valid = publicRfqResponseSchema.safeParse({
        items: [{ productId: 1, quantity: 10, unitPrice: 100 }],
      });
      assert.ok(valid.success);

      const invalid = publicRfqResponseSchema.safeParse({ items: [] });
      assert.ok(!invalid.success);
    });

    it('publicRfqResponseSchema rejects negative unitPrice', () => {
      const result = publicRfqResponseSchema.safeParse({
        items: [{ productId: 1, quantity: 10, unitPrice: -5 }],
      });
      assert.ok(!result.success);
    });

    it('manualRfqResponseSchema validates same structure as public', () => {
      const valid = manualRfqResponseSchema.safeParse({
        currency: 'CRC',
        items: [{ productId: 1, quantity: 5, unitPrice: 200 }],
      });
      assert.ok(valid.success);
    });
  });

  describe('expired invitation persistence', () => {
    it('persists EXPIRED on public read before rejecting the token', async () => {
      const expiredInvitation = {
        id: 900n,
        companyId: 1n,
        purchaseRequestId: 11n,
        supplierId: 22n,
        status: 'PREPARED',
        expiresAt: new Date(Date.now() - 60_000),
        purchaseRequest: { title: 'Solicitud RFQ', items: [] },
        supplier: { id: 22n, name: 'Proveedor Demo', email: 'demo@example.com' },
      };
      const updates = [];
      const { rfqService, restore } = loadRfqServiceWithStubs({
        repoOverrides: {
          findInvitationByTokenHash: async () => expiredInvitation,
          updateInvitation: async (id, data) => {
            updates.push({ id, data });
            return { ...expiredInvitation, ...data };
          },
        },
      });

      try {
        await assert.rejects(
          () => rfqService.getPublicInvitation('public-raw-token'),
          (error) => error.statusCode === 410 && error.code === 'expired',
        );
      } finally {
        restore();
      }

      assert.equal(updates.length, 1);
      assert.deepEqual(updates[0], {
        id: 900n,
        data: { status: 'EXPIRED' },
      });
    });

    it('persists EXPIRED on public submit before rejecting the token', async () => {
      const expiredInvitation = {
        id: 901n,
        companyId: 1n,
        purchaseRequestId: 12n,
        supplierId: 23n,
        status: 'PREPARED',
        expiresAt: new Date(Date.now() - 60_000),
        purchaseRequest: { title: 'Solicitud RFQ', items: [{ productId: 777n }] },
        supplier: { id: 23n, name: 'Proveedor Dos', email: 'dos@example.com' },
      };
      const updates = [];
      const { rfqService, restore } = loadRfqServiceWithStubs({
        repoOverrides: {
          transaction: async (work) => work({ tx: true }),
          findInvitationByTokenHash: async () => expiredInvitation,
          updateInvitation: async (id, data) => {
            updates.push({ id, data });
            return { ...expiredInvitation, ...data };
          },
          createSupplierQuotation: async () => {
            throw new Error('createSupplierQuotation must not be called for expired invitations');
          },
        },
      });

      try {
        await assert.rejects(
          () => rfqService.submitPublicResponse('public-raw-token', {
            currency: 'CRC',
            items: [{ productId: 777, quantity: 2, unitPrice: 100 }],
          }),
          (error) => error.statusCode === 410 && error.code === 'expired',
        );
      } finally {
        restore();
      }

      assert.equal(updates.length, 1);
      assert.deepEqual(updates[0], {
        id: 901n,
        data: { status: 'EXPIRED' },
      });
    });

    it('does not mutate a non-expired invitation on public read', async () => {
      const activeInvitation = {
        id: 902n,
        companyId: 1n,
        purchaseRequestId: 13n,
        supplierId: 24n,
        status: 'PREPARED',
        expiresAt: new Date(Date.now() + 60_000),
        purchaseRequest: {
          title: 'Solicitud activa',
          items: [{ productId: 55n, quantity: 3, notes: null, product: { name: 'Harina', unit: 'kg' } }],
        },
        supplier: { id: 24n, name: 'Proveedor Activo', email: 'activo@example.com' },
      };
      let updateCalls = 0;
      const { rfqService, restore } = loadRfqServiceWithStubs({
        repoOverrides: {
          findInvitationByTokenHash: async () => activeInvitation,
          updateInvitation: async () => {
            updateCalls += 1;
            return activeInvitation;
          },
        },
      });

      let result;
      try {
        result = await rfqService.getPublicInvitation('public-raw-token');
      } finally {
        restore();
      }

      assert.equal(updateCalls, 0);
      assert.equal(result.supplierName, 'Proveedor Activo');
      assert.equal(result.requestTitle, 'Solicitud activa');
      assert.equal(result.items.length, 1);
    });

    it('rejects expired invitations for internal manual response after persisting EXPIRED', async () => {
      const expiredInvitation = {
        id: 903n,
        companyId: 1n,
        purchaseRequestId: 14n,
        supplierId: 25n,
        status: 'PREPARED',
        expiresAt: new Date(Date.now() - 60_000),
        purchaseRequest: { title: 'Solicitud RFQ', items: [{ productId: 888n }] },
      };
      const updates = [];
      const { rfqService, restore } = loadRfqServiceWithStubs({
        repoOverrides: {
          transaction: async (work) => work({ tx: true }),
          findInvitationById: async () => expiredInvitation,
          updateInvitation: async (id, data) => {
            updates.push({ id, data });
            return { ...expiredInvitation, ...data };
          },
        },
      });

      try {
        await assert.rejects(
          () => rfqService.submitManualResponse(903n, {
            currency: 'CRC',
            items: [{ productId: 888, quantity: 1, unitPrice: 10 }],
          }, { companyId: '1', sub: '2' }),
          (error) => error.statusCode === 409 && error.code === 'expired',
        );
      } finally {
        restore();
      }

      assert.equal(updates.length, 1);
      assert.deepEqual(updates[0], {
        id: 903n,
        data: { status: 'EXPIRED' },
      });
    });

    it('normalizes expired invitations in listRfqInvitations and tracking summary', async () => {
      const expiredInvitation = {
        id: 904n,
        companyId: 1n,
        purchaseRequestId: 15n,
        supplierId: 26n,
        status: 'PREPARED',
        expiresAt: new Date(Date.now() - 60_000),
        purchaseRequest: { id: 15n, title: 'Solicitud vencida', items: [] },
        supplier: { id: 26n, name: 'Proveedor Vencido', email: 'vencido@example.com' },
      };
      const updates = [];
      const { rfqService, restore } = loadRfqServiceWithStubs({
        repoOverrides: {
          findPurchaseRequestForCompany: async () => ({ id: 15n, title: 'Solicitud vencida', items: [] }),
          listInvitationsForRequest: async () => [expiredInvitation],
          listRfqTrackingSummary: async () => [{
            id: 15n,
            title: 'Solicitud vencida',
            status: 'OPEN',
            createdAt: new Date('2026-08-13T00:00:00.000Z'),
            updatedAt: new Date('2026-08-13T00:00:00.000Z'),
            items: [],
            quotations: [],
            rfqInvitations: [expiredInvitation],
          }],
          updateInvitation: async (id, data) => {
            updates.push({ id, data });
            return { ...expiredInvitation, ...data };
          },
        },
      });

      let invitationsResult;
      let trackingResult;
      try {
        invitationsResult = await rfqService.listRfqInvitations(15n, { companyId: '1', sub: '2' });
        trackingResult = await rfqService.getRfqTrackingSummary({ companyId: '1', sub: '2' });
      } finally {
        restore();
      }

      assert.equal(invitationsResult[0].status, 'EXPIRED');
      assert.equal(trackingResult[0].invitations[0].status, 'EXPIRED');
      assert.equal(trackingResult[0].hasInvitations, true);
      assert.equal(trackingResult[0].quotationCount, 0);
      assert.equal(updates.length, 2);
    });

    it('includes open grouped quotation requests without RFQ invitations in tracking summary', async () => {
      const { rfqService, restore } = loadRfqServiceWithStubs({
        repoOverrides: {
          listRfqTrackingSummary: async () => [{
            id: 77n,
            title: 'Cotización asistida semanal',
            status: 'OPEN',
            createdAt: new Date('2026-08-13T00:00:00.000Z'),
            updatedAt: new Date('2026-08-14T00:00:00.000Z'),
            items: [{
              id: 1n,
              productId: 501n,
              quantity: 12,
              notes: 'Reposición urgente',
              product: { name: 'Harina integral', unit: 'kg' },
            }],
            quotations: [{
              id: 880n,
              supplierId: 41n,
              supplier: { name: 'Proveedor Base', email: 'base@example.com' },
              status: 'SUBMITTED',
              currency: 'CRC',
              notes: 'Cotización inicial',
              submittedAt: new Date('2026-08-13T10:00:00.000Z'),
              createdAt: new Date('2026-08-13T10:00:00.000Z'),
              updatedAt: new Date('2026-08-13T10:00:00.000Z'),
              items: [{
                id: 700n,
                productId: 501n,
                quantity: 12,
                unitPrice: 950,
                leadTimeDays: 3,
                availabilityNotes: 'Entrega semanal',
                notes: null,
                product: { name: 'Harina integral' },
              }],
            }],
            rfqInvitations: [],
          }],
        },
      });

      let trackingResult;
      try {
        trackingResult = await rfqService.getRfqTrackingSummary({ companyId: '1', sub: '2' });
      } finally {
        restore();
      }

      assert.equal(trackingResult.length, 1);
      assert.equal(trackingResult[0].purchaseRequestId, 77n);
      assert.equal(trackingResult[0].status, 'OPEN');
      assert.equal(trackingResult[0].hasInvitations, false);
      assert.equal(trackingResult[0].quotationCount, 1);
      assert.equal(trackingResult[0].respondedInvitationCount, 0);
      assert.equal(trackingResult[0].manualResponseCount, 0);
      assert.equal(trackingResult[0].publicResponseCount, 0);
      assert.deepEqual(trackingResult[0].invitations, []);
      assert.equal(trackingResult[0].items[0].productName, 'Harina integral');
      assert.equal(trackingResult[0].quotations[0].supplierName, 'Proveedor Base');
      assert.equal(trackingResult[0].quotations[0].items[0].productName, 'Harina integral');
      assert.equal(trackingResult[0].quotations[0].items[0].lineTotal, 11400);
    });

    it('exposes detailed responded invitation summaries with manual and public response origin', async () => {
      const respondedInvitation = {
        id: 905n,
        companyId: 1n,
        purchaseRequestId: 16n,
        supplierId: 55n,
        quotationId: 990n,
        status: 'RESPONDED',
        responseSource: 'MANUAL_OFFICE_EMAIL',
        expiresAt: new Date('2026-08-20T00:00:00.000Z'),
        respondedAt: new Date('2026-08-14T12:00:00.000Z'),
        createdAt: new Date('2026-08-13T12:00:00.000Z'),
        supplier: { id: 55n, name: 'Proveedor Manual', email: 'manual@example.com' },
        quotation: {
          id: 990n,
          supplierId: 55n,
          supplier: { name: 'Proveedor Manual', email: 'manual@example.com' },
          status: 'SUBMITTED',
          currency: 'USD',
          notes: 'Respuesta manual registrada',
          submittedAt: new Date('2026-08-14T12:00:00.000Z'),
          createdAt: new Date('2026-08-14T12:00:00.000Z'),
          updatedAt: new Date('2026-08-14T12:30:00.000Z'),
          items: [{
            id: 800n,
            productId: 601n,
            quantity: 4,
            unitPrice: 15.5,
            leadTimeDays: 5,
            availabilityNotes: 'Disponible',
            notes: 'Incluye empaque',
            product: { name: 'Levadura seca' },
          }],
        },
      };

      const publicInvitation = {
        id: 906n,
        companyId: 1n,
        purchaseRequestId: 16n,
        supplierId: 56n,
        quotationId: 991n,
        status: 'RESPONDED',
        responseSource: 'PUBLIC_TOKEN',
        expiresAt: new Date('2026-08-20T00:00:00.000Z'),
        respondedAt: new Date('2026-08-14T14:00:00.000Z'),
        createdAt: new Date('2026-08-13T14:00:00.000Z'),
        supplier: { id: 56n, name: 'Proveedor Público', email: 'public@example.com' },
        quotation: {
          id: 991n,
          supplierId: 56n,
          supplier: { name: 'Proveedor Público', email: 'public@example.com' },
          status: 'SUBMITTED',
          currency: 'CRC',
          notes: 'Respuesta por portal',
          submittedAt: new Date('2026-08-14T14:00:00.000Z'),
          createdAt: new Date('2026-08-14T14:00:00.000Z'),
          updatedAt: new Date('2026-08-14T14:10:00.000Z'),
          items: [{
            id: 801n,
            productId: 602n,
            quantity: 10,
            unitPrice: 920,
            leadTimeDays: 2,
            availabilityNotes: null,
            notes: null,
            product: { name: 'Harina blanca' },
          }],
        },
      };

      const { rfqService, restore } = loadRfqServiceWithStubs({
        repoOverrides: {
          listRfqTrackingSummary: async () => [{
            id: 16n,
            title: 'Seguimiento de respuestas',
            status: 'OPEN',
            createdAt: new Date('2026-08-13T00:00:00.000Z'),
            updatedAt: new Date('2026-08-14T14:10:00.000Z'),
            items: [{
              id: 2n,
              productId: 601n,
              quantity: 4,
              notes: null,
              product: { name: 'Levadura seca', unit: 'kg' },
            }],
            quotations: [respondedInvitation.quotation, publicInvitation.quotation],
            rfqInvitations: [respondedInvitation, publicInvitation],
          }],
        },
      });

      let trackingResult;
      try {
        trackingResult = await rfqService.getRfqTrackingSummary({ companyId: '1', sub: '2' });
      } finally {
        restore();
      }

      assert.equal(trackingResult[0].respondedInvitationCount, 2);
      assert.equal(trackingResult[0].manualResponseCount, 1);
      assert.equal(trackingResult[0].publicResponseCount, 1);
      assert.equal(trackingResult[0].invitations[0].quotation.responseSource, 'MANUAL_OFFICE_EMAIL');
      assert.equal(trackingResult[0].invitations[0].quotation.items[0].productName, 'Levadura seca');
      assert.equal(trackingResult[0].invitations[0].quotation.totalAmount, 62);
      assert.equal(trackingResult[0].quotations[1].responseSource, 'PUBLIC_TOKEN');
      assert.equal(trackingResult[0].quotations[1].invitationId, 906n);
      assert.equal(trackingResult[0].quotations[1].items[0].lineTotal, 9200);
    });
  });

  describe('repository exports', () => {
    const rfqRepo = require('../src/repositories/procurement-rfq.repository');

    it('exports transaction', () => {
      assert.equal(typeof rfqRepo.transaction, 'function');
    });

    it('exports createInvitation', () => {
      assert.equal(typeof rfqRepo.createInvitation, 'function');
    });

    it('exports findInvitationByTokenHash', () => {
      assert.equal(typeof rfqRepo.findInvitationByTokenHash, 'function');
    });

    it('exports listInvitationsForRequest', () => {
      assert.equal(typeof rfqRepo.listInvitationsForRequest, 'function');
    });

    it('exports findActiveInvitationForSupplier', () => {
      assert.equal(typeof rfqRepo.findActiveInvitationForSupplier, 'function');
    });

    it('exports updateInvitation', () => {
      assert.equal(typeof rfqRepo.updateInvitation, 'function');
    });

    it('exports listRfqTrackingSummary', () => {
      assert.equal(typeof rfqRepo.listRfqTrackingSummary, 'function');
    });
  });

  describe('no email dependencies', () => {
    it('service does not reference SMTP or OAuth', () => {
      assert.doesNotMatch(serviceSource, /smtp/i);
      assert.doesNotMatch(serviceSource, /oauth/i);
      assert.doesNotMatch(serviceSource, /nodemailer/i);
    });

    it('schema does not reference email config', () => {
      assert.doesNotMatch(schemaSource, /smtpHost|smtpPort|smtpUser/i);
    });

    it('repository does not reference email sending', () => {
      assert.doesNotMatch(repoSource, /sendEmail|transport|nodemailer/i);
    });
  });
});
