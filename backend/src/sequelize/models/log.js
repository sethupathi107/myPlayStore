import { Model, DataTypes } from '@sequelize/core';


export default function defineLogs(sequelize){
    class Logs extends Model{}
    Logs.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          allowNull: false,
          unique: true,
          primaryKey: true,
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
      },
      {
        sequelize,
        modelName: 'Logs',
        timestamps: true,
        updatedAt:false,
      }
    );
    
    return Logs;
}
 
