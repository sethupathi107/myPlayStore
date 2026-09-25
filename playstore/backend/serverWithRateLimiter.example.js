/**
 * EXAMPLE: How to add rate limiter to your server.js
 * 
 * Copy the import and middleware lines below to your actual server.js
 */

import express from "express";
import { blockedIpMiddleware, rateLimiter } from "./src/middleware/rateLimiter.js";

const app = express();

// ============================================
// ADD THESE LINES TO YOUR server.js
// ============================================

// 1. Check if IP is blocked first
app.use(blockedIpMiddleware);

// 2. Apply strict rate limit: 5 requests per 1 minute
app.use(
  rateLimiter({
    windowMs: 1 * 60 * 1000,  // 1 minute
    maxRequests: 5,            // 5 requests max
    message: "Only 5 requests allowed per minute. Please try again later.",
  })
);

// ============================================
// ALL YOUR EXISTING ROUTES HERE
// ============================================

// Example routes
app.get("/api/apps", (req, res) => {
  res.json({ message: "List apps" });
});

app.get("/api/apps/:id/download", (req, res) => {
  res.json({ message: "Download app" });
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Rate limit: 5 requests per 1 minute per IP`);
});

// ============================================
// RESPONSE EXAMPLES
// ============================================

/**
 * REQUEST 1 (Success):
 * GET /api/apps
 * Response Headers:
 *   X-RateLimit-Limit: 5
 *   X-RateLimit-Remaining: 4
 *   X-RateLimit-Reset: 2026-09-24T12:01:00.000Z
 * 
 * REQUEST 6 (Blocked):
 * GET /api/apps
 * Status: 429 Too Many Requests
 * Body: {
 *   error: "Only 5 requests allowed per minute. Please try again later.",
 *   retryAfter: 60
 * }
 */
