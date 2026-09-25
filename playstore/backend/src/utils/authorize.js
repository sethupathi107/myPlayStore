import { logger } from "./logger.js";

// Shared "is this resource mine, or am I an admin" check for the app/image
// write routes. Returns true (and has already sent the 403) when the
// request should be rejected, so callers can `if (await forbidUnlessOwnerOrAdmin(...)) return;`.
export function forbidUnlessOwnerOrAdmin(req, res, resource, { action, resourceLabel = "app", permissionVerb = "modify" } = {}) {
    if (resource.userId !== req.user.id && req.user.role !== "admin") {
        logger.warn(`User ${req.user.id} attempted to ${action} ${resourceLabel} ${resource.id} owned by ${resource.userId}`);
        res.status(403).json({ message: `You do not have permission to ${permissionVerb} this ${resourceLabel}` });
        return true;
    }
    return false;
}
