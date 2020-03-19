module.exports = app => {
  const {INTEGER, BIGINT, CHAR, ENUM} = app.Sequelize

  const Contract = app.model.define('contract', {
    address: {
      type: CHAR(20).BINARY,
      primaryKey: true
    },
    addressString: CHAR(34),
    vm: {
      type: ENUM,
      values: ['evm', 'x86']
    },
    type: {
      type: ENUM,
      values: ['dgp', 'qrc20', 'qrc721'],
      allowNull: true
    },
    sha256Code: CHAR(32).BINARY,
    createReceiptId: {
      type: BIGINT.UNSIGNED,
      allowNull: true
    },
    createHeight: INTEGER.UNSIGNED,
    destructReceiptId: {
      type: BIGINT.UNSIGNED,
      allowNull: true
    },
    destructHeight: {
      type: INTEGER.UNSIGNED,
      allowNull: true
    }
  }, {freezeTableName: true, underscored: true, timestamps: false})

  Contract.associate = () => {
    const {Address, EvmReceipt: EVMReceipt, EvmReceiptLog: EVMReceiptLog} = app.model
    Contract.hasOne(Address, {as: 'originalAddress', foreignKey: 'data'})
    Address.belongsTo(Contract, {as: 'contract', foreignKey: 'data'})
    EVMReceipt.belongsTo(Contract, {as: 'contract', foreignKey: 'contractAddress'})
    Contract.hasMany(EVMReceipt, {as: 'evmReceipts', foreignKey: 'contractAddress'})
    EVMReceiptLog.belongsTo(Contract, {as: 'contract', foreignKey: 'address'})
    Contract.hasMany(EVMReceiptLog, {as: 'evmLogs', foreignKey: 'address'})
    EVMReceipt.hasMany(Contract, {as: 'createdContracts', foreignKey: 'createReceiptId'})
    Contract.belongsTo(EVMReceipt, {as: 'createReceipt', foreignKey: 'createReceiptId'})
    EVMReceipt.hasMany(Contract, {as: 'destructedContracts', foreignKey: 'destructReceiptId'})
    Contract.belongsTo(EVMReceipt, {as: 'destructReceipt', foreignKey: 'destructReceiptId'})
  }

  return Contract
}
