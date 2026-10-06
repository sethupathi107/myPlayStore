import IORedis from "ioredis";
import logger from "./logger.js";

const connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
});

connection.on("error", (err) => {
    logger.error(`BullMQ Redis connection error: ${err.message}`);
});

connection.on("connect", () => logger.info("bull redis connected"))


export default connection;