import { Model, DataTypes } from '@sequelize/core';

export default function defineCategory(sequelize) {
class Category extends Model {
    static associate(models){
      Category.hasMany(models.Application,{
        foreignKey: {
          name: 'categoryId',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        as: 'apps'
      })
    }
}
 
  Category.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        unique: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { notEmpty: true, len: [2, 20] },
      },
    },
    {
      sequelize,
      modelName: 'Category',
      timestamps: true,
    }
  );

  return Category;
}
