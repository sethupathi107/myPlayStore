// scripts/seedApps.js
//
// Creates a realistic demo catalog against a freshly-migrated (empty)
// database: N random users, each publishing M apps of their own (default
// 50 users x 10 apps = 500 apps), every app with a real icon and 2-4
// real screenshots copied from app-images/. Unlike the old root-level
// seed scripts (deleted), this writes through the real Sequelize models
// one row at a time - no bulk-worker mass generation.
//
// Usage:
//   node --env-file=.env scripts/seedApps.js [usersCount] [appsPerUser]
//   npm run seed:apps                  -> 50 users x 10 apps = 500 apps
//   npm run seed:apps -- 20 5           -> 20 users x 5 apps = 100 apps
//
// Safe to re-run - categories are found-or-created, not duplicated;
// users and apps are always added fresh (usernames/emails are unique per run).

import "./lib/localDb.js";
import fs from "fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import bcrypt from "bcrypt";
import sequelize, { User, Category, Application, Image } from "../src/sequelize/config/database.js";
import { APP_NAMES_BY_CATEGORY, ensureCategories } from "./lib/categoryData.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ICONS_DIR = path.join(ROOT, "app-images", "icons");
const SCREENSHOTS_DIR = path.join(ROOT, "app-images", "screenshots");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const IMAGE_UPLOAD_DIR = path.join(ROOT, "uploads", "images");

const DEMO_PASSWORD = "password123";

const NAME_SUFFIXES = ["", "", "", " Pro", " Lite", " Plus", " Go"]; // mostly no suffix, some variety

const FIRST_NAMES = [
    "alex", "jordan", "taylor", "morgan", "riley", "casey", "jamie", "avery",
    "quinn", "reese", "drew", "sam", "kai", "rowan", "dana", "skyler",
    "harper", "emerson", "blair", "finley", "sage", "wren", "arden", "marlowe",
];

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function pickMany(list, count) {
    const copy = [...list];
    const result = [];
    for (let i = 0; i < count && copy.length > 0; i++) {
        const index = Math.floor(Math.random() * copy.length);
        result.push(copy.splice(index, 1)[0]);
    }
    return result;
}

function makeUsername(index) {
    return `${pick(FIRST_NAMES)}${crypto.randomInt(100, 999)}-${index}`;
}

function makeAppName(categoryName, usedNames) {
    const bank = APP_NAMES_BY_CATEGORY[categoryName] || APP_NAMES_BY_CATEGORY["Productivity"];
    let name;
    let attempts = 0;
    do {
        name = `${pick(bank)}${pick(NAME_SUFFIXES)}`;
        attempts++;
    } while (usedNames.has(name) && attempts <= 20);
    usedNames.add(name);
    return name;
}

const TAGLINES = [
    "Small footprint, big difference.",
    "Built for the way you actually work.",
    "Fast and simple for everyday tasks.",
    "Stay organized, stay ahead.",
    "Your daily companion app.",
    "Made for quick, focused sessions.",
    "The tool you'll open every day.",
    "Everything you need, nothing you don't.",
];

async function ensureUploadDirs() {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.mkdir(IMAGE_UPLOAD_DIR, { recursive: true });
}

async function createRandomUser(index) {
    const username = makeUsername(index);
    const email = `${username}@hommer.dev`;
    const hashed = await bcrypt.hash(DEMO_PASSWORD, 10);
    return User.create({ username, email, password: hashed, role: "user" });
}

async function copyIntoUploads(sourcePath, destDir, extension) {
    const filename = `${crypto.randomUUID()}${extension}`;
    await fs.copyFile(sourcePath, path.join(destDir, filename));
    return filename;
}

async function writePlaceholderAppFile() {
    // No real APK exists for a demo app - a small placeholder file is
    // enough to exercise the download flow (real bytes, real byte count).
    const filename = `${crypto.randomUUID()}.apk`;
    const contents = `hommer demo app placeholder\ngenerated ${new Date().toISOString()}\n`;
    await fs.writeFile(path.join(UPLOAD_DIR, filename), contents);
    return filename;
}

async function createApp(user, category, iconFiles, screenshotFiles, usedNames) {
    const name = makeAppName(category.name, usedNames);
    const tagline = pick(TAGLINES);
    const description = `${name} is a ${category.name.toLowerCase()} app. ${tagline}`;

    const applicationURL = await writePlaceholderAppFile();

    const app = await Application.create({
        name,
        description,
        categoryId: category.id,
        userId: user.id,
        applicationURL,
    });

    const iconSource = path.join(ICONS_DIR, pick(iconFiles));
    const iconFilename = await copyIntoUploads(iconSource, IMAGE_UPLOAD_DIR, path.extname(iconSource));
    const iconImage = await Image.create({ applicationId: app.id, filename: iconFilename });
    app.iconImageId = iconImage.id;
    await app.save();

    const screenshotPicks = pickMany(screenshotFiles, 2 + Math.floor(Math.random() * 3)); // 2-4
    for (const screenshotName of screenshotPicks) {
        const source = path.join(SCREENSHOTS_DIR, screenshotName);
        const filename = await copyIntoUploads(source, IMAGE_UPLOAD_DIR, path.extname(source));
        await Image.create({ applicationId: app.id, filename });
    }

    return app;
}

async function main() {
    const usersCount = Math.max(1, Number(process.argv[2]) || 50);
    const appsPerUser = Math.max(1, Number(process.argv[3]) || 10);

    const [iconFiles, screenshotFiles] = await Promise.all([
        fs.readdir(ICONS_DIR).catch(() => []),
        fs.readdir(SCREENSHOTS_DIR).catch(() => []),
    ]);

    if (iconFiles.length === 0 || screenshotFiles.length === 0) {
        console.error(
            "No source images found in app-images/icons or app-images/screenshots - nothing to seed with."
        );
        process.exitCode = 1;
        return;
    }

    await ensureUploadDirs();
    const categories = (await ensureCategories(Category)).map((row) => row.category);

    const usedNames = new Set();
    let usersCreated = 0;
    let appsCreated = 0;

    for (let u = 0; u < usersCount; u++) {
        const user = await createRandomUser(u + 1);
        usersCreated++;

        for (let a = 0; a < appsPerUser; a++) {
            const category = pick(categories);
            await createApp(user, category, iconFiles, screenshotFiles, usedNames);
            appsCreated++;
        }

        if (usersCreated % 10 === 0 || usersCreated === usersCount) {
            console.log(`Created ${usersCreated}/${usersCount} users, ${appsCreated} apps so far...`);
        }
    }

    console.log(
        `\nDone. Created ${usersCreated} users x ${appsPerUser} apps = ${appsCreated} apps across ${categories.length} categories.`
    );
    console.log(`Every seeded user's password is: ${DEMO_PASSWORD}`);
}

main()
    .catch((error) => {
        console.error("Seeding failed:", error.stack || error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await sequelize.close();
    });
