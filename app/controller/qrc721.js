const {Controller} = require('egg')

class QRC721Controller extends Controller {
  async summary() {
    this.ctx.assert(this.ctx.state.token.type === 'qrc721', 404)
    const summary = await this.ctx.service.contract.getQRC721Summary(this.ctx.state.token.contractAddress)
    this.ctx.body = {
      address: summary.addressHex.toString('hex'),
      addressHex: summary.addressHex.toString('hex'),
      name: summary.name,
      symbol: summary.symbol,
      totalSupply: summary.totalSupply.toString(),
      holders: summary.holders,
      transactions: summary.transactions
    }
  }

  async list() {
    const {totalCount, tokens} = await this.ctx.service.qrc721.listQRC721Tokens()
    this.ctx.body = {
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
    this.ctx.assert(this.ctx.state.token.type === 'qrc721', 404)
    const {totalCount, transactions} = await this.ctx.service.qrc721.getQRC721TokenTransactions(this.ctx.state.token.contractAddress)
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
        tokenId: transaction.tokenId
      }))
    }
  }
}

module.exports = QRC721Controller
