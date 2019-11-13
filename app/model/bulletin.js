module.exports = app => {
  const {INTEGER, STRING} = app.Sequelize

  let Bulletin = app.model.define('bulletin', {
    _id: {
      type: INTEGER.UNSIGNED,
      field: '_id',
      primaryKey: true,
      autoIncrement: true
    },
    locale: STRING(10),
    title: STRING(255),
    url: STRING(255),
    priority: INTEGER.UNSIGNED
  }, {freezeTableName: true, underscored: true, timestamps: false})

  return Bulletin
}
