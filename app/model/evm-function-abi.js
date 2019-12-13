module.exports = app => {
  const {INTEGER, CHAR, STRING, JSON, ENUM} = app.Sequelize

  let EVMFunctionABI = app.model.define('evm_function_abi', {
    _id: {
      type: INTEGER.UNSIGNED,
      field: '_id',
      primaryKey: true,
      autoIncrement: true
    },
    id: CHAR(4).BINARY,
    type: {
      type: ENUM,
      values: ['function', 'constructor', 'fallback', '']
    },
    name: STRING(255),
    inputs: JSON,
    outputs: JSON,
    stateMutability: {
      type: ENUM,
      values: ['pure', 'view', 'nonpayable', 'payable']
    },
    contractTag: {
      type: STRING(32),
      allowNull: true
    }
  }, {freezeTableName: true, underscored: true, timestamps: false})

  return EVMFunctionABI
}
