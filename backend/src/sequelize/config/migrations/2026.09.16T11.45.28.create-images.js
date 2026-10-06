import { DataTypes } from '@sequelize/core';
/** @type {import('umzug').MigrationFn<any>} */
export const up = async params => {
    const sequelize = params.context;
    const qi = sequelize.queryInterface;
    await qi.createTable('Images', {
        id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
        },
        applicationId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        filename: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        deletedAt: {
            type: DataTypes.DATE,
        },
    });
};

/** @type {import('umzug').MigrationFn<any>} */
export const down = async params => {
    const sequelize = params.context;
    await sequelize.getQueryInterface().dropTable('Images')
};
