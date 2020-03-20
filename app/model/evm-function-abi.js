module.exports = app => {
  const {INTEGER, CHAR, STRING, JSON, ENUM} = app.Sequelize

  const EVMFunctionABI = app.model.define('evm_function_abi', {
    _id: {
      type: INTEGER.UNSIGNED,
      field: '_id',
      primaryKey: true,
      autoIncrement: true
    },
    id: {
      type: CHAR(4).BINARY,
      allowNull: true
    },
    type: {
      type: ENUM,
      values: ['function', 'constructor', 'fallback']
    },
    name: STRING(255),
    inputs: JSON,
    outputs: JSON,
    stateMutability: {
      type: ENUM,
      values: ['pure', 'view', 'nonpayable', 'payable']
    },
    contractAddress: {
      type: CHAR(20).BINARY,
      allowNull: true
    },
    contractTag: {
      type: STRING(32),
      allowNull: true
    }
  }, {freezeTableName: true, underscored: true, timestamps: false})

  return EVMFunctionABI
}
