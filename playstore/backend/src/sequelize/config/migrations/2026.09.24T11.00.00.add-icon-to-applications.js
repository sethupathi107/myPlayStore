import { DataTypes } from '@sequelize/core';

/** @type {import('umzug').MigrationFn<any>} */
export const up = async params => {
    const sequelize = params.context;
    const qi = sequelize.queryInterface;

    await qi.addColumn('Applications', 'iconImageId', {
        type: DataTypes.UUID,
        allowNull: true,
    });

    await qi.addConstraint('Applications', {
        fields: ['iconImageId'],
        type: 'foreign key',
        name: 'fk_applications_iconImageId',
        references: { table: 'Images', field: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
    });
};

/** @type {import('umzug').MigrationFn<any>} */
export const down = async params => {
    const sequelize = params.context;
    const qi = sequelize.queryInterface;

    await qi.removeConstraint('Applications', 'fk_applications_iconImageId');
    await qi.removeColumn('Applications', 'iconImageId');
};
