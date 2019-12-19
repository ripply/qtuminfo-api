const Sequelize = require('sequelize')

module.exports = app => {
  const {INTEGER, STRING, JSON, DATE} = app.Sequelize

  let QtuminfoTranslation = app.model.define('qtuminfo_translation', {
    _id: {
      type: INTEGER.UNSIGNED,
      field: '_id',
      primaryKey: true,
      autoIncrement: true
    },
    locale: STRING(10),
    translations: JSON,
    email: STRING(40),
    timestamp: {
      type: DATE,
      defaultValue: Sequelize.fn('NOW')
    }
  }, {freezeTableName: true, underscored: true, timestamps: false})

  return QtuminfoTranslation
}
