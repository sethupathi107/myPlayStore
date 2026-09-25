import { QueryTypes, Op } from "@sequelize/core";
import client from '../utils/redisClient.js'
import sequelize, { User, Application, Installed, Logs } from "../sequelize/config/database.js";
import { logger } from "../utils/logger.js";
import bcrypt from "bcrypt"

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Resolves a day-bucketed date range for the downloads-history chart:
 * range=7d (default) or 30d gives the last N days ending today; from/to
 * (YYYY-MM-DD or any Date-parseable string) gives a custom range - both
 * are required together, same convention as export.js's resolveDateRange.
 */
function resolveHistoryRange(query) {
    const { range, from, to } = query;

    if (from || to) {
        if (!from || !to) {
            const err = new Error("Both 'from' and 'to' are required for a custom range");
            err.status = 400;
            throw err;
        }
        const fromDate = new Date(from);
        const toDate = new Date(to);
        if (isNaN(fromDate) || isNaN(toDate)) {
            const err = new Error("'from'/'to' must be valid dates (e.g. 2026-09-01)");
            err.status = 400;
            throw err;
        }
        if (fromDate > toDate) {
            const err = new Error("'from' must be on or before 'to'");
            err.status = 400;
            throw err;
        }
        return { from: fromDate, to: toDate, label: "custom" };
    }

    const days = range === "30d" ? 30 : 7; // default: 7d
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - (days - 1) * DAY_MS);
    return { from: fromDate, to: toDate, label: range === "30d" ? "30d" : "7d" };
}

/**
 * Resolves the date range for GET /logs/export. from/to (required
 * together) is the primary way in - any Date-parseable string, 'to' is
 * pushed to end-of-day so a same-day range (from=to=today) still
 * includes today's rows. range=7d/30d is kept as a shortcut. With
 * neither given, defaults to the last 7 days rather than dumping the
 * whole table unbounded.
 */
function resolveLogRange(query) {
    const { range, from, to } = query;

    if (from || to) {
        if (!from || !to) {
            const err = new Error("Both 'from' and 'to' are required for a custom range");
            err.status = 400;
            throw err;
        }
        const fromDate = new Date(from);
        const toDate = new Date(to);
        if (isNaN(fromDate) || isNaN(toDate)) {
            const err = new Error("'from'/'to' must be valid dates (e.g. 2026-09-01)");
            err.status = 400;
            throw err;
        }
        toDate.setHours(23, 59, 59, 999);
        if (fromDate > toDate) {
            const err = new Error("'from' must be on or before 'to'");
            err.status = 400;
            throw err;
        }
        return { from: fromDate, to: toDate, label: `${from}_${to}` };
    }

    const days = range === "30d" ? 30 : 7;
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - (days - 1) * DAY_MS);
    fromDate.setHours(0, 0, 0, 0);
    return { from: fromDate, to: toDate, label: range === "30d" ? "30d" : "7d" };
}

