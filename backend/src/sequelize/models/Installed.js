import { Model, DataTypes } from '@sequelize/core';

export default function defineInstalled(sequelize, { User, Application }) {
  class Installed extends Model {
    static associate(models){
        Installed.belongsTo(models.User,{
            foreignKey:{name:'userId',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
            },
            as:"user",
        })
        Installed.belongsTo(models.Application,{
            foreignKey:{ name:"applicationId",
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',},
            as :"application"
        })
    }
  }
  
  Installed.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
        unique: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: User,
          key: 'id',
        },
        validate: { notEmpty: true },
      },
      applicationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: Application,
          key: 'id',
        },
        validate: { notEmpty: true },
      },
    },
    {
      sequelize,
      modelName: 'Installed',
      timestamps: true,
    }
  );

  return Installed;
}
