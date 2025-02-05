const {Service} = require('egg')

class ContractService extends Service {
  async getContractAddresses(list) {
    const {Address} = this.app.qtuminfo.lib
    const chain = this.app.chain
    const {Contract} = this.ctx.model

    const result = []
    for (const item of list) {
      let rawAddress
      try {
        rawAddress = Address.fromString(item, chain)
      } catch (err) {
        this.ctx.throw(400)
      }
      let filter
      if (rawAddress.type === Address.CONTRACT) {
        filter = {address: Buffer.from(item, 'hex')}
      } else if (rawAddress.type === Address.EVM_CONTRACT) {
        filter = {addressString: item}
      } else {
        this.ctx.throw(400)
      }
      const contractResult = await Contract.findOne({
        where: filter,
        attributes: ['address', 'addressString', 'vm', 'type']
      })
      this.ctx.assert(contractResult, 404)
      result.push(contractResult.address)
    }
    return result
  }

  async getContractSummary(contract) {
    const {
      contractAddress, vm, type,
      createHeight, createTransactionId, createOutputIndex, createBy,
      destructHeight, destructTransactionId, destructOutputIndex, destructBy,
      addressIds
    } = contract
    const {
      Qrc20: QRC20, Qrc20Statistics: QRC20Statistics,
      Qrc721: QRC721, Qrc721Statistics: QRC721Statistics
    } = this.ctx.model
    const {balance: balanceService, qrc20: qrc20Service, qrc721: qrc721Service} = this.ctx.service
    const qrc20 = await QRC20.findOne({
      where: {contractAddress},
      attributes: ['name', 'symbol'],
      include: [{
        model: QRC20Statistics,
        as: 'statistics',
        required: true
      }]
    })
    const qrc721 = await QRC721.findOne({
      where: {contractAddress},
      attributes: ['name', 'symbol'],
      include: [{
        model: QRC721Statistics,
        as: 'statistics',
        required: true
      }]
    })
    const [
      {totalReceived, totalSent},
      unconfirmed,
      qrc20Balances,
      qrc721Balances,
      transactionCount
    ] = await Promise.all([
      balanceService.getTotalBalanceChanges(addressIds),
      balanceService.getUnconfirmedBalance(addressIds),
      qrc20Service.getAllQRC20Balances([contractAddress]),
      qrc721Service.getAllQRC721Balances([contractAddress]),
      this.getContractBasicTransactionCount(contractAddress)
    ])
    return {
      address: contractAddress,
      addressHex: contractAddress,
      vm,
      type,
      createHeight,
      createTransactionId,
      createOutputIndex,
      createBy,
      destructHeight,
      destructTransactionId,
      destructOutputIndex,
      destructBy,
      ...type === 'qrc20' ? {
        qrc20: {
          name: qrc20.name,
          symbol: qrc20.symbol
        }
      } : {},
      ...type === 'qrc721' ? {
        qrc721: {
          name: qrc721.name,
          symbol: qrc721.symbol,
        }
      } : {},
      balance: totalReceived - totalSent,
      totalReceived,
      totalSent,
      unconfirmed,
      qrc20Balances,
      qrc721Balances,
      transactionCount
    }
  }

  async getContractTransactionCount(contractAddress, addressIds) {
    const TransferABI = this.app.qtuminfo.lib.Solidity.qrc20ABIs.find(abi => abi.name === 'Transfer')
    const db = this.ctx.model
    const {sql} = this.ctx.helper
    const topic = Buffer.concat([Buffer.alloc(12), contractAddress])
    const [{count}] = await db.query(sql`
      SELECT COUNT(*) AS count FROM (
        SELECT transaction_id FROM balance_change
        WHERE address_id IN ${addressIds} AND ${this.ctx.service.block.getRawBlockFilter()}
        UNION
        SELECT transaction_id FROM evm_receipt
        WHERE contract_address = ${contractAddress} AND ${this.ctx.service.block.getRawBlockFilter()}
        UNION
        SELECT receipt.transaction_id AS transaction_id FROM evm_receipt receipt, evm_receipt_log log
        WHERE log.receipt_id = receipt._id AND log.address = ${contractAddress}
          AND ${this.ctx.service.block.getRawBlockFilter('receipt.block_height')}
        UNION
        SELECT receipt.transaction_id AS transaction_id FROM evm_receipt receipt, evm_receipt_log log, contract
        WHERE log.receipt_id = receipt._id
          AND ${this.ctx.service.block.getRawBlockFilter('receipt.block_height')}
          AND contract.address = log.address AND contract.type IN ('qrc20', 'qrc721')
          AND log.topic1 = ${TransferABI.id}
          AND (log.topic2 = ${topic} OR log.topic3 = ${topic})
          AND (
            (contract.type = 'qrc20' AND log.topic3 IS NOT NULL AND log.topic4 IS NULL)
            OR (contract.type = 'qrc721' AND log.topic4 IS NOT NULL)
          )
      ) list
    `, {type: db.QueryTypes.SELECT})
    return count
  }

