const {Service} = require('egg')

class QRC721Service extends Service {
  async getQRC721Summary(contractAddress) {
    const {Qrc721: QRC721, Qrc721Statistics: QRC721Statistics} = this.ctx.model
    const qrc721 = await QRC721.findOne({
      where: {contractAddress},
      attributes: ['name', 'symbol', 'totalSupply'],
      include: [{
        model: QRC721Statistics,
        as: 'statistics',
        required: true
      }]
    })
    return {
      address: contractAddress.toString('hex'),
      addressHex: contractAddress,
      name: qrc721.name,
      symbol: qrc721.symbol,
      totalSupply: qrc721.totalSupply,
      holders: qrc721.statistics.holders,
      transactions: qrc721.statistics.transactions
    }
  }

  async listQRC721Tokens() {
    const db = this.ctx.model
    const {sql} = this.ctx.helper
    const {limit, offset} = this.ctx.state.pagination

    const [{totalCount}] = await db.query(sql`
      SELECT COUNT(DISTINCT(qrc721_token.contract_address)) AS count FROM qrc721_token
      INNER JOIN qrc721 USING (contract_address)
    `, {type: db.QueryTypes.SELECT})
    const list = await db.query(sql`
      SELECT
        contract.address_string AS address, contract.address AS addressHex,
        qrc721.name AS name, qrc721.symbol AS symbol, qrc721.total_supply AS totalSupply,
        list.holders AS holders
      FROM (
        SELECT contract_address, COUNT(*) AS holders FROM qrc721_token
        INNER JOIN qrc721 USING (contract_address)
        GROUP BY contract_address
        ORDER BY holders DESC
        LIMIT ${offset}, ${limit}
      ) list
      INNER JOIN qrc721 USING (contract_address)
      INNER JOIN contract ON contract.address = list.contract_address
      ORDER BY holders DESC
    `, {type: db.QueryTypes.SELECT})

    return {
      totalCount,
      tokens: list.map(item => ({
        address: item.addressHex.toString('hex'),
        addressHex: item.addressHex,
        name: item.name.toString(),
        symbol: item.symbol.toString(),
        totalSupply: BigInt(`0x${item.totalSupply.toString('hex')}`),
        holders: item.holders
      }))
    }
  }

  async getAllQRC721Balances(hexAddresses) {
    if (hexAddresses.length === 0) {
      return []
    }
    const db = this.ctx.model
    const {sql} = this.ctx.helper
    const list = await db.query(sql`
      SELECT
        contract.address AS addressHex, contract.address_string AS address,
        qrc721.name AS name,
        qrc721.symbol AS symbol,
        qrc721_token.count AS count
      FROM (
        SELECT contract_address, COUNT(*) AS count FROM qrc721_token
        WHERE holder IN ${hexAddresses}
        GROUP BY contract_address
      ) qrc721_token
      INNER JOIN contract ON contract.address = qrc721_token.contract_address
      INNER JOIN qrc721 ON qrc721.contract_address = qrc721_token.contract_address
    `, {type: db.QueryTypes.SELECT})
    return list.map(item => ({
      address: item.addressHex.toString('hex'),
      addressHex: item.addressHex,
      name: item.name.toString(),
      symbol: item.symbol.toString(),
      count: item.count
    }))
  }

