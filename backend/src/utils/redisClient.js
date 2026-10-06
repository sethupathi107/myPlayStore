import { createClient } from "redis";
import { logger } from "./logger.js";

const client = createClient({
    url: process.env.REDIS_URL,
});

client.on("error", (err) => {
    logger.error(`Redis error: ${err.message}`);
});

await client.connect();

logger.info("Connected to Redis");

export default client;