  async getContractTransactions(contractAddress, addressIds) {
    const TransferABI = this.app.qtuminfo.lib.Solidity.qrc20ABIs.find(abi => abi.name === 'Transfer')
    const db = this.ctx.model
    const {sql} = this.ctx.helper
    const {limit, offset, reversed = true} = this.ctx.state.pagination
    const order = reversed ? 'DESC' : 'ASC'
    const topic = Buffer.concat([Buffer.alloc(12), contractAddress])
    const totalCount = await this.getContractTransactionCount(contractAddress, addressIds)
    const transactions = await db.query(sql`
      SELECT tx.id AS id FROM (
        SELECT block_height, index_in_block, _id FROM (
          SELECT block_height, index_in_block, transaction_id AS _id FROM balance_change
          WHERE address_id IN ${addressIds} AND ${this.ctx.service.block.getRawBlockFilter()}
          UNION
          SELECT block_height, index_in_block, transaction_id AS _id FROM evm_receipt
          WHERE contract_address = ${contractAddress} AND ${this.ctx.service.block.getRawBlockFilter()}
          UNION
          SELECT receipt.block_height AS block_height, receipt.index_in_block AS index_in_block, receipt.transaction_id AS _id
          FROM evm_receipt receipt, evm_receipt_log log
          WHERE log.receipt_id = receipt._id AND log.address = ${contractAddress}
            AND ${this.ctx.service.block.getRawBlockFilter('receipt.block_height')}
          UNION
          SELECT receipt.block_height AS block_height, receipt.index_in_block AS index_in_block, receipt.transaction_id AS _id
          FROM evm_receipt receipt, evm_receipt_log log, contract
          WHERE log.receipt_id = receipt._id
            AND ${this.ctx.service.block.getRawBlockFilter('receipt.block_height')}
            AND contract.address = log.address AND contract.type IN ('qrc20', 'qrc721')
            AND log.topic1 = ${TransferABI.id}
            AND (log.topic2 = ${topic} OR log.topic3 = ${topic})
            AND (
              (contract.type = 'qrc20' AND log.topic3 IS NOT NULL AND log.topic4 IS NULL)
              OR (contract.type = 'qrc721' AND log.topic4 IS NOT NULL)
            )
        ) list
        ORDER BY block_height ${{raw: order}}, index_in_block ${{raw: order}}, _id ${{raw: order}}
        LIMIT ${offset}, ${limit}
      ) list, transaction tx
      WHERE tx._id = list._id
      ORDER BY list.block_height ${{raw: order}}, list.index_in_block ${{raw: order}}, list._id ${{raw: order}}
    `, {type: db.QueryTypes.SELECT}).map(({id}) => id)
    return {totalCount, transactions}
  }

  async getContractBasicTransactionCount(contractAddress) {
    const {EvmReceipt: EVMReceipt} = this.ctx.model
    return await EVMReceipt.count({
      where: {
        contractAddress,
        ...this.ctx.service.block.getBlockFilter()
      }
    })
  }

