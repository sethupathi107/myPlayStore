// scripts/seedCategories.js
//
// Creates just the category list (found-or-created, safe to re-run) -
// useful on its own before running seed:apps, or any time you just want
// the category dropdown populated without generating users/apps yet.
//
// Usage:
//   node --env-file=.env scripts/seedCategories.js
//   npm run seed:categories

import "./lib/localDb.js";
import sequelize, { Category } from "../src/sequelize/config/database.js";
import { ensureCategories } from "./lib/categoryData.js";

async function main() {
    const rows = await ensureCategories(Category);
    const createdCount = rows.filter((r) => r.created).length;

    for (const { category, created } of rows) {
        console.log(`${created ? "created" : "exists "}  ${category.name}`);
    }

    console.log(`\nDone. ${createdCount} created, ${rows.length - createdCount} already existed (${rows.length} total).`);
}

main()
    .catch((error) => {
        console.error("Seeding categories failed:", error.stack || error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await sequelize.close();
    });
