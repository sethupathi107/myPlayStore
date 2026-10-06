import { DataTypes } from '@sequelize/core';
/** @type {import('umzug').MigrationFn<any>} */
export const up = async params => {
    const sequelize = params.context;
    const qi = sequelize.queryInterface;
    await qi.addColumn('Applications', 'deletedAt', {
        type: DataTypes.DATE,
    });
    await qi.addColumn('Installeds', 'deletedAt', {
        type: DataTypes.DATE,
    });
};

/** @type {import('umzug').MigrationFn<any>} */
export const down = async params => {
    const sequelize = params.context;
    const qi = sequelize.queryInterface;
    await qi.removeColumn('Applications', 'deletedAt');
    await qi.removeColumn('Installeds', 'deletedAt');
};
