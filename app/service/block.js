const {Service} = require('egg')

class BlockService extends Service {
  async getBlock(arg) {
    const {Header, Address, Block, Transaction} = this.ctx.model

    const cache = this.ctx.service.cache.getLRUCache('block')
    const cachedBlock = await cache.get(arg)
    if (cachedBlock) {
      const nextHeader = await Header.findOne({
        where: {height: cachedBlock.height + 1},
        attributes: ['hash']
      })
      cachedBlock.nextHash = nextHeader?.hash
      cachedBlock.confirmations = this.app.blockchainInfo.tip.height - cachedBlock.height + 1
      return cachedBlock
    }

    let filter
    if (Number.isInteger(arg)) {
      filter = {height: arg}
    } else if (Buffer.isBuffer(arg)) {
      filter = {hash: arg}
    } else {
      return null
    }
    const result = await Header.findOne({
      where: filter,
      include: [{
        model: Block,
        as: 'block',
        required: true,
        attributes: ['size', 'weight'],
        include: [
          {
            model: Address,
            as: 'miner',
            attributes: ['string']
          },
          {
            model: Address,
            as: 'delegator',
            required: false,
            attributes: ['string']
          }
        ]
      }]
    })
    if (!result) {
      return null
    }
    const [prevHeader, nextHeader, transactions, [reward]] = await Promise.all([
      Header.findOne({
        where: {height: result.height - 1},
        attributes: ['timestamp']
      }),
      Header.findOne({
        where: {height: result.height + 1},
        attributes: ['hash']
      }),
      Transaction.findAll({
        where: {blockHeight: result.height},
        attributes: ['id'],
        order: [['indexInBlock', 'ASC']]
      }),
      this.getBlockRewards(result.height)
    ])
    const block = {
      hash: result.hash,
      height: result.height,
      version: result.version,
      prevHash: result.prevHash,
      nextHash: nextHeader?.hash,
      merkleRoot: result.merkleRoot,
      timestamp: result.timestamp,
      bits: result.bits,
      nonce: result.nonce,
      hashStateRoot: result.hashStateRoot,
      hashUTXORoot: result.hashUTXORoot,
      stakePrevTxId: result.stakePrevTxId,
      stakeOutputIndex: result.stakeOutputIndex,
      signature: result.signature,
      chainwork: result.chainwork,
      proofOfStake: result.isProofOfStake(),
      interval: result.height > 0 ? result.timestamp - prevHeader.timestamp : null,
      size: result.block.size,
      weight: result.block.weight,
      transactions: transactions.map(tx => tx.id),
      miner: result.block.miner.string,
      delegator: result.block.delegator?.string,
      difficulty: result.difficulty,
      reward,
      confirmations: this.app.blockchainInfo.tip.height - result.height + 1
    }
    await Promise.all([
      () => cache.set(block.height, block),
      () => cache.set(block.hash, block)
    ])
    return block
  }

  async getRawBlock(arg) {
    const {Header, Transaction} = this.ctx.model
    const {Header: RawHeader, Block: RawBlock} = this.app.qtuminfo.lib
    let filter
    if (Number.isInteger(arg)) {
      filter = {height: arg}
    } else if (Buffer.isBuffer(arg)) {
      filter = {hash: arg}
    } else {
      return null
    }
    const block = await Header.findOne({where: filter})
    if (!block) {
      return null
    }
    const transactionIds = (await Transaction.findAll({
      where: {blockHeight: block.height},
      attributes: ['id'],
      order: [['indexInBlock', 'ASC']]
    })).map(tx => tx.id)
    const transactions = await Promise.all(transactionIds.map(id => this.ctx.service.transaction.getRawTransaction(id)))
    return new RawBlock({
      header: new RawHeader({
        version: block.version,
        prevHash: block.prevHash,
        merkleRoot: block.merkleRoot,
        timestamp: block.timestamp,
        bits: block.bits,
        nonce: block.nonce,
        hashStateRoot: block.hashStateRoot,
        hashUTXORoot: block.hashUTXORoot,
        stakePrevTxId: block.stakePrevTxId,
        stakeOutputIndex: block.stakeOutputIndex,
        signature: block.signature
      }),
      transactions
    })
  }

