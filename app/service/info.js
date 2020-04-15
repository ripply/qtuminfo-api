const {Service} = require('egg')

class InfoService extends Service {
  async getInfo() {
    const height = this.app.blockchainInfo.tip.height
    const blockTime = await this.ctx.service.cache.getCache('blocktime') ?? 0
    const difficulty = await this.ctx.service.cache.getCache('difficulty') ?? 0
    const stakeWeight = await this.ctx.service.cache.getCache('stakeweight') ?? 0
    const fullnodes = await this.ctx.service.cache.getCache('fullnodes') ?? 0
    const feeRate = (await this.ctx.service.cache.getCache('feerate') ?? []).find(item => item.blocks === 10)?.feeRate ?? 0.004
    const dgpInfo = await this.ctx.service.cache.getCache('dgpinfo') ?? {}
    const addresses = await this.ctx.service.cache.getCache('addresses') ?? 0
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
    const height = this.app.blockchainInfo.tip.height
    if (height <= this.app.chain.lastPoWBlockHeight) {
      return height * 20000
    } else {
      let supply = 1e8 - 4
      const reward = 4
      const interval = 985500
      let stakeHeight = height - this.app.chain.lastPoWBlockHeight + 1
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
    return 1e8 + 985500 * 4 * (1 - 1 / 2 ** 7) / (1 - 1 / 2) - 4
  }

  getCirculatingSupply() {
    return this.getTotalSupply()
  }

  async getBlockTime() {
    const {Header} = this.ctx.model
    const header = await Header.findOne({
      attributes: ['timestamp'],
      order: [['height', 'DESC']]
    })
    return header.timestamp
  }

  async getDifficulty() {
    const {Header} = this.ctx.model
    const header = await Header.findOne({
      attributes: ['bits'],
      order: [['height', 'DESC']]
    })
    return header.difficulty
  }

  async getStakeWeight() {
    const {Header} = this.ctx.model
    const {gte: $gte} = this.app.Sequelize.Op
    const height = await Header.aggregate('height', 'max')
    const list = await Header.findAll({
      where: {height: {[$gte]: height - 500}},
      attributes: ['timestamp', 'bits'],
      order: [['height', 'ASC']]
    })
    const interval = list[list.length - 1].timestamp - list[0].timestamp
    const sum = list.slice(1)
      .map(x => x.difficulty)
      .reduce((x, y) => x + y)
    return sum * 2 ** 32 * 16 / interval
  }

  async getFeeRates() {
    const client = new this.app.qtuminfo.rpc(this.app.config.qtuminfo.rpc)
    const results = await Promise.all([2, 4, 6, 10, 12, 24].map(blocks => client.estimatesmartfee(blocks)))
    return [
      {blocks: 2, feeRate: results[0].feerate ?? 0.004},
      {blocks: 4, feeRate: results[1].feerate ?? 0.004},
      {blocks: 6, feeRate: results[2].feerate ?? 0.004},
      {blocks: 10, feeRate: results[3].feerate ?? 0.004},
      {blocks: 12, feeRate: results[4].feerate ?? 0.004},
      {blocks: 24, feeRate: results[5].feerate ?? 0.004}
    ]
  }

  async getDGPInfo() {
    const client = new this.app.qtuminfo.rpc(this.app.config.qtuminfo.rpc)
    const info = await client.getdgpinfo()
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
      where: {type: {[$lt]: 0x80}}
    })
  }
}

module.exports = InfoService
