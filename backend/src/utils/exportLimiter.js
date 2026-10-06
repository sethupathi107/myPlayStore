import client from "./redisClient.js";
import { logger } from "./logger.js";

// Two-level slot limiter, backed by Redis sorted sets so it works
// correctly even if the app runs as multiple server instances sharing the
// same Redis (a plain in-process counter would not).
//
//   export:active:global        - one member per currently-running export, any user
//   export:active:user:<userId> - one member per currently-running export for that user
//
// Each member's score is an expiry timestamp (now + a safety TTL). Every
// acquire attempt first prunes expired members from both sets before
// checking capacity - this makes the limiter self-healing: if a server
// process crashes mid-export and never calls release(), the stale slot
// still disappears on its own once the TTL passes, instead of permanently
// eating a concurrency slot.
//
// The whole acquire check-and-reserve sequence runs as a single Lua
// script so it is atomic - two requests arriving at the same instant
// cannot both read "1 slot free" and both acquire it.
const ACQUIRE_SCRIPT = `
local globalKey = KEYS[1]
local userKey = KEYS[2]
local now = tonumber(ARGV[1])
local expiry = tonumber(ARGV[2])
local maxGlobal = tonumber(ARGV[3])
local slotId = ARGV[4]

redis.call('ZREMRANGEBYSCORE', globalKey, '-inf', now)
redis.call('ZREMRANGEBYSCORE', userKey, '-inf', now)

if redis.call('ZCARD', userKey) > 0 then
    return 'USER_BUSY'
end

if redis.call('ZCARD', globalKey) >= maxGlobal then
    return 'GLOBAL_BUSY'
end

redis.call('ZADD', globalKey, expiry, slotId)
redis.call('ZADD', userKey, expiry, slotId)
return 'OK'
`;

const GLOBAL_KEY = "export:active:global";

/**
 * Tries to reserve one export slot for this user. Returns:
 *   { ok: true }
 *   { ok: false, reason: "USER_BUSY" }                          - this user already has one running
 *   { ok: false, reason: "GLOBAL_BUSY", retryAfterSeconds: N }   - server-wide capacity is full
 */
export async function acquireExportSlot({ userId, slotId, maxDurationMs, maxGlobalConcurrency }) {
    const userKey = `export:active:user:${userId}`;
    const now = Date.now();
    const expiry = now + maxDurationMs;

    const result = await client.eval(ACQUIRE_SCRIPT, {
        keys: [GLOBAL_KEY, userKey],
        arguments: [String(now), String(expiry), String(maxGlobalConcurrency), slotId],
    });

    if (result === "OK") {
        return { ok: true };
    }

    if (result === "USER_BUSY") {
        return { ok: false, reason: "USER_BUSY" };
    }

    // GLOBAL_BUSY: give the caller an informed retry hint, based on the
    // soonest a currently-running export is expected to finish (its slot's
    // expiry), rather than a made-up constant.
    let retryAfterSeconds = 5;
    try {
        const soonest = await client.zRangeWithScores(GLOBAL_KEY, 0, 0);
        if (soonest.length > 0) {
            retryAfterSeconds = Math.max(1, Math.ceil((soonest[0].score - now) / 1000));
        }
    } catch (error) {
        logger.error(`Failed to compute export retryAfterSeconds: ${error.message}`);
    }

    return { ok: false, reason: "GLOBAL_BUSY", retryAfterSeconds };
}

/**
 * Releases a previously-acquired slot. Safe to call even if the slot has
 * already expired and been pruned - ZREM on a missing member is a no-op.
 */
export async function releaseExportSlot({ userId, slotId }) {
    const userKey = `export:active:user:${userId}`;
    await client.zRem(GLOBAL_KEY, slotId);
    await client.zRem(userKey, slotId);
}