  async listBlocks(dateFilter) {
    const db = this.ctx.model
    const {sql} = this.ctx.helper
    let dateFilterString = ''
    if (dateFilter) {
      dateFilterString = sql`AND timestamp BETWEEN ${dateFilter.min} AND ${dateFilter.max - 1}`
    }
    const [{totalCount}] = await db.query(sql`
      SELECT COUNT(*) AS totalCount FROM header WHERE height <= ${this.app.blockchainInfo.tip.height} ${{raw: dateFilterString}}
    `, {type: db.QueryTypes.SELECT})
    let blocks
    if (this.ctx.state.pagination) {
      const {limit, offset} = this.ctx.state.pagination
      blocks = await db.query(sql`
        SELECT
          header.hash AS hash, l.height AS height, header.timestamp AS timestamp,
          block.size AS size, address.string AS miner
        FROM (
          SELECT height FROM header
          WHERE height <= ${this.app.blockchainInfo.tip.height} ${{raw: dateFilterString}}
          ORDER BY height DESC
          LIMIT ${offset}, ${limit}
        ) l, header, block, address
        WHERE l.height = header.height AND l.height = block.height AND address._id = block.miner_id
        ORDER BY l.height ASC
      `, {type: db.QueryTypes.SELECT})
    } else {
      blocks = await db.query(sql`
        SELECT
          header.hash AS hash, l.height AS height, header.timestamp AS timestamp,
          block.size AS size, address.string AS miner
        FROM (
          SELECT height FROM header
          WHERE height <= ${this.app.blockchainInfo.tip.height} ${{raw: dateFilterString}}
          ORDER BY height DESC
        ) l, header, block, address
        WHERE l.height = header.height AND l.height = block.height AND address._id = block.miner_id
        ORDER BY l.height ASC
      `, {type: db.QueryTypes.SELECT})
    }
    if (blocks.length === 0) {
      return {totalCount, blocks: []}
    } else {
      return {totalCount, blocks: await this.getBlockSummary(blocks)}
    }
  }

  async getRecentBlocks(count) {
    const db = this.ctx.model
    const {sql} = this.ctx.helper
    const blocks = await db.query(sql`
      SELECT
        l.hash AS hash, l.height AS height, header.timestamp AS timestamp,
        l.size AS size, address.string AS miner
      FROM (
        SELECT hash, height, size, miner_id FROM block
        ORDER BY height DESC
        LIMIT ${count}
      ) l, header, address WHERE l.height = header.height AND l.miner_id = address._id
      ORDER BY l.height DESC
    `, {type: db.QueryTypes.SELECT})
    if (blocks.length === 0) {
      return []
    }
    blocks.reverse()
    return await this.getBlockSummary(blocks)
  }

  async getBlockRewards(startHeight, endHeight = startHeight + 1) {
    const db = this.ctx.model
    const {sql} = this.ctx.helper
    const rewards = await db.query(sql`
      SELECT SUM(value) AS value FROM (
        SELECT tx.block_height AS height, output.value AS value FROM header, transaction tx, transaction_output output
        WHERE
          tx.block_height BETWEEN ${startHeight} AND ${endHeight - 1}
          AND header.height = tx.block_height
          AND tx.index_in_block = (SELECT CASE header.stake_prev_transaction_id WHEN ${Buffer.alloc(32)} THEN 0 ELSE 1 END)
          AND output.transaction_id = tx._id
          AND NOT EXISTS (
            SELECT refund_id FROM gas_refund
            WHERE refund_id = output.transaction_id AND refund_index = output.output_index
          )
        UNION ALL
        SELECT tx.block_height AS height, -input.value AS value
        FROM header, transaction tx, transaction_input input
        WHERE
          tx.block_height BETWEEN ${startHeight} AND ${endHeight - 1}
          AND header.height = tx.block_height
          AND tx.index_in_block = (SELECT CASE header.stake_prev_transaction_id WHEN ${Buffer.alloc(32)} THEN 0 ELSE 1 END)
          AND input.transaction_id = tx._id
      ) block_reward
      GROUP BY height
      ORDER BY height ASC
    `, {type: db.QueryTypes.SELECT})
    const result = rewards.map(reward => BigInt(reward.value))
    if (startHeight[0] === 0) {
      result[0] = 0n
    }
    return result
  }

