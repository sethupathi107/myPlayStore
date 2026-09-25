// scripts/seedDownloads.js
//
// Adds realistic "Installed" rows (download history) directly to the
// database for every existing app - the admin dashboard's downloads
// charts and app detail's download counts are all derived from this
// table, not stored on the app itself.
//
// Deliberately NOT what the old (deleted) simulateDownloads.js did: that
// dumped everything at nearly the same instant, which is exactly what
// produced the 57,656-downloads-in-one-day spike that broke the "Downloads
// per day" chart earlier. This spreads each app's installs across a
// window of days (default 45) with randomized times, and gives apps an
// uneven (long-tail-ish) popularity spread instead of a flat count each -
// some apps end up popular, most don't, which is what real usage looks like.
//
// Usage:
//   node --env-file=.env scripts/seedDownloads.js [maxPerApp] [days]
//   npm run seed:downloads                  -> up to 100 installs/app over 45 days
//   npm run seed:downloads -- 300 60        -> up to 300 installs/app over 60 days
//
// Adds new rows every run - it does not clear existing Installed rows first.

import "./lib/localDb.js";
import sequelize, { User, Application, Installed } from "../src/sequelize/config/database.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Skews toward small counts with an occasional bigger one - two
// multiplied randoms is a cheap way to get a long-tail-ish spread
// without a real power-law generator.
function randomPopularityCount(maxPerApp) {
    return Math.floor(Math.random() * Math.random() * (maxPerApp + 1));
}

function randomTimestampWithinDays(days) {
    const offsetMs = Math.random() * days * DAY_MS;
    return new Date(Date.now() - offsetMs);
}

async function main() {
    const maxPerApp = Math.max(1, Number(process.argv[2]) || 100);
    const days = Math.max(1, Number(process.argv[3]) || 45);

    const [apps, users] = await Promise.all([
        Application.findAll({ attributes: ["id"] }),
        User.findAll({ attributes: ["id"] }),
    ]);

    if (apps.length === 0 || users.length === 0) {
        console.error("No apps or users in the database yet - run seed:apps first.");
        process.exitCode = 1;
        return;
    }

    const userIds = users.map((u) => u.id);
    let totalRows = 0;
    let batch = [];
    const BATCH_SIZE = 2000;

    for (const app of apps) {
        const installCount = randomPopularityCount(maxPerApp);
        for (let i = 0; i < installCount; i++) {
            const createdAt = randomTimestampWithinDays(days);
            batch.push({
                userId: userIds[Math.floor(Math.random() * userIds.length)],
                applicationId: app.id,
                createdAt,
                updatedAt: createdAt,
            });
        }

        if (batch.length >= BATCH_SIZE) {
            await Installed.bulkCreate(batch);
            totalRows += batch.length;
            console.log(`Inserted ${totalRows} install rows so far...`);
            batch = [];
        }
    }

    if (batch.length > 0) {
        await Installed.bulkCreate(batch);
        totalRows += batch.length;
    }

    console.log(`\nDone. Added ${totalRows} install rows across ${apps.length} apps, spread over the last ${days} days.`);
}

main()
    .catch((error) => {
        console.error("Seeding downloads failed:", error.stack || error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await sequelize.close();
    });
