module.exports = app => {
  const {INTEGER, CHAR, STRING, JSON, BOOLEAN} = app.Sequelize

  let EVMEventABI = app.model.define('evm_event_abi', {
    _id: {
      type: INTEGER.UNSIGNED,
      field: '_id',
      primaryKey: true,
      autoIncrement: true
    },
    id: CHAR(32).BINARY,
    name: STRING(255),
    inputs: JSON,
    anonymous: {
      type: BOOLEAN,
      defaultValue: false
    },
    contractTag: {
      type: STRING(32),
      allowNull: true
    }
  }, {freezeTableName: true, underscored: true, timestamps: false})

  return EVMEventABI
}
