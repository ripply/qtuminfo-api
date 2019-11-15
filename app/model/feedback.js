const Sequelize = require('sequelize')

module.exports = app => {
  const {INTEGER, BOOLEAN, STRING, TEXT, DATE} = app.Sequelize

  let Feedback = app.model.define('feedback', {
    _id: {
      type: INTEGER.UNSIGNED,
      field: '_id',
      primaryKey: true,
      autoIncrement: true
    },
    name: STRING(255),
    email: STRING(255),
    content: TEXT,
    time: {
      type: DATE,
      defaultValue: Sequelize.fn('NOW')
    },
    emailSent: {
      type: BOOLEAN,
      defaultValue: false
    }
  }, {freezeTableName: true, underscored: true, timestamps: false})

  return Feedback
}