  async getBlockSummary(blocks) {
    const db = this.ctx.model
    const {Header} = db
    const {sql} = this.ctx.helper
    const transactionCountMapping = new Map(
      (await db.query(sql`
        SELECT block.height AS height, MAX(transaction.index_in_block) + 1 AS transactionsCount
        FROM block
        INNER JOIN transaction ON block.height = transaction.block_height
        WHERE block.height BETWEEN ${blocks[0].height} AND ${blocks[blocks.length - 1].height}
        GROUP BY block.height
      `, {type: db.QueryTypes.SELECT}))
        .map(({height, transactionsCount}) => [height, transactionsCount])
    )
    const [prevHeader, rewards] = await Promise.all([
      Header.findOne({
        where: {height: blocks[0].height - 1},
        attributes: ['timestamp']
      }),
      this.getBlockRewards(blocks[0].height, blocks[blocks.length - 1].height + 1)
    ])
    const result = []
    for (let i = blocks.length; --i >= 0;) {
      const block = blocks[i]
      let interval
      if (i === 0) {
        interval = prevHeader ? block.timestamp - prevHeader.timestamp : null
      } else {
        interval = block.timestamp - blocks[i - 1].timestamp
      }
      result.push({
        hash: block.hash,
        height: block.height,
        timestamp: block.timestamp,
        transactionsCount: transactionCountMapping.get(block.height),
        interval,
        size: block.size,
        miner: block.miner,
        reward: rewards[i]
      })
    }
    return result
  }

  async getBiggestMiners(lastNDays = null) {
    const db = this.ctx.model
    const {sql} = this.ctx.helper
    const {Block} = db
    const {gte: $gte} = this.app.Sequelize.Op
    const blockHeightOffset = this.app.chain.lastPoWBlockHeight >= 0xffffffff ? 1 : this.app.chain.lastPoWBlockHeight + 1
    let fromBlock = blockHeightOffset
    const timestamp = Math.floor(Date.now() / 1000)
    if (lastNDays != null) {
      const [{fromBlockHeight}] = await db.query(sql`
        SELECT MIN(height) as fromBlockHeight FROM header
        WHERE timestamp > ${timestamp - 86400 * lastNDays}
      `, {type: db.QueryTypes.SELECT})
      if (fromBlockHeight > fromBlock) {
        fromBlock = fromBlockHeight
      }
    }
    const {limit, offset} = this.ctx.state.pagination
    const totalCount = await Block.count({
      where: {height: {[$gte]: fromBlock}},
      distinct: true,
      col: 'minerId'
    })
    const list = await db.query(sql`
      SELECT
        address.string AS address,
        list.blocks AS blocks,
        list.reward AS reward,
        rich_list.balance AS balance
      FROM (
        SELECT
          miner_id,
          COUNT(*) AS blocks,
          4 * SUM(
            IF(
              height >= ${blockHeightOffset} + 985500 * 7,
              0,
              POW(2, -FLOOR((height - ${blockHeightOffset}) / 985500))
            )
          ) AS reward
        FROM block
        WHERE height >= ${fromBlock}
        GROUP BY miner_id
        ORDER BY blocks DESC
        LIMIT ${offset}, ${limit}
      ) list
      INNER JOIN address ON address._id = list.miner_id
      LEFT JOIN rich_list ON rich_list.address_id = address._id
      ORDER BY blocks DESC
    `, {type: db.QueryTypes.SELECT})
    return {
      totalCount,
      list: list.map(({address, blocks, reward, balance}) => ({address, blocks, reward, balance: BigInt(balance ?? 0)})),
      blocks: this.app.blockchainInfo.tip.height - fromBlock + 1
    }
  }

  async getBlockTransactions(height) {
    const {Transaction} = this.ctx.model
    const transactions = await Transaction.findAll({
      where: {blockHeight: height},
      attributes: ['id']
    })
    return transactions.map(tx => tx.id)
  }

