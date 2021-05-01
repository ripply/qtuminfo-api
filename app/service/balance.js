const {Service} = require('egg')

class BalanceService extends Service {
  async getBalance(ids) {
    const {TransactionOutput} = this.ctx.model
    const {in: $in, gt: $gt} = this.app.Sequelize.Op
    const result = await TransactionOutput.aggregate('value', 'SUM', {
      where: {
        addressId: {[$in]: ids},
        blockHeight: {[$gt]: 0},
        inputId: 0
      }
    })
    return BigInt(result || 0)
  }

  async getTotalBalanceChanges(ids) {
    if (ids.length === 0) {
      return {totalReceived: 0n, totalSent: 0n}
    }

    const db = this.ctx.model
    const {sql} = this.ctx.helper
    let totalReceived
    let totalSent
    if (ids.length === 1) {
      const [result] = await db.query(sql`
        SELECT
          SUM(CAST(GREATEST(value, 0) AS DECIMAL(24))) AS totalReceived,
          SUM(CAST(GREATEST(-value, 0) AS DECIMAL(24))) AS totalSent
        FROM balance_change WHERE address_id = ${ids[0]} AND block_height > 0
      `, {type: db.QueryTypes.SELECT})
      totalReceived = BigInt(result.totalReceived ?? 0)
      totalSent = BigInt(result.totalSent ?? 0)
    } else {
      const [result] = await db.query(sql`
        SELECT
          SUM(CAST(GREATEST(value, 0) AS DECIMAL(24))) AS totalReceived,
          SUM(CAST(GREATEST(-value, 0) AS DECIMAL(24))) AS totalSent
        FROM (
          SELECT SUM(value) AS value FROM balance_change
          WHERE address_id IN ${ids} AND block_height > 0
          GROUP BY transaction_id
        ) AS temp
      `, {type: db.QueryTypes.SELECT})
      totalReceived = BigInt(result.totalReceived ?? 0)
      totalSent = BigInt(result.totalSent ?? 0)
    }
    return {totalReceived, totalSent}
  }

  async getUnconfirmedBalance(ids) {
    const {TransactionOutput} = this.ctx.model
    const {in: $in} = this.app.Sequelize.Op
    const result = await TransactionOutput.aggregate('value', 'SUM', {
      where: {
        addressId: {[$in]: ids},
        blockHeight: 0xffffffff,
        inputHeight: null
      }
    })
    return BigInt(result || 0)
  }

  async getStakingBalance(ids) {
    const {TransactionOutput} = this.ctx.model
    const {in: $in, gt: $gt} = this.app.Sequelize.Op
    const result = await TransactionOutput.aggregate('value', 'SUM', {
      where: {
        addressId: {[$in]: ids},
        blockHeight: {[$gt]: this.app.blockchainInfo.tip.height - 2000},
        inputHeight: null,
        isStake: true
      }
    })
    return BigInt(result || 0)
  }

  async getMatureBalance(ids) {
    const {TransactionOutput} = this.ctx.model
    const {in: $in, between: $between} = this.app.Sequelize.Op
    const result = await TransactionOutput.aggregate('value', 'SUM', {
      where: {
        addressId: {[$in]: ids},
        blockHeight: {[$between]: [1, this.app.blockchainInfo.tip.height - 2000]},
        inputHeight: null
      }
    })
    return BigInt(result || 0)
  }

