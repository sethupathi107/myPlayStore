import { Application, Category, User } from "../sequelize/config/database.js";
import client from "./opensearchClient.js";
import { APPLICATIONS_INDEX, ensureApplicationsIndex } from "./opensearchIndex.js";

async function run() {
    await ensureApplicationsIndex();

    const apps = await Application.findAll({
        include: [
            { model: Category, as: "category", attributes: ["name"] },
            { model: User, as: "user", attributes: ["username"] },
        ],
    });

    if (apps.length === 0) {
        console.log("No apps to index.");
        process.exit(0);
    }

    const body = apps.flatMap((app) => [
        { index: { _index: APPLICATIONS_INDEX, _id: app.id } },
        {
            id: app.id,
            name: app.name,
            description: app.description,
            categoryId: app.categoryId,
            iconImageId: app.iconImageId,
            categoryName: app.category?.name ?? null,
            uploaderUsername: app.user?.username ?? null,
            downloads: app.downloads ?? 0,
            createdAt: app.createdAt,
        },
    ]);

    const result = await client.bulk({ body, refresh: true });
    const failed = result.body.items.filter((i) => i.index?.error);

    console.log(`Indexed ${apps.length - failed.length}/${apps.length} apps.`);
    if (failed.length) console.error(failed.map((f) => f.index.error));

    process.exit(failed.length ? 1 : 0);
}
run();