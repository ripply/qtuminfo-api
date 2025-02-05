module.exports = app => {
  const {INTEGER, BIGINT, CHAR} = app.Sequelize

  const Block = app.model.define('block', {
    hash: {
      type: CHAR(32).BINARY,
      unique: true
    },
    height: {
      type: INTEGER.UNSIGNED,
      primaryKey: true
    },
    size: INTEGER.UNSIGNED,
    weight: INTEGER.UNSIGNED,
    minerId: BIGINT.UNSIGNED,
    delegatorId: {
      type: BIGINT.UNSIGNED,
      allowNull: true
    },
    txs: INTEGER.UNSIGNED,
    transactionsCount: INTEGER.UNSIGNED,
    contractTransactionsCount: INTEGER.UNSIGNED,
    transactionVolume: {
      type: BIGINT,
      get() {
        const transactionVolume = this.getDataValue('transactionVolume')
        return transactionVolume == null ? null : BigInt(transactionVolume)
      },
      set(transactionVolume) {
        if (transactionVolume != null) {
          this.setDataValue('transactionVolume', transactionVolume.toString())
        }
      }
    }
  }, {freezeTableName: true, underscored: true, timestamps: false})

  Block.associate = () => {
    const {Header, Address} = app.model
    Header.hasOne(Block, {as: 'block', foreignKey: 'height'})
    Block.belongsTo(Header, {as: 'header', foreignKey: 'height'})
    Address.hasOne(Block, {as: 'minedBlocks', foreignKey: 'minerId'})
    Block.belongsTo(Address, {as: 'miner', foreignKey: 'minerId'})
    Address.hasOne(Block, {as: 'delegatedBlocks', foreignKey: 'delegatorId'})
    Block.belongsTo(Address, {as: 'delegator', foreignKey: 'delegatorId'})
  }

  return Block
}