  async getContractBasicTransactions(contractAddress) {
    const {Address, OutputScript} = this.app.qtuminfo.lib
    const {
      Header, Transaction, TransactionOutput, Contract, EvmReceipt: EVMReceipt, EvmReceiptLog: EVMReceiptLog,
      where, col
    } = this.ctx.model
    const {in: $in} = this.app.Sequelize.Op
    const {limit, offset, reversed = true} = this.ctx.state.pagination
    const order = reversed ? 'DESC' : 'ASC'
    const totalCount = await this.getContractBasicTransactionCount(contractAddress)
    const receiptIds = (await EVMReceipt.findAll({
      where: {
        contractAddress,
        ...this.ctx.service.block.getBlockFilter()
      },
      attributes: ['_id'],
      order: [['blockHeight', order], ['indexInBlock', order], ['transactionId', order], ['outputIndex', order]],
      limit,
      offset
    })).map(receipt => receipt._id)
    const receipts = await EVMReceipt.findAll({
      where: {_id: {[$in]: receiptIds}},
      include: [
        {
          model: Header,
          as: 'header',
          required: false,
          attributes: ['hash', 'timestamp']
        },
        {
          model: Transaction,
          as: 'transaction',
          required: true,
          attributes: ['id']
        },
        {
          model: TransactionOutput,
          as: 'output',
          on: {
            transactionId: where(col('output.transaction_id'), '=', col('evm_receipt.transaction_id')),
            outputIndex: where(col('output.output_index'), '=', col('evm_receipt.output_index'))
          },
          required: true,
          attributes: ['scriptPubKey', 'value']
        },
        {
          model: EVMReceiptLog,
          as: 'logs',
          required: false,
          include: [{
            model: Contract,
            as: 'contract',
            required: true,
            attributes: ['addressString']
          }]
        },
        {
          model: Contract,
          as: 'contract',
          required: true,
          attributes: ['addressString']
        }
      ],
      order: [['blockHeight', order], ['indexInBlock', order], ['transactionId', order], ['outputIndex', order]]
    })
    const transactions = receipts.map(receipt => ({
      transactionId: receipt.transaction.id,
      outputIndex: receipt.outputIndex,
      ...receipt.header ? {
        blockHeight: receipt.blockHeight,
        blockHash: receipt.header.hash,
        timestamp: receipt.header.timestamp,
        confirmations: this.app.blockchainInfo.tip.height - receipt.blockHeight + 1
      } : {confirmations: 0},
      scriptPubKey: OutputScript.fromBuffer(receipt.output.scriptPubKey),
      value: receipt.output.value,
      sender: new Address({type: receipt.senderType, data: receipt.senderData, chain: this.app.chain}),
      gasUsed: receipt.gasUsed,
      contractAddress: receipt.contractAddress.toString('hex'),
      contractAddressHex: receipt.contractAddress,
      excepted: receipt.excepted,
      exceptedMessage: receipt.exceptedMessage,
      evmLogs: receipt.logs.sort((x, y) => x.logIndex - y.logIndex).map(log => ({
        address: log.address.toString('hex'),
        addressHex: log.address,
        topics: this.ctx.service.transaction.transformTopics(log),
        data: log.data
      }))
    }))
    return {totalCount, transactions}
  }

  async callContract(contract, data, sender) {
    const client = new this.app.qtuminfo.rpc(this.app.config.qtuminfo.rpc)
    return await client.callcontract(
      contract.toString('hex'),
      data.toString('hex'),
      ...sender == null ? [] : [sender.toString('hex')]
    )
  }

  async searchLogs({contract, topic1, topic2, topic3, topic4} = {}) {
    const {Address} = this.app.qtuminfo.lib
    const db = this.ctx.model
    const {Header, Transaction, EvmReceipt: EVMReceipt, EvmReceiptLog: EVMReceiptLog, Contract} = db
    const {in: $in} = this.ctx.app.Sequelize.Op
    const {sql} = this.ctx.helper
    const {limit, offset} = this.ctx.state.pagination

    const blockFilter = this.ctx.service.block.getRawBlockFilter('receipt.block_height')
    const contractFilter = contract ? sql`log.address = ${contract}` : 'TRUE'
    const topic1Filter = topic1 ? sql`log.topic1 = ${topic1}` : 'TRUE'
    const topic2Filter = topic2 ? sql`log.topic2 = ${topic2}` : 'TRUE'
    const topic3Filter = topic3 ? sql`log.topic3 = ${topic3}` : 'TRUE'
    const topic4Filter = topic4 ? sql`log.topic4 = ${topic4}` : 'TRUE'

    const [{count: totalCount}] = await db.query(sql`
      SELECT COUNT(DISTINCT(log._id)) AS count from evm_receipt receipt, evm_receipt_log log
      WHERE receipt._id = log.receipt_id AND ${blockFilter} AND ${{raw: contractFilter}}
        AND ${{raw: topic1Filter}} AND ${{raw: topic2Filter}} AND ${{raw: topic3Filter}} AND ${{raw: topic4Filter}}
    `, {type: db.QueryTypes.SELECT})
    if (totalCount === 0) {
      return {totalCount, logs: []}
    }

    const ids = (await db.query(sql`
      SELECT log._id AS _id from evm_receipt receipt, evm_receipt_log log
      WHERE receipt._id = log.receipt_id AND ${blockFilter} AND ${{raw: contractFilter}}
        AND ${{raw: topic1Filter}} AND ${{raw: topic2Filter}} AND ${{raw: topic3Filter}} AND ${{raw: topic4Filter}}
      ORDER BY log._id ASC
      LIMIT ${offset}, ${limit}
    `, {type: db.QueryTypes.SELECT})).map(log => log._id)

    const logs = await EVMReceiptLog.findAll({
      where: {_id: {[$in]: ids}},
      attributes: ['topic1', 'topic2', 'topic3', 'topic4', 'data'],
      include: [
        {
          model: EVMReceipt,
          as: 'receipt',
          required: true,
          attributes: ['transactionId', 'outputIndex', 'blockHeight', 'senderType', 'senderData'],
          include: [
            {
              model: Transaction,
              as: 'transaction',
              required: true,
              attributes: ['id'],
              include: [{
                model: Header,
                as: 'header',
                required: true,
                attributes: ['hash', 'height', 'timestamp']
              }]
            },
            {
              model: Contract,
              as: 'contract',
              required: true,
              attributes: ['address', 'addressString']
            }
          ]
        },
        {
          model: Contract,
          as: 'contract',
          required: true,
          attributes: ['address', 'addressString']
        }
      ],
      order: [['_id', 'ASC']]
    })

    return {
      totalCount,
      logs: logs.map(log => ({
        transactionId: log.receipt.transaction.id,
        outputIndex: log.receipt.outputIndex,
        blockHeight: log.receipt.transaction.header.height,
        blockHash: log.receipt.transaction.header.hash,
        timestamp: log.receipt.transaction.header.timestamp,
        sender: new Address({type: log.receipt.senderType, data: log.receipt.senderData, chain: this.app.chain}),
        contractAddress: log.receipt.contract.address.toString('hex'),
        contractAddressHex: log.receipt.contract.address,
        address: log.contract.address.toString('hex'),
        addressHex: log.contract.address,
        topics: this.ctx.service.transaction.transformTopics(log),
        data: log.data
      }))
    }
  }

