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

    // const cache = this.ctx.service.cache.getLRUCache('transaction')
    const transaction = await Transaction.findOne({
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
            attributes: ['id', 'blockHeight', 'indexInBlock']
          }]
        }
      ]
    })
    if (!transaction) {
      // await cache.del(id.toString('hex'))
      return null
    }
    // const cachedTransaction = await cache.get(id.toString('hex'))
    // if (cachedTransaction) {
    //   if (transaction.header) {
    //     cachedTransaction.blockHash = transaction.header.hash.toString('hex')
    //     cachedTransaction.blockHeight = transaction.blockHeight
    //     cachedTransaction.timestamp = transaction.header.timestamp
    //     cachedTransaction.confirmations = this.app.blockchainInfo.tip.height - cachedTransaction.blockHeight + 1
    //   }
    //   return cachedTransaction
    // }

    const witnesses = await Witness.findAll({
      where: {transactionId: id},
      attributes: ['inputIndex', 'script'],
      order: [['inputIndex', 'ASC'], ['witnessIndex', 'ASC']]
    })

    const inputs = await TransactionInput.findAll({
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
            attributes: ['address', 'addressString', 'createHeight', 'destructHeight'],
            include: [
              {
                model: EVMReceipt,
                as: 'createReceipt',
                required: false,
                attributes: ['indexInBlock', 'outputIndex']
              },
              {
                model: EVMReceipt,
                as: 'destructReceipt',
                required: false,
                attributes: ['indexInBlock', 'outputIndex']
              }
            ]
          }]
        }
      ],
      order: [['inputIndex', 'ASC']]
    })
    const outputs = await TransactionOutput.findAll({
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
          include: [
            {
              model: Contract,
              as: 'contract',
              required: false,
              attributes: ['addressString', 'createHeight', 'destructHeight'],
              include: [
                {
                  model: EVMReceipt,
                  as: 'createReceipt',
                  required: false,
                  attributes: ['indexInBlock', 'outputIndex']
                },
                {
                  model: EVMReceipt,
                  as: 'destructReceipt',
                  required: false,
                  attributes: ['indexInBlock', 'outputIndex']
                }
              ]
            },
            {
              model: Contract,
              as: 'createdContracts',
              required: false,
              attributes: ['address', 'addressString']
            },
            {
              model: Contract,
              as: 'destructedContracts',
              required: false,
              attributes: ['address', 'addressString']
            }
          ]
        }
      ],
      order: [['outputIndex', 'ASC']]
    })

    let eventLogs = []
    const contractSpends = []

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
      const contractSpendIds = (await Transaction.findAll({
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
        const inputs = await TransactionInput.findAll({
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
              attributes: ['address', 'addressString', 'createHeight', 'destructHeight'],
              include: [
                {
                  model: EVMReceipt,
                  as: 'createReceipt',
                  required: false,
                  attributes: ['indexInBlock', 'outputIndex']
                },
                {
                  model: EVMReceipt,
                  as: 'destructReceipt',
                  required: false,
                  attributes: ['indexInBlock', 'outputIndex']
                }
              ]
            }]
          }],
          order: [['inputIndex', 'ASC']]
        })
        const outputs = await TransactionOutput.findAll({
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
              attributes: ['address', 'addressString', 'createHeight', 'destructHeight'],
              include: [
                {
                  model: EVMReceipt,
                  as: 'createReceipt',
                  required: false,
                  attributes: ['indexInBlock', 'outputIndex']
                },
                {
                  model: EVMReceipt,
                  as: 'destructReceipt',
                  required: false,
                  attributes: ['indexInBlock', 'outputIndex']
                }
              ]
            }]
          }],
          order: [['outputIndex', 'ASC']]
        })
        for (const id of contractSpendIds) {
          contractSpends.push({
            inputs: inputs.filter(input => input.transactionId === id).map(input => ({
              ...this.transformAddress(input.address, transaction),
              value: input.value
            })),
            outputs: outputs.filter(output => output.transactionId === id).map(output => ({
              ...this.transformAddress(output.address, transaction),
              value: output.value
            }))
          })
        }
      }
    }

    const result = await this.transformTransaction({
      id: transaction.id,
      hash: transaction.hash,
      version: transaction.version,
      flag: transaction.flag,
      inputs: inputs.map((input, index) => ({
        prevTxId: input.outputTransaction ? input.outputTransaction.id : Buffer.alloc(32),
        outputIndex: input.outputIndex,
        scriptSig: input.scriptSig,
        sequence: input.sequence,
        witness: witnesses.filter(({inputIndex}) => inputIndex === index).map(({script}) => script),
        value: input.value,
        scriptPubKey: input.output?.scriptPubKey,
        ...this.transformAddress(input.address, transaction)
      })),
      outputs: outputs.map(output => {
        const outputObject = {
          scriptPubKey: output.scriptPubKey,
          value: output.value,
          ...this.transformAddress(output.address, transaction)
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
            exceptedMessage: output.evmReceipt.exceptedMessage,
            createdContracts: output.evmReceipt.createdContracts.map(
              ({address, addressString}) => ({address: addressString, addressHex: address})
            ),
            destructedContracts: output.evmReceipt.destructedContracts.map(
              ({address, addressString}) => ({address: addressString, addressHex: address})
            )
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
    // await cache.set(id.toString('hex'), result)
    return result
  }

  async getRawTransaction(id) {
    const {Transaction, Witness, TransactionOutput, TransactionInput} = this.ctx.model
    const {Transaction: RawTransaction, Input, Output, OutputScript} = this.app.qtuminfo.lib

    const transaction = await Transaction.findOne({
      where: {id},
      attributes: ['_id', 'version', 'flag', 'lockTime']
    })
    if (!transaction) {
      return null
    }
    const witnesses = await Witness.findAll({
      where: {transactionId: id},
      attributes: ['inputIndex', 'script'],
      order: [['inputIndex', 'ASC'], ['witnessIndex', 'ASC']]
    })

    const inputs = await TransactionInput.findAll({
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
    const outputs = await TransactionOutput.findAll({
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
    const {limit, offset} = this.ctx.state.pagination
    const totalCount = await Block.aggregate('txs', 'SUM') + await Transaction.count({where: {blockHeight: 0xffffffff}})
    const list = await db.query(sql`
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
    const totalCount = await Block.aggregate('txs', 'SUM') + await Transaction.count({where: {blockHeight: 0xffffffff}})
    const list = await Transaction.findAll({
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
    const balanceChanges = await BalanceChange.findAll({
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
    const receipts = await EVMReceipt.findAll({
      attributes: ['senderType', 'senderData'],
      include: [{
        model: Transaction,
        as: 'transaction',
        required: true,
        where: {id},
        attributes: []
      }]
    })
    const addresses = new Set(balanceChanges.map(item => item.address.string))
    for (const receipt of receipts) {
      addresses.add(new RawAddress({type: receipt.senderType, data: receipt.senderData, chain: this.app.chain}).toString())
    }
    return [...addresses]
  }

  async sendRawTransaction(data) {
    const client = new this.app.qtuminfo.rpc(this.app.config.qtuminfo.rpc)
    const id = await client.sendrawtransaction(data.toString('hex'))
    return Buffer.from(id, 'hex')
  }

  transformAddress(address, transaction) {
    const {Address} = this.app.qtuminfo.lib
    const result = {}
    if (address) {
      if ([Address.CONTRACT, Address.EVM_CONTRACT].includes(address.type)) {
        if (address.contract) {
          result.address = address.contract.address.toString('hex')
          result.addressHex = address.contract.address
          if (transaction.contractSpendSource) {
            transaction = transaction.contractSpendSource.destTransaction
          }
          const {createHeight, createReceipt, destructHeight, destructReceipt} = address.contract
          if (createHeight > transaction.blockHeight) {
            result.isInvalidContract = true
          } else if (createHeight === transaction.blockHeight && createReceipt) {
            const {indexInBlock, outputIndex} = createReceipt
            if (indexInBlock > transaction.indexInBlock
              || indexInBlock === transaction.indexInBlock && outputIndex > transaction.outputIndex) {
              result.isInvalidContract = true
            }
          }
          if (destructHeight != null) {
            if (destructHeight < transaction.blockHeight) {
              result.isInvalidContract = true
            } else if (destructHeight === transaction.blockHeight && destructReceipt) {
              const {indexInBlock, outputIndex} = destructReceipt
              if (indexInBlock < transaction.indexInBlock
                || indexInBlock === transaction.indexInBlock && outputIndex < transaction.outputIndex) {
                result.isInvalidContract = true
              }
            }
          }
        } else {
          const rawAddress = Address.fromString(address.string, this.app.chain)
          result.address = rawAddress.data.toString('hex')
          result.addressHex = rawAddress.data
          result.isInvalidContract = true
        }
      } else {
        result.address = address.string
      }
    }
    return result
  }

  async transformTransaction(transaction) {
    const confirmations = transaction.block ? this.app.blockchainInfo.tip.height - transaction.block.height + 1 : 0
    const inputValue = transaction.inputs.map(input => input.value).reduce((x, y) => x + y)
    const outputValue = transaction.outputs.map(output => output.value).reduce((x, y) => x + y)
    const refundValue = transaction.outputs
      .map(output => output.refundValue)
      .filter(Boolean)
      .reduce((x, y) => x + y, 0n)
    const refundToValue = transaction.outputs
      .filter(output => output.isRefund)
      .map(output => output.value)
      .reduce((x, y) => x + y, 0n)
    const inputs = transaction.inputs.map((input, index) => this.transformInput(input, index, transaction))
    const outputs = await Promise.all(transaction.outputs.map((output, index) => this.transformOutput(output, index)))

    const [qrc20TokenTransfers, qrc20TokenUnconfirmedTransfers, qrc721TokenTransfers] = await Promise.all([
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
    const scriptSig = InputScript.fromBuffer(input.scriptSig, {
      scriptPubKey: OutputScript.fromBuffer(input.scriptPubKey ?? Buffer.alloc(0)),
      witness: input.witness,
      isCoinbase: isCoinbase(input)
    })
    const result = {}
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
    const {Contract, ContractCode} = db
    const {sql} = this.ctx.helper
    const scriptPubKey = OutputScript.fromBuffer(output.scriptPubKey)
    const type = scriptPubKey.isEmpty() ? 'empty' : scriptPubKey.type
    const result = {
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
        exceptedMessage: output.evmReceipt.exceptedMessage,
        createdContracts: output.evmReceipt.createdContracts.map(({addressHex}) => addressHex.toString('hex')),
        destructedContracts: output.evmReceipt.destructedContracts.map(({addressHex}) => addressHex.toString('hex'))
      }
      if ([OutputScript.EVM_CONTRACT_CREATE, OutputScript.EVM_CONTRACT_CREATE_SENDER].includes(scriptPubKey.type)) {
        const abiList = await db.query(sql`
          SELECT inputs, state_mutability, contract_tag FROM evm_function_abi
          WHERE id IS NULL AND type = 'constructor' AND (
            contract_address = ${output.evmReceipt.contractAddressHex} OR contract_tag IN (
              SELECT tag FROM contract_tag WHERE contract_address = ${output.evmReceipt.contractAddressHex}
            )
          )
        `, {type: db.QueryTypes.SELECT})
        if (abiList.length) {
          const {code} = await ContractCode.findOne({
            attributes: ['code'],
            include: [{
              model: Contract,
              as: 'contract',
              required: true,
              where: {address: output.addressHex},
              attributes: []
            }]
          })
          const offset = scriptPubKey.byteCode.indexOf(code)
          const byteCode = scriptPubKey.byteCode.slice(offset + code.length)
          for (const {inputs, state_mutability: stateMutability, contract_tag: tag} of abiList) {
            try {
              const abi = new Solidity.MethodABI({type: 'constuctor', inputs, stateMutability})
              const abiResult = abi.decodeInputs(byteCode)
              result.receipt.abi = {
                tag,
                type: 'constructor',
                name: '',
                inputs: inputs.map((input, index) => ({
                  name: input.name,
                  type: input.type,
                  value: this.decodeSolitityParameter(input.type, abiResult[index])
                })),
                stateMutability
              }
              break
            } catch (err) {}
          }
        }
      } else if ([OutputScript.EVM_CONTRACT_CALL, OutputScript.EVM_CONTRACT_CALL_SENDER].includes(scriptPubKey.type)) {
        const byteCode = scriptPubKey.byteCode
        if (byteCode.compare(Buffer.alloc(1)) === 0) {
          const abiList = await db.query(sql`
            SELECT state_mutability, contract_tag FROM evm_function_abi
            WHERE id IS NULL AND type = 'fallback' AND (
              contract_address = ${output.evmReceipt.contractAddressHex} OR contract_tag IN (
                SELECT tag FROM contract_tag WHERE contract_address = ${output.evmReceipt.contractAddressHex}
              )
            )
          `, {type: db.QueryTypes.SELECT})
          for (const {state_mutability: stateMutability, contract_tag: tag} of abiList) {
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
          const abiList = await db.query(sql`
            SELECT type, name, inputs, state_mutability, contract_tag FROM evm_function_abi
            WHERE id = ${byteCode.slice(0, 4)} AND (
              contract_address = ${output.evmReceipt.contractAddressHex} OR contract_tag IN (
                SELECT tag FROM contract_tag WHERE contract_address = ${output.evmReceipt.contractAddressHex}
              )
            )
          `, {type: db.QueryTypes.SELECT})
          for (const {type, name, inputs, state_mutability: stateMutability} of abiList) {
            const abi = new Solidity.MethodABI({type, name, inputs, stateMutability})
            try {
              const abiResult = abi.decodeInputs(byteCode.slice(4))
              result.receipt.abi = {
                tag: abiList.map(abi => abi.contract_tag).filter(Boolean),
                type,
                name,
                inputs: inputs.map((input, index) => ({
                  name: input.name,
                  type: input.type,
                  value: this.decodeSolitityParameter(input.type, abiResult[index])
                })),
                stateMutability
              }
              break
            } catch (err) {}
          }
        }
      }
      result.receipt.logs = []
      for (const {addressHex, topics, data} of output.evmReceipt.logs) {
        const log = {
          address: addressHex.toString('hex'),
          addressHex: addressHex.toString('hex'),
          topics: topics.map(topic => topic.toString('hex')),
          data: data.toString('hex')
        }
        const abiList = await db.query(sql`
          SELECT name, inputs, anonymous, contract_tag FROM evm_event_abi
          WHERE (id = ${topics[0] ?? Buffer.alloc(0)} OR anonymous = TRUE) AND (
            contract_address = ${addressHex} OR contract_tag IN (
              SELECT tag FROM contract_tag WHERE contract_address = ${addressHex}
            )
          )
        `, {type: db.QueryTypes.SELECT})
        for (const {name, inputs, anonymous} of abiList) {
          const abi = new Solidity.EventABI({name, inputs, anonymous})
          try {
            const abiResult = abi.decode(topics, data)
            log.abi = {
              tag: abiList.map(abi => abi.contract_tag).filter(Boolean),
              name,
              inputs: inputs.map((input, index) => ({
                name: input.name,
                type: input.type,
                indexed: input.indexed,
                value: this.decodeSolitityParameter(input.type, abiResult[index])
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
    const result = []
    for (const output of outputs) {
      if (output.evmReceipt) {
        for (const {addressHex, topics, data, qrc20} of output.evmReceipt.logs) {
          if (qrc20 && topics.length === 3 && topics[0].compare(TransferABI.id) === 0 && data.length === 32) {
            const [from, to] = await this.ctx.service.contract.transformHexAddresses([topics[1].slice(12), topics[2].slice(12)])
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
    const result = []
    for (const output of outputs) {
      if (output.evmReceipt) {
        const qrc20 = await QRC20.findOne({
          where: {contractAddress: output.addressHex},
          attributes: ['name', 'symbol', 'decimals']
        })
        if (!qrc20) {
          continue
        }
        const scriptPubKey = OutputScript.fromBuffer(output.scriptPubKey)
        if (![OutputScript.EVM_CONTRACT_CALL, OutputScript.EVM_CONTRACT_CALL_SENDER].includes(scriptPubKey.type)) {
          continue
        }
        const byteCode = scriptPubKey.byteCode
        if (byteCode.length !== 68
          || byteCode.slice(0, 4).compare(transferABI.id) !== 0
          || byteCode.slice(4, 16).compare(Buffer.alloc(12)) !== 0
        ) {
          continue
        }
        const from = output.evmReceipt.sender
        const [to] = await this.ctx.service.contract.transformHexAddresses([byteCode.slice(16, 36)])
        const value = BigInt(`0x${byteCode.slice(36).toString('hex')}`)
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
    const result = []
    for (const output of outputs) {
      if (output.evmReceipt) {
        for (const {addressHex, topics, qrc721} of output.evmReceipt.logs) {
          if (qrc721 && topics.length === 4 && topics[0].compare(TransferABI.id) === 0) {
            const [from, to] = await this.ctx.service.contract.transformHexAddresses([topics[1].slice(12), topics[2].slice(12)])
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

    const transaction = await Transaction.findOne({
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

    const inputs = await TransactionInput.findAll({
      where: {transactionId},
      attributes: ['value', 'addressId']
    })
    const outputs = await TransactionOutput.findAll({
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

    const inputValue = inputs.map(input => input.value).reduce((x, y) => x + y)
    const outputValue = outputs.map(output => output.value).reduce((x, y) => x + y)
    const refundValue = outputs
      .filter(output => output.refund)
      .map(output => output.refund.refundTo.value)
      .reduce((x, y) => x + y, 0n)
    const refundToValue = outputs
      .filter(output => output.refundTo)
      .map(output => output.value)
      .reduce((x, y) => x + y, 0n)
    const amount = [
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
    const receipt = await EVMReceipt.findOne({
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
    const logs = await EVMReceiptLog.findAll({
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
      const address = RawAddress.fromString(receipt.output.address.string, this.app.chain)
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
    const result = []
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

  decodeSolidityObject(type, parameter) {
    const result = {}
    for (const key of Object.keys(type)) {
      const subType = type[key]
      const subParam = parameter[key]
      if (typeof subType === 'object') {
        result[key] = this.decodeSolidityObject(subType, subParam)
      } else {
        result[key] = this.decodeSolitityParameter(subType, subParam)
      }
    }
    return result
  }

  decodeSolitityParameter(type, parameter) {
    if (typeof type === 'object') {
      const key = Object.keys(type)[0]
      return this.decodeSolidityObject(key, parameter)
    } else if (Array.isArray(parameter)) {
      const index = type.indexOf('[')
      const itemType = index < 0 ? type : type.slice(0, index)
      return parameter.map(param => this.decodeSolitityParameter(itemType, param))
    } else if (Buffer.isBuffer(parameter)) {
      return parameter.toString('hex')
    } else if (type.startsWith('int') || type.startsWith('uint')) {
      return parameter.toString()
    } else {
      return parameter
    }
  }
}

function isCoinbase(input) {
  return input.prevTxId.compare(Buffer.alloc(32)) === 0 && input.outputIndex === 0xffffffff
}

function isCoinstake(transaction) {
  return transaction.inputs.length > 0 && transaction.inputs[0].prevTxId.compare(Buffer.alloc(32)) !== 0
    && transaction.outputs.length >= 2 && transaction.outputs[0].value === 0n && transaction.outputs[0].scriptPubKey.length === 0
}

module.exports = TransactionService
