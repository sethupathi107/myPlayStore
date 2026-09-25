import fs from "fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../utils/logger.js";
import { Image, Application } from "../sequelize/config/database.js";
import { invalidateAppCache } from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "../../uploads/images");

async function getAppImages(req, res) {
    try {
        const {applicationId} = req.body;

        const images = await Image.findAll({ where: { applicationId } });

        res.json(images);
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function addAppImage(req, res) {
    try {
        const {applicationId} = req.body;
        const isIcon = req.body.isIcon === "true" || req.body.isIcon === true;

        if (!req.file) {
            return res.status(400).json({ message: "Image file is required" });
        }

        const app = await Application.findByPk(applicationId);
        if (!app) {
            return res.status(404).json({ message: "App not found" });
        }

        if (app.userId !== req.user.id && req.user.role !== "admin") {
            logger.warn(`User ${req.user.id} attempted to add an image to app ${app.id} owned by ${app.userId}`);
            return res.status(403).json({ message: "You do not have permission to modify this app" });
        }

        const newImage = await Image.create({
            applicationId,
            filename: req.file.filename,
        });

        if (isIcon) {
            app.iconImageId = newImage.id;
            await app.save();
            await invalidateAppCache(applicationId);
        }

        logger.info(`User ${req.user.id} added image ${newImage.id} to app ${applicationId}${isIcon ? " as icon" : ""}`);

        res.status(201).json(newImage);
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function deleteAppImage(req, res) {
    try {
        const {applicationId} = req.body;
        const { imageId } = req.body;

        if (!imageId) {
            return res.status(400).json({ message: "imageId is required" });
        }

        const image = await Image.findOne({ where: { id: imageId, applicationId } });

        if (!image) {
            return res.status(404).json({ message: "Image not found" });
        }

        const parentApp = await Application.findByPk(image.applicationId);

        if (parentApp && parentApp.userId !== req.user.id && req.user.role !== "admin") {
            logger.warn(`User ${req.user.id} attempted to delete image ${image.id} from app ${parentApp.id} owned by ${parentApp.userId}`);
            return res.status(403).json({ message: "You do not have permission to modify this app" });
        }

        const filename = image.filename;
        const wasIcon = parentApp?.iconImageId === image.id;

        await image.destroy();

        // The FK's ON DELETE SET NULL already clears Applications.iconImageId
        // in the database - this just keeps the Redis-cached app rows in sync.
        if (wasIcon) {
            await invalidateAppCache(applicationId);
        }

        fs.unlink(path.join(UPLOAD_DIR, filename)).catch((err) => {
            logger.error(`Failed to remove image file ${filename}: ${err.message}`);
        });

        logger.info(`User ${req.user.id} deleted image ${image.id} from app ${applicationId}`);

        res.json({ message: "Image deleted", image });
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function getImageFile(req, res) {
    try {
        const { imageId } = req.body;

        const image = await Image.findByPk(imageId);
        if (!image) {
            return res.status(404).json({ message: "Image not found" });
        }

        const filePath = path.join(UPLOAD_DIR, image.filename);

        res.sendFile(filePath, (err) => {
            if (err) {
                logger.error(err.stack || err.message);
                if (!res.headersSent) {
                    res.status(404).json({ message: "File not found on server" });
                }
            }
        });
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

export default {
    getAppImages,
    addAppImage,
    deleteAppImage,
    getImageFile,
};
