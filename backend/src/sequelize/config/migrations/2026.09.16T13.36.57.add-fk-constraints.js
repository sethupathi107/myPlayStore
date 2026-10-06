/** @type {import('umzug').MigrationFn<any>} */
export const up = async params => {
    const sequelize = params.context;
    const qi = sequelize.queryInterface;

    await qi.addConstraint('Applications', {
        fields: ['userId'],
        type: 'foreign key',
        name: 'fk_applications_userId',
        references: { table: 'Users', field: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });

    await qi.addConstraint('Applications', {
        fields: ['categoryId'],
        type: 'foreign key',
        name: 'fk_applications_categoryId',
        references: { table: 'Categories', field: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });

    await qi.addConstraint('Installeds', {
        fields: ['userId'],
        type: 'foreign key',
        name: 'fk_installeds_userId',
        references: { table: 'Users', field: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });

    await qi.addConstraint('Installeds', {
        fields: ['applicationId'],
        type: 'foreign key',
        name: 'fk_installeds_applicationId',
        references: { table: 'Applications', field: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });

    await qi.addConstraint('Images', {
        fields: ['applicationId'],
        type: 'foreign key',
        name: 'fk_images_applicationId',
        references: { table: 'Applications', field: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
};

/** @type {import('umzug').MigrationFn<any>} */
export const down = async params => {
    const sequelize = params.context;
    const qi = sequelize.queryInterface;

    await qi.removeConstraint('Images', 'fk_images_applicationId');
    await qi.removeConstraint('Installeds', 'fk_installeds_applicationId');
    await qi.removeConstraint('Installeds', 'fk_installeds_userId');
    await qi.removeConstraint('Applications', 'fk_applications_categoryId');
    await qi.removeConstraint('Applications', 'fk_applications_userId');
};