  async updateEVMLogTags() {
    const TransferABI = this.app.qtuminfo.lib.Solidity.qrc20ABIs.find(abi => abi.name === 'Transfer')
    const db = this.ctx.model
    const {EvmReceiptLogTag: EVMReceiptLogTag} = db
    const {sql} = this.ctx.helper

    const logs = await db.query(sql`
      SELECT log._id AS _id, log.topic2 AS topic2, log.topic3 AS topic3, log.data AS data FROM qrc20, evm_receipt_log log
      WHERE qrc20.contract_address = log.address AND log.topic1 = ${TransferABI.id}
        AND log._id > (SELECT MAX(log_id) FROM evm_receipt_log_tag)
    `, {type: db.QueryTypes.SELECT})
    await EVMReceiptLogTag.bulkCreate(
      logs.map(log => ({tag: 'qrc20_transfer', logId: log._id})),
      {validate: false, logging: false}
    )
  }

  async createSolidityABI(tag, abiList) {
    const {Solidity} = this.app.qtuminfo.lib
    const {EvmFunctionAbi: EVMFunctionABI, EvmEventAbi: EVMEventABI} = this.ctx.model
    const functionABIs = abiList.filter(abi => abi.type !== 'event').map(abi => new Solidity.MethodABI(abi))
    const eventABIs = abiList.filter(abi => abi.type === 'event').map(abi => new Solidity.EventABI(abi))
    await EVMFunctionABI.bulkCreate(functionABIs.map(abi => ({
      id: abi.id,
      type: abi.type,
      name: abi.name ?? '',
      inputs: abi.inputs ?? [],
      outputs: abi.outputs ?? [],
      stateMutability: abi.stateMutability,
      contractTag: tag
    })), {updateOnDuplicates: ['type', 'name', 'inputs', 'outputs', 'stateMutability']})
    await EVMEventABI.bulkCreate(eventABIs.map(abi => ({
      id: abi.id,
      name: abi.name,
      inputs: abi.inputs,
      anonymous: abi.anonymous,
      contractTag: tag
    })), {updateOnDuplicates: ['name', 'inputs', 'anonymous']})
  }

  async transformHexAddresses(addresses) {
    if (addresses.length === 0) {
      return []
    }
    const {Contract} = this.ctx.model
    const {in: $in} = this.app.Sequelize.Op
    const {Address} = this.app.qtuminfo.lib
    const result = addresses.map(address => address.compare(Buffer.alloc(20)) === 0 ? null : address)

    const contracts = await Contract.findAll({
      where: {address: {[$in]: addresses.filter(address => address.compare(Buffer.alloc(20)) !== 0)}},
      attributes: ['address', 'addressString']
    })
    const mapping = new Map(contracts.map(({address, addressString}) => [address.toString('hex'), addressString]))
    for (let i = 0; i < result.length; ++i) {
      if (result[i]) {
        const string = mapping.get(result[i].toString('hex'))
        if (string) {
          result[i] = {string, hex: result[i]}
        } else {
          result[i] = new Address({
            type: Address.PAY_TO_PUBLIC_KEY_HASH,
            data: result[i],
            chain: this.app.chain
          }).toString()
        }
      }
    }
    return result
  }
}

module.exports = ContractService
