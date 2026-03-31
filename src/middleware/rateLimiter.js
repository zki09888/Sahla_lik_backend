/**
 * Smart Rate Limiter - Different limits for different endpoints
 * Protects server without blocking normal usage
 */

const rateLimits = new Map();

// Configuration per endpoint pattern
const ENDPOINT_LIMITS = {
  // Ticket creation - relaxed (users may book multiple tickets)
  '/api/v1/tickets': {
    windowMs: 60 * 1000,  // 1 minute
    max: 20,               // 20 requests per minute
    message: 'Too many ticket requests. Please wait a few seconds.'
  },
  
  // Call next - moderate (guichet operations)
  '/api/v1/tickets/call-next': {
    windowMs: 10 * 1000,  // 10 seconds
    max: 5,                // 5 calls per 10 seconds
    message: 'Please wait a moment between calls.'
  },
  
  // Serve/Skip - moderate
  '/api/v1/tickets/serve': {
    windowMs: 10 * 1000,
    max: 5,
    message: 'Please wait a moment.'
  },
  
  '/api/v1/tickets/skip': {
    windowMs: 10 * 1000,
    max: 5,
    message: 'Please wait a moment.'
  },
  
  // Authentication - stricter (prevent brute force)
  '/api/v1/auth/login': {
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many login attempts. Please try again later.'
  },
  
  '/api/v1/auth/signup': {
    windowMs: 60 * 1000,
    max: 5,
    message: 'Too many signup attempts. Please try again later.'
  },
  
  // Default for other endpoints
  default: {
    windowMs: 60 * 1000,
    max: 100,
    message: 'Too many requests. Please slow down.'
  }
};

function cleanup() {
  const now = Date.now();
  for (const [key, data] of rateLimits.entries()) {
    if (now - data.windowStart > data.windowMs) {
      rateLimits.delete(key);
    }
  }
}

// Cleanup every 30 seconds
setInterval(cleanup, 30 * 1000);

function getEndpointLimit(url) {
  // Find matching endpoint pattern
  for (const [pattern, config] of Object.entries(ENDPOINT_LIMITS)) {
    if (pattern !== 'default' && url.includes(pattern)) {
      return config;
    }
  }
  return ENDPOINT_LIMITS.default;
}

function createRateLimiter(options = {}) {
  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const url = req.url;
    
    // Get limit config for this endpoint
    const config = options.windowMs 
      ? options  // Use provided options if specified
      : getEndpointLimit(url);
    
    const { windowMs, max, message } = config;
    const now = Date.now();
    
    // Create unique key per IP + endpoint
    const key = `${ip}:${url.split('?')[0]}`;
    
    if (!rateLimits.has(key)) {
      rateLimits.set(key, {
        windowStart: now,
        count: 1
      });
      return next();
    }
    
    const data = rateLimits.get(key);
    
    // Reset if window expired
    if (now - data.windowStart > windowMs) {
      data.windowStart = now;
      data.count = 1;
      return next();
    }
    
    data.count++;
    
    if (data.count > max) {
      const retryAfter = Math.ceil((data.windowStart + windowMs - now) / 1000);
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: message,
        retryAfter: retryAfter,
        limit: max,
        window: `${windowMs / 1000}s`
      });
    }
    
    next();
  };
}

// Global middleware that applies smart limits
function smartRateLimiter(req, res, next) {
  const limiter = createRateLimiter();
  return limiter(req, res, next);
}

module.exports = {
  smartRateLimiter,
  createRateLimiter,
  ENDPOINT_LIMITS
};
