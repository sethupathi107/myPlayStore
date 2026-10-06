import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Worker } from "bullmq";
import { Op } from "@sequelize/core";
import { to as copyTo } from "pg-copy-streams";
import connection from "./bullConnection.js";
import pgReplicaPool from "./pgReplicaPool.js";
import mailQueue from "./mailQueue.js";
import exportQueue from "./exportQueue.js";
import { ExportJob, User } from "../sequelize/config/database.js";
import logger from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.join(__dirname, "../../exports");

if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

const EXPORT_RETENTION_DAYS = Number(process.env.EXPORT_RETENTION_DAYS) || 7;
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:9000";

// One raw-SQL builder per export "type". Only "downloads" exists today;
// adding a new type later (e.g. "logs") just means adding another entry
// here - nothing else in this file needs to change.
const QUERY_BUILDERS = {
    downloads: (fromLiteral, toLiteral) => `
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
    `,
};

/**
 * Runs one export: COPY (from the replica pool) -> gzip -> a file in the
 * shared volume, using node:stream/promises' pipeline() so backpressure
 * and error propagation across all three stages are handled by Node
 * itself, not by manual write/drain bookkeeping.
 *
 * The ExportJob DB row is the single source of truth for status/type/date
 * range - job.data only ever carries the row's id, so there is exactly one
 * place this information lives, never two copies that could drift.
 */
async function processExportJob(job) {
    const { exportJobId } = job.data;

    const exportJobRow = await ExportJob.findByPk(exportJobId);
    if (!exportJobRow) {
        throw new Error(`ExportJob row ${exportJobId} not found`);
    }

    await exportJobRow.update({ status: "processing" });

    const queryBuilder = QUERY_BUILDERS[exportJobRow.type];
    if (!queryBuilder) {
        const message = `Unknown export type: ${exportJobRow.type}`;
        await exportJobRow.update({ status: "failed", errorMessage: message });
        throw new Error(message);
    }

    const fileName = `${exportJobRow.type}-${exportJobRow.id}.csv.gz`;
    const filePath = path.join(EXPORT_DIR, fileName);

    const pgClient = await pgReplicaPool.connect();

    try {
        // COPY does not support $1/$2 bind parameters (simple query
        // protocol only) - these ISO strings come from Date objects the
        // controller already validated with new Date(...), never raw
        // request text, so inlining them is safe. See export.js for the
        // same note on the original inline-streaming version of this.
        const fromLiteral = exportJobRow.fromDate.toISOString();
        const toLiteral = exportJobRow.toDate.toISOString();
        const copyQuery = queryBuilder(fromLiteral, toLiteral);

        const copyStream = pgClient.query(copyTo(copyQuery));
        const gzipStream = zlib.createGzip();
        const writeStream = fs.createWriteStream(filePath);

        let rowCount = 0;
        copyStream.on("data", (chunk) => {
            for (let i = 0; i < chunk.length; i++) {
                if (chunk[i] === 10) rowCount++; // count '\n' bytes as a cheap row counter
            }
        });

        await pipeline(copyStream, gzipStream, writeStream);
        rowCount -= 1; // subtract the CSV header line

        await exportJobRow.update({
            status: "done",
            filePath,
            fileName,
            rowCount: Math.max(rowCount, 0),
        });

        logger.info(`Export job ${job.id} (${exportJobRow.type}) finished: ${rowCount} rows -> ${fileName}`);

        const requestingUser = await User.findByPk(exportJobRow.userId);
        if (requestingUser?.email) {
            try {
                await mailQueue.add("export-ready-notification", {
                    to: requestingUser.email,
                    subject: "Your export is ready",
                    text: `Your ${exportJobRow.type} export (${rowCount} rows) is ready to download:\n\n${APP_BASE_URL}/v1/admin/export/jobs/${exportJobRow.id}/download\n\nThis link will stop working after ${EXPORT_RETENTION_DAYS} days.`,
                });
            } catch (error) {
                logger.error(`Failed to enqueue export-ready email for job ${job.id}: ${error.message}`);
            }
        }
    } catch (error) {
        await exportJobRow.update({ status: "failed", errorMessage: error.message });
        fs.unlink(filePath, () => {});
        throw error;
    } finally {
        pgClient.release();
    }
}

/**
 * Deletes export files (and marks their rows "expired") once they're
 * older than EXPORT_RETENTION_DAYS. Registered as a recurring BullMQ job
 * below, not a local cron - this is application logic running inside the
 * app's own worker, not a session-level schedule.
 */
async function processCleanupJob() {
    const cutoff = new Date(Date.now() - EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const oldJobs = await ExportJob.findAll({
        where: {
            status: "done",
            createdAt: { [Op.lt]: cutoff },
        },
    });

    for (const oldJob of oldJobs) {
        if (oldJob.filePath) {
            fs.unlink(oldJob.filePath, (err) => {
                if (err && err.code !== "ENOENT") {
                    logger.error(`Export cleanup: failed to delete ${oldJob.filePath}: ${err.message}`);
                }
            });
        }
        await oldJob.update({ status: "expired", filePath: null });
    }

    logger.info(`Export cleanup: expired ${oldJobs.length} export file(s) older than ${EXPORT_RETENTION_DAYS} days`);
}

const exportWorker = new Worker(
    "export",
    async (job) => {
        if (job.name === "cleanup-exports") {
            return processCleanupJob();
        }
        return processExportJob(job);
    },
    {
        connection,
        concurrency: Number(process.env.EXPORT_MAX_CONCURRENCY) || 2,
    }
);

exportWorker.on("failed", (job, err) => {
    logger.error(`Export worker job ${job.id} (${job.name}) failed: ${err.message}`);
});

// Registers the daily cleanup job. upsertJobScheduler is idempotent
// (internally uses override: true), so calling this every time the app
// starts updates the existing schedule instead of creating duplicates.
await exportQueue.upsertJobScheduler(
    "cleanup-exports-daily",
    { pattern: "0 3 * * *" }, // every day at 03:00
    { name: "cleanup-exports", data: {} }
);

export default exportWorker;
