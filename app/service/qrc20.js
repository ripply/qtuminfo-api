const {Service} = require('egg')

class QRC20Service extends Service {
  async getQRC20Summary(contractAddress) {
    const {Qrc20: QRC20, Qrc20Statistics: QRC20Statistics} = this.ctx.model
    const qrc20 = await QRC20.findOne({
      where: {contractAddress},
      attributes: ['name', 'symbol', 'decimals', 'totalSupply'],
      include: [{
        model: QRC20Statistics,
        as: 'statistics',
        required: true
      }]
    })
    return {
      address: contractAddress.toString('hex'),
      addressHex: contractAddress,
      name: qrc20.name,
      symbol: qrc20.symbol,
      decimals: qrc20.decimals,
      totalSupply: qrc20.totalSupply,
      holders: qrc20.statistics.holders,
      transactions: qrc20.statistics.transactions
    }
  }

  async getQRC20CirculatingSupply(contractAddress) {
    const {Qrc20: QRC20, Qrc20Balance: QRC20Balance} = this.ctx.model
    const qrc20 = await QRC20.findOne({
      where: {contractAddress},
      attributes: ['decimals', 'totalSupply']
    })
    const {balance} = await QRC20Balance.findOne({
      where: {
        contractAddress,
        address: Buffer.from('27813dfc39dee247fa191e27eaf6d63217a71b48', 'hex')
      },
      attributes: ['balance']
    })
    return Number(qrc20.totalSupply - balance) / 10 ** qrc20.decimals
  }

  async listQRC20Tokens() {
    const db = this.ctx.model
    const {Qrc20Statistics: QRC20Statistics} = db
    const {sql} = this.ctx.helper
    const {gt: $gt} = this.app.Sequelize.Op
    const {limit, offset} = this.ctx.state.pagination

    const totalCount = await QRC20Statistics.count({where: {transactions: {[$gt]: 0}}})
    const list = await db.query(sql`
      SELECT
        contract.address_string AS address, contract.address AS addressHex,
        qrc20.name AS name, qrc20.symbol AS symbol, qrc20.decimals AS decimals, qrc20.total_supply AS totalSupply,
        list.holders AS holders,
        list.transactions AS transactions
      FROM (
        SELECT contract_address, holders, transactions FROM qrc20_statistics
        WHERE transactions > 0
        ORDER BY transactions DESC
        LIMIT ${offset}, ${limit}
      ) list
      INNER JOIN qrc20 USING (contract_address)
      INNER JOIN contract ON contract.address = list.contract_address
      ORDER BY transactions DESC
    `, {type: db.QueryTypes.SELECT})

    return {
      totalCount,
      tokens: list.map(item => ({
        address: item.addressHex.toString('hex'),
        addressHex: item.addressHex,
        name: item.name.toString(),
        symbol: item.symbol.toString(),
        decimals: item.decimals,
        totalSupply: BigInt(`0x${item.totalSupply.toString('hex')}`),
        holders: item.holders,
        transactions: item.transactions
      }))
    }
  }

