const {Controller} = require('egg')

class QRC20Controller extends Controller {
  async summary() {
    const {ctx} = this
    ctx.assert(ctx.state.token.type === 'qrc20', 404)
    let summary = await ctx.service.qrc20.getQRC20Summary(ctx.state.token.contractAddress)
    ctx.body = {
      address: summary.addressHex.toString('hex'),
      addressHex: summary.addressHex.toString('hex'),
      name: summary.name,
      symbol: summary.symbol,
      decimals: summary.decimals,
      totalSupply: summary.totalSupply.toString(),
      version: summary.version,
      holders: summary.holders,
      transactions: summary.transactions
    }
  }

  async list() {
    const {ctx} = this
    let {totalCount, tokens} = await ctx.service.qrc20.listQRC20Tokens()
    ctx.body = {
      totalCount,
      tokens: tokens.map(item => ({
        address: item.addressHex.toString('hex'),
        addressHex: item.addressHex.toString('hex'),
        name: item.name,
        symbol: item.symbol,
        decimals: item.decimals,
        totalSupply: item.totalSupply.toString(),
        version: item.version,
        holders: item.holders,
        transactions: item.transactions
      }))
    }
  }

  async allTransactions() {
    const {ctx} = this
    let {totalCount, transactions} = await ctx.service.qrc20.getAllQRC20TokenTransactions()
    ctx.body = {
      totalCount,
      transactions: transactions.map(transaction => ({
        transactionId: transaction.transactionId.toString('hex'),
        outputIndex: transaction.outputIndex,
        blockHeight: transaction.blockHeight,
        blockHash: transaction.blockHash.toString('hex'),
        timestamp: transaction.timestamp,
        confirmations: transaction.confirmations,
        token: {
          address: transaction.token.address.toString('hex'),
          addressHex: transaction.token.addressHex,
          name: transaction.token.name,
          symbol: transaction.token.symbol,
          decimals: transaction.token.decimals
        },
        from: transaction.from,
        fromHex: transaction.fromHex?.toString('hex'),
        to: transaction.to,
        toHex: transaction.toHex?.toString('hex'),
        value: transaction.value.toString()
      }))
    }
  }

  async transactions() {
    const {ctx} = this
    ctx.assert(ctx.state.token.type === 'qrc20', 404)
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
        fromHex: transaction.fromHex?.toString('hex'),
        to: transaction.to,
        toHex: transaction.toHex?.toString('hex'),
        value: transaction.value.toString()
      }))
    }
  }

  async richList() {
    const {ctx} = this
    ctx.assert(ctx.state.token.type === 'qrc20', 404)
    let {totalCount, list} = await ctx.service.qrc20.getQRC20TokenRichList(ctx.state.token.contractAddress)
    ctx.body = {
      totalCount,
      list: list.map(item => ({
        address: item.address,
        addressHex: item.addressHex,
        balance: item.balance.toString()
      }))
    }
  }
}

module.exports = QRC20Controller
