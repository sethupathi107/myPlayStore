import { Model, DataTypes } from '@sequelize/core';

export default function defineImage(sequelize, { Application }) {
  class Image extends Model {
    static associate(models){
        Image.belongsTo(models.Application,{
            foreignKey: {
                name: 'applicationId',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            as: 'application',
        })
    }
  }

  Image.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
        unique: true,
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
      filename: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true },
      },
    },
    {
      sequelize,
      modelName: 'Image',
      timestamps: true,
    }
  );

  return Image;
}
