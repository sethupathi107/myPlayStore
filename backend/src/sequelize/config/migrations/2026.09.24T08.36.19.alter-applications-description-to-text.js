import { DataTypes } from '@sequelize/core';

/** @type {import('umzug').MigrationFn<any>} */
export const up = async params => {
    const sequelize = params.context;
    const qi = sequelize.queryInterface;

    // description was VARCHAR(255) - too small for the frontend's own
    // 2000-character limit, which caused every long description to fail
    // with an uncaught SequelizeValidationError (a 500, not a clean 400).
    await qi.changeColumn('Applications', 'description', {
        type: DataTypes.TEXT,
        allowNull: true,
    });
};

/** @type {import('umzug').MigrationFn<any>} */
export const down = async params => {
    const sequelize = params.context;
    const qi = sequelize.queryInterface;

    await qi.changeColumn('Applications', 'description', {
        type: DataTypes.STRING,
        allowNull: true,
    });
};
