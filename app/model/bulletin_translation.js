module.exports = app => {
  const {INTEGER, STRING} = app.Sequelize

  const BulletinTranslation = app.model.define('bulletin_translation', {
    bulletinId: {
      type: INTEGER.UNSIGNED,
      primaryKey: true
    },
    locale: {
      type: STRING(10),
      primaryKey: true
    },
    title: STRING(255),
    url: STRING(255)
  }, {freezeTableName: true, underscored: true, timestamps: false})

  BulletinTranslation.associate = () => {
    const {Bulletin} = app.model
    Bulletin.hasMany(BulletinTranslation, {as: 'translations', foreignKey: 'bulletinId'})
    BulletinTranslation.belongsTo(Bulletin, {as: 'bulletin', foreignKey: 'bulletinId'})
  }

  return BulletinTranslation
}
