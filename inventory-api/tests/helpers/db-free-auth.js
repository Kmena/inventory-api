/**
 * Test helper: db-free authentication seam.
 *
 * Patches `userRepository.findAuthenticatedUserById` so that the
 * `authenticate` middleware can resolve sessions without a real database.
 * Follows the same pattern as `db-free-audit.js`.
 *
 * Usage (module-level, before any test):
 *
 *   const { enableDbFreeAuthSeams } = require('./helpers/db-free-auth');
 *   const restore = enableDbFreeAuthSeams();
 *   process.on('exit', restore);
 *
 * You may optionally pass an array of test users so specific sessions resolve
 * with the correct companyId / permissions:
 *
 *   enableDbFreeAuthSeams([{ id: '77', companyId: '77', role: { code: 'admin' }, permissions: [] }])
 *
 * Any session whose userId is NOT in the list resolves to a generic ACTIVE
 * user — sufficient for E2E tests that stub all API routes via Playwright.
 */

const userRepository = require('../../src/repositories/user.repository');

/**
 * Builds a fake DB user object that satisfies `validateAuthenticatedUser`
 * and `buildAuthenticatedContext` inside authenticate.js.
 *
 * @param {{ id: string|number|bigint, username?: string, fullName?: string,
 *           companyId?: string|number|bigint|null,
 *           role?: { code?: string },
 *           permissions?: string[] }} testUser
 */
function buildFakeDbUser(testUser) {
  return {
    id: BigInt(testUser.id),
    username: testUser.username || `test-user-${testUser.id}`,
    fullName: testUser.fullName || `Test User ${testUser.id}`,
    status: 'ACTIVE',
    companyId: testUser.companyId != null ? BigInt(testUser.companyId) : null,
    role: {
      code: testUser.role?.code || null,
      isActive: true,
      rolePermissions: (testUser.permissions || []).map((code) => ({
        isEnabled: true,
        permission: { code, isActive: true },
      })),
    },
    company: testUser.companyId != null ? { isActive: true } : null,
  };
}

/**
 * Returns a minimal generic ACTIVE user for any id not explicitly registered.
 * Good enough for E2E tests where all API routes are stubbed via Playwright.
 *
 * @param {bigint} id
 */
function buildGenericFakeUser(id) {
  return {
    id,
    username: `test-user-${id}`,
    fullName: `Test User ${id}`,
    status: 'ACTIVE',
    companyId: null,
    role: { code: null, isActive: true, rolePermissions: [] },
    company: null,
  };
}

/**
 * Replaces `userRepository.findAuthenticatedUserById` with an in-memory
 * implementation. Any id not found in `testUsers` resolves to a generic
 * ACTIVE user so the middleware does not crash without DATABASE_URL.
 *
 * @param {Array} [testUsers=[]]  Optional list of specific users to register.
 * @returns {() => void}          Restore function — call on exit / teardown.
 */
function enableDbFreeAuthSeams(testUsers = []) {
  const original = userRepository.findAuthenticatedUserById;

  const userMap = new Map(
    testUsers.map((u) => [String(BigInt(u.id)), buildFakeDbUser(u)]),
  );

  userRepository.findAuthenticatedUserById = async (id) =>
    userMap.get(String(id)) ?? buildGenericFakeUser(id);

  return () => {
    userRepository.findAuthenticatedUserById = original;
  };
}

module.exports = { enableDbFreeAuthSeams, buildFakeDbUser };