// Wraps a value in double quotes only when the CSV spec requires it
// (contains a comma, quote, or newline), doubling any internal quotes -
// log messages routinely contain commas and stack-trace newlines, so a
// naive join(",") would silently corrupt the file.
function toCsvField(value) {
    const str = value === null || value === undefined ? "" : String(value);
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

async function getActivity(req, res) {

    const cacheKey="admin"

    try{
        const activity = await client.get(cacheKey);
        if(activity){
            return res.status(200).json(JSON.parse(activity));
        }
    }catch(error){
        logger.error("Redis GET failed, falling back to DB:",error.message);
    }

    try {
        const [totalUsers, totalApps, totalDownloads, users] = await Promise.all([
            User.count(),
            Application.count(),
            Installed.count(),
            User.findAll({ attributes: { exclude: ["password"] } }),
        ]);

        const payload = { totalUsers, totalApps, totalDownloads, users };

        try{
            await client.set(cacheKey, JSON.stringify(payload), { EX: 60 });
        } catch(error){
            logger.error("Redis SET failed: ",error.message);
        }

        logger.info(`User ${req.user.id} viewed the admin activity dashboard`);

        res.json({
            totalUsers,
            totalApps,
            totalDownloads,
            users,
        });
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}


async function getLogs(req, res) {
    try {
        const limit = Number(req.query.limit) || 100;

        const logs = await Logs.findAll({
            order: [["createdAt", "DESC"]],
            limit,
        });

        res.json(logs);
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

/**
 * GET /v1/admin/downloads-history?range=7d|30d  (or ?from=&to=)
 *
 * One row per calendar day in the range - how many "Installed" rows
 * (downloads) landed on that day, zero-filled for days with no
 * downloads at all. Not who downloaded what, just the daily count, for
 * charting. generate_series builds the full list of days first so a
 * day with zero downloads still shows up as {count: 0} instead of being
 * silently missing from the response.
 */
async function getDownloadsHistory(req, res) {
    let dateRange;
    try {
        dateRange = resolveHistoryRange(req.query);
    } catch (error) {
        return res.status(error.status || 400).json({ message: error.message });
    }

    try {
        const rows = await sequelize.query(
            `
            SELECT
                gs.day::date AS "date",
                COALESCE(COUNT(i.id), 0)::int AS "count"
            FROM generate_series(:from::date, :to::date, interval '1 day') AS gs(day)
            LEFT JOIN "Installeds" i ON date_trunc('day', i."createdAt") = gs.day
            GROUP BY gs.day
            ORDER BY gs.day ASC
            `,
            {
                replacements: { from: dateRange.from, to: dateRange.to },
                type: QueryTypes.SELECT,
            }
        );

        const data = rows.map((row) => ({
            date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10),
            count: Number(row.count),
        }));

        const totalDownloads = data.reduce((sum, day) => sum + day.count, 0);

        res.status(200).json({
            range: dateRange.label,
            from: dateRange.from.toISOString().slice(0, 10),
            to: dateRange.to.toISOString().slice(0, 10),
            totalDownloads,
            data,
        });
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

/**
 * GET /v1/admin/logs/export?from=&to=  (or ?range=7d|30d)
 * Streams every Logs row created in the range back as a CSV attachment
 * - date-wise export for the admin log view, same from/to convention as
 * the downloads export and the downloads-history chart endpoint.
 */
async function exportLogs(req, res) {
    let dateRange;
    try {
        dateRange = resolveLogRange(req.query);
    } catch (error) {
        return res.status(error.status || 400).json({ message: error.message });
    }

    try {
        const logs = await Logs.findAll({
            where: {
                createdAt: { [Op.between]: [dateRange.from, dateRange.to] },
            },
            order: [["createdAt", "ASC"]],
        });

        const header = "id,createdAt,message";
        const rows = logs.map((log) =>
            [toCsvField(log.id), toCsvField(log.createdAt.toISOString()), toCsvField(log.message)].join(",")
        );
        const csv = [header, ...rows].join("\r\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="logs-${dateRange.label}.csv"`);
        res.status(200).send(csv);
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

/**
 * GET /v1/admin/apps-by-category
 *
 * Pie-chart data: how many apps sit in each category, and what share of
 * the total that is - not which apps, just the counts. LEFT JOIN from
 * Categories so a category with zero apps still shows up as {count: 0,
 * percentage: 0} instead of being silently missing from the slice list.
 * Percentages are rounded to 1 decimal for display; because of that
 * rounding they won't always sum to exactly 100 - that's normal for a
 * pie chart and not a bug.
 */
async function getAppsByCategory(req, res) {
    try {
        const rows = await sequelize.query(
            `
            SELECT
                c.id AS "categoryId",
                c.name AS "name",
                COUNT(a.id)::int AS "count"
            FROM "Categories" c
            LEFT JOIN "Applications" a ON a."categoryId" = c.id
            GROUP BY c.id, c.name
            ORDER BY "count" DESC
            `,
            { type: QueryTypes.SELECT }
        );

        const totalApps = rows.reduce((sum, row) => sum + Number(row.count), 0);

        const categories = rows.map((row) => {
            const count = Number(row.count);
            return {
                categoryId: row.categoryId,
                name: row.name,
                count,
                percentage: totalApps > 0 ? Math.round((count / totalApps) * 1000) / 10 : 0,
            };
        });

        res.status(200).json({ totalApps, categories });
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

/**
 * GET /v1/admin/downloads-by-category
 *
 * Pie-chart data again, but counting downloads (Installed rows) instead
 * of apps: how many times an app in each category has been downloaded,
 * and what share of all downloads that is. Same shape as
 * apps-by-category on purpose - a category with 200 apps could still be
 * the smallest slice here if none of those apps get installed, and
 * that's the point of having both endpoints. Two LEFT JOINs (Categories
 * -> Applications -> Installeds) so a category with zero downloads (or
 * zero apps) still shows up as {count: 0, percentage: 0}.
 */
async function getDownloadsByCategory(req, res) {
    try {
        const rows = await sequelize.query(
            `
            SELECT
                c.id AS "categoryId",
                c.name AS "name",
                COUNT(i.id)::int AS "count"
            FROM "Categories" c
            LEFT JOIN "Applications" a ON a."categoryId" = c.id
            LEFT JOIN "Installeds" i ON i."applicationId" = a.id
            GROUP BY c.id, c.name
            ORDER BY "count" DESC
            `,
            { type: QueryTypes.SELECT }
        );

        const totalDownloads = rows.reduce((sum, row) => sum + Number(row.count), 0);

        const categories = rows.map((row) => {
            const count = Number(row.count);
            return {
                categoryId: row.categoryId,
                name: row.name,
                count,
                percentage: totalDownloads > 0 ? Math.round((count / totalDownloads) * 1000) / 10 : 0,
            };
        });

        res.status(200).json({ totalDownloads, categories });
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function createUser(){
    try {

        const name ="sethupathi";
        const email = "sethupathiofficial107@gmail.com";
        const password = "123123"
        
        const hashedPassword = await bcrypt.hash(password, 10);

        let user;
        const use = await User.findOne({email:email})
        console.log(use);
        if(!use){
            user = await User.create({ username:name, email : email, password : hashedPassword, role: "admin" });
        }


        logger.info(`User ${user.id} signed up`);   

        if(process.env.ENVIRONMENT==="dev"){
            console.log("User name is -> sethupathioffical107@gmail.com")
            console.log("123123")
        }

    } catch (error) {
        logger.error(error.stack || error.message);
    }
}
createUser();

export default {
    getActivity,
    getLogs,
    getDownloadsHistory,
    exportLogs,
    getAppsByCategory,
    getDownloadsByCategory,
};
