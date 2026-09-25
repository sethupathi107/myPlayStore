import redis from "../utils/redisClient.js";
import { logger } from "../utils/logger.js";

export function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.socket.remoteAddress ||
    req.connection.remoteAddress ||
    "unknown"
  );
}

/**
 * Rate limiter middleware using Redis. Defaults to limiting by IP, but
 * `keyGenerator` lets a caller limit by something else instead - e.g. the
 * authenticated user's id (req.user.id), once a request has a token, so a
 * shared IP (offices, mobile carriers) doesn't throttle every user behind
 * it as one.
 */
export const rateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes default
    maxRequests = 100, // max requests per window
    keyPrefix = "rate-limit:",
    message = "Too many requests, please try again later",
    keyGenerator = getClientIp,
  } = options;

  return async (req, res, next) => {
    try {
      const identifier = keyGenerator(req);
      const key = `${keyPrefix}${identifier}`;

      // Get current request count from Redis
      const currentCount = await redis.incr(key);

      // Set expiry on first request
      if (currentCount === 1) {
        await redis.expire(key, Math.ceil(windowMs / 1000));
      }

      // Set headers
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - currentCount));
      res.setHeader("X-RateLimit-Reset", new Date(Date.now() + windowMs).toISOString());

      // Check if limit exceeded
      if (currentCount > maxRequests) {
        logger.warn(`Rate limit exceeded for ${key} (${currentCount} requests)`);
        // Every other endpoint's error body is {message}, not {error} - the
        // frontend's errorMessage() helper only reads that key, so {error}
        // here fell straight through to axios's generic "Request failed
        // with status code 429" instead of anything useful.
        return res.status(429).json({
          message,
          retryAfter: Math.ceil(windowMs / 1000),
        });
      }

      // Log request info
      logger.debug(`${key} | Requests: ${currentCount}/${maxRequests}`);

      next();
    } catch (err) {
      logger.error(`Rate limiter error: ${err.message}`);
      // Don't block requests if Redis fails
      next();
    }
  };
};

/**
 * Hard block middleware for permanently blocked IPs
 * Stores blocked IPs in Redis with optional expiry
 */
export const blockIp = async (ip, reason = "Manual block", expirySeconds = null) => {
  try {
    const key = `blocked-ip:${ip}`;
    await redis.set(key, reason);

    if (expirySeconds) {
      await redis.expire(key, expirySeconds);
    }

    logger.warn(`IP blocked: ${ip} | Reason: ${reason}`);
    return true;
  } catch (err) {
    logger.error(`Error blocking IP: ${err.message}`);
    return false;
  }
};

/**
 * Unblock an IP address
 */
export const unblockIp = async (ip) => {
  try {
    const key = `blocked-ip:${ip}`;
    await redis.del(key);
    logger.info(`IP unblocked: ${ip}`);
    return true;
  } catch (err) {
    logger.error(`Error unblocking IP: ${err.message}`);
    return false;
  }
};

/**
 * Check if IP is blocked
 */
export const isIpBlocked = async (ip) => {
  try {
    const key = `blocked-ip:${ip}`;
    return await redis.exists(key);
  } catch (err) {
    logger.error(`Error checking blocked IP: ${err.message}`);
    return false;
  }
};

/**
 * Middleware to check if IP is blocked
 */
export const blockedIpMiddleware = async (req, res, next) => {
  try {
    const clientIp = getClientIp(req);

    const blocked = await isIpBlocked(clientIp);

    if (blocked) {
      logger.warn(`Blocked IP attempted access: ${clientIp}`);
      return res.status(403).json({
        message: "Your IP address has been blocked",
      });
    }

    next();
  } catch (err) {
    logger.error(`Blocked IP middleware error: ${err.message}`);
    next();
  }
};
