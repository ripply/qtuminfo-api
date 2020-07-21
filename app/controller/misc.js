const {Controller} = require('egg')

class MiscController extends Controller {
  async classify() {
    this.ctx.body = await this.ctx.service.misc.classify(this.ctx.query.query)
  }

  async richList() {
    const {totalCount, list} = await this.ctx.service.balance.getRichList()
    this.ctx.body = {
      totalCount,
      list: list.map(item => ({
        address: item.addressHex ? item.addressHex.toString('hex') : item.address,
        addressHex: item.addressHex?.toString('hex'),
        balance: item.balance.toString()
      }))
    }
  }

  async biggestMiners() {
    let lastNDays = null
    if (this.ctx.query.days && /^[1-9]\d*$/.test(this.ctx.query.days)) {
      lastNDays = Number.parseInt(this.ctx.query.days)
    }
    const {totalCount, list, blocks} = await this.ctx.service.block.getBiggestMiners(lastNDays)
    this.ctx.body = {
      totalCount,
      list: list.map(item => ({
        address: item.address,
        blocks: item.blocks,
        reward: item.reward,
        balance: item.balance.toString()
      })),
      blocks
    }
  }

  async prices() {
    this.ctx.body = await this.ctx.service.cache.getCache('qtum-price')
  }

  async verifyMessage() {
    const {address, message, signature} = this.ctx.request.body
    this.ctx.body = await this.ctx.service.misc.verifyMessage(address, message, signature)
  }
}

module.exports = MiscController
