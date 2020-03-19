module.exports = app => {
  const {BIGINT, STRING} = app.Sequelize

  const EVMReceiptLogTag = app.model.define('evm_receipt_log_tag', {
    tag: {
      type: STRING(32),
      primaryKey: true
    },
    logId: {
      type: BIGINT.UNSIGNED,
      primaryKey: true
    }
  }, {freezeTableName: true, underscored: true, timestamps: false})

  EVMReceiptLogTag.associate = () => {
    const {EvmReceiptLog: EVMReceiptLog} = app.model
    EVMReceiptLogTag.belongsTo(EVMReceiptLog, {as: 'log', foreignKey: 'logId'})
    EVMReceiptLog.hasMany(EVMReceiptLogTag, {as: 'tags', foreignKey: 'logId'})
  }

  return EVMReceiptLogTag
}
