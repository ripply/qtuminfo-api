const {Controller} = require('egg')

class MiscController extends Controller {
  async classify() {
    let {ctx} = this
    ctx.body = await ctx.service.misc.classify(ctx.query.query)
  }

  async richList() {
    let {ctx} = this
    let {totalCount, list} = await ctx.service.balance.getRichList()
    ctx.body = {
      totalCount,
      list: list.map(item => ({
        address: item.addressHex ? item.addressHex.toString('hex') : item.address,
        addressHex: item.addressHex?.toString('hex'),
        balance: item.balance.toString()
      }))
    }
  }

  async biggestMiners() {
    let {ctx} = this
    let lastNDays = null
    if (ctx.query.days && /^[1-9]\d*$/.test(ctx.query.days)) {
      lastNDays = Number.parseInt(ctx.query.days)
    }
    let {totalCount, list, blocks} = await ctx.service.block.getBiggestMiners(lastNDays)
    ctx.body = {
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
}

module.exports = MiscController