  async getAllQRC20Balances(hexAddresses) {
    if (hexAddresses.length === 0) {
      return []
    }
    const {OutputScript, Solidity} = this.app.qtuminfo.lib
    const transferABI = Solidity.qrc20ABIs.find(abi => abi.name === 'transfer')
    const {
      Address, TransactionOutput,
      Contract, EvmReceipt: EVMReceipt, Qrc20: QRC20, Qrc20Balance: QRC20Balance,
      where, col
    } = this.ctx.model
    const {in: $in} = this.app.Sequelize.Op
    const list = await QRC20.findAll({
      attributes: ['contractAddress', 'name', 'symbol', 'decimals'],
      include: [{
        model: Contract,
        as: 'contract',
        required: true,
        attributes: ['addressString'],
        include: [{
          model: QRC20Balance,
          as: 'qrc20Balances',
          required: true,
          where: {address: {[$in]: hexAddresses}},
          attributes: ['balance']
        }]
      }]
    })
    const mapping = new Map(list.map(item => [
      item.contract.addressString,
      {
        address: item.contractAddress.toString('hex'),
        addressHex: item.contractAddress,
        name: item.name,
        symbol: item.symbol,
        decimals: item.decimals,
        balance: item.contract.qrc20Balances.map(({balance}) => balance).reduce((x, y) => x + y),
        unconfirmed: {
          received: 0n,
          sent: 0n
        }
      }
    ]))
    const unconfirmedList = await EVMReceipt.findAll({
      where: {blockHeight: 0xffffffff},
      attributes: ['senderData'],
      include: [
        {
          model: TransactionOutput,
          as: 'output',
          on: {
            transactionId: where(col('output.transaction_id'), '=', col('evm_receipt.transaction_id')),
            outputIndex: where(col('output.output_index'), '=', col('evm_receipt.output_index'))
          },
          required: true,
          attributes: ['scriptPubKey'],
          include: [{
            model: Address,
            as: 'address',
            required: true,
            attributes: ['_id'],
            include: [{
              model: Contract,
              as: 'contract',
              required: true,
              attributes: ['address', 'addressString'],
              include: [{
                model: QRC20,
                as: 'qrc20',
                required: true,
                attributes: ['name', 'symbol', 'decimals']
              }]
            }]
          }]
        }
      ]
    })
    for (const item of unconfirmedList) {
      const scriptPubKey = OutputScript.fromBuffer(item.output.scriptPubKey)
      if (![OutputScript.EVM_CONTRACT_CALL, OutputScript.EVM_CONTRACT_CALL_SENDER].includes(scriptPubKey.type)) {
        continue
      }
      const byteCode = scriptPubKey.byteCode
      if (byteCode.length === 68
        && byteCode.slice(0, 4).compare(transferABI.id) === 0
        && byteCode.slice(4, 16).compare(Buffer.alloc(12)) === 0
      ) {
        let data = {}
        if (mapping.has(item.output.address.contract.addressString)) {
          data = mapping.get(item.output.address.contract.addressString)
        } else {
          data = {
            address: item.output.address.contract.address.toString('hex'),
            addressHex: item.output.address.contract.address,
            name: item.output.address.contract.qrc20.name,
            symbol: item.output.address.contract.qrc20.symbol,
            decimals: item.output.address.contract.qrc20.decimals,
            balance: 0n,
            unconfirmed: {
              received: 0n,
              sent: 0n
            },
            isUnconfirmed: true,
            isNew: true
          }
          mapping.set(item.output.address.contract.addressString, data)
        }
        const from = item.senderData
        const to = byteCode.slice(16, 36)
        const value = BigInt(`0x${byteCode.slice(36).toString('hex')}`)
        const isFrom = hexAddresses.some(address => address.compare(from) === 0)
        const isTo = hexAddresses.some(address => address.compare(to) === 0)
        if (isFrom || isTo) {
          delete data.isNew
        }
        if (isFrom && !isTo) {
          data.unconfirmed.sent += value
        } else if (!isFrom && isTo) {
          data.unconfirmed.received += value
        }
      }
    }
    return [...mapping.values()].filter(item => !item.isNew)
  }

