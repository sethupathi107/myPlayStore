import { DataTypes } from '@sequelize/core';

/** @type {import('umzug').MigrationFn<any>} */
export const up = async params => {
    const sequelize = params.context;
    const qi = sequelize.queryInterface;

    await qi.changeColumn('Logs', 'message', {
        type: DataTypes.TEXT,
        allowNull: false,
    });
};

/** @type {import('umzug').MigrationFn<any>} */
export const down = async params => {
    const sequelize = params.context;
    const qi = sequelize.queryInterface;

    await qi.changeColumn('Logs', 'message', {
        type: DataTypes.STRING,
        allowNull: false,
    });
};
