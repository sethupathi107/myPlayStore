import fs from "fs";
import zlib from "node:zlib";
import { randomUUID } from "node:crypto";
import { Op } from "@sequelize/core";
import { to as copyTo } from "pg-copy-streams";
import exportQueue from "../utils/exportQueue.js";
import pgReplicaPool from "../utils/pgReplicaPool.js";
import { acquireExportSlot, releaseExportSlot } from "../utils/exportLimiter.js";
import { ExportJob } from "../sequelize/config/database.js";
import { logger } from "../utils/logger.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const ALLOWED_TYPES = ["downloads"];

function resolveDateRange(query) {
    const { range, from, to } = query;

    if (from || to) {
        if (!from || !to) {
            const err = new Error("Both 'from' and 'to' are required for a custom range");
            err.status = 400;
            throw err;
        }
        const fromDate = new Date(from);
        const toDate = new Date(to);
        if (isNaN(fromDate) || isNaN(toDate)) {
            const err = new Error("'from'/'to' must be valid dates (e.g. 2026-09-01)");
            err.status = 400;
            throw err;
        }
        toDate.setHours(23, 59, 59, 999);
        return { from: fromDate, to: toDate, label: `${from}_${to}` };
    }

    const days = range === "30d" ? 30 : 7;
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - days * DAY_MS);
    return { from: fromDate, to: toDate, label: `${days}d` };
}


const SYNC_MAX_GLOBAL_CONCURRENCY = Number(process.env.EXPORT_SYNC_MAX_CONCURRENCY) || 3;
const SYNC_SLOT_TTL_MS = 10 * 60 * 1000; // safety net: a slot self-expires after 10 min even if release() is never called

/**
 * GET /v1/admin/export/downloads-sync?range=7d  (or ?from=&to=)
 *
 * The ORIGINAL synchronous path: streams the CSV.gz directly back on this
 * same request via COPY -> gzip -> res, gated by exportLimiter.js's
 * per-user + global Redis slot limiter. Kept alongside the async job
 * queue (POST /downloads) rather than replacing it - use this one for a
 * quick, small, "I want it right now" export; use the async one when the
 * range is large enough that holding this request open for minutes would
 * be risky (proxy/browser timeouts, a long-lived DB transaction tied to a
 * live connection). See requestExport below for that path.
 */
async function exportDownloadsSync(req, res) {
    let dateRange;
    try {
        dateRange = resolveDateRange(req.query);
    } catch (error) {
        return res.status(error.status || 400).json({ message: error.message });
    }

    const userId = req.user.id;
    const slotId = randomUUID();

    const acquireResult = await acquireExportSlot({
        userId,
        slotId,
        maxDurationMs: SYNC_SLOT_TTL_MS,
        maxGlobalConcurrency: SYNC_MAX_GLOBAL_CONCURRENCY,
    });

    if (!acquireResult.ok && acquireResult.reason === "USER_BUSY") {
        return res.status(429).json({
            message: "You already have a sync export in progress. Wait for it to finish before starting another.",
        });
    }

    if (!acquireResult.ok && acquireResult.reason === "GLOBAL_BUSY") {
        res.setHeader("Retry-After", String(acquireResult.retryAfterSeconds));
        return res.status(429).json({
            message: `Server busy, retry in ${acquireResult.retryAfterSeconds}s`,
            retryAfterSeconds: acquireResult.retryAfterSeconds,
        });
    }

    let released = false;
    let pgClient = null;

    const releaseSlot = async () => {
        if (released) return;
        released = true;
        try {
            await releaseExportSlot({ userId, slotId });
        } catch (error) {
            logger.error(`Failed to release sync export slot ${slotId}: ${error.message}`);
        }
        if (pgClient) {
            pgClient.release();
            pgClient = null;
        }
    };

    try {
        pgClient = await pgReplicaPool.connect();

        // Same COPY-can't-bind-parameters note as the worker: these ISO
        // strings come from Date objects resolveDateRange already parsed
        // with new Date(...), never raw request text.
        const fromLiteral = dateRange.from.toISOString();
        const toLiteral = dateRange.to.toISOString();

        const copyQuery = `
            COPY (
                SELECT
                    i.id,
                    i."createdAt" AS "downloadedAt",
                    u.username,
                    u.email AS "userEmail",
                    a.name AS "appName",
                    c.name AS "category"
                FROM "Installeds" i
                JOIN "Users" u ON u.id = i."userId"
                JOIN "Applications" a ON a.id = i."applicationId"
                LEFT JOIN "Categories" c ON c.id = a."categoryId"
                WHERE i."createdAt" BETWEEN '${fromLiteral}' AND '${toLiteral}'
                ORDER BY i."createdAt" ASC
            ) TO STDOUT WITH (FORMAT csv, HEADER true)
        `;

        const copyStream = pgClient.query(copyTo(copyQuery));
        const gzipStream = zlib.createGzip();

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Encoding", "gzip");
        res.setHeader("Content-Disposition", `attachment; filename="downloads-${dateRange.label}.csv.gz"`);

        req.on("close", () => {
            copyStream.destroy();
        });

        copyStream.on("error", (error) => {
            logger.error(`Sync export COPY stream error: ${error.stack || error.message}`);
            if (!res.headersSent) {
                res.status(500).json({ message: "Internal server error" });
            } else {
                res.end();
            }
        });

        gzipStream.on("error", (error) => {
            logger.error(`Sync export gzip stream error: ${error.stack || error.message}`);
            res.end();
        });

        res.on("close", () => {
            releaseSlot();
        });

        copyStream.pipe(gzipStream).pipe(res);
    } catch (error) {
        logger.error(error.stack || error.message);
        await releaseSlot();
        if (!res.headersSent) {
            res.status(500).json({ message: "Internal server error" });
        } else {
            res.end();
        }
    }
}

