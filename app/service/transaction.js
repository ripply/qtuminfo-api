const {Service} = require('egg')

class TransactionService extends Service {
  async getTransaction(id) {
    const {
      Header, Address,
      Transaction, Witness, TransactionOutput, TransactionInput, GasRefund,
      EvmReceipt: EVMReceipt, EvmReceiptLog: EVMReceiptLog, ContractSpend,
      Contract, Qrc20: QRC20, Qrc721: QRC721,
      where, col
    } = this.ctx.model
    const {in: $in} = this.app.Sequelize.Op
    const {Address: RawAddress} = this.app.qtuminfo.lib

    let cache = this.ctx.service.cache.getLRUCache('transaction')
    let transaction = await Transaction.findOne({
      where: {id},
      include: [
        {
          model: Header,
          as: 'header',
          required: false,
          attributes: ['hash', 'timestamp']
        },
        {
          model: ContractSpend,
          as: 'contractSpendSource',
          required: false,
          attributes: ['destId'],
          include: [{
            model: Transaction,
            as: 'destTransaction',
            required: true,
            attributes: ['id']
          }]
        }
      ]
    })
    if (!transaction) {
      await cache.del(id.toString('hex'))
      return null
    }
    let cachedTransaction = await cache.get(id.toString('hex'))
    if (cachedTransaction) {
      if (transaction.header) {
        cachedTransaction.blockHash = transaction.header.hash.toString('hex')
        cachedTransaction.blockHeight = transaction.blockHeight
        cachedTransaction.timestamp = transaction.header.timestamp
        cachedTransaction.confirmations = this.app.blockchainInfo.tip.height - cachedTransaction.blockHeight + 1
      }
      return cachedTransaction
    }

    let witnesses = await Witness.findAll({
      where: {transactionId: id},
      attributes: ['inputIndex', 'script'],
      order: [['inputIndex', 'ASC'], ['witnessIndex', 'ASC']]
    })

    let inputs = await TransactionInput.findAll({
      where: {transactionId: transaction._id},
      include: [
        {
          model: Transaction,
          as: 'outputTransaction',
          required: false,
          attributes: ['id']
        },
        {
          model: TransactionOutput,
          as: 'output',
          on: {
            transactionId: where(col('output.transaction_id'), '=', col('transaction_input.output_id')),
            outputIndex: where(col('output.output_index'), '=', col('transaction_input.output_index'))
          },
          required: false,
          attributes: ['outputIndex', 'scriptPubKey']
        },
        {
          model: Address,
          as: 'address',
          required: false,
          attributes: ['type', 'string'],
          include: [{
            model: Contract,
            as: 'contract',
            required: false,
            attributes: ['address', 'addressString']
          }]
        }
      ],
      order: [['inputIndex', 'ASC']]
    })
    let outputs = await TransactionOutput.findAll({
      where: {transactionId: transaction._id},
      include: [
        {
          model: Transaction,
          as: 'inputTransaction',
          required: false,
          attributes: ['id']
        },
        {
          model: TransactionInput,
          as: 'input',
          on: {
            transactionId: where(col('input.transaction_id'), '=', col('transaction_output.input_id')),
            outputIndex: where(col('input.input_index'), '=', col('transaction_output.input_index'))
          },
          required: false,
          attributes: []
        },
        {
          model: Address,
          as: 'address',
          required: false,
          attributes: ['type', 'string'],
          include: [{
            model: Contract,
            as: 'contract',
            required: false,
            attributes: ['address', 'addressString']
          }]
        },
        {
          model: GasRefund,
          as: 'refund',
          on: {
            transactionId: where(col('refund.transaction_id'), '=', transaction._id),
            outputIndex: where(col('refund.output_index'), '=', col('transaction_output.output_index'))
          },
          required: false,
          attributes: ['refundIndex'],
          include: [
            {
              model: Transaction,
              as: 'refundToTransaction',
              required: true,
              attributes: ['id']
            },
            {
              model: TransactionOutput,
              as: 'refundTo',
              on: {
                transactionId: where(col('refund->refundTo.transaction_id'), '=', col('refund.refund_id')),
                outputIndex: where(col('refund->refundTo.output_index'), '=', col('refund.refund_index'))
              },
              required: true,
              attributes: ['value']
            }
          ]
        },
        {
          model: GasRefund,
          as: 'refundTo',
          on: {
            transactionId: where(col('refundTo.refund_id'), '=', transaction._id),
            outputIndex: where(col('refundTo.refund_index'), '=', col('transaction_output.output_index'))
          },
          required: false,
          attributes: ['outputIndex'],
          include: [{
            model: Transaction,
            as: 'transaction',
            required: true,
            attributes: ['id']
          }]
        },
        {
          model: EVMReceipt,
          as: 'evmReceipt',
          on: {
            transactionId: where(col('evmReceipt.transaction_id'), '=', transaction._id),
            outputIndex: where(col('evmReceipt.output_index'), '=', col('transaction_output.output_index'))
          },
          required: false,
          include: [{
            model: Contract,
            as: 'contract',
            required: false,
            attributes: ['addressString']
          }]
        }
      ],
      order: [['outputIndex', 'ASC']]
    })

    let eventLogs = []
    let contractSpends = []

    if (outputs.some(output => output.evmReceipt)) {
      eventLogs = await EVMReceiptLog.findAll({
        where: {receiptId: {[$in]: outputs.filter(output => output.evmReceipt).map(output => output.evmReceipt._id)}},
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
            required: false,
            attributes: ['name', 'symbol', 'decimals']
          },
          {
            model: QRC721,
            as: 'qrc721',
            required: false,
            attributes: ['name', 'symbol']
          }
        ],
        order: [['_id', 'ASC']]
      })
      let contractSpendIds = (await Transaction.findAll({
        attributes: ['_id'],
        include: [{
          model: ContractSpend,
          as: 'contractSpendSource',
          required: true,
          attributes: [],
          where: {destId: transaction._id}
        }],
        order: [['blockHeight', 'ASC'], ['indexInBlock', 'ASC']]
      })).map(item => item._id)
      if (contractSpendIds.length) {
        let inputs = await TransactionInput.findAll({
          where: {transactionId: {[$in]: contractSpendIds}},
          attributes: ['transactionId', 'value'],
          include: [{
            model: Address,
            as: 'address',
            required: false,
            attributes: ['type', 'string'],
            include: [{
              model: Contract,
              as: 'contract',
              required: false,
              attributes: ['address', 'addressString']
            }]
          }],
          order: [['inputIndex', 'ASC']]
        })
        let outputs = await TransactionOutput.findAll({
          where: {transactionId: {[$in]: contractSpendIds}},
          attributes: ['transactionId', 'value'],
          include: [{
            model: Address,
            as: 'address',
            required: false,
            attributes: ['type', 'string'],
            include: [{
              model: Contract,
              as: 'contract',
              required: false,
              attributes: ['address', 'addressString']
            }]
          }],
          order: [['outputIndex', 'ASC']]
        })
        for (let id of contractSpendIds) {
          contractSpends.push({
            inputs: inputs.filter(input => input.transactionId === id).map(input => {
              let result = {}
              if (input.address) {
                if ([RawAddress.CONTRACT, RawAddress.EVM_CONTRACT].includes(input.address.type) && input.address.contract) {
                  result.address = input.address.contract.address.toString('hex')
                  result.addressHex = input.address.contract.address
                } else {
                  result.address = input.address.string
                }
              }
              result.value = input.value
              return result
            }),
            outputs: outputs.filter(output => output.transactionId === id).map(output => {
              let result = {}
              if (output.address) {
                if ([RawAddress.CONTRACT, RawAddress.EVM_CONTRACT].includes(output.address.type) && output.address.contract) {
                  result.address = output.address.contract.address.toString('hex')
                  result.addressHex = output.address.contract.address
                } else {
                  result.address = output.address.string
                }
              }
              result.value = output.value
              return result
            })
          })
        }
      }
    }

    let result = await this.transformTransaction({
      id: transaction.id,
      hash: transaction.hash,
      version: transaction.version,
      flag: transaction.flag,
      inputs: inputs.map((input, index) => {
        let inputObject = {
          prevTxId: input.outputTransaction ? input.outputTransaction.id : Buffer.alloc(32),
          outputIndex: input.outputIndex,
          scriptSig: input.scriptSig,
          sequence: input.sequence,
          witness: witnesses.filter(({inputIndex}) => inputIndex === index).map(({script}) => script),
          value: input.value,
          scriptPubKey: input.output?.scriptPubKey
        }
        if (input.address) {
          if ([RawAddress.CONTRACT, RawAddress.EVM_CONTRACT].includes(input.address.type)) {
            if (input.address.contract) {
              inputObject.address = input.address.contract.address.toString('hex')
              inputObject.addressHex = input.address.contract.address
            } else {
              let address = RawAddress.fromString(input.address.string, this.app.chain)
              inputObject.address = address.data.toString('hex')
              inputObject.addressHex = address.data
              inputObject.isInvalidContract = true
            }
          } else {
            inputObject.address = input.address.string
          }
        }
        return inputObject
      }),
      outputs: outputs.map(output => {
        let outputObject = {
          scriptPubKey: output.scriptPubKey,
          value: output.value
        }
        if (output.address) {
          if ([RawAddress.CONTRACT, RawAddress.EVM_CONTRACT].includes(output.address.type)) {
            if (output.address.contract) {
              outputObject.address = output.address.contract.address.toString('hex')
              outputObject.addressHex = output.address.contract.address
            } else {
              let address = RawAddress.fromString(output.address.string, this.app.chain)
              outputObject.address = address.data.toString('hex')
              outputObject.addressHex = address.data
              outputObject.isInvalidContract = true
            }
          } else {
            outputObject.address = output.address.string
          }
        }
        if (output.inputTransaction) {
          outputObject.spentTxId = output.inputTransaction.id
          outputObject.spentIndex = output.inputIndex
        }
        if (output.refund) {
          outputObject.refundTxId = output.refund.refundToTransaction.id
          outputObject.refundIndex = output.refund.refundIndex
          outputObject.refundValue = output.refund.refundTo.value
        }
        if (output.refundTo) {
          outputObject.isRefund = true
        }
        if (output.evmReceipt) {
          outputObject.evmReceipt = {
            sender: new RawAddress({
              type: output.evmReceipt.senderType,
              data: output.evmReceipt.senderData,
              chain: this.app.chain
            }).toString(),
            gasUsed: output.evmReceipt.gasUsed,
            contractAddress: output.evmReceipt.contractAddress.toString('hex'),
            contractAddressHex: output.evmReceipt.contractAddress,
            excepted: output.evmReceipt.excepted,
            exceptedMessage: output.evmReceipt.exceptedMessage
          }
          outputObject.evmReceipt.logs = eventLogs.filter(log => log.receiptId === output.evmReceipt._id).map(log => ({
            address: log.address.toString('hex'),
            addressHex: log.address,
            topics: this.transformTopics(log),
            data: log.data,
            ...log.qrc20 ? {
              qrc20: {
                name: log.qrc20.name,
                symbol: log.qrc20.symbol,
                decimals: log.qrc20.decimals
              }
            } : {},
            ...log.qrc721 ? {
              qrc721: {
                name: log.qrc721.name,
                symbol: log.qrc721.symbol
              }
            } : {}
          }))
        }
        return outputObject
      }),
      lockTime: transaction.lockTime,
      ...transaction.header ? {
        block: {
          hash: transaction.header.hash,
          height: transaction.blockHeight,
          timestamp: transaction.header.timestamp,
        }
      } : {},
      contractSpendSource: transaction.contractSpendSource?.destTransaction.id,
      contractSpends,
      size: transaction.size,
      weight: transaction.weight
    })
    await cache.set(id.toString('hex'), result)
    return result
  }

  async getRawTransaction(id) {
    const {Transaction, Witness, TransactionOutput, TransactionInput} = this.ctx.model
    const {Transaction: RawTransaction, Input, Output, OutputScript} = this.app.qtuminfo.lib

    let transaction = await Transaction.findOne({
      where: {id},
      attributes: ['_id', 'version', 'flag', 'lockTime']
    })
    if (!transaction) {
      return null
    }
    let witnesses = await Witness.findAll({
      where: {transactionId: id},
      attributes: ['inputIndex', 'script'],
      order: [['inputIndex', 'ASC'], ['witnessIndex', 'ASC']]
    })

    let inputs = await TransactionInput.findAll({
      where: {transactionId: transaction._id},
      attributes: ['outputIndex', 'scriptSig', 'sequence'],
      include: [{
        model: Transaction,
        as: 'outputTransaction',
        required: false,
        attributes: ['id'],
      }],
      order: [['inputIndex', 'ASC']]
    })
    let outputs = await TransactionOutput.findAll({
      where: {transactionId: transaction._id},
      attributes: ['value', 'scriptPubKey'],
      order: [['outputIndex', 'ASC']]
    })

    return new RawTransaction({
      version: transaction.version,
      flag: transaction.flag,
      inputs: inputs.map((input, index) => new Input({
        prevTxId: input.outputTransaction ? input.outputTransaction.id : Buffer.alloc(32),
        outputIndex: input.outputIndex,
        scriptSig: input.scriptSig,
        sequence: input.sequence,
        witness: witnesses.filter(({inputIndex}) => inputIndex === index).map(({script}) => script)
      })),
      outputs: outputs.map(output => new Output({
        value: output.value,
        scriptPubKey: OutputScript.fromBuffer(output.scriptPubKey)
      })),
      lockTime: transaction.lockTime
    })
  }

  async getRecentTransactions(count = 10) {
    const {Transaction} = this.ctx.model
    const {or: $or, gt: $gt, lte: $lte} = this.app.Sequelize.Op

    return (await Transaction.findAll({
      where: {
        indexInBlock: {[$gt]: 0},
        [$or]: [
          {blockHeight: {[$lte]: this.app.chain.lastPoWBlockHeight}},
          {indexInBlock: {[$gt]: 1}}
        ]
      },
      attributes: ['id'],
      order: [['blockHeight', 'DESC'], ['indexInBlock', 'DESC'], ['_id', 'DESC']],
      limit: count
    })).map(tx => tx.id)
  }

  async getAllTransactions() {
    const db = this.ctx.model
    const {Block, Transaction} = this.ctx.model
    const {sql} = this.ctx.helper
    let {limit, offset} = this.ctx.state.pagination
    let totalCount = await Block.aggregate('txs', 'SUM') + await Transaction.count({where: {blockHeight: 0xffffffff}})
    let list = await db.query(sql`
      SELECT tx.id AS id FROM (
        SELECT _id, block_height, index_in_block FROM transaction
        ORDER BY block_height DESC, index_in_block DESC, _id DESC
        LIMIT ${offset}, ${limit}
      ) list
      INNER JOIN transaction tx USING (_id)
      ORDER BY list.block_height DESC, list.index_in_block DESC, list._id DESC
    `, {type: db.QueryTypes.SELECT})
    return {totalCount, ids: list.map(({id}) => id)}
  }

  async getLatestTransactions(count = 20) {
    const {Block, Transaction} = this.ctx.model
    let totalCount = await Block.aggregate('txs', 'SUM') + await Transaction.count({where: {blockHeight: 0xffffffff}})
    let list = await Transaction.findAll({
      attributes: ['id'],
      order: [['blockHeight', 'DESC'], ['indexInBlock', 'DESC'], ['_id', 'DESC']],
      offset: 0,
      limit: count
    })
    return {totalCount, ids: list.map(({id}) => id)}
  }

  async getMempoolTransactionAddresses(id) {
    const {Address: RawAddress} = this.app.qtuminfo.lib
    const {Address, Transaction, BalanceChange, EvmReceipt: EVMReceipt} = this.ctx.model
    let balanceChanges = await BalanceChange.findAll({
      attributes: [],
      include: [
        {
          model: Transaction,
          as: 'transaction',
          required: true,
          where: {id},
          attributes: []
        },
        {
          model: Address,
          as: 'address',
          required: true,
          attributes: ['string']
        }
      ]
    })
    let receipts = await EVMReceipt.findAll({
      attributes: ['senderType', 'senderData'],
      include: [{
        model: Transaction,
        as: 'transaction',
        required: true,
        where: {id},
        attributes: []
      }]
    })
    let addresses = new Set(balanceChanges.map(item => item.address.string))
    for (let receipt of receipts) {
      addresses.add(new RawAddress({type: receipt.senderType, data: receipt.senderData, chain: this.app.chain}).toString())
    }
    return [...addresses]
  }

  async sendRawTransaction(data) {
    let client = new this.app.qtuminfo.rpc(this.app.config.qtuminfo.rpc)
    let id = await client.sendrawtransaction(data.toString('hex'))
    return Buffer.from(id, 'hex')
  }

  async transformTransaction(transaction) {
    let confirmations = transaction.block ? this.app.blockchainInfo.tip.height - transaction.block.height + 1 : 0
    let inputValue = transaction.inputs.map(input => input.value).reduce((x, y) => x + y)
    let outputValue = transaction.outputs.map(output => output.value).reduce((x, y) => x + y)
    let refundValue = transaction.outputs
      .map(output => output.refundValue)
      .filter(Boolean)
      .reduce((x, y) => x + y, 0n)
    let refundToValue = transaction.outputs
      .filter(output => output.isRefund)
      .map(output => output.value)
      .reduce((x, y) => x + y, 0n)
    let inputs = transaction.inputs.map((input, index) => this.transformInput(input, index, transaction))
    let outputs = await Promise.all(transaction.outputs.map((output, index) => this.transformOutput(output, index)))

    let [qrc20TokenTransfers, qrc20TokenUnconfirmedTransfers, qrc721TokenTransfers] = await Promise.all([
      this.transformQRC20Transfers(transaction.outputs),
      confirmations === 0 ? this.transformQRC20UnconfirmedTransfers(transaction.outputs) : undefined,
      this.transformQRC721Transfers(transaction.outputs)
    ])

    return {
      id: transaction.id.toString('hex'),
      hash: transaction.hash.toString('hex'),
      version: transaction.version,
      lockTime: transaction.lockTime,
      blockHash: transaction.block?.hash.toString('hex'),
      blockHeight: transaction.block?.height,
      timestamp: transaction.block?.timestamp,
      confirmations,
      inputs,
      outputs,
      isCoinbase: isCoinbase(transaction.inputs[0]),
      isCoinstake: isCoinstake(transaction),
      inputValue: inputValue.toString(),
      outputValue: outputValue.toString(),
      refundValue: refundValue.toString(),
      fees: (inputValue - outputValue - refundValue + refundToValue).toString(),
      size: transaction.size,
      weight: transaction.weight,
      contractSpendSource: transaction.contractSpendSource?.toString('hex'),
      contractSpends: transaction.contractSpends.length
        ? transaction.contractSpends.map(({inputs, outputs}) => ({
          inputs: inputs.map(input => ({
            address: input.addressHex.toString('hex'),
            addressHex: input.addressHex.toString('hex'),
            value: input.value.toString()
          })),
          outputs: outputs.map(output => ({
            address: output.addressHex ? output.addressHex.toString('hex') : output.address,
            addressHex: output.addressHex?.toString('hex'),
            value: output.value.toString()
          }))
        }))
        : undefined,
      qrc20TokenTransfers,
      qrc20TokenUnconfirmedTransfers,
      qrc721TokenTransfers
    }
  }

  transformInput(input, index, transaction) {
    const {InputScript, OutputScript} = this.app.qtuminfo.lib
    let scriptSig = InputScript.fromBuffer(input.scriptSig, {
      scriptPubKey: OutputScript.fromBuffer(input.scriptPubKey ?? Buffer.alloc(0)),
      witness: input.witness,
      isCoinbase: isCoinbase(input)
    })
    let result = {}
    if (scriptSig.type === InputScript.COINBASE) {
      result.coinbase = scriptSig.buffer.toString('hex')
    } else {
      result.prevTxId = input.prevTxId.toString('hex')
      result.outputIndex = input.outputIndex
      result.value = input.value.toString()
      result.address = input.addressHex ? input.addressHex.toString('hex') : input.address
      result.addressHex = input.addressHex?.toString('hex')
      result.isInvalidContract = input.isInvalidContract
    }
    result.scriptSig = {type: scriptSig.type}
    result.scriptSig.hex = input.scriptSig.toString('hex')
    result.scriptSig.asm = scriptSig.toString()
    result.sequence = input.sequence
    if (transaction.flag) {
      result.witness = input.witness.map(script => script.toString('hex'))
    }
    return result
  }

  async transformOutput(output) {
    const {OutputScript, Solidity} = this.app.qtuminfo.lib
    const db = this.ctx.model
    const {sql} = this.ctx.helper
    let scriptPubKey = OutputScript.fromBuffer(output.scriptPubKey)
    let type = scriptPubKey.isEmpty() ? 'empty' : scriptPubKey.type
    let result = {
      value: output.value.toString(),
      address: output.addressHex ? output.addressHex.toString('hex') : output.address,
      addressHex: output.addressHex?.toString('hex'),
      isInvalidContract: output.isInvalidContract,
      scriptPubKey: {
        type,
        hex: output.scriptPubKey.toString('hex'),
        asm: scriptPubKey.toString()
      },
      isRefund: output.isRefund
    }
    if (output.spentTxId) {
      result.spentTxId = output.spentTxId.toString('hex')
      result.spentIndex = output.spentIndex
    }
    if (output.evmReceipt) {
      result.receipt = {
        sender: output.evmReceipt.sender,
        gasUsed: output.evmReceipt.gasUsed,
        contractAddress: output.evmReceipt.contractAddressHex.toString('hex'),
        contractAddressHex: output.evmReceipt.contractAddressHex.toString('hex'),
        excepted: output.evmReceipt.excepted,
        exceptedMessage: output.evmReceipt.exceptedMessage
      }
      if ([OutputScript.EVM_CONTRACT_CALL, OutputScript.EVM_CONTRACT_CALL_SENDER].includes(scriptPubKey.type)) {
        let byteCode = scriptPubKey.byteCode
        if (Buffer.compare(byteCode, Buffer.alloc(1)) === 0) {
          let abiList = await db.query(sql`
            SELECT state_mutability, contract_tag FROM evm_function_abi
            WHERE id = ${Buffer.alloc(0)} AND type = 'fallback' AND (
              contract_tag IS NULL OR contract_tag IN (
                SELECT tag FROM contract_tag WHERE contract_address = ${output.evmReceipt.contractAddressHex}
              )
            )
          `, {type: db.QueryTypes.SELECT})
          for (let {state_mutability: stateMutability, contract_tag: tag} of abiList) {
            result.receipt.abi = {
              tag,
              type: 'fallback',
              name: '',
              inputs: [],
              stateMutability
            }
            break
          }
        } else {
          let abiList = await db.query(sql`
            SELECT type, name, inputs, state_mutability, contract_tag FROM evm_function_abi
            WHERE id = ${byteCode.slice(0, 4)} AND (
              contract_tag IS NULL OR contract_tag IN (
                SELECT tag FROM contract_tag WHERE contract_address = ${output.evmReceipt.contractAddressHex}
              )
            )
          `, {type: db.QueryTypes.SELECT})
          for (let {type, name, inputs, state_mutability: stateMutability, contract_tag: tag} of abiList) {
            let abi = new Solidity.MethodABI({type, name, inputs, stateMutability})
            try {
              let abiResult = abi.decodeInputs(byteCode.slice(4))
              result.receipt.abi = {
                tag,
                type,
                name,
                inputs: inputs.map((input, index) => ({
                  name: input.name,
                  type: input.type,
                  value: this.decodeSolitityParams(abiResult[index], input.type)
                })),
                stateMutability
              }
              break
            } catch (err) {}
          }
        }
      }
      result.receipt.logs = []
      for (let {addressHex, topics, data} of output.evmReceipt.logs) {
        let log = {
          address: addressHex.toString('hex'),
          addressHex: addressHex.toString('hex'),
          topics: topics.map(topic => topic.toString('hex')),
          data: data.toString('hex')
        }
        let abiList = await db.query(sql`
          SELECT name, inputs, anonymous, contract_tag FROM evm_event_abi
          WHERE (id = ${topics[0] ?? Buffer.alloc(0)} OR anonymous = FALSE) AND (
            contract_tag IS NULL OR contract_tag IN (
              SELECT tag FROM contract_tag WHERE contract_address = ${addressHex}
            )
          )
        `, {type: db.QueryTypes.SELECT})
        for (let {name, inputs, anonymous, contract_tag: tag} of abiList) {
          let abi = new Solidity.EventABI({name, inputs, anonymous})
          try {
            let abiResult = abi.decode({topics: anonymous ? topics : topics.slice(1), data})
            log.abi = {
              tag,
              name,
              inputs: inputs.map((input, index) => ({
                name: input.name,
                type: input.type,
                indexed: input.indexed,
                value: this.decodeSolitityParams(abiResult[index], input.type)
              })),
              anonymous: Boolean(anonymous)
            }
            break
          } catch (err) {}
        }
        result.receipt.logs.push(log)
      }
    }
    return result
  }

  async transformQRC20Transfers(outputs) {
    const TransferABI = this.app.qtuminfo.lib.Solidity.qrc20ABIs.find(abi => abi.name === 'Transfer')
    let result = []
    for (let output of outputs) {
      if (output.evmReceipt) {
        for (let {addressHex, topics, data, qrc20} of output.evmReceipt.logs) {
          if (qrc20 && topics.length === 3 && Buffer.compare(topics[0], TransferABI.id) === 0 && data.length === 32) {
            let [from, to] = await this.ctx.service.contract.transformHexAddresses([topics[1].slice(12), topics[2].slice(12)])
            result.push({
              address: addressHex.toString('hex'),
              addressHex: addressHex.toString('hex'),
              name: qrc20.name,
              symbol: qrc20.symbol,
              decimals: qrc20.decimals,
              ...from?.hex ? {from: from.hex.toString('hex'), fromHex: from.hex.toString('hex')} : {from},
              ...to?.hex ? {to: to.hex.toString('hex'), toHex: to.hex.toString('hex')} : {to},
              value: BigInt(`0x${data.toString('hex')}`).toString()
            })
          }
        }
      }
    }
    if (result.length) {
      return result
    }
  }

  async transformQRC20UnconfirmedTransfers(outputs) {
    const {OutputScript, Solidity} = this.app.qtuminfo.lib
    const transferABI = Solidity.qrc20ABIs.find(abi => abi.name === 'transfer')
    const {Qrc20: QRC20} = this.ctx.model
    let result = []
    for (let output of outputs) {
      if (output.evmReceipt) {
        let qrc20 = await QRC20.findOne({
          where: {contractAddress: output.addressHex},
          attributes: ['name', 'symbol', 'decimals']
        })
        if (!qrc20) {
          continue
        }
        let scriptPubKey = OutputScript.fromBuffer(output.scriptPubKey)
        if (![OutputScript.EVM_CONTRACT_CALL, OutputScript.EVM_CONTRACT_CALL_SENDER].includes(scriptPubKey.type)) {
          continue
        }
        let byteCode = scriptPubKey.byteCode
        if (byteCode.length !== 68
          || Buffer.compare(byteCode.slice(0, 4), transferABI.id) !== 0
          || Buffer.compare(byteCode.slice(4, 16), Buffer.alloc(12)) !== 0
        ) {
          continue
        }
        let from = output.evmReceipt.sender
        let [to] = await this.ctx.service.contract.transformHexAddresses([byteCode.slice(16, 36)])
        let value = BigInt(`0x${byteCode.slice(36).toString('hex')}`)
        result.push({
          address: output.addressHex.toString('hex'),
          addressHex: output.addressHex.toString('hex'),
          name: qrc20.name,
          symbol: qrc20.symbol,
          decimals: qrc20.decimals,
          from,
          ...to?.hex ? {to: to.string, toHex: to.hex.toString('hex')} : {to},
          value: value.toString()
        })
      }
    }
    if (result.length) {
      return result
    }
  }

  async transformQRC721Transfers(outputs) {
    const TransferABI = this.app.qtuminfo.lib.Solidity.qrc20ABIs.find(abi => abi.name === 'Transfer')
    let result = []
    for (let output of outputs) {
      if (output.evmReceipt) {
        for (let {addressHex, topics, qrc721} of output.evmReceipt.logs) {
          if (qrc721 && topics.length === 4 && Buffer.compare(topics[0], TransferABI.id) === 0) {
            let [from, to] = await this.ctx.service.contract.transformHexAddresses([topics[1].slice(12), topics[2].slice(12)])
            result.push({
              address: addressHex.toString('hex'),
              addressHex: addressHex.toString('hex'),
              name: qrc721.name,
              symbol: qrc721.symbol,
              ...from?.hex ? {from: from.hex.toString('hex'), fromHex: from.hex.toString('hex')} : {from},
              ...to?.hex ? {to: to.hex.toString('hex'), toHex: to.hex.toString('hex')} : {to},
              tokenId: topics[3].toString('hex')
            })
          }
        }
      }
    }
    if (result.length) {
      return result
    }
  }

  async getBasicTransaction(transactionId, addressIds) {
    const {Header, Transaction, TransactionOutput, TransactionInput, GasRefund, EvmReceipt: EVMReceipt, where, col} = this.ctx.model

    let transaction = await Transaction.findOne({
      where: {_id: transactionId},
      attributes: ['id', 'blockHeight', 'indexInBlock'],
      include: [{
        model: Header,
        as: 'header',
        required: false,
        attributes: ['hash', 'timestamp']
      }]
    })
    if (!transaction) {
      return null
    }

    let inputs = await TransactionInput.findAll({
      where: {transactionId},
      attributes: ['value', 'addressId']
    })
    let outputs = await TransactionOutput.findAll({
      where: {transactionId},
      attributes: ['value', 'addressId'],
      include: [
        {
          model: EVMReceipt,
          as: 'evmReceipt',
          on: {
            transactionId: where(col('evmReceipt.transaction_id'), '=', col('transaction_output.transaction_id')),
            outputIndex: where(col('evmReceipt.output_index'), '=', col('transaction_output.output_index'))
          },
          required: false,
          attributes: ['_id']
        },
        {
          model: GasRefund,
          as: 'refund',
          on: {
            transactionId: where(col('refund.transaction_id'), '=', transactionId),
            outputIndex: where(col('refund.output_index'), '=', col('transaction_output.output_index'))
          },
          required: false,
          attributes: [],
          include: [{
            model: TransactionOutput,
            as: 'refundTo',
            on: {
              transactionId: where(col('refund->refundTo.transaction_id'), '=', col('refund.refund_id')),
              outputIndex: where(col('refund->refundTo.output_index'), '=', col('refund.refund_index'))
            },
            required: true,
            attributes: ['value']
          }]
        },
        {
          model: GasRefund,
          as: 'refundTo',
          on: {
            transactionId: where(col('refundTo.refund_id'), '=', transactionId),
            outputIndex: where(col('refundTo.refund_index'), '=', col('transaction_output.output_index'))
          },
          required: false,
          attributes: ['transactionId']
        }
      ]
    })

    let inputValue = inputs.map(input => input.value).reduce((x, y) => x + y)
    let outputValue = outputs.map(output => output.value).reduce((x, y) => x + y)
    let refundValue = outputs
      .filter(output => output.refund)
      .map(output => output.refund.refundTo.value)
      .reduce((x, y) => x + y, 0n)
    let refundToValue = outputs
      .filter(output => output.refundTo)
      .map(output => output.value)
      .reduce((x, y) => x + y, 0n)
    let amount = [
      ...outputs.filter(output => addressIds.includes(output.addressId)).map(output => output.value),
      ...inputs.filter(input => addressIds.includes(input.addressId)).map(input => -input.value)
    ].reduce((x, y) => x + y, 0n)
    let type = ''
    if (addressIds.includes(inputs[0].addressId) && outputs.some(output => output.evmReceipt)) {
      type = 'contract'
    } else if (transaction.indexInBlock < 2 && (transaction.blockHeight > this.app.chain.lastPoWBlockHeight || transaction.indexInBlock === 0)) {
      if (outputs.some(output => addressIds.includes(output.addressId) && !output.refundTo)) {
        type = 'block-reward'
      } else {
        type = 'gas-refund'
      }
    } else if (amount > 0n) {
      type = 'receive'
    } else if (amount < 0n) {
      type = 'send'
    }

    return {
      id: transaction.id,
      inputs: inputs.map(input => ({value: input.value, addressId: input.addressId})),
      outputs: outputs.map(output => ({value: output.value, addressId: output.addressId})),
      ...transaction.blockHeight === 0xffffffff ? {} : {
        blockHeight: transaction.blockHeight,
        blockHash: transaction.header.hash,
        timestamp: transaction.header.timestamp
      },
      inputValue,
      outputValue,
      refundValue,
      fees: inputValue - outputValue - refundValue + refundToValue,
      amount,
      type
    }
  }

  async getContractTransaction(receiptId) {
    const {Address: RawAddress, OutputScript} = this.app.qtuminfo.lib
    const {
      Header, Address, Transaction, TransactionOutput,
      EvmReceipt: EVMReceipt, EvmReceiptLog: EVMReceiptLog, Contract,
      where, col
    } = this.ctx.model
    let receipt = await EVMReceipt.findOne({
      where: {_id: receiptId},
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
          attributes: ['scriptPubKey', 'value'],
          include: [{
            model: Address,
            as: 'address',
            required: false,
            attributes: ['type', 'string'],
            include: [{
              model: Contract,
              as: 'contract',
              required: false,
              attributes: ['address', 'addressString']
            }]
          }]
        }, {
          model: Contract,
          as: 'contract',
          required: false,
          attributes: ['addressString']
        }
      ]
    })
    if (!receipt) {
      return null
    }
    let logs = await EVMReceiptLog.findAll({
      where: {receiptId},
      include: [{
        model: Contract,
        as: 'contract',
        required: true,
        attributes: ['addressString']
      }],
      order: [['logIndex', 'ASC']]
    })

    let outputAddress
    let outputAddressHex
    let isInvalidContract
    if (receipt.output.address.contract) {
      outputAddress = receipt.output.address.contract.address.toString('hex')
      outputAddressHex = receipt.output.address.contract.address
    } else {
      let address = RawAddress.fromString(receipt.output.address.string, this.app.chain)
      outputAddress = address.data.toString('hex')
      outputAddressHex = address.data
      isInvalidContract = true
    }

    return {
      transactionId: receipt.transaction.id,
      outputIndex: receipt.outputIndex,
      ...receipt.blockHeight === 0xffffffff ? {} : {
        blockHeight: receipt.blockHeight,
        blockHash: receipt.header.hash,
        timestamp: receipt.header.timestamp
      },
      scriptPubKey: OutputScript.fromBuffer(receipt.output.scriptPubKey),
      value: receipt.output.value,
      outputAddress,
      outputAddressHex,
      isInvalidContract,
      sender: new RawAddress({
        type: receipt.senderType,
        data: receipt.senderData,
        chain: this.app.chain
      }),
      gasUsed: receipt.gasUsed,
      contractAddress: receipt.contractAddress.toString('hex'),
      contractAddressHex: receipt.contractAddress,
      excepted: receipt.excepted,
      exceptedMessage: receipt.exceptedMessage,
      evmLogs: logs.map(log => ({
        address: log.address.toString('hex'),
        addressHex: log.address,
        topics: this.transformTopics(log),
        data: log.data
      }))
    }
  }

  transformTopics(log) {
    let result = []
    if (log.topic1) {
      result.push(log.topic1)
    }
    if (log.topic2) {
      result.push(log.topic2)
    }
    if (log.topic3) {
      result.push(log.topic3)
    }
    if (log.topic4) {
      result.push(log.topic4)
    }
    return result
  }

  decodeSolitityParams(value, type) {
    if (type.startsWith('uint') || type.startsWith('int')) {
      return value.toString()
    }
    return value
  }
}

function isCoinbase(input) {
  return Buffer.compare(input.prevTxId, Buffer.alloc(32)) === 0 && input.outputIndex === 0xffffffff
}

function isCoinstake(transaction) {
  return transaction.inputs.length > 0 && Buffer.compare(transaction.inputs[0].prevTxId, Buffer.alloc(32)) !== 0
    && transaction.outputs.length >= 2 && transaction.outputs[0].value === 0n && transaction.outputs[0].scriptPubKey.length === 0
}

module.exports = TransactionService
