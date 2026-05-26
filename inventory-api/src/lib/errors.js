function createHttpError(statusCode, message, code = 'business_error') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

module.exports = {
  createHttpError,
};
