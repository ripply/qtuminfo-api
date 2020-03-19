const {Controller} = require('egg')

class StatisticsController extends Controller {
  async info() {
    const _24hStatistics = await this.ctx.service.cache.getCache('24h-statistics') ?? {}
    this.ctx.body = _24hStatistics
  }

  async dailyTransactions() {
    const dailyTransactions = await this.ctx.service.cache.getCache('daily-transactions') ?? []
    this.ctx.body = dailyTransactions.map(({timestamp, transactionsCount, contractTransactionsCount, transactionVolume}) => ({
      time: new Date(timestamp * 1000),
      transactionCount: transactionsCount,
      contractTransactionCount: contractTransactionsCount,
      transactionVolume
    }))
  }

  async blockInterval() {
    const blockInterval = await this.ctx.service.cache.getCache('block-interval') ?? []
    this.ctx.body = blockInterval
  }

  async addressGrowth() {
    const addressGrowth = await this.ctx.service.cache.getCache('address-growth') ?? []
    this.ctx.body = addressGrowth.map(({timestamp, count}) => ({
      time: new Date(timestamp * 1000),
      addresses: count
    }))
  }
}

module.exports = StatisticsController
