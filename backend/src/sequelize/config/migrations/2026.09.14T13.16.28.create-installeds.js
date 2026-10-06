import { DataTypes } from '@sequelize/core';
/** @type {import('umzug').MigrationFn<any>} */
export const up = async params => {
    const sequelize = params.context;
    const qi = sequelize.queryInterface;
    await qi.createTable('Installeds',{
        id:{
            type:DataTypes.UUID,
            allowNull:false,
            priamryKey:true,
            unique:true,
        },
        userId:{
            type: DataTypes.UUID,
            allowNull:false,
            validate:{ notEmpty:true },
        },
        applicationId:{
            type: DataTypes.UUID,
            allowNull:false,
            validate:{ notEmpty:true },
        },
    })
};

/** @type {import('umzug').MigrationFn<any>} */
export const down = async params => {
    const sequelize = params.context;
    const qi = sequelize.queryInterface;
    await qi.dropTable('Installeds');
};