const {Subscription} = require('egg')

class UpdatePriceSubscription extends Subscription {
  static get schedule() {
    return {
      cron: '0 * * * *',
      type: 'worker'
    }
  }

  async subscribe() {
    const price = await this.ctx.service.misc.getPrices()
    await this.ctx.service.cache.setCache('qtum-price', price)
    this.app.io.of('/').to('coin')
      .emit('qtum-price', price)
  }
}

module.exports = UpdatePriceSubscription
