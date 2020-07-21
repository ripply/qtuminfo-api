const CoinGecko = require('coingecko-api')
const {Service} = require('egg')

class MiscService extends Service {
  async classify(id) {
    const db = this.ctx.model
    const {Block, Transaction, Contract, Qrc20: QRC20, Qrc721: QRC721, where, fn, literal} = db
    const {or: $or, like: $like} = this.app.Sequelize.Op
    const {Address} = this.app.qtuminfo.lib
    const {sql} = this.ctx.helper

    if (/^(0|[1-9]\d{0,9})$/.test(id)) {
      const height = Number.parseInt(id)
      if (height <= this.app.blockchainInfo.tip.height) {
        return {type: 'block'}
      }
    }
    if (/^[0-9a-f]{64}$/i.test(id)) {
      if (await Block.findOne({
        where: {hash: Buffer.from(id, 'hex')},
        attributes: ['height']
      })) {
        return {type: 'block'}
      } else if (await Transaction.findOne({
        where: {id: Buffer.from(id, 'hex')},
        attributes: ['_id']
      })) {
        return {type: 'transaction'}
      }
    }

    try {
      const address = Address.fromString(id, this.app.chain)
      if ([Address.CONTRACT, Address.EVM_CONTRACT].includes(address.type)) {
        const contract = await Contract.findOne({
          where: {address: address.data},
          attributes: ['address']
        })
        if (contract) {
          return {
            type: 'contract',
            address: contract.address.toString('hex'),
            addressHex: contract.address.toString('hex')
          }
        }
      } else {
        return {type: 'address'}
      }
    } catch (err) {}

    let qrc20Results = (await QRC20.findAll({
      where: {
        [$or]: [
          where(fn('LOWER', fn('CONVERT', literal('name USING utf8mb4'))), id.toLowerCase()),
          where(fn('LOWER', fn('CONVERT', literal('symbol USING utf8mb4'))), id.toLowerCase())
        ]
      },
      attributes: ['contractAddress']
    })).map(qrc20 => qrc20.contractAddress)
    if (qrc20Results.length === 0) {
      qrc20Results = (await QRC20.findAll({
        where: {
          [$or]: [
            where(fn('LOWER', fn('CONVERT', literal('name USING utf8mb4'))), {[$like]: `%${id.toLowerCase()}%`}),
            where(fn('LOWER', fn('CONVERT', literal('symbol USING utf8mb4'))), {[$like]: `%${id.toLowerCase()}%`})
          ]
        },
        attributes: ['contractAddress']
      })).map(qrc20 => qrc20.contractAddress)
    }
    if (qrc20Results.length) {
      const [{addressHex}] = await db.query(sql`
        SELECT contract.address_string AS address, contract.address AS addressHex FROM (
          SELECT contract_address FROM qrc20_statistics
          WHERE contract_address IN ${qrc20Results}
          ORDER BY transactions DESC LIMIT 1
        ) qrc20_balance
        INNER JOIN contract ON contract.address = qrc20_balance.contract_address
      `, {type: db.QueryTypes.SELECT})
      return {
        type: 'qrc20',
        address: addressHex.toString('hex'),
        addressHex: addressHex.toString('hex')
      }
    }

    let qrc721Results = (await QRC721.findAll({
      where: {
        [$or]: [
          where(fn('LOWER', fn('CONVERT', literal('name USING utf8mb4'))), id.toLowerCase()),
          where(fn('LOWER', fn('CONVERT', literal('symbol USING utf8mb4'))), id.toLowerCase())
        ]
      },
      attributes: ['contractAddress']
    })).map(qrc721 => qrc721.contractAddress)
    if (qrc721Results.length === 0) {
      qrc721Results = (await QRC721.findAll({
        where: {
          [$or]: [
            where(fn('LOWER', fn('CONVERT', literal('name USING utf8mb4'))), {[$like]: `%${id.toLowerCase()}%`}),
            where(fn('LOWER', fn('CONVERT', literal('symbol USING utf8mb4'))), {[$like]: `%${id.toLowerCase()}%`})
          ]
        },
        attributes: ['contractAddress']
      })).map(qrc721 => qrc721.contractAddress)
    }
    if (qrc721Results.length) {
      const [{addressHex}] = await db.query(sql`
        SELECT contract.address_string AS address, contract.address AS addressHex FROM (
          SELECT contract_address FROM qrc721_statistics
          WHERE contract_address IN ${qrc721Results}
          ORDER BY transactions DESC LIMIT 1
        ) qrc721_token
        INNER JOIN contract ON contract.address = qrc721_token.contract_address
      `, {type: db.QueryTypes.SELECT})
      return {
        type: 'qrc721',
        address: addressHex.toString('hex'),
        addressHex: addressHex.toString('hex')
      }
    }

    return {}
  }

  /* eslint-disable camelcase */
  async getPrices() {
    const result = await new CoinGecko().coins.fetch('qtum', {
      tickers: false,
      community_data: false,
      developer_data: false,
      localization: false
    })
    const currentPrice = result.data.market_data.current_price
    return {
      USD: currentPrice.usd,
      CNY: currentPrice.cny
    }
  }
  /* eslint-enable camelcase */

  async getFullNodes() {
    const {status, data} = await this.ctx.curl('https://nodes.qtum.org/api/nodes', {dataType: 'json'})
    if (status === 200) {
      return data.map(item => item.count).reduce((x, y) => x + y)
    }
  }

  async verifymessage(address, message, signature) {
    const client = new this.app.qtuminfo.rpc(this.app.config.qtuminfo.rpc)
    return await client.verifymessage(address, signature, message)
  }
}

module.exports = MiscService
