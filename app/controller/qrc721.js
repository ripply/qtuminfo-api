const {Controller} = require('egg')

class QRC721Controller extends Controller {
  async list() {
    const {ctx} = this
    let {totalCount, tokens} = await ctx.service.qrc721.listQRC721Tokens()
    ctx.body = {
      totalCount,
      tokens: tokens.map(item => ({
        address: item.addressHex.toString('hex'),
        addressHex: item.addressHex.toString('hex'),
        name: item.name,
        symbol: item.symbol,
        totalSupply: item.totalSupply.toString(),
        holders: item.holders
      }))
    }
  }

  async transactions() {
    const {ctx} = this
    ctx.assert(ctx.state.token.type === 'qrc721', 404)
    let {totalCount, transactions} = await ctx.service.qrc20.getQRC20TokenTransactions(ctx.state.token.contractAddress)
    ctx.body = {
      totalCount,
      transactions: transactions.map(transaction => ({
        transactionId: transaction.transactionId.toString('hex'),
        outputIndex: transaction.outputIndex,
        blockHeight: transaction.blockHeight,
        blockHash: transaction.blockHash.toString('hex'),
        timestamp: transaction.timestamp,
        confirmations: transaction.confirmations,
        from: transaction.from,
        fromHex: transaction.fromHex && transaction.fromHex.toString('hex'),
        to: transaction.to,
        toHex: transaction.toHex && transaction.toHex.toString('hex'),
        value: transaction.value.toString()
      }))
    }
  }
}

module.exports = QRC721Controller
