import { Model, DataTypes } from '@sequelize/core';

  // id SERIAL PRIMARY KEY,
  // user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  // token TEXT NOT NULL,
  // created_at TIMESTAMP DEFAULT NOW(),
  // expires_at TIMESTAMP NOT NULL

export default function defineSession(sequelize, { User }) {
  class Session extends Model {}

  Session.init(
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
      token: {
        type: DataTypes.STRING,
        allowNull: false, 
        unique: true,
        validate: { notEmpty: true },
      },
      expireAt:{
        type: DataTypes.DATE,
        allowNull:true,
      }
    }, 
    {
      sequelize,
      modelName: 'Session',
      timestamps: true,
    }
  );

  return Session; 
}
