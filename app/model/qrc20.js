module.exports = app => {
  const {INTEGER, CHAR, BLOB} = app.Sequelize

  const QRC20 = app.model.define('qrc20', {
    contractAddress: {
      type: CHAR(20).BINARY,
      primaryKey: true
    },
    name: {
      type: BLOB,
      get() {
        const name = this.getDataValue('name')
        return name == null ? null : name.toString()
      },
      set(name) {
        this.setDataValue('name', Buffer.from(name))
      }
    },
    symbol: {
      type: BLOB,
      get() {
        const symbol = this.getDataValue('symbol')
        return symbol == null ? null : symbol.toString()
      },
      set(symbol) {
        this.setDataValue('symbol', Buffer.from(symbol))
      }
    },
    decimals: INTEGER(3).UNSIGNED,
    totalSupply: {
      type: CHAR(32).BINARY,
      get() {
        const totalSupply = this.getDataValue('totalSupply')
        return totalSupply == null ? null : BigInt(`0x${totalSupply.toString('hex')}`)
      },
      set(totalSupply) {
        this.setDataValue(
          'totalSupply',
          Buffer.from(totalSupply.toString(16).padStart(64, '0'), 'hex')
        )
      }
    }
  }, {freezeTableName: true, underscored: true, timestamps: false})

  QRC20.associate = () => {
    const {EvmReceiptLog: EVMReceiptLog, Contract} = app.model
    EVMReceiptLog.belongsTo(QRC20, {as: 'qrc20', foreignKey: 'address', targetKey: 'contractAddress'})
    QRC20.hasMany(EVMReceiptLog, {as: 'logs', foreignKey: 'address', sourceKey: 'contractAddress'})
    Contract.hasOne(QRC20, {as: 'qrc20', foreignKey: 'contractAddress'})
    QRC20.belongsTo(Contract, {as: 'contract', foreignKey: 'contractAddress'})
  }

  return QRC20
}
