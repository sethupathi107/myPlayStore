import { Worker } from "bullmq";
import connection from "../utils/bullConnection.js";
import client from "./opensearchClient.js";
import { APPLICATIONS_INDEX } from "./opensearchIndex.js";
import { logger } from "../utils/logger.js";

const searchIndexWorker = new Worker(
    "search-index",
    async (job) => {
        const { action, applicationId, document } = job.data;

        if (action === "upsert") {
            await client.index({
                index: APPLICATIONS_INDEX,
                id: applicationId,
                body: document,
                refresh: true, // small index, freshness matters more than raw throughput here
            });
        } else if (action === "delete") {
            await client.delete({
                index: APPLICATIONS_INDEX,
                id: applicationId,
            }).catch((err) => {
                if (err.meta?.statusCode !== 404) throw err;
            });
        }
    },
    { connection, concurrency: 5 }
);

searchIndexWorker.on("failed", (job, err) => {
    logger.error(`search-index job ${job.id} (${job.data.action}) failed: ${err.message}`);
});

export default searchIndexWorker;