  async getQRC20Balance(rawAddresses, tokenAddress) {
    const {Address: RawAddress, OutputScript, Solidity} = this.app.qtuminfo.lib
    const transferABI = Solidity.qrc20ABIs.find(abi => abi.name === 'transfer')
    const {
      Address, TransactionOutput,
      Contract, EvmReceipt: EVMReceipt, Qrc20: QRC20, Qrc20Balance: QRC20Balance,
      where, col
    } = this.ctx.model
    const {in: $in} = this.app.Sequelize.Op
    const hexAddresses = rawAddresses
      .filter(address => [RawAddress.PAY_TO_PUBLIC_KEY_HASH, RawAddress.CONTRACT, RawAddress.EVM_CONTRACT].includes(address.type))
      .map(address => address.data)
    if (hexAddresses.length === 0) {
      return []
    }
    const token = await QRC20.findOne({
      where: {contractAddress: tokenAddress},
      attributes: ['name', 'symbol', 'decimals']
    })
    const list = await QRC20Balance.findAll({
      where: {contractAddress: tokenAddress, address: {[$in]: hexAddresses}},
      attributes: ['balance']
    })
    const unconfirmedList = await EVMReceipt.findAll({
      where: {blockHeight: 0xffffffff},
      attributes: ['senderData'],
      include: [{
        model: TransactionOutput,
        as: 'output',
        on: {
          transactionId: where(col('output.transaction_id'), '=', col('evm_receipt.transaction_id')),
          outputIndex: where(col('output.output_index'), '=', col('evm_receipt.output_index'))
        },
        required: true,
        attributes: ['scriptPubKey'],
        include: [{
          model: Address,
          as: 'address',
          required: true,
          attributes: [],
          include: [{
            model: Contract,
            as: 'contract',
            required: true,
            where: {address: tokenAddress},
            attributes: []
          }]
        }]
      }]
    })
    const unconfirmed = {
      received: 0n,
      sent: 0n
    }
    for (const item of unconfirmedList) {
      const scriptPubKey = OutputScript.fromBuffer(item.output.scriptPubKey)
      if (![OutputScript.EVM_CONTRACT_CALL, OutputScript.EVM_CONTRACT_CALL_SENDER].includes(scriptPubKey.type)) {
        continue
      }
      const byteCode = scriptPubKey.byteCode
      if (byteCode.length === 68
        && byteCode.slice(0, 4).compare(transferABI.id) === 0
        && byteCode.slice(4, 16).compare(Buffer.alloc(12)) === 0
      ) {
        const from = item.senderData
        const to = byteCode.slice(16, 36)
        const value = BigInt(`0x${byteCode.slice(36).toString('hex')}`)
        const isFrom = hexAddresses.some(address => address.compare(from) === 0)
        const isTo = hexAddresses.some(address => address.compare(to) === 0)
        if (isFrom && !isTo) {
          unconfirmed.sent += value
        } else if (!isFrom && isTo) {
          unconfirmed.received += value
        }
      }
    }
    return {
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      balance: list.map(({balance}) => balance).reduce((x, y) => x + y, 0n),
      unconfirmed
    }
  }