/**
 * POST /v1/admin/export/downloads  { type?: "downloads", range?: "7d"|"30d", from?, to? }
 *
 * Creates the ExportJob DB row first (status "queued") - this row is the
 * single source of truth the status/download endpoints and the worker all
 * read from. Only after it exists does a BullMQ job get pushed, carrying
 * just the row's id. Responds 202 immediately; the actual COPY/gzip/file
 * work happens entirely in exportWorker.js, decoupled from this request.
 *
 * The client is not expected to poll this. Once the worker flips the row
 * to "done" it emails the requesting user a link with the job id baked
 * into it (see exportWorker.js's mailQueue.add("export-ready-notification",
 * ...)) - that email link IS the handle; opening it hits the download
 * route below directly. jobId/statusUrl are still returned here for a
 * client that wants to show its own in-app status, but nothing depends
 * on them being polled.
 */
async function requestExport(req, res) {
    const type = req.body.type || "downloads";
    if (!ALLOWED_TYPES.includes(type)) {
        return res.status(400).json({ message: `type must be one of: ${ALLOWED_TYPES.join(", ")}` });
    }

    let dateRange;
    try {
        dateRange = resolveDateRange(req.body);
    } catch (error) {
        return res.status(error.status || 400).json({ message: error.message });
    }

    try {
        const existingActiveJob = await ExportJob.findOne({
            where: {
                userId: req.user.id,
                status: { [Op.in]: ["queued", "processing"] },
            },
        });

        if (existingActiveJob) {
            return res.status(429).json({
                message: "You already have an export in progress. Wait for it to finish before starting another.",
                jobId: existingActiveJob.id,
                statusUrl: `/v1/admin/export/jobs/${existingActiveJob.id}`,
            });
        }

        const exportJobRow = await ExportJob.create({
            userId: req.user.id,
            type,
            status: "queued",
            rangeLabel: dateRange.label,
            fromDate: dateRange.from,
            toDate: dateRange.to,
        });

        await exportQueue.add("export", { exportJobId: exportJobRow.id });

        res.status(202).json({
            message: "Export job queued. We'll email you a download link once it's ready.",
            jobId: exportJobRow.id,
            statusUrl: `/v1/admin/export/jobs/${exportJobRow.id}`,
        });
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

/**
 * GET /v1/admin/export/jobs/:id
 * Reads the ExportJob row directly. Optional - the worker already emails
 * the user a direct download link when the job finishes, so nothing
 * needs to poll this for the export to reach them. This just exists for
 * a client that wants to show its own "still processing..." state.
 */
async function getExportStatus(req, res) {
    try {
        const exportJobRow = await ExportJob.findByPk(req.params.id);

        if (!exportJobRow) {
            return res.status(404).json({ message: "Export job not found" });
        }

        const response = {
            jobId: exportJobRow.id,
            type: exportJobRow.type,
            status: exportJobRow.status,
            rangeLabel: exportJobRow.rangeLabel,
            rowCount: exportJobRow.rowCount,
        };

        if (exportJobRow.status === "done") {
            response.downloadUrl = `/v1/admin/export/jobs/${exportJobRow.id}/download`;
        }
        if (exportJobRow.status === "failed") {
            response.error = exportJobRow.errorMessage;
        }

        res.status(200).json(response);
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

/**
 * GET /v1/admin/export/jobs/:id/download
 * Streams the finished file straight from the shared volume on disk -
 * res.download() uses fs.createReadStream + pipe internally, so
 * backpressure here is handled by Node automatically, same as everywhere
 * else data leaves this app as a stream.
 */
async function downloadExportFile(req, res) {
    try {
        const exportJobRow = await ExportJob.findByPk(req.params.id);

        if (!exportJobRow) {
            return res.status(404).json({ message: "Export job not found" });
        }

        if (exportJobRow.status !== "done") {
            return res.status(409).json({ message: `Export is not ready yet (status: ${exportJobRow.status})` });
        }

        if (!exportJobRow.filePath || !fs.existsSync(exportJobRow.filePath)) {
            return res.status(410).json({ message: "This export's file has expired and is no longer available" });
        }

        res.download(exportJobRow.filePath, exportJobRow.fileName);
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

export default {
    exportDownloadsSync,
    requestExport,
    getExportStatus,
    downloadExportFile,
};
