const {Service} = require('egg')

class InfoService extends Service {
  async getInfo() {
    let height = this.app.blockchainInfo.tip.height
    let blockTime = JSON.parse(await this.app.redis.hget(this.app.name, 'blocktime')) || 0
    let difficulty = JSON.parse(await this.app.redis.hget(this.app.name, 'difficulty')) || 0
    let stakeWeight = JSON.parse(await this.app.redis.hget(this.app.name, 'stakeweight')) || 0
    let fullnodes = JSON.parse(await this.app.redis.hget(this.app.name, 'fullnodes')) || 0
    let feeRate = JSON.parse(await this.app.redis.hget(this.app.name, 'feerate')).find(item => item.blocks === 10).feeRate || 0.004
    let dgpInfo = JSON.parse(await this.app.redis.hget(this.app.name, 'dgpinfo')) || {}
    let addresses = JSON.parse(await this.app.redis.hget(this.app.name, 'addresses')) || 0
    return {
      height,
      supply: this.getTotalSupply(),
      ...this.app.chain.name === 'mainnet' ? {circulatingSupply: this.getCirculatingSupply()} : {},
      blockTime,
      difficulty,
      stakeWeight: Math.round(stakeWeight),
      fullnodes,
      feeRate,
      dgpInfo,
      addresses,
      netStakeWeight: Math.round(stakeWeight)
    }
  }

  getTotalSupply() {
    let height = this.app.blockchainInfo.tip.height
    if (height <= this.app.chain.lastPoWBlockHeight) {
      return height * 20000
    } else {
      let supply = 1e8
      let reward = 4
      let interval = 985500
      let stakeHeight = height - this.app.chain.lastPoWBlockHeight
      let halvings = 0
      while (halvings < 7 && stakeHeight > interval) {
        supply += interval * reward / (1 << halvings++)
        stakeHeight -= interval
      }
      supply += stakeHeight * reward / (1 << halvings)
      return supply
    }
  }

  getTotalMaxSupply() {
    return 1e8 + 985500 * 4 * (1 - 1 / 2 ** 7) / (1 - 1 / 2)
  }

  getCirculatingSupply() {
    let height = this.app.blockchainInfo.tip.height
    let totalSupply = this.getTotalSupply(height)
    if (this.app.chain.name === 'mainnet') {
      return totalSupply - 575e4
    } else {
      return totalSupply
    }
  }

  async getBlockTime() {
    const {Header} = this.ctx.model
    let header = await Header.findOne({
      attributes: ['timestamp'],
      order: [['height', 'DESC']],
      transaction: this.ctx.state.transaction
    })
    return header.timestamp
  }

  async getDifficulty() {
    const {Header} = this.ctx.model
    let header = await Header.findOne({
      attributes: ['bits'],
      order: [['height', 'DESC']],
      transaction: this.ctx.state.transaction
    })
    return header.difficulty
  }

  async getStakeWeight() {
    const {Header} = this.ctx.model
    const {gte: $gte} = this.app.Sequelize.Op
    let height = await Header.aggregate('height', 'max', {transaction: this.ctx.state.transaction})
    let list = await Header.findAll({
      where: {height: {[$gte]: height - 500}},
      attributes: ['timestamp', 'bits'],
      order: [['height', 'ASC']],
      transaction: this.ctx.state.transaction
    })
    let interval = list[list.length - 1].timestamp - list[0].timestamp
    let sum = list.slice(1)
      .map(x => x.difficulty)
      .reduce((x, y) => x + y)
    return sum * 2 ** 32 * 16 / interval
  }

  async getFeeRates() {
    let client = new this.app.qtuminfo.rpc(this.app.config.qtuminfo.rpc)
    let results = await Promise.all([2, 4, 6, 10, 12, 24].map(blocks => client.estimatesmartfee(blocks)))
    return [
      {blocks: 2, feeRate: results[0].feerate || 0.004},
      {blocks: 4, feeRate: results[1].feerate || 0.004},
      {blocks: 6, feeRate: results[2].feerate || 0.004},
      {blocks: 10, feeRate: results[3].feerate || 0.004},
      {blocks: 12, feeRate: results[4].feerate || 0.004},
      {blocks: 24, feeRate: results[5].feerate || 0.004}
    ]
  }

  async getDGPInfo() {
    let client = new this.app.qtuminfo.rpc(this.app.config.qtuminfo.rpc)
    let info = await client.getdgpinfo()
    return {
      maxBlockSize: info.maxblocksize,
      minGasPrice: info.mingasprice,
      blockGasLimit: info.blockgaslimit
    }
  }

  async getAddresses() {
    const {Address} = this.ctx.model
    const {lt: $lt} = this.app.Sequelize.Op
    return await Address.count({
      where: {type: {[$lt]: 0x80}},
      transaction: this.ctx.state.transaction
    })
  }
}

module.exports = InfoService
