/**
 * @param {number} statusCode
 * @param {string} message
 * @param {string} [code='business_error']
 * @returns {Error & { statusCode: number, code: string }}
 */
function createHttpError(statusCode, message, code = 'business_error') {
  return Object.assign(new Error(message), {
    statusCode,
    code,
  });
}

module.exports = {
  createHttpError,
};
