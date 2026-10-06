import { Model, DataTypes } from '@sequelize/core';

export default function defineApplication(sequelize, { User, Category }) {
class Application extends Model {
    static associate(models){
        Application.belongsTo(models.Category, {
            foreignKey: {
                name: 'categoryId',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            as: 'category',
        })
        Application.belongsTo(models.User, {
            foreignKey: {
                name: "userId",
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            as: 'user',
        })
        Application.hasMany(models.Installed, {
            foreignKey: {
                name: 'applicationId',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            as: 'installed',
        })
        Application.hasMany(models.Image, {
            foreignKey: {
                name: 'applicationId',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            as: 'images',
        })
        Application.belongsTo(models.Image, {
            foreignKey: {
                name: 'iconImageId',
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
            },
            as: 'icon',
        })
    }
}
  Application.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        unique: true,
        primaryKey: true,
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
      categoryId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: Category,
          key: 'id',
        },
        validate: { notEmpty: true },
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true, len: [2, 150] },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: { notEmpty: true, len: [2, 2000] },
      },
      applicationURL: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true, len: [2, 50] },
      },
      iconImageId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Application',
      timestamps: true,
    }
  );

  Application.addHook("afterDestroy",async(instance, options)=>{
    // Same Set-vs-object gotcha as User.js's afterDestroy hook: this
    // @sequelize/core v7 alpha exposes sequelize.models as a Set of model
    // classes, not a {ModelName: Model} object, so look up by .name.
    const modelsByName = Object.fromEntries(
        [...instance.sequelize.models].map((model) => [model.name, model])
    );
    const {Image,Installed}=modelsByName;
    await Image.destroy({
      where:{
        applicationId:instance.id
      },
      transaction:options.transaction
    })

    await Installed.destroy({
      where:{
        applicationId: instance.id
      },
      transaction:options.transaction
    })
  })

  return Application;
}
