import { DataTypes } from '@sequelize/core';
/** @type {import('umzug').MigrationFn<any>} */
export const up = async params => {
    const sequelizec = params.context;
    const qi = sequelizec.queryInterface;
    await qi.addColumn('Applications', 'description', {
    type: DataTypes.STRING,
    allowNull: true,
    });
};

/** @type {import('umzug').MigrationFn<any>} */
export const down = async params => {
    const sequelize = params.context;
    const qi = sequelize.queryInterface;
    await qi.removeColumn('Applications','description')
};
