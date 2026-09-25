# Rate Limiter Implementation Guide

## 1. Import the middleware in your `server.js`

```javascript
import { 
  rateLimiter, 
  blockedIpMiddleware, 
  blockIp, 
  unblockIp 
} from "./src/middleware/rateLimiter.js";
```

## 2. Add middleware to your Express app

### Option A: Global Rate Limiting (all routes)
```javascript
// Apply to all routes
app.use(blockedIpMiddleware); // Check blocked IPs first
app.use(rateLimiter({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  maxRequests: 100,           // 100 requests per window
  message: "Too many requests from your IP"
}));
```

### Option B: Rate limit specific routes
```javascript
// Rate limit only download endpoint
app.get(
  "/api/apps/:id/download",
  rateLimiter({ 
    windowMs: 5 * 60 * 1000,  // 5 minutes
    maxRequests: 20            // 20 downloads per 5 min
  }),
  (req, res) => {
    // your download logic
  }
);

// Stricter limit for login
app.post(
  "/api/auth/login",
  rateLimiter({ 
    windowMs: 15 * 60 * 1000,
    maxRequests: 5             // 5 login attempts per 15 min
  }),
  (req, res) => {
    // your login logic
  }
);
```

## 3. Manual IP blocking

```javascript
// Block an IP permanently
await blockIp("192.168.1.100", "Suspicious activity");

// Block an IP for 24 hours (86400 seconds)
await blockIp("192.168.1.101", "DDoS attempt", 86400);

// Unblock an IP
await unblockIp("192.168.1.100");
```

## 4. Create admin endpoints to manage blocks

```javascript
// Admin: List blocked IPs
app.get("/admin/blocked-ips", async (req, res) => {
  // your admin check here
  const keys = await redis.keys("blocked-ip:*");
  const blocked = {};
  for (const key of keys) {
    const ip = key.replace("blocked-ip:", "");
    blocked[ip] = await redis.get(key);
  }
  res.json(blocked);
});

// Admin: Block an IP
app.post("/admin/block-ip", async (req, res) => {
  // your admin check here
  const { ip, reason, expirySeconds } = req.body;
  await blockIp(ip, reason, expirySeconds);
  res.json({ success: true, blocked: ip });
});

// Admin: Unblock an IP
app.delete("/admin/block-ip/:ip", async (req, res) => {
  // your admin check here
  await unblockIp(req.params.ip);
  res.json({ success: true, unblocked: req.params.ip });
});
```

## 5. Response Headers

Every response includes:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2026-09-24T12:30:00.000Z
```

When limit exceeded, returns 429 with:
```json
{
  "error": "Too many requests, please try again later",
  "retryAfter": 900
}
```

## 6. Redis Keys

**Rate limit tracking:**
```
rate-limit:192.168.1.100 → 45  // 45 requests made
```

**Blocked IPs:**
```
blocked-ip:192.168.1.101 → "DDoS attempt"
```

## Configuration Options

```javascript
{
  windowMs: 15 * 60 * 1000,   // Time window in milliseconds
  maxRequests: 100,            // Max requests per window
  keyPrefix: "rate-limit:",    // Redis key prefix
  message: "Too many requests" // Custom error message
}
```
