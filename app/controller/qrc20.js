const {Controller} = require('egg')

class QRC20Controller extends Controller {
  async summary() {
    this.ctx.assert(this.ctx.state.token.type === 'qrc20', 404)
    const summary = await this.ctx.service.qrc20.getQRC20Summary(this.ctx.state.token.contractAddress)
    this.ctx.body = {
      address: summary.addressHex.toString('hex'),
      addressHex: summary.addressHex.toString('hex'),
      name: summary.name,
      symbol: summary.symbol,
      decimals: summary.decimals,
      totalSupply: summary.totalSupply.toString(),
      holders: summary.holders,
      transactions: summary.transactions
    }
  }

  async list() {
    const {totalCount, tokens} = await this.ctx.service.qrc20.listQRC20Tokens()
    this.ctx.body = {
      totalCount,
      tokens: tokens.map(item => ({
        address: item.addressHex.toString('hex'),
        addressHex: item.addressHex.toString('hex'),
        name: item.name,
        symbol: item.symbol,
        decimals: item.decimals,
        totalSupply: item.totalSupply.toString(),
        holders: item.holders,
        transactions: item.transactions
      }))
    }
  }

  async allTransactions() {
    const {totalCount, transactions} = await this.ctx.service.qrc20.getAllQRC20TokenTransactions()
    this.ctx.body = {
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
    this.ctx.assert(this.ctx.state.token.type === 'qrc20', 404)
    const {totalCount, transactions} = await this.ctx.service.qrc20.getQRC20TokenTransactions(this.ctx.state.token.contractAddress)
    this.ctx.body = {
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
    this.ctx.assert(this.ctx.state.token.type === 'qrc20', 404)
    const {totalCount, list} = await this.ctx.service.qrc20.getQRC20TokenRichList(this.ctx.state.token.contractAddress)
    this.ctx.body = {
      totalCount,
      list: list.map(item => ({
        address: item.address,
        addressHex: item.addressHex,
        balance: item.balance.toString()
      }))
    }
  }

  async updateTotalSupply() {
    this.ctx.assert(this.ctx.state.token.type === 'qrc20', 500)
    const totalSupply = await this.ctx.service.qrc20.updateQRC20TotalSupply(this.ctx.state.token.contractAddress)
    this.ctx.assert(totalSupply != null, 500)
    this.ctx.body = totalSupply.toString()
  }
}

module.exports = QRC20Controller
