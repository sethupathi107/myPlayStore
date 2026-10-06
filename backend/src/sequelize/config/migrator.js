import { Umzug,SequelizeStorage } from "umzug";
import sequelize from './database.js';

export const migrator = new Umzug({
    migrations:{
        glob:'src/sequelize/config/migrations/*.js',
    },
    context:sequelize,
    storage:new SequelizeStorage({sequelize}),
    logger:console,
})