const {
  findGovernedHeavyEndpoint,
  measureGovernedHeavyEndpointResponse,
} = require('../lib/heavy-endpoint-governance');

function createHeavyEndpointMetricsMiddleware() {
  return (req, res, next) => {
    const governedEndpoint = findGovernedHeavyEndpoint(req.method, req.path || req.originalUrl || req.url);
    if (!governedEndpoint) {
      next();
      return;
    }

    res.locals.heavyEndpointMetrics = {
      endpointKey: governedEndpoint.key,
      routePattern: governedEndpoint.routePattern,
      payloadClass: governedEndpoint.payloadClass,
      responseShape: governedEndpoint.responseShape,
    };

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      try {
        res.locals.heavyEndpointMetrics = {
          ...res.locals.heavyEndpointMetrics,
          ...measureGovernedHeavyEndpointResponse(governedEndpoint, body),
        };
      } catch {
        // best-effort instrumentation only
      }

      return originalJson(body);
    };

    next();
  };
}

module.exports = {
  createHeavyEndpointMetricsMiddleware,
};