  async getQRC721TokenTransactions(contractAddress) {
    const TransferABI = this.app.qtuminfo.lib.Solidity.qrc721ABIs.find(abi => abi.name === 'Transfer')
    const db = this.ctx.model
    const {EvmReceiptLog: EVMReceiptLog} = db
    const {sql} = this.ctx.helper
    const {limit, offset, reversed = true} = this.ctx.state.pagination
    const order = reversed ? 'DESC' : 'ASC'

    const totalCount = await EVMReceiptLog.count({
      where: {
        ...this.ctx.service.block.getBlockFilter(),
        address: contractAddress,
        topic1: TransferABI.id
      }
    })
    const transactions = await db.query(sql`
      SELECT
        transaction.id AS transactionId,
        evm_receipt.output_index AS outputIndex,
        evm_receipt.block_height AS blockHeight,
        header.hash AS blockHash,
        header.timestamp AS timestamp,
        list.topic2 AS topic2,
        list.topic3 AS topic3,
        list.topic4 AS topic4
      FROM (
        SELECT _id, receipt_id, topic2, topic3, topic4 FROM evm_receipt_log
        WHERE address = ${contractAddress} AND topic1 = ${TransferABI.id} AND ${this.ctx.service.block.getRawBlockFilter()}
        ORDER BY _id ${{raw: order}} LIMIT ${offset}, ${limit}
      ) list
      INNER JOIN evm_receipt ON evm_receipt._id = list.receipt_id
      INNER JOIN transaction ON transaction._id = evm_receipt.transaction_id
      INNER JOIN header ON header.height = evm_receipt.block_height
      ORDER BY list._id ${{raw: order}}
    `, {type: db.QueryTypes.SELECT})

    const addresses = await this.ctx.service.contract.transformHexAddresses(
      transactions.map(transaction => [transaction.topic2.slice(12), transaction.topic3.slice(12)]).flat()
    )
    return {
      totalCount,
      transactions: transactions.map((transaction, index) => {
        const from = addresses[index * 2]
        const to = addresses[index * 2 + 1]
        return {
          transactionId: transaction.transactionId,
          outputIndex: transaction.outputIndex,
          blockHeight: transaction.blockHeight,
          blockHash: transaction.blockHash,
          timestamp: transaction.timestamp,
          confirmations: this.app.blockchainInfo.tip.height - transaction.blockHeight + 1,
          ...from?.hex ? {from: from.hex.toString('hex'), fromHex: from.hex} : {from},
          ...to?.hex ? {to: to.hex.toString('hex'), toHex: to.hex} : {to},
          tokenId: transaction.topic4.toString('hex')
        }
      })
    }
  }

  async updateQRC721Statistics() {
    const TransferABI = this.app.qtuminfo.lib.Solidity.qrc721ABIs.find(abi => abi.name === 'Transfer')
    const db = this.ctx.model
    const {Qrc721: QRC721, Qrc721Statistics: QRC721Statistics} = db
    const {sql} = this.ctx.helper
    const transaction = await db.transaction()
    try {
      const result = (await QRC721.findAll({
        attributes: ['contractAddress'],
        order: [['contractAddress', 'ASC']],
        transaction
      })).map(({contractAddress}) => ({contractAddress, holders: 0, transactions: 0}))
      const holderResults = await db.query(sql`
        SELECT contract_address AS contractAddress, COUNT(*) AS count FROM qrc721_token
        GROUP BY contractAddress ORDER BY contractAddress ASC
      `, {type: db.QueryTypes.SELECT, transaction})
      let i = 0
      for (const {contractAddress, count} of holderResults) {
        while (i < result.length) {
          const comparison = contractAddress.compare(result[i].contractAddress)
          if (comparison === 0) {
            result[i].holders = count
            break
          } else if (comparison < 0) {
            break
          } else {
            ++i
          }
        }
      }
      const transactionResults = await db.query(sql`
        SELECT address AS contractAddress, COUNT(*) AS count FROM evm_receipt_log USE INDEX (contract)
        WHERE topic1 = ${TransferABI.id}
        GROUP BY contractAddress ORDER BY contractAddress
      `, {type: db.QueryTypes.SELECT, transaction})
      let j = 0
      for (const {contractAddress, count} of transactionResults) {
        while (j < result.length) {
          const comparison = contractAddress.compare(result[j].contractAddress)
          if (comparison === 0) {
            result[j].transactions = count
            break
          } else if (comparison < 0) {
            break
          } else {
            ++j
          }
        }
      }
      await db.query(sql`DELETE FROM qrc721_statistics`, {transaction})
      await QRC721Statistics.bulkCreate(result, {validate: false, transaction, logging: false})
      await transaction.commit()
    } catch (err) {
      await transaction.rollback()
    }
  }
}

module.exports = QRC721Service
