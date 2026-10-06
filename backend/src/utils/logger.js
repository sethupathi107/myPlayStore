import fs from "fs";
import path from "path";
import winston from "winston";

const LOG_DIR = "logs";

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR);
}

const { combine, timestamp, printf, colorize } = winston.format;

const plainFormat = printf(({ timestamp, level, message }) => {
    return `${timestamp} [${level.toUpperCase()}] ${message}`;
});

export const logger = winston.createLogger({
    level: "info",
    format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), plainFormat),
    transports: [
        new winston.transports.Console({
            format: combine(colorize(), timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), plainFormat)
        }),
        new winston.transports.File({ filename: path.join(LOG_DIR, "error.log"), level: "error" }),
        new winston.transports.File({ filename: path.join(LOG_DIR, "combined.log") })
    ]
});
export default logger;