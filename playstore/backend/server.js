import express from "express";
import cors from "cors";
import multer from "multer";
import authRoutes from "./src/routes/auth.js";
import image from "./src/routes/image.js";
import application from "./src/routes/app.js";
import category from "./src/routes/category.js";
import admin from "./src/routes/admin.js";
import exportRoutes from "./src/routes/export.js";
import auth from "./src/middlewares/auth.js"
import requireAdmin from "./src/middlewares/requireAdmin.js"
import DbTransport from "./src/utils/dbTransport.js";
import { Logs } from "./src/sequelize/config/database.js";
import { logger } from "./src/utils/logger.js";
import "./src/utils/mailWorker.js";
import "./src/utils/exportWorker.js";
import bullBoardAdapter from "./src/utils/bullBoard.js";
import { ensureApplicationsIndex } from "./src/opensearch/opensearchIndex.js";
import "./src/opensearch/searchIndexWorker.js";
import { blockedIpMiddleware, rateLimiter, getClientIp } from "./src/middleware/rateLimiter.js";

await ensureApplicationsIndex();


logger.add(new DbTransport({ level: "info" }, Logs));

const app = express();

// Frontend origin(s) allowed to call this API cross-origin. Comma-separated
// in CORS_ORIGIN (see .env) so both a local Vite dev server and a deployed
// frontend can be allowed at once, e.g.:
//   CORS_ORIGIN=http://localhost:5173,https://storefront.example.com
// Falls back to the default Vite dev ports when the env var isn't set, so
// this still works out of the box for local development even without the
// Vite proxy configured on the frontend.
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:4173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(
    cors({
        origin(origin, callback) {
            // No Origin header means the request didn't come from a browser
            // (curl, a mobile app, server-to-server) -- nothing for CORS to
            // enforce there, so let it through.
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            callback(new Error(`CORS: origin "${origin}" is not allowed`));
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        // The frontend reads the real filename off this header for every
        // file-download endpoint (app binaries, screenshots, CSV/gzip
        // exports) -- browsers hide it from cross-origin JS unless it's
        // explicitly exposed here.
        exposedHeaders: ["Content-Disposition"],
    }),
);

app.use(express.json());

// Manually-banned IPs (see blockIp()/unblockIp() in rateLimiter.js) are
// checked everywhere, signed in or not - unrelated to the request-rate
// limiting below, which is scoped per endpoint group instead of global.
app.use(blockedIpMiddleware);

app.use("/v1/sign", authRoutes);
app.use("/queues", bullBoardAdapter.getRouter());
app.use(auth);

// Everything past this point has a verified access token, so requests are
// throttled per signed-in user (keyed by their user id) rather than per IP -
// otherwise every user behind the same office/carrier IP would share one
// limit. Sign-in/signup, which run before `auth` and have no user id yet,
// get their own IP-keyed limiter directly on those two routes instead (see
// routes/auth.js).
app.use(
    rateLimiter({
        windowMs: Number(process.env.RATE_LIMIT_USER_WINDOW_MS) || 1000,
        maxRequests: Number(process.env.RATE_LIMIT_USER_MAX) || 5,
        keyPrefix: "rate-limit:user:",
        keyGenerator: (req) => req.user?.id || getClientIp(req),
        message: "Too many requests. Please slow down.",
    })
);

app.use("/v1/app",application);
app.use("/v1/images",image);
app.use("/v1/category",category);
app.use("/v1/admin",requireAdmin,admin);
app.use("/v1/admin/export",requireAdmin,exportRoutes);

// Multer throws its upload errors (file too large, wrong field name, etc.)
// as a rejected middleware, which Express only routes to a 4-arg handler
// like this one - without it, they fell through to Express's default
// handler as a bare 500 with no usable message for the client to show.
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ message: "File is too large. Maximum size is 5MB." });
        }
        return res.status(400).json({ message: err.message });
    }
    next(err);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Rate limit: 5 requests/min per IP on sign-in/signup, 5 requests/sec per user token elsewhere`);
});
