import { rateLimiter, blockedIpMiddleware } from "./src/middleware/rateLimiter.js";

/**
 * Strict Rate Limiter Configuration
 * Max 5 requests per 1 minute
 */
export const strictRateLimiter = rateLimiter({
  windowMs: 1 * 60 * 1000,  // 1 minute
  maxRequests: 5,            // 5 requests max
  keyPrefix: "rate-limit:",
  message: "Only 5 requests allowed per minute. Please try again later.",
});

/**
 * Usage in server.js:
 * 
 * import { strictRateLimiter, blockedIpMiddleware } from "./rateLimiterConfig.js";
 * 
 * // Option 1: Global (all routes)
 * app.use(blockedIpMiddleware);
 * app.use(strictRateLimiter);
 * 
 * // Option 2: Specific routes
 * app.get("/api/apps/:id/download", strictRateLimiter, (req, res) => { ... });
 * app.post("/api/auth/login", strictRateLimiter, (req, res) => { ... });
 */
