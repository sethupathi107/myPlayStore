import client from "./opensearchClient.js";
import { logger } from "../utils/logger.js";

export const APPLICATIONS_INDEX = "applications";

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
            iconImageId: { type: "keyword" },
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

export async function ensureApplicationsIndex() {
    const exists = await client.indices.exists({ index: APPLICATIONS_INDEX });
    if (exists.body) {
        return;
    }
    await client.indices.create({ index: APPLICATIONS_INDEX, body: INDEX_BODY });
    logger.info(`Created OpenSearch index "${APPLICATIONS_INDEX}"`);
}