  async getQRC20BalanceHistory(addresses, tokenAddress) {
    const TransferABI = this.app.qtuminfo.lib.Solidity.qrc20ABIs.find(abi => abi.name === 'Transfer')
    const db = this.ctx.model
    const {sql} = this.ctx.helper
    const {
      Header, Transaction,
      EvmReceipt: EVMReceipt, EvmReceiptLog: EVMReceiptLog,
      Contract, Qrc20: QRC20, Qrc20Balance: QRC20Balance,
      literal
    } = db
    const {ne: $ne, and: $and, or: $or, in: $in} = this.app.Sequelize.Op
    if (addresses.length === 0) {
      return {totalCount: 0, transactions: []}
    }
    const addressSet = new Set(addresses.map(address => address.toString('hex')))
    const topicAddresses = addresses.map(address => Buffer.concat([Buffer.alloc(12), address]))
    const {limit, offset, reversed = true} = this.ctx.state.pagination
    const order = reversed ? 'DESC' : 'ASC'
    const logFilter = [
      ...tokenAddress ? [sql`log.address = ${tokenAddress}`] : [],
      sql`log.topic1 = ${TransferABI.id}`,
      'log.topic3 IS NOT NULL',
      'log.topic4 IS NULL',
      sql`(log.topic2 IN ${topicAddresses} OR log.topic3 IN ${topicAddresses})`
    ].join(' AND ')

    const [{totalCount}] = await db.query(sql`
      SELECT COUNT(DISTINCT(receipt.transaction_id)) AS totalCount
      FROM evm_receipt receipt, evm_receipt_log log, qrc20
      WHERE receipt._id = log.receipt_id AND log.address = qrc20.contract_address AND ${{raw: logFilter}}
    `, {type: db.QueryTypes.SELECT})
    if (totalCount === 0) {
      return {totalCount: 0, transactions: []}
    }
    const ids = (await db.query(sql`
      SELECT transaction_id AS id FROM evm_receipt receipt
      INNER JOIN (
        SELECT DISTINCT(receipt.transaction_id) AS id FROM evm_receipt receipt, evm_receipt_log log, qrc20
        WHERE receipt._id = log.receipt_id AND log.address = qrc20.contract_address AND ${{raw: logFilter}}
      ) list ON list.id = receipt.transaction_id
      ORDER BY receipt.block_height ${{raw: order}}, receipt.index_in_block ${{raw: order}},
        receipt.transaction_id ${{raw: order}}, receipt.output_index ${{raw: order}}
      LIMIT ${offset}, ${limit}
    `, {type: db.QueryTypes.SELECT})).map(({id}) => id)

    let list = await EVMReceipt.findAll({
      where: {transactionId: {[$in]: ids}},
      attributes: ['blockHeight', 'indexInBlock'],
      include: [
        {
          model: Header,
          as: 'header',
          required: true,
          attributes: ['hash', 'timestamp']
        },
        {
          model: Transaction,
          as: 'transaction',
          required: true,
          attributes: ['id']
        },
        {
          model: EVMReceiptLog,
          as: 'logs',
          required: true,
          where: {
            ...tokenAddress ? {address: tokenAddress} : {},
            topic1: TransferABI.id,
            topic3: {[$ne]: null},
            topic4: null,
            [$or]: [
              {topic2: {[$in]: topicAddresses}},
              {topic3: {[$in]: topicAddresses}}
            ]
          },
          attributes: ['address', 'topic2', 'topic3', 'data'],
          include: [
            {
              model: Contract,
              as: 'contract',
              required: true,
              attributes: ['addressString']
            },
            {
              model: QRC20,
              as: 'qrc20',
              required: true,
              attributes: ['name', 'symbol', 'decimals']
            }
          ]
        }
      ],
      order: [['blockHeight', order], ['indexInBlock', order], ['transactionId', order], ['outputIndex', order]]
    })

    if (!reversed) {
      list = list.reverse()
    }
    const initialBalanceMap = new Map()
    if (list.length > 0) {
      const intialBalanceList = await QRC20Balance.findAll({
        where: {
          ...tokenAddress ? {contractAddress: tokenAddress} : {},
          address: {[$in]: addresses}
        },
        attributes: ['balance'],
        include: [{
          model: Contract,
          as: 'contract',
          required: true,
          attributes: ['addressString']
        }]
      })
      for (const {balance, contract} of intialBalanceList) {
        const address = contract.addressString
        initialBalanceMap.set(address, initialBalanceMap.get(address) ?? 0n + balance)
      }
      const {blockHeight, indexInBlock} = list[0]
      const latestLogs = await EVMReceiptLog.findAll({
        where: {
          ...tokenAddress ? {address: tokenAddress} : {},
          topic1: TransferABI.id,
          topic3: {[$ne]: null},
          topic4: null,
          [$or]: [
            {topic2: {[$in]: topicAddresses}},
            {topic3: {[$in]: topicAddresses}}
          ]
        },
        attributes: ['address', 'topic2', 'topic3', 'data'],
        include: [
          {
            model: EVMReceipt,
            as: 'receipt',
            required: true,
            where: {
              [$and]: literal(`(receipt.block_height, receipt.index_in_block) > (${blockHeight}, ${indexInBlock})`)
            }
          },
          {
            model: Contract,
            as: 'contract',
            required: true,
            attributes: ['addressString']
          }
        ]
      })
      for (const log of latestLogs) {
        const address = log.contract.addressString
        const amount = BigInt(`0x${log.data.toString('hex')}`)
        let balance = initialBalanceMap.get(address) ?? 0n
        if (addressSet.has(log.topic2.slice(12).toString('hex'))) {
          balance += amount
        }
        if (addressSet.has(log.topic3.slice(12).toString('hex'))) {
          balance -= amount
        }
        initialBalanceMap.set(address, balance)
      }
    }

    let transactions = list.map(({blockHeight, header, transaction, logs}) => {
      const result = {
        id: transaction.id,
        block: {
          hash: header.hash,
          height: blockHeight,
          timestamp: header.timestamp
        },
        confirmations: this.app.blockchainInfo.tip.height - blockHeight + 1,
        tokens: []
      }
      for (const log of logs) {
        const address = log.contract.addressString
        let delta = 0n
        const amount = BigInt(`0x${log.data.toString('hex')}`)
        if (addressSet.has(log.topic2.slice(12).toString('hex'))) {
          delta -= amount
        }
        if (addressSet.has(log.topic3.slice(12).toString('hex'))) {
          delta += amount
        }
        const item = result.tokens.find(token => token.address === address)
        if (item) {
          item.amount += delta
        } else {
          result.tokens.push({
            address,
            addressHex: log.address,
            name: log.qrc20.name.toString(),
            symbol: log.qrc20.symbol.toString(),
            decimals: log.qrc20.decimals,
            amount: delta
          })
        }
      }
      for (const token of result.tokens) {
        let initial = initialBalanceMap.get(token.address) ?? 0n
        token.balance = initial
        initial -= token.amount
        initialBalanceMap.set(token.address, initial)
        token.address = token.addressHex.toString('hex')
      }
      return result
    })
    if (!reversed) {
      transactions = transactions.reverse()
    }
    return {totalCount, transactions}
  }

  async getAllQRC20TokenTransactions() {
    const db = this.ctx.model
    const {EvmReceiptLogTag: EVMReceiptLogTag} = db
    const {sql} = this.ctx.helper
    const {limit, offset, reversed = true} = this.ctx.state.pagination
    const order = reversed ? 'DESC' : 'ASC'

    const totalCount = await EVMReceiptLogTag.count({where: {tag: 'qrc20_transfer'}})
    const transactions = await db.query(sql`
      SELECT
        transaction.id AS transactionId,
        evm_receipt.output_index AS outputIndex,
        evm_receipt.block_height AS blockHeight,
        header.hash AS blockHash,
        header.timestamp AS timestamp,
        contract.address AS addressHex,
        qrc20.name AS name,
        qrc20.symbol AS symbol,
        qrc20.decimals AS decimals,
        evm_receipt_log.topic2 AS topic2,
        evm_receipt_log.topic3 AS topic3,
        evm_receipt_log.data AS data
      FROM (
        SELECT log_id FROM evm_receipt_log_tag WHERE tag = 'qrc20_transfer'
        ORDER BY log_id ${{raw: order}} LIMIT ${offset}, ${limit}
      ) list
      INNER JOIN evm_receipt_log ON evm_receipt_log._id = list.log_id
      INNER JOIN evm_receipt ON evm_receipt._id = evm_receipt_log.receipt_id
      INNER JOIN qrc20 ON qrc20.contract_address = evm_receipt_log.address
      INNER JOIN contract ON contract.address = evm_receipt_log.address
      INNER JOIN transaction ON transaction._id = evm_receipt.transaction_id
      INNER JOIN header ON header.height = evm_receipt.block_height
      ORDER BY list.log_id ${{raw: order}}
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
          token: {
            address: transaction.addressHex,
            addressHex: transaction.addressHex.toString('hex'),
            name: transaction.name.toString(),
            symbol: transaction.symbol.toString(),
            decimals: transaction.decimals
          },
          ...from?.hex ? {from: from.hex.toString('hex'), fromHex: from.hex} : {from},
          ...to?.hex ? {to: to.hex.toString('hex'), toHex: to.hex} : {to},
          value: BigInt(`0x${transaction.data.toString('hex')}`)
        }
      })
    }
  }

  async getQRC20TokenTransactions(contractAddress) {
    const TransferABI = this.app.qtuminfo.lib.Solidity.qrc20ABIs.find(abi => abi.name === 'Transfer')
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
        list.data AS data
      FROM (
        SELECT _id, receipt_id, topic2, topic3, data FROM evm_receipt_log
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
          value: BigInt(`0x${transaction.data.toString('hex')}`)
        }
      })
    }
  }

  async getQRC20TokenRichList(contractAddress) {
    const db = this.ctx.model
    const {Qrc20Balance: QRC20Balance} = db
    const {ne: $ne} = this.app.Sequelize.Op
    const {limit, offset} = this.ctx.state.pagination

    const totalCount = await QRC20Balance.count({
      where: {contractAddress, balance: {[$ne]: Buffer.alloc(32)}}
    })
    const list = await QRC20Balance.findAll({
      where: {contractAddress, balance: {[$ne]: Buffer.alloc(32)}},
      attributes: ['address', 'balance'],
      order: [['balance', 'DESC']],
      limit,
      offset
    })
    const addresses = await this.ctx.service.contract.transformHexAddresses(list.map(item => item.address))
    return {
      totalCount,
      list: list.map(({balance}, index) => {
        const address = addresses[index]
        return {
          ...address?.hex ? {
            address: address.hex.toString('hex'),
            addressHex: address.hex.toString('hex')
          } : {address},
          balance
        }
      })
    }
  }

  async updateQRC20Statistics() {
    const TransferABI = this.app.qtuminfo.lib.Solidity.qrc20ABIs.find(abi => abi.name === 'Transfer')
    const db = this.ctx.model
    const {Qrc20: QRC20, Qrc20Statistics: QRC20Statistics} = db
    const {sql} = this.ctx.helper
    const transaction = await db.transaction()
    try {
      const result = (await QRC20.findAll({
        attributes: ['contractAddress'],
        order: [['contractAddress', 'ASC']],
        transaction
      })).map(({contractAddress}) => ({contractAddress, holders: 0, transactions: 0}))
      const balanceResults = await db.query(sql`
        SELECT contract_address AS contractAddress, COUNT(*) AS count FROM qrc20_balance
        WHERE balance != ${Buffer.alloc(32)}
        GROUP BY contractAddress ORDER BY contractAddress ASC
      `, {type: db.QueryTypes.SELECT, transaction})
      let i = 0
      for (const {contractAddress, count} of balanceResults) {
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
        GROUP BY contractAddress ORDER BY contractAddress ASC
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
      await db.query(sql`DELETE FROM qrc20_statistics`, {transaction})
      await QRC20Statistics.bulkCreate(result, {validate: false, transaction, logging: false})
      await transaction.commit()
    } catch (err) {
      await transaction.rollback()
    }
  }

  async updateQRC20TotalSupply(contractAddress) {
    const totalSupplyABI = this.app.qtuminfo.lib.Solidity.qrc20ABIs.find(abi => abi.name === 'totalSupply')
    const {Qrc20: QRC20} = this.ctx.model
    const {executionResult} = await this.ctx.service.contract.callContract(
      contractAddress.toString('hex'),
      totalSupplyABI.id.toString('hex')
    )
    if (executionResult.excepted === 'None') {
      const totalSupply = BigInt(`0x${executionResult.output}`)
      await QRC20.update({totalSupply}, {where: {contractAddress}})
      return totalSupply
    }
  }
}

module.exports = QRC20Service
