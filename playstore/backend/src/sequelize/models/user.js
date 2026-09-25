import { Model, DataTypes } from '@sequelize/core';

export default function defineUser(sequelize) {
class User extends Model {
    static associate(models){
        User.hasMany(models.Application,{
            foreignKey: {
                name: "userId",
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            as:'application',
        })
        User.hasMany(models.Installed,{
            foreignKey: {
                name: 'userId',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            as:'installed', 
        })
    }
}

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true, len: [2, 50] },
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true, notEmpty: true },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true, len: [60, 60] },
      },
      role: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'user',
        validate: { isIn: [['user', 'admin']] },
      },
    },
    {
      sequelize,
      modelName: 'User',
      timestamps: true,
    }
  );

  User.addHook("afterDestroy", async (instance, options) => {
    // instance.sequelize.models is a Set of model classes in this
    // @sequelize/core v7 alpha (not the plain {ModelName: Model} object v6
    // had), so it has to be looked up by .name instead of destructured.
    const modelsByName = Object.fromEntries(
        [...instance.sequelize.models].map((model) => [model.name, model])
    );
    const { Application, Installed, Session } = modelsByName;

    const apps = await Application.findAll({
        where: { userId: instance.id },
        transaction: options.transaction
    });

    for (const app of apps) {
        await app.destroy({ transaction: options.transaction });
    }

    await Installed.destroy({
        where: { userId: instance.id },
        transaction: options.transaction
    });

    await Session.destroy({
        where: { userId: instance.id },
        transaction: options.transaction
    });
});

  return User;
}