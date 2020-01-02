module.exports = app => {
  const {BIGINT, CHAR} = app.Sequelize

  let QRC20Transfer = app.model.define('qrc20_transfer', {
    logId: {
      type: BIGINT.UNSIGNED,
      primaryKey: true
    },
    from: CHAR(20).BINARY,
    to: CHAR(20).BINARY,
    value: CHAR(32).BINARY
  }, {freezeTableName: true, underscored: true, timestamps: false})

  QRC20Transfer.associate = () => {
    const {EvmReceiptLog: EVMReceiptLog} = app.model
    QRC20Transfer.belongsTo(EVMReceiptLog, {as: 'log', foreignKey: 'logId'})
    EVMReceiptLog.hasOne(QRC20Transfer, {as: 'qrc20Transfer', foreignKey: 'logId'})
  }

  return QRC20Transfer
}
