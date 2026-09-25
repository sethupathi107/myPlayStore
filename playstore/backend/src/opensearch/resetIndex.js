import client from "./opensearchClient.js";
import { APPLICATIONS_INDEX, INDEX_BODY } from "./opensearchIndex.js";
import { logger } from "../utils/logger.js";

// Deletes the "applications" index if it exists, then recreates it with the
// same settings/mapping as opensearchIndex.js's ensureApplicationsIndex() -
// imported from there directly so the two can't drift out of sync.
// Run with: npm run reset:index
// (Follow up with `npm run reindex:apps` to repopulate it from Postgres.)

async function run() {
    const exists = await client.indices.exists({ index: APPLICATIONS_INDEX });
    if (exists.body) {
        await client.indices.delete({ index: APPLICATIONS_INDEX });
        logger.info(`Deleted OpenSearch index "${APPLICATIONS_INDEX}"`);
    }

    await client.indices.create({ index: APPLICATIONS_INDEX, body: INDEX_BODY });
    logger.info(`Created OpenSearch index "${APPLICATIONS_INDEX}"`);
    process.exit(0);
}

run().catch((err) => {
    logger.error(`Failed to reset OpenSearch index: ${err.message}`);
    process.exit(1);
});
