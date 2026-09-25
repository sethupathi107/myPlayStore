import { QueryTypes, Op } from "@sequelize/core";
import { logger } from "../utils/logger.js";
import sequelize,{ Application, Installed, Image } from "../sequelize/config/database.js";
import path from "node:path";
import fs from "fs/promises";
import { fileURLToPath } from "node:url";
import client from "../utils/redisClient.js";
const EXP = process.env.EXP;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "../../uploads");
const IMAGE_UPLOAD_DIR = path.join(__dirname, "../../uploads/images");


import searchIndexQueue from "../opensearch/searchIndexQueue.js";
import opensearch from "../opensearch/opensearchClient.js";
import { APPLICATIONS_INDEX } from "../opensearch/opensearchIndex.js";
import { Category, User } from "../sequelize/config/database.js";

async function enqueueIndexUpsert(app) {
    const [category, uploader] = await Promise.all([
        Category.findByPk(app.categoryId),
        User.findByPk(app.userId),
    ]);
    await searchIndexQueue.add("upsert", {
        action: "upsert",
        applicationId: app.id,
        document: {
            id: app.id,
            name: app.name,
            description: app.description,
            categoryId: app.categoryId,
            iconImageId: app.iconImageId,
            categoryName: category?.name ?? null,
            uploaderUsername: uploader?.username ?? null,
            downloads: app.downloads ?? 0,
            createdAt: app.createdAt,
        },
    });
}

// Sending every row back in one response doesn't scale as the apps table
// grows, so this is paginated the same way /app/search already is:
// ?page=&limit= in, { total, page, limit, results } out.
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

async function getAllApps(req, res) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.limit) || DEFAULT_PAGE_SIZE));
    const offset = (page - 1) * limit;

    // Optional filters: ?categoryId= for browsing one category, ?mine=true
    // for "just the apps I uploaded", ?excludeId= to drop one app (used by
    // the "similar apps" section so an app never lists itself).
    const { categoryId, excludeId } = req.query;
    const mine = req.query.mine === "true" || req.query.mine === "1";

    const where = {};
    if (categoryId) where.categoryId = categoryId;
    if (mine) where.userId = req.user.id;
    if (excludeId) where.id = { [Op.ne]: excludeId };

    const hasFilters = Object.keys(where).length > 0;
    const cacheKey = `app:all:${page}:${limit}:${categoryId || ""}:${mine ? req.user.id : ""}:${excludeId || ""}`;

    // Only the unfiltered, non-personal listing is worth caching - a "mine"
    // or "similar apps" query is either per-user or narrow enough that
    // caching it adds complexity for little benefit.
    if (!hasFilters) {
        try{
            const cached=await client.get(cacheKey)
            if(cached){
                return res.json(JSON.parse(cached));
            }
        } catch(error){
            logger.error("Redis GET failed, falling back to DB: ",error.message)
        }
    }

    try{
        const { rows, count } = await Application.findAndCountAll({
            where,
            limit,
            offset,
            order: [["createdAt", "DESC"]],
        });

        const payload = { total: count, page, limit, results: rows };

        if (!hasFilters) {
            try{
                await client.set(cacheKey,JSON.stringify(payload),{EX:60});
            } catch (error){
                logger.error("Redis SET failed: ",error.message);
            }
        }
        res.json(payload)
    }catch(error){
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }

}

// The list is cached per page/limit combination (app:all:1:20, app:all:2:20,
// ...) so a plain `del("app:all")` after a write never actually cleared it -
// this clears every cached page instead.
async function invalidateAppListCache() {
    try {
        const keys = await client.keys("app:all:*");
        if (keys.length > 0) await client.del(keys);
    } catch (error) {
        logger.error("Redis DEL (app list cache) failed: ", error.message);
    }
}

// Shared with the images controller: setting/clearing an app's icon changes
// the Application row (iconImageId), so both the list cache and that app's
// own appid:<id> cache need to drop the same way a name/description edit does.
export async function invalidateAppCache(applicationId) {
    await invalidateAppListCache();
    try {
        await client.del("appid:" + applicationId);
    } catch (error) {
        logger.error("Redis DEL failed: ", error.message);
    }
}

