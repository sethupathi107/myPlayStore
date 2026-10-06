import { Client } from "@opensearch-project/opensearch";
import { logger } from "../utils/logger.js";

const client = new Client({
    node: process.env.OPENSEARCH_URL,
});

client.ping()
    .then(() => logger.info("Connected to OpenSearch"))
    .catch((err) => logger.error(`OpenSearch ping failed: ${err.message}`));

export default client;