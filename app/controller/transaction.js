const {Controller} = require('egg')

class TransactionController extends Controller {
  async transaction() {
    this.ctx.assert(this.ctx.params.id && /^[0-9a-f]{64}$/i.test(this.ctx.params.id), 404)
    const id = Buffer.from(this.ctx.params.id, 'hex')
    const transaction = await this.ctx.service.transaction.getTransaction(id)
    this.ctx.assert(transaction, 404)
    this.ctx.body = transaction
  }

  async transactions() {
    this.ctx.assert(this.ctx.params.ids, 404)
    const ids = this.ctx.params.ids.split(',')
    this.ctx.assert(ids.length <= 100 && ids.every(id => /^[0-9a-f]{64}$/i.test(id)), 404)
    const transactions = await Promise.all(ids.map(
      id => this.ctx.service.transaction.getTransaction(Buffer.from(id, 'hex'))
    ))
    this.ctx.assert(transactions.every(Boolean), 404)
    this.ctx.body = transactions
  }

  async rawTransaction() {
    this.ctx.assert(/^[0-9a-f]{64}$/.test(this.ctx.params.id), 404)
    const id = Buffer.from(this.ctx.params.id, 'hex')
    const transaction = await this.ctx.service.transaction.getRawTransaction(id)
    this.ctx.assert(transaction, 404)
    this.ctx.body = transaction.toBuffer().toString('hex')
  }

  async recent() {
    const count = Number.parseInt(this.ctx.query.count ?? 10)
    const ids = await this.ctx.service.transaction.getRecentTransactions(count)
    this.ctx.body = await Promise.all(ids.map(
      id => this.ctx.service.transaction.getTransaction(Buffer.from(id, 'hex'))
    ))
  }

  async list() {
    const {totalCount, ids} = await this.ctx.service.transaction.getAllTransactions()
    const transactions = await Promise.all(ids.map(id => this.ctx.service.transaction.getTransaction(id)))
    this.ctx.body = {totalCount, transactions}
  }

  async send() {
    const {rawtx: data} = this.ctx.request.body
    if (!/^([0-9a-f][0-9a-f])+$/i.test(data)) {
      this.ctx.body = {status: 1, message: 'TX decode failed'}
    }
    try {
      const id = await this.ctx.service.transaction.sendRawTransaction(Buffer.from(data, 'hex'))
      this.ctx.body = {status: 0, id: id.toString('hex'), txid: id.toString('hex')}
    } catch (err) {
      this.ctx.body = {status: 1, message: err.message}
    }
  }
}

module.exports = TransactionController