async function getAppById(req, res) {
    // try {

    //     const {applicationid} = req.body;
    //     const app = await Application.findByPk(applicationid);

    //     if (!app) {
    //         return res.status(404).json({ message: "App not found" });
    //     }
    //     res.json(app);
    // } catch (error) {
    //     logger.error(error.stack || error.message);
    //     res.status(500).json({ message: "Internal server error" });
    // }


    const {applicationId} = req.body;

    if(!applicationId){
        return res.status(400).json({message :"applicationId is required"})
    }

    const cacheKey="appid:"+applicationId;
    try{
        const cached=await client.get(cacheKey)
        if(cached){
            return res.json(JSON.parse(cached));
        }
    } catch(error){
        logger.error("Redis GET failed, falling back to DB: ",error.message)
    }

    try{
        const app = await Application.findByPk(applicationId);

        if (!app) {
            return res.status(404).json({ message: "App not found" });
        }

        // Downloads aren't stored on the app itself (Installed rows are the
        // source of truth, same as /app/hot and /app/trending) - the app
        // detail page needs the real count here too, not a guess.
        const downloads = await Installed.count({ where: { applicationId } });
        const payload = { ...app.toJSON(), downloads };

        try{
            await client.set(cacheKey,JSON.stringify(payload),{EX:EXP});
        } catch (error){
            logger.error("Redis SET failed: ",error.message);
        }

        res.json(payload)
    }catch(error){
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function createApp(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Application file is required" });
        }
        const { name, categoryId, description } = req.body;
        const applicationURL = req.file.filename;

        if (!name || !categoryId) {
            return res.status(400).json({
                message: "Name and category are required"
            });
        }
 
        const app =await Application.create({
            name,
            categoryId,
            description,
            userId: req.user.id, // uploader is always the authenticated user, never client-supplied
            applicationURL
        })

        await invalidateAppListCache();

        logger.info(`User ${req.user.id} created app ${app.id} (${app.name})`);

        await enqueueIndexUpsert(app).catch((err) =>
            logger.error(`Failed to enqueue search index for app ${app.id}: ${err.message}`)
        );

        res.status(201).json(app);

    } catch (error) {
        const handled = handleAppWriteError(error, res);
        if (handled) return;
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

// A request can carry a still-valid access token for a user (or reference a
// category) that no longer exists in the database - the JWT itself doesn't
// get revoked when the row does. Rather than let that surface as a raw 500,
// translate the specific foreign key it tripped into a clean, actionable
// response.
function handleAppWriteError(error, res) {
    // A field failing model validation (too long/short, empty, etc.) is a
    // bad request, not a server error - surface the actual reason instead
    // of a generic 500.
    if (error.name === "SequelizeValidationError") {
        res.status(400).json({ message: error.errors.map((e) => e.message).join(", ") });
        return true;
    }

    if (error.name !== "SequelizeForeignKeyConstraintError") return false;

    const constraint = error.original?.constraint || error.parent?.constraint || "";

    if (constraint.includes("userId")) {
        res.status(401).json({ message: "Your account no longer exists. Please log in again." });
        return true;
    }
    if (constraint.includes("categoryId")) {
        res.status(400).json({ message: "That category no longer exists. Please choose another." });
        return true;
    }
    return false;
}

async function updateApp(req, res) {
    try {
        const { id, name, categoryId, description } = req.body;

        if (!id) {
            return res.status(400).json({ message: "App id is required" });
        }

        const app = await Application.findByPk(id);

        if (!app) {
            return res.status(404).json({ message: "App not found" });
        }

        if (app.userId !== req.user.id && req.user.role !== "admin") {
            logger.warn(`User ${req.user.id} attempted to update app ${app.id} owned by ${app.userId}`);
            return res.status(403).json({ message: "You do not have permission to modify this app" });
        }
        const oldFilename = app.applicationURL;

        if(name!== undefined) app.name = name;
        if(categoryId !== undefined) app.categoryId=categoryId;
        if(description !== undefined) app.description = description;
        if(req.file) app.applicationURL = req.file.filename;

        await app.save();

        if (req.file && oldFilename) {
            fs.unlink(path.join(UPLOAD_DIR, oldFilename)).catch((err) => {
                logger.error(`Failed to remove old app file ${oldFilename}: ${err.message}`);
            });
        }

        await invalidateAppListCache();
        try{
            await client.del("appid:"+id);
        }catch(error){
            logger.error("Redis DEL failed: ", error.message);
        }

        logger.info(`User ${req.user.id} updated app ${app.id} (${app.name})`);

        await enqueueIndexUpsert(app).catch((err) =>
            logger.error(`Failed to enqueue search index for app ${app.id}: ${err.message}`)
        );

        res.status(200).json(app);
    } catch (error) {
        const handled = handleAppWriteError(error, res);
        if (handled) return;
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function deleteApp(req, res) {
    try {
         const { applicationId} = req.body;

        if (!applicationId) {
            return res.status(400).json({ message: "App applicationId is required" });
        }

        const app = await Application.findByPk(applicationId, {
            include: [{ model: Image, as: "images" }],
        });

        if (!app) {
            return res.status(404).json({ message: "App not found" });
        }

        if (app.userId !== req.user.id && req.user.role !== "admin") {
            logger.warn(`User ${req.user.id} attempted to delete app ${app.id} owned by ${app.userId}`);
            return res.status(403).json({ message: "You do not have permission to delete this app" });
        }

        const imageFilenames = (app.images || []).map((image) => image.filename);

        await sequelize.transaction(async (t) => {
            await app.destroy({ transaction: t });
        });

        fs.unlink(path.join(UPLOAD_DIR, app.applicationURL)).catch((err) => {
            logger.error(`Failed to remove old app file ${app.applicationURL}: ${err.message}`);
        });

        for (const filename of imageFilenames) {
            fs.unlink(path.join(IMAGE_UPLOAD_DIR, filename)).catch((err) => {
                logger.error(`Failed to remove app image file ${filename}: ${err.message}`);
            });
        }

        await invalidateAppListCache();
        try{
            await client.del("appid:"+applicationId)
        } catch(error){
            logger.error("Redis DEL failed: ",error.message);
        }

        logger.info(`User ${req.user.id} deleted app ${app.id} (${app.applicationURL})`);

        await searchIndexQueue.add("delete", { action: "delete", applicationId: app.id }).catch((err) =>
            logger.error(`Failed to enqueue search-index delete for app ${app.id}: ${err.message}`)
        );

        res.status(200).json({ message: "App deleted", app: app });
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function downloadApp(req,res){
    try{
        const {applicationId} = req.body;

        const app = await Application.findByPk(applicationId);

        if(!app){
            return res.status(404).json({message:"App not fount"});
        }

        const filePath = path.join(UPLOAD_DIR,app.applicationURL);
        const downloadName = `${app.name}${path.extname(app.applicationURL)}`;

        res.download(filePath,downloadName,(err)=>{
            if(err){
                logger.error(err.stack || err.message);
                if(!res.headersSent){
                    res.status(404).json({message:"File not found on server"})
                }
                return;
            }

            Installed.create({
                userId: req.user.id,
                applicationId,
            })
                .then(() => invalidateAppCache(applicationId))
                .catch((error) => {
                    logger.error("Failed to record install: ", error.message);
                });
        })
    } catch (error){
        logger.error(error.stack || error.message);
        res.status(500).json({message:"Internal server error"});
    }
}


async function searchApps(req, res) {
    try {
        const { q, categoryId, page = 1, limit = 20 } = req.query;

        if (!q || !q.trim()) {
            return res.status(400).json({ message: "Query parameter 'q' is required" });
        }

        const must = [
            {
                multi_match: {
                    query: q,
                    fields: ["name^3", "description","categoryName^2"],
                    fuzziness: "AUTO",
                },
            },
        ];
        const filter = categoryId ? [{ term: { categoryId } }] : [];

        const result = await opensearch.search({
            index: APPLICATIONS_INDEX,
            body: {
                query: { bool: { must, filter } },
                from: (Number(page) - 1) * Number(limit),
                size: Number(limit),
            },
        });

        const hits = result.body.hits.hits.map((hit) => ({ ...hit._source, score: hit._score }));

        res.json({
            total: result.body.hits.total.value,
            page: Number(page),
            limit: Number(limit),
            results: hits,
        });
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}




const MAX_HOT_LIMIT = 50;

/**
 * GET /v1/app/hot?limit=10
 *
 * The most-downloaded apps overall, ranked by how many "Installed" rows
 * each app has. Downloads aren't stored on the app itself (only Installed
 * rows are the source of truth), so this counts them with a LEFT JOIN the
 * same way the admin apps-by-category/downloads-by-category endpoints do -
 * an app with zero downloads still shows up with {downloads: 0}.
 */
async function getHotApps(req, res) {
    const limit = Math.min(MAX_HOT_LIMIT, Math.max(1, Number(req.query.limit) || 10));
    const cacheKey = `app:hot:${limit}`;

    try {
        const cached = await client.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));
    } catch (error) {
        logger.error("Redis GET failed, falling back to DB: ", error.message);
    }

    try {
        const rows = await sequelize.query(
            `
            SELECT
                a.id,
                a.name,
                a.description,
                a."categoryId",
                a."iconImageId",
                c.name AS "categoryName",
                COUNT(i.id)::int AS "downloads"
            FROM "Applications" a
            LEFT JOIN "Installeds" i ON i."applicationId" = a.id
            LEFT JOIN "Categories" c ON c.id = a."categoryId"
            GROUP BY a.id, c.name
            ORDER BY "downloads" DESC, a."createdAt" DESC
            LIMIT :limit
            `,
            { replacements: { limit }, type: QueryTypes.SELECT }
        );

        const payload = { results: rows };

        try {
            await client.set(cacheKey, JSON.stringify(payload), { EX: 60 });
        } catch (error) {
            logger.error("Redis SET failed: ", error.message);
        }

        res.json(payload);
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

const MAX_TRENDING_LIMIT = 50;
const DEFAULT_TRENDING_DAYS = 7;
const MAX_TRENDING_DAYS = 90;

/**
 * GET /v1/app/trending?days=7&limit=10
 *
 * Apps ranked by how many Installed rows they picked up in just the last
 * N days (default 7) - a "what's hot right now" view, distinct from
 * /app/hot's all-time download count. The day window lives in the JOIN's
 * own ON clause (not a WHERE on the outer query) so an app with zero
 * *recent* installs still shows up with {downloads: 0} instead of being
 * dropped entirely, same as /app/hot.
 */
async function getTrendingApps(req, res) {
    const limit = Math.min(MAX_TRENDING_LIMIT, Math.max(1, Number(req.query.limit) || 10));
    const days = Math.min(MAX_TRENDING_DAYS, Math.max(1, Number(req.query.days) || DEFAULT_TRENDING_DAYS));
    const cacheKey = `app:trending:${days}:${limit}`;

    try {
        const cached = await client.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));
    } catch (error) {
        logger.error("Redis GET failed, falling back to DB: ", error.message);
    }

    try {
        const rows = await sequelize.query(
            `
            SELECT
                a.id,
                a.name,
                a.description,
                a."categoryId",
                a."iconImageId",
                c.name AS "categoryName",
                COUNT(i.id)::int AS "downloads"
            FROM "Applications" a
            LEFT JOIN "Installeds" i
                ON i."applicationId" = a.id
                AND i."createdAt" >= NOW() - (:days::text || ' days')::interval
            LEFT JOIN "Categories" c ON c.id = a."categoryId"
            GROUP BY a.id, c.name
            ORDER BY "downloads" DESC, a."createdAt" DESC
            LIMIT :limit
            `,
            { replacements: { days, limit }, type: QueryTypes.SELECT }
        );

        const payload = { days, results: rows };

        try {
            await client.set(cacheKey, JSON.stringify(payload), { EX: 60 });
        } catch (error) {
            logger.error("Redis SET failed: ", error.message);
        }

        res.json(payload);
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

/**
 * GET /v1/app/trending-by-category?days=7&limit=5
 *
 * Same idea as getHotAppsByCategory, but ranked by downloads within just
 * the last `days` days (like getTrendingApps) instead of all-time - the
 * "trending in each category" shelves on Discover. Categories with no
 * apps at all simply don't appear (nothing to rank); a category whose
 * apps have zero *recent* installs still appears, just ordered by
 * createdAt as a tie-break (same fallback getHotAppsByCategory uses).
 */
async function getTrendingAppsByCategory(req, res) {
    const limit = Math.min(MAX_HOT_LIMIT, Math.max(1, Number(req.query.limit) || 5));
    const days = Math.min(MAX_TRENDING_DAYS, Math.max(1, Number(req.query.days) || DEFAULT_TRENDING_DAYS));
    const cacheKey = `app:trendingByCategory:${days}:${limit}`;

    try {
        const cached = await client.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));
    } catch (error) {
        logger.error("Redis GET failed, falling back to DB: ", error.message);
    }

    try {
        const rows = await sequelize.query(
            `
            SELECT id, name, description, "categoryId", "iconImageId", "categoryName", downloads
            FROM (
                SELECT
                    a.id,
                    a.name,
                    a.description,
                    a."categoryId",
                    a."iconImageId",
                    c.name AS "categoryName",
                    COUNT(i.id)::int AS downloads,
                    ROW_NUMBER() OVER (
                        PARTITION BY a."categoryId"
                        ORDER BY COUNT(i.id) DESC, a."createdAt" DESC
                    ) AS rank
                FROM "Applications" a
                LEFT JOIN "Installeds" i
                    ON i."applicationId" = a.id
                    AND i."createdAt" >= NOW() - (:days::text || ' days')::interval
                LEFT JOIN "Categories" c ON c.id = a."categoryId"
                GROUP BY a.id, c.name
            ) ranked
            WHERE rank <= :limit
            ORDER BY "categoryName" ASC, downloads DESC
            `,
            { replacements: { days, limit }, type: QueryTypes.SELECT }
        );

        const categoriesById = new Map();
        for (const row of rows) {
            if (!categoriesById.has(row.categoryId)) {
                categoriesById.set(row.categoryId, {
                    categoryId: row.categoryId,
                    categoryName: row.categoryName,
                    apps: [],
                });
            }
            categoriesById.get(row.categoryId).apps.push({
                id: row.id,
                name: row.name,
                description: row.description,
                iconImageId: row.iconImageId,
                downloads: row.downloads,
            });
        }

        const payload = { days, categories: [...categoriesById.values()] };

        try {
            await client.set(cacheKey, JSON.stringify(payload), { EX: 60 });
        } catch (error) {
            logger.error("Redis SET failed: ", error.message);
        }

        res.json(payload);
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

/**
 * GET /v1/app/hot-by-category?limit=5
 *
 * Same ranking as getHotApps, but split per category - the top `limit`
 * apps within each category instead of one global list. Uses
 * ROW_NUMBER() OVER (PARTITION BY categoryId ...) to rank apps inside
 * their own category, then keeps only the top N rows of each partition.
 * Categories with no apps at all simply don't appear (nothing to rank).
 */
async function getHotAppsByCategory(req, res) {
    const limit = Math.min(MAX_HOT_LIMIT, Math.max(1, Number(req.query.limit) || 5));
    const cacheKey = `app:hotByCategory:${limit}`;

    try {
        const cached = await client.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));
    } catch (error) {
        logger.error("Redis GET failed, falling back to DB: ", error.message);
    }

    try {
        const rows = await sequelize.query(
            `
            SELECT id, name, description, "categoryId", "iconImageId", "categoryName", downloads
            FROM (
                SELECT
                    a.id,
                    a.name,
                    a.description,
                    a."categoryId",
                    a."iconImageId",
                    c.name AS "categoryName",
                    COUNT(i.id)::int AS downloads,
                    ROW_NUMBER() OVER (
                        PARTITION BY a."categoryId"
                        ORDER BY COUNT(i.id) DESC, a."createdAt" DESC
                    ) AS rank
                FROM "Applications" a
                LEFT JOIN "Installeds" i ON i."applicationId" = a.id
                LEFT JOIN "Categories" c ON c.id = a."categoryId"
                GROUP BY a.id, c.name
            ) ranked
            WHERE rank <= :limit
            ORDER BY "categoryName" ASC, downloads DESC
            `,
            { replacements: { limit }, type: QueryTypes.SELECT }
        );

        const categoriesById = new Map();
        for (const row of rows) {
            if (!categoriesById.has(row.categoryId)) {
                categoriesById.set(row.categoryId, {
                    categoryId: row.categoryId,
                    categoryName: row.categoryName,
                    apps: [],
                });
            }
            categoriesById.get(row.categoryId).apps.push({
                id: row.id,
                name: row.name,
                description: row.description,
                iconImageId: row.iconImageId,
                downloads: row.downloads,
            });
        }

        const payload = { categories: [...categoriesById.values()] };

        try {
            await client.set(cacheKey, JSON.stringify(payload), { EX: 60 });
        } catch (error) {
            logger.error("Redis SET failed: ", error.message);
        }

        res.json(payload);
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

export default {
    getAllApps,
    getAppById,
    createApp,
    updateApp,
    deleteApp,
    downloadApp,
    searchApps,
    getHotApps,
    getHotAppsByCategory,
    getTrendingApps,
    getTrendingAppsByCategory
};
