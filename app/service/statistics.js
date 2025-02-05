const {Service} = require('egg')

class StatisticsService extends Service {
  async get24hStatistics() {
    const db = this.ctx.model
    const {sql} = this.ctx.helper
    const timestamp = Math.floor(Date.now() / 1000)
    let [{fromHeight, toHeight}] = await db.query(sql`
      SELECT MIN(height) as fromHeight, MAX(height) as toHeight FROM header
      WHERE timestamp BETWEEN ${timestamp - 86400 + 1} AND ${timestamp}
    `, {type: db.QueryTypes.SELECT})
    fromHeight = Math.max(fromHeight, 1)
    const [[{transactionCount}], [{transactionVolume}], [{averageBlockTime}]] = await Promise.all([
      db.query(sql`
        SELECT SUM(transactions_count) AS transactionCount FROM block WHERE height BETWEEN ${fromHeight} AND ${toHeight}
      `, {type: db.QueryTypes.SELECT}),
      db.query(sql`
        SELECT SUM(transaction_volume) AS transactionVolume FROM block WHERE height BETWEEN ${fromHeight} AND ${toHeight}
      `, {type: db.QueryTypes.SELECT}),
      db.query(sql`
        SELECT (
          (SELECT timestamp FROM header WHERE height = ${toHeight}) - (SELECT timestamp FROM header WHERE height = ${fromHeight - 1})
        ) / (${toHeight} - ${fromHeight} + 1) AS averageBlockTime
      `, {type: db.QueryTypes.SELECT})
    ])
    return {
      transactionCount: Number(transactionCount),
      transactionVolume,
      averageBlockTime: Number(averageBlockTime)
    }
  }

  async getDailyTransactions() {
    const db = this.ctx.model
    const {sql} = this.ctx.helper
    const result = await db.query(sql`
      SELECT
        FLOOR(header.timestamp / 86400) AS date,
        SUM(block.transactions_count) AS transactionsCount,
        SUM(block.contract_transactions_count) AS contractTransactionsCount,
        SUM(block.transaction_volume) AS transactionVolume
      FROM header, block
      WHERE header.height = block.height
      GROUP BY date
      ORDER BY date ASC
    `, {type: db.QueryTypes.SELECT})
    return result.map(({date, transactionsCount, contractTransactionsCount, transactionVolume}) => ({
      timestamp: date * 86400,
      transactionsCount,
      contractTransactionsCount,
      transactionVolume
    }))
  }

  async getBlockIntervalStatistics() {
    const db = this.ctx.model
    const {sql} = this.ctx.helper
    const skips = this.app.chain.lastPoWBlockHeight === Infinity ? 1 : this.app.chain.lastPoWBlockHeight + 1
    const result = await db.query(sql`
      SELECT header.timestamp - prev_header.timestamp AS blockInterval, COUNT(*) AS count FROM header
      INNER JOIN header prev_header ON prev_header.height = header.height - 1
      WHERE header.height > ${skips}
      GROUP BY blockInterval
      ORDER BY blockInterval ASC
    `, {type: db.QueryTypes.SELECT})
    const total = this.app.blockchainInfo.tip.height - skips
    return result.map(({blockInterval, count}) => ({interval: blockInterval, count, percentage: count / total}))
  }

  async getAddressGrowth() {
    const db = this.ctx.model
    const {Address} = db
    const {sql} = this.ctx.helper
    const result = await db.query(sql`
      SELECT FLOOR(header.timestamp / 86400) AS date, COUNT(*) AS count FROM address, header
      WHERE address.create_height = header.height AND address.type < ${Address.parseType('contract')}
      GROUP BY date
      ORDER BY date ASC
    `, {type: db.QueryTypes.SELECT})
    let sum = 0
    return result.map(({date, count}) => {
      sum += count
      return {
        timestamp: date * 86400,
        count: sum
      }
    })
  }
}

module.exports = StatisticsService
