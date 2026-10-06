import { DataTypes } from "@sequelize/core";

export async function up({ context: sequelize }) {
  const queryInterface = sequelize.queryInterface;
  await queryInterface.createTable("Logs", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    message: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });
}

export async function down({ context: sequelize }) {
  const queryInterface = sequelize.queryInterface;
  await queryInterface.dropTable("Logs");
}
