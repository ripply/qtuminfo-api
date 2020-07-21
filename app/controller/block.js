const {Controller} = require('egg')

class BlockController extends Controller {
  async block() {
    let arg = this.ctx.params.block
    this.ctx.assert(arg, 404)
    if (/^(0|[1-9]\d{0,9})$/.test(arg)) {
      arg = Number.parseInt(arg)
    } else if (/^[0-9a-f]{64}$/i.test(arg)) {
      arg = Buffer.from(arg, 'hex')
    } else {
      this.ctx.throw(400)
    }
    const block = await this.ctx.service.block.getBlock(arg)
    this.ctx.assert(block, 404)
    this.ctx.body = {
      hash: block.hash.toString('hex'),
      height: block.height,
      version: block.version,
      prevHash: block.prevHash.toString('hex'),
      nextHash: block.nextHash?.toString('hex'),
      merkleRoot: block.merkleRoot.toString('hex'),
      timestamp: block.timestamp,
      bits: block.bits.toString(16),
      nonce: block.nonce,
      hashStateRoot: block.hashStateRoot.toString('hex'),
      hashUTXORoot: block.hashUTXORoot.toString('hex'),
      stakePrevTxId: block.stakePrevTxId.toString('hex'),
      stakeOutputIndex: block.stakeOutputIndex,
      prevOutStakeHash: block.stakePrevTxId.toString('hex'),
      prevOutStakeN: block.stakeOutputIndex,
      signature: block.signature.toString('hex'),
      chainwork: block.chainwork.toString(16).padStart(64, '0'),
      flags: block.proofOfStake ? 'proof-of-stake' : 'proof-of-work',
      ...block.height > 0 ? {interval: block.interval} : {},
      size: block.size,
      weight: block.weight,
      transactions: block.transactions.map(id => id.toString('hex')),
      miner: block.miner,
      delegator: block.delegator,
      difficulty: block.difficulty,
      reward: block.reward.toString(),
      confirmations: this.app.blockchainInfo.tip.height - block.height + 1
    }
  }

  async rawBlock() {
    let arg = this.ctx.params.block
    this.ctx.assert(arg, 404)
    if (/^(0|[1-9]\d{0,9})$/.test(arg)) {
      arg = Number.parseInt(arg)
    } else if (/^[0-9a-f]{64}$/i.test(arg)) {
      arg = Buffer.from(arg, 'hex')
    } else {
      this.ctx.throw(400)
    }
    const block = await this.ctx.service.block.getRawBlock(arg)
    this.ctx.assert(block, 404)
    this.ctx.body = block.toBuffer().toString('hex')
  }

  async list() {
    let date = this.ctx.query.date
    if (!date) {
      const d = new Date()
      const yyyy = d.getUTCFullYear().toString()
      const mm = (d.getUTCMonth() + 1).toString()
      const dd = d.getUTCDate().toString()
      date = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    }
    const min = Math.floor(Date.parse(date) / 1000)
    const max = min + 24 * 60 * 60
    const {blocks} = await this.ctx.service.block.listBlocks({min, max})
    this.ctx.body = blocks.map(block => ({
      hash: block.hash.toString('hex'),
      height: block.height,
      timestamp: block.timestamp,
      ...block.height > 0 ? {interval: block.interval} : {},
      size: block.size,
      transactionCount: block.transactionsCount,
      miner: block.miner,
      reward: block.reward.toString()
    }))
  }

  async blockList() {
    let dateFilter = null
    const date = this.ctx.query.date
    if (date) {
      const min = Math.floor(Date.parse(date) / 1000)
      const max = min + 24 * 60 * 60
      dateFilter = {min, max}
    }
    const result = await this.ctx.service.block.listBlocks(dateFilter)
    this.ctx.body = {
      totalCount: result.totalCount,
      blocks: result.blocks.map(block => ({
        hash: block.hash.toString('hex'),
        height: block.height,
        timestamp: block.timestamp,
        ...block.height > 0 ? {interval: block.interval} : {},
        size: block.size,
        transactionCount: block.transactionsCount,
        miner: block.miner,
        reward: block.reward.toString()
      }))
    }
  }

  async recent() {
    const count = Number.parseInt(this.ctx.query.count ?? 10)
    const blocks = await this.ctx.service.block.getRecentBlocks(count)
    this.ctx.body = blocks.map(block => ({
      hash: block.hash.toString('hex'),
      height: block.height,
      timestamp: block.timestamp,
      ...block.height > 0 ? {interval: block.interval} : {},
      size: block.size,
      transactionCount: block.transactionsCount,
      miner: block.miner,
      reward: block.reward.toString()
    }))
  }
}

module.exports = BlockController
