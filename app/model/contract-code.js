module.exports = app => {
  const {CHAR, BLOB, TEXT} = app.Sequelize

  const ContractCode = app.model.define('contract_code', {
    sha256sum: {
      type: CHAR(32).BINARY,
      primaryKey: true
    },
    code: BLOB,
    source: {
      type: TEXT('long'),
      allowNull: true
    }
  }, {freezeTableName: true, underscored: true, timestamps: false})

  ContractCode.associate = () => {
    const {Contract} = app.model
    Contract.hasOne(ContractCode, {as: 'code', foreignKey: 'sha256sum', sourceKey: 'sha256Code'})
    ContractCode.belongsTo(Contract, {as: 'contract', foreignKey: 'sha256sum', targetKey: 'sha256Code'})
  }

  return ContractCode
}