  async getBalanceHistory(ids, {nonZero = false} = {}) {
    if (ids.length === 0) {
      return {totalCount: 0, transactions: []}
    }
    const db = this.ctx.model
    const {sql} = this.ctx.helper
    const {Header, Transaction, BalanceChange} = db
    const {in: $in, ne: $ne, gt: $gt} = this.app.Sequelize.Op
    const {limit, offset, reversed = true} = this.ctx.state.pagination
    const order = reversed ? 'DESC' : 'ASC'

    let totalCount
    let transactionIds
    let list
    if (ids.length === 1) {
      const valueFilter = nonZero ? {value: {[$ne]: 0}} : {}
      totalCount = await BalanceChange.count({
        where: {
          addressId: ids[0],
          blockHeight: {[$gt]: 0},
          ...valueFilter
        },
        distinct: true,
        col: 'transactionId'
      })
      if (totalCount === 0) {
        return {totalCount: 0, transactions: []}
      }
      transactionIds = (await BalanceChange.findAll({
        where: {addressId: ids[0], ...valueFilter},
        attributes: ['transactionId'],
        order: [['blockHeight', order], ['indexInBlock', order], ['transactionId', order]],
        limit,
        offset
      })).map(({transactionId}) => transactionId)
      list = await BalanceChange.findAll({
        where: {transactionId: {[$in]: transactionIds}, addressId: ids[0]},
        attributes: ['transactionId', 'blockHeight', 'indexInBlock', 'value'],
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
          }
        ],
        order: [['blockHeight', order], ['indexInBlock', order], ['transactionId', order]]
      })
    } else {
      const havingFilter = nonZero ? 'SUM(value) != 0' : null
      if (havingFilter) {
        const [{count}] = await db.query(sql`
          SELECT COUNT(*) AS count FROM (
            SELECT transaction_id FROM balance_change
            WHERE address_id IN ${ids} AND block_height > 0
            GROUP BY transaction_id
            HAVING ${{raw: havingFilter}}
          ) list
        `, {type: db.QueryTypes.SELECT})
        totalCount = count
      } else {
        totalCount = await BalanceChange.count({
          where: {addressId: {[$in]: ids}, blockHeight: {[$gt]: 0}},
          distinct: true,
          col: 'transactionId'
        })
      }
      if (totalCount === 0) {
        return {totalCount: 0, transactions: []}
      }
      if (havingFilter) {
        transactionIds = (await db.query(sql`
          SELECT MIN(block_height) AS block_height, MIN(index_in_block) AS index_in_block, transaction_id AS transactionId
          FROM balance_change
          WHERE address_id IN ${ids} AND block_height > 0
          GROUP BY transaction_id
          HAVING ${{raw: havingFilter}}
          ORDER BY block_height ${{raw: order}}, index_in_block ${{raw: order}}, transaction_id ${{raw: order}}
          LIMIT ${offset}, ${limit}
        `, {type: db.QueryTypes.SELECT})).map(({transactionId}) => transactionId)
      } else {
        transactionIds = (await BalanceChange.findAll({
          where: {addressId: {[$in]: ids}},
          attributes: ['transactionId'],
          order: [['blockHeight', order], ['indexInBlock', order], ['transactionId', order]],
          limit,
          offset
        })).map(({transactionId}) => transactionId)
      }
      list = await db.query(sql`
        SELECT
          transaction.id AS id, transaction.block_height AS blockHeight,
          transaction.index_in_block AS indexInBlock, transaction._id AS transactionId,
          header.hash AS blockHash, header.timestamp AS timestamp,
          list.value AS value
        FROM (
          SELECT MIN(block_height) AS block_height, MIN(index_in_block) AS index_in_block, transaction_id, SUM(value) AS value
          FROM balance_change
          WHERE transaction_id IN ${transactionIds} AND address_id IN ${ids}
          GROUP BY transaction_id
          ORDER BY block_height ${{raw: order}}, index_in_block ${{raw: order}}, transaction_id ${{raw: order}}
        ) list
        INNER JOIN transaction ON transaction._id = list.transaction_id
        LEFT JOIN header ON header.height = transaction.block_height
      `, {type: db.QueryTypes.SELECT})
    }

    if (reversed) {
      list = list.reverse()
    }
    let initialBalance = 0n
    if (list.length > 0) {
      const {blockHeight, indexInBlock, transactionId} = list[0]
      const [{value}] = await db.query(sql`
        SELECT SUM(value) AS value FROM balance_change
        WHERE address_id IN ${ids}
          AND (block_height, index_in_block, transaction_id) < (${blockHeight}, ${indexInBlock}, ${transactionId})
      `, {type: db.QueryTypes.SELECT})
      initialBalance = BigInt(value ?? 0)
    }
    let transactions = list.map(item => ({
      id: item.id ?? item.transaction.id,
      ...item.header ? {
        block: {
          hash: item.header.hash,
          height: item.blockHeight,
          timestamp: item.header.timestamp
        }
      } : {},
      ...item.blockHash ? {
        block: {
          hash: item.blockHash,
          height: item.blockHeight,
          timestamp: item.timestamp
        }
      } : {},
      amount: BigInt(item.value),
    }))
    for (const tx of transactions) {
      tx.balance = initialBalance += tx.amount
    }
    if (reversed) {
      transactions = transactions.reverse()
    }
    return {totalCount, transactions}
  }

  async getRichList() {
    const db = this.ctx.model
    const {RichList} = db
    const {sql} = this.ctx.helper
    const {limit, offset} = this.ctx.state.pagination
    const totalCount = await RichList.count()
    const list = await db.query(sql`
      SELECT address.string AS address, rich_list.balance AS balance
      FROM (SELECT address_id FROM rich_list ORDER BY balance DESC LIMIT ${offset}, ${limit}) list
      INNER JOIN rich_list USING (address_id)
      INNER JOIN address ON address._id = list.address_id
    `, {type: db.QueryTypes.SELECT})
    return {
      totalCount,
      list: list.map(item => ({
        address: item.address,
        balance: BigInt(item.balance)
      }))
    }
  }

  async updateRichList() {
    const db = this.ctx.model
    const {Address, RichList} = db
    const {sql} = this.ctx.helper
    const transaction = await db.transaction()
    try {
      const blockHeight = this.app.blockchainInfo.tip.height
      const list = await db.query(sql`
        SELECT list.address_id AS addressId, list.balance AS balance
        FROM (
          SELECT address_id, SUM(value) AS balance
          FROM transaction_output
          WHERE
            address_id > 0
            AND (input_height IS NULL OR input_height > ${blockHeight})
            AND (block_height BETWEEN 1 AND ${blockHeight})
            AND value > 0
          GROUP BY address_id
        ) list
        INNER JOIN address ON address._id = list.address_id
        WHERE address.type < ${Address.parseType('contract')}
      `, {type: db.QueryTypes.SELECT, transaction})
      await db.query(sql`DELETE FROM rich_list`, {transaction})
      await RichList.bulkCreate(
        list.map(({addressId, balance}) => ({addressId, balance: BigInt(balance)})),
        {validate: false, transaction, logging: false}
      )
      await transaction.commit()
    } catch (err) {
      await transaction.rollback()
    }
  }

  async getRichListSnapshot(blockHeight) {
    const db = this.ctx.model
    const {Address} = db
    const {sql} = this.ctx.helper
    return await db.query(sql`
      SELECT address.string AS address, list.balance AS balance
      FROM (
        SELECT address_id, SUM(value) AS balance
        FROM transaction_output
        WHERE
          address_id > 0
          AND (input_height IS NULL OR input_height > ${blockHeight})
          AND (block_height BETWEEN 1 AND ${blockHeight})
          AND value > 0
        GROUP BY address_id
      ) list
      INNER JOIN address ON address._id = list.address_id
      WHERE address.type < ${Address.parseType('contract')}
    `, {type: db.QueryTypes.SELECT})
  }

  async getBalanceRanking(addressIds) {
    if (addressIds.length !== 1) {
      return null
    }
    const {RichList} = this.ctx.model
    const {gt: $gt} = this.app.Sequelize.Op
    const item = await RichList.findOne({
      where: {addressId: addressIds[0]},
      attributes: ['balance']
    })
    if (item == null) {
      return null
    } else {
      return await RichList.count({
        where: {balance: {[$gt]: item.balance.toString()}}
      }) + 1
    }
  }
}

module.exports = BalanceService
