module.exports = app => {
  const {INTEGER, CHAR} = app.Sequelize

  const QRC721Statistics = app.model.define('qrc721_statistics', {
    contractAddress: {
      type: CHAR(20).BINARY,
      primaryKey: true
    },
    holders: INTEGER.UNSIGNED,
    transactions: INTEGER.UNSIGNED
  }, {freezeTableName: true, underscored: true, timestamps: false})

  QRC721Statistics.associate = () => {
    const {Qrc721: QRC721} = app.model
    QRC721Statistics.belongsTo(QRC721, {as: 'qrc721', foreignKey: 'contractAddress'})
    QRC721.hasOne(QRC721Statistics, {as: 'statistics', foreignKey: 'contractAddress'})
  }

  return QRC721Statistics
}
