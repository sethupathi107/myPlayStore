import { Sequelize } from '@sequelize/core';
import { PostgresDialect } from '@sequelize/postgres';

import defineUser from "../models/User.js";
import defineCategory from "../models/Category.js";
import defineApplication from "../models/App.js";
import defineInstalled from "../models/Installed.js";
import defineSession from "../models/Session.js";
import defineImage from "../models/Image.js";
import defineLogs from '../models/log.js';
import defineExportJob from '../models/ExportJob.js';
import logger from '../../utils/logger.js';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Run with --env-file=.env or export it before starting the app.");
}

const sequelize = new Sequelize({
  dialect: PostgresDialect,
  url: process.env.DATABASE_URL,
  logging: process.env.NODE_ENV === "production" ? false : (sql) => logger.info(sql),
});

const User = defineUser(sequelize);
const Logs = defineLogs(sequelize);
const Category = defineCategory(sequelize);
const Application = defineApplication(sequelize, { User, Category });
const Installed = defineInstalled(sequelize, { User, Application });
const Session = defineSession(sequelize, { User });
const Image = defineImage(sequelize, { Application });
const ExportJob = defineExportJob(sequelize, { User });

const models = { User, Category, Application, Installed, Session, Image , Logs, ExportJob };

Object.values(models).forEach((model) => {
  if (model.associate) model.associate(models);
});

try {
  await sequelize.authenticate();
} catch (error) {
  console.error("Unable to connect to the database:", error.message);
  process.exit(1);
}

export default sequelize;
export { User, Category, Application, Installed, Session, Image, Logs, ExportJob };
