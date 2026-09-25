import client from "./opensearchClient.js";
import { APPLICATIONS_INDEX } from "./opensearchIndex.js";
import { logger } from "../utils/logger.js";

// Deletes the "applications" index if it exists, then recreates it with the
// same settings/mapping as opensearchIndex.js's ensureApplicationsIndex().
// Run with: npm run reset:index
// (Follow up with `npm run reindex:apps` to repopulate it from Postgres.)

const INDEX_BODY = {
    settings: {
        analysis: {
            analyzer: {
                default: { type: "standard" },
            },
        },
    },
    mappings: {
        properties: {
            id: { type: "keyword" },
            name: {
                type: "text",
                fields: { keyword: { type: "keyword" } },
            },
            description: { type: "text" },
            categoryId: { type: "keyword" },
            categoryName: {
                type: "keyword",
                fields: {
                    text: { type: "text" }
                }
            },
            uploaderUsername: { type: "keyword" },
            downloads: { type: "integer" },
            createdAt: { type: "date" },
        },
    },
};

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
