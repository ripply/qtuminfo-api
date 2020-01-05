const {Controller} = require('egg')

class StatisticsController extends Controller {
  async info() {
    const {ctx} = this
    let _24hStatistics = await ctx.service.cache.getCache('24h-statistics') ?? {}
    ctx.body = _24hStatistics
  }

  async dailyTransactions() {
    const {ctx} = this
    let dailyTransactions = await ctx.service.cache.getCache('daily-transactions') ?? []
    ctx.body = dailyTransactions.map(({timestamp, transactionsCount, contractTransactionsCount, transactionVolume}) => ({
      time: new Date(timestamp * 1000),
      transactionCount: transactionsCount,
      contractTransactionCount: contractTransactionsCount,
      transactionVolume
    }))
  }

  async blockInterval() {
    const {ctx} = this
    let blockInterval = await ctx.service.cache.getCache('block-interval') ?? []
    ctx.body = blockInterval
  }

  async addressGrowth() {
    const {ctx} = this
    let addressGrowth = await ctx.service.cache.getCache('address-growth') ?? []
    ctx.body = addressGrowth.map(({timestamp, count}) => ({
      time: new Date(timestamp * 1000),
      addresses: count
    }))
  }
}

module.exports = StatisticsController
