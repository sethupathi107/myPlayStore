import { DataTypes } from '@sequelize/core';

/** @type {import('umzug').MigrationFn<any>} */
export const up = async params => {
    const sequelize = params.context;
    const qi = sequelize.queryInterface;

    await qi.createTable('ExportJobs', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            allowNull: false,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        status: {
            // one of: queued | processing | done | failed
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "queued",
        },
        rangeLabel: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        fromDate: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        toDate: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        filePath: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        fileName: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        rowCount: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        errorMessage: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    });

    await qi.addIndex('ExportJobs', ['userId', 'status']);
};

/** @type {import('umzug').MigrationFn<any>} */
export const down = async params => {
    const sequelize = params.context;
    const qi = sequelize.queryInterface;
    await qi.dropTable('ExportJobs');
};