  async getBlockAddressTransactions(height) {
    const {Address, Transaction, BalanceChange, EvmReceipt: EVMReceipt, EvmReceiptLog: EVMReceiptLog, Contract} = this.ctx.model
    const {Address: RawAddress} = this.app.qtuminfo.lib
    const TransferABI = this.app.qtuminfo.lib.Solidity.qrc20ABIs.find(abi => abi.name === 'Transfer')
    const result = []
    const balanceChanges = await BalanceChange.findAll({
      attributes: [],
      include: [
        {
          model: Transaction,
          as: 'transaction',
          required: true,
          where: {blockHeight: height},
          attributes: ['indexInBlock']
        },
        {
          model: Address,
          as: 'address',
          required: true,
          attributes: ['string']
        }
      ]
    })
    for (const {transaction, address} of balanceChanges) {
      result[transaction.indexInBlock] = result[transaction.indexInBlock] ?? new Set()
      result[transaction.indexInBlock].add(address.string)
    }
    const receipts = await EVMReceipt.findAll({
      where: {blockHeight: height},
      attributes: ['indexInBlock', 'senderType', 'senderData']
    })
    for (const {indexInBlock, senderType, senderData} of receipts) {
      result[indexInBlock] = result[indexInBlock] ?? new Set()
      result[indexInBlock].add(new RawAddress({type: senderType, data: senderData, chain: this.app.chain}).toString())
    }
    const receiptLogs = await EVMReceiptLog.findAll({
      attributes: ['topic1', 'topic2', 'topic3', 'topic4'],
      include: [
        {
          model: EVMReceipt,
          as: 'receipt',
          required: true,
          where: {blockHeight: height},
          attributes: ['indexInBlock']
        },
        {
          model: Contract,
          as: 'contract',
          required: true,
          attributes: ['addressString', 'type']
        }
      ]
    })
    for (const {topic1, topic2, topic3, topic4, receipt, contract} of receiptLogs) {
      const set = result[receipt.indexInBlock] = result[receipt.indexInBlock] || new Set()
      set.add(contract.addressString)
      if (topic1.compare(TransferABI.id) === 0 && topic3) {
        if (contract.type === 'qrc20' && !topic4 || contract.type === 'qrc721' && topic4) {
          const sender = topic2.slice(12)
          const receiver = topic3.slice(12)
          if (sender.compare(Buffer.alloc(20)) !== 0) {
            set.add(new RawAddress({type: Address.PAY_TO_PUBLIC_KEY_HASH, data: sender, chain: this.app.chain}).toString())
            set.add(new RawAddress({type: Address.EVM_CONTRACT, data: sender, chain: this.app.chain}).toString())
          }
          if (receiver.compare(Buffer.alloc(20)) !== 0) {
            set.add(new RawAddress({type: Address.PAY_TO_PUBLIC_KEY_HASH, data: receiver, chain: this.app.chain}).toString())
            set.add(new RawAddress({type: Address.EVM_CONTRACT, data: receiver, chain: this.app.chain}).toString())
          }
        }
      }
    }
    return result
  }

  getBlockFilter(category = 'blockHeight') {
    const {gte: $gte, lte: $lte, between: $between} = this.app.Sequelize.Op
    const {fromBlock, toBlock} = this.ctx.state
    let blockFilter = null
    if (fromBlock != null && toBlock != null) {
      blockFilter = {[$between]: [fromBlock, toBlock]}
    } else if (fromBlock != null) {
      blockFilter = {[$gte]: fromBlock}
    } else if (toBlock != null) {
      blockFilter = {[$lte]: toBlock}
    }
    return blockFilter ? {[category]: blockFilter} : {}
  }

  getRawBlockFilter(category = 'block_height') {
    const {sql} = this.ctx.helper
    const {fromBlock, toBlock} = this.ctx.state
    let blockFilter = 'TRUE'
    if (fromBlock != null && toBlock != null) {
      blockFilter = sql`${{raw: category}} BETWEEN ${fromBlock} AND ${toBlock}`
    } else if (fromBlock != null) {
      blockFilter = sql`${{raw: category}} >= ${fromBlock}`
    } else if (toBlock != null) {
      blockFilter = sql`${{raw: category}} <= ${toBlock}`
    }
    return {raw: blockFilter}
  }
}

module.exports = BlockService
