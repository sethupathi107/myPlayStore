import { Model, DataTypes } from '@sequelize/core';

export default function defineExportJob(sequelize, { User }) {
    class ExportJob extends Model {
        static associate(models) {
            ExportJob.belongsTo(models.User, {
                foreignKey: {
                    name: 'userId',
                    onDelete: 'CASCADE',
                    onUpdate: 'CASCADE',
                },
                as: 'user',
            });
        }
    }

    ExportJob.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true,
            },
            userId: {
                type: DataTypes.UUID,
                allowNull: false,
                references: { model: User, key: 'id' },
            },
            type: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            status: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "queued",
            },
            rangeLabel: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            fromDate: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            toDate: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            filePath: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            fileName: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            rowCount: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            errorMessage: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
        },
        {
            sequelize,
            modelName: 'ExportJob',
            timestamps: true,
        }
    );

    return ExportJob;
}
