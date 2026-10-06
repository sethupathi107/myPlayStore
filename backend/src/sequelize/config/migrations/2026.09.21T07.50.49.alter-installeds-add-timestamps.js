import { DataTypes } from '@sequelize/core';

/** @type {import('umzug').MigrationFn<any>} */
export const up = async params => {
    const sequelize = params.context;
    const qi = sequelize.queryInterface;

    await qi.addColumn('Installeds', 'createdAt', {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    });

    await qi.addColumn('Installeds', 'updatedAt', {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    });
};

/** @type {import('umzug').MigrationFn<any>} */
export const down = async params => {
    const sequelize = params.context;
    const qi = sequelize.queryInterface;

    await qi.removeColumn('Installeds', 'createdAt');
    await qi.removeColumn('Installeds', 'updatedAt');
};
