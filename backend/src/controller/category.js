import path from "node:path";
import fs from "fs/promises";
import { fileURLToPath } from "node:url";
import { Category, Application, Image } from "../sequelize/config/database.js";
import { logger } from "../utils/logger.js";
import client from "../utils/redisClient.js";
const EXP = process.env.EXP;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "../../uploads");
const IMAGE_UPLOAD_DIR = path.join(__dirname, "../../uploads/images");

async function getAllCategories(req, res) {

    const cacheKey = "category:all";
    try{
        const cached = await client.get(cacheKey);
        if(cached){
            return res.status(200).json(JSON.parse(cached))
        }
    } catch(error){
        logger.error("Redis GET failed, falling back to DB: ",error.message)
    }

    try {
        const categories = await Category.findAll();
        try{
            await client.set(cacheKey,JSON.stringify(categories), {EX:EXP});
        } catch(error) {
            logger.error("Redis GET failed, falling back to DB: ",error.message)
        }
        res.json(categories);
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function createCategory(req, res) {
    try {
        const { name } = req.body;

        const existingCategory = await Category.findOne({ where: { name } });

        if (existingCategory) {
            return res.status(409).json({ message: "Category already exists" });
        }

        const newCategory = await Category.create({ name });

        try{
            await client.del("category:all");
        }catch(error){
            logger.error("Redis DEL failed: ", error.message);
        }

        logger.info(`User ${req.user.id} created category ${newCategory.id} (${newCategory.name})`);

        res.status(201).json(newCategory);
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function deleteCategory(req, res) {
    try {
        const { id } = req.body;

        const category = await Category.findOne({ where: { id } });

        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }

        // Deleting the category cascades (at the DB level) through every
        // Application in it, and through their Installeds/Images - that
        // cascade never runs Sequelize hooks or application code, so the
        // actual files on disk have to be cleaned up here, before the rows
        // disappear out from under us.
        const appsInCategory = await Application.findAll({
            where: { categoryId: id },
            include: [{ model: Image, as: "images" }],
        });

        const fileCleanupTargets = [];
        for (const app of appsInCategory) {
            if (app.applicationURL) {
                fileCleanupTargets.push(path.join(UPLOAD_DIR, app.applicationURL));
            }
            for (const image of app.images || []) {
                fileCleanupTargets.push(path.join(IMAGE_UPLOAD_DIR, image.filename));
            }
        }

        logger.info(
            `User ${req.user.id} is deleting category ${category.id} (${category.name}) - this cascades to ${appsInCategory.length} app(s) and their images/installs`
        );

        await category.destroy();

        for (const filePath of fileCleanupTargets) {
            fs.unlink(filePath).catch((err) => {
                logger.error(`Failed to remove file ${filePath} after category delete: ${err.message}`);
            });
        }

        try{
            await client.del("category:all");
        }catch(error){
            logger.error("Redis DEL failed: ", error.message);
        }

        logger.info(`User ${req.user.id} deleted category ${category.id} (${category.name})`);

        res.json({ message: "Category deleted", category });
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

export default {
    getAllCategories,
    createCategory,
    deleteCategory
};
