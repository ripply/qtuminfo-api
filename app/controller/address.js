const {Controller} = require('egg')

class AddressController extends Controller {
  async summary() {
    const {address} = this.ctx.state
    const summary = await this.ctx.service.address.getAddressSummary(
      address.addressIds,
      address.p2pkhAddressIds,
      address.rawAddresses
    )
    this.ctx.body = {
      balance: summary.balance.toString(),
      totalReceived: summary.totalReceived.toString(),
      totalSent: summary.totalSent.toString(),
      unconfirmed: summary.unconfirmed.toString(),
      staking: summary.staking.toString(),
      mature: summary.mature.toString(),
      qrc20Balances: summary.qrc20Balances.map(item => ({
        address: item.addressHex.toString('hex'),
        addressHex: item.addressHex.toString('hex'),
        name: item.name,
        symbol: item.symbol,
        decimals: item.decimals,
        balance: item.balance.toString(),
        unconfirmed: {
          received: item.unconfirmed.received.toString(),
          sent: item.unconfirmed.sent.toString()
        },
        isUnconfirmed: item.isUnconfirmed
      })),
      qrc721Balances: summary.qrc721Balances.map(item => ({
        address: item.addressHex.toString('hex'),
        addressHex: item.addressHex.toString('hex'),
        name: item.name,
        symbol: item.symbol,
        count: item.count
      })),
      ranking: summary.ranking,
      transactionCount: summary.transactionCount,
      blocksMined: summary.blocksMined,
      ...summary.delegationState
        ? {superStaker: summary.delegationState.staker.toString(), fee: summary.delegationState.fee}
        : {},
      ...summary.delegators.length
        ? {delegators: summary.delegators.map(delegator => ({address: delegator.address.toString(), fee: delegator.fee}))}
        : {}
    }
  }

  async balance() {
    const balance = await this.ctx.service.balance.getBalance(this.ctx.state.address.addressIds)
    this.ctx.body = balance.toString()
  }

  async totalReceived() {
    const {totalReceived} = await this.ctx.service.balance.getTotalBalanceChanges(this.ctx.state.address.addressIds)
    this.ctx.body = totalReceived.toString()
  }

  async totalSent() {
    const {totalSent} = await this.ctx.service.balance.getTotalBalanceChanges(this.ctx.state.address.addressIds)
    this.ctx.body = totalSent.toString()
  }

  async unconfirmedBalance() {
    const unconfirmed = await this.ctx.service.balance.getUnconfirmedBalance(this.ctx.state.address.addressIds)
    this.ctx.body = unconfirmed.toString()
  }

  async stakingBalance() {
    const unconfirmed = await this.ctx.service.balance.getStakingBalance(this.ctx.state.address.addressIds)
    this.ctx.body = unconfirmed.toString()
  }

  async matureBalance() {
    const unconfirmed = await this.ctx.service.balance.getMatureBalance(this.ctx.state.address.p2pkhAddressIds)
    this.ctx.body = unconfirmed.toString()
  }

  async qrc20TokenBalance() {
    const {address, token} = this.ctx.state
    if (token.type !== 'qrc20') {
      this.ctx.body = {}
    }
    const {
      name,
      symbol,
      decimals,
      balance,
      unconfirmed
    } = await this.ctx.service.qrc20.getQRC20Balance(address.rawAddresses, token.contractAddress)
    this.ctx.body = {
      name,
      symbol,
      decimals,
      balance: balance.toString(),
      unconfirmed: {
        received: unconfirmed.received.toString(),
        sent: unconfirmed.sent.toString()
      }
    }
  }

  async transactions() {
    const {address} = this.ctx.state
    const {
      totalCount,
      transactions
    } = await this.ctx.service.address.getAddressTransactions(address.addressIds, address.rawAddresses)
    this.ctx.body = {
      totalCount,
      transactions: transactions.map(id => id.toString('hex'))
    }
  }

  async basicTransactions() {
    const {totalCount, transactions} = await this.ctx.service.address.getAddressBasicTransactions(this.ctx.state.address.addressIds)
    this.ctx.body = {
      totalCount,
      transactions: transactions.map(transaction => ({
        id: transaction.id.toString('hex'),
        blockHeight: transaction.blockHeight,
        blockHash: transaction.blockHash?.toString('hex'),
        timestamp: transaction.timestamp,
        confirmations: transaction.confirmations,
        amount: transaction.amount.toString(),
        inputValue: transaction.inputValue.toString(),
        outputValue: transaction.outputValue.toString(),
        refundValue: transaction.refundValue.toString(),
        fees: transaction.fees.toString(),
        type: transaction.type
      }))
    }
  }

  async contractTransactions() {
    const {address, contract} = this.ctx.state
    const {totalCount, transactions} = await this.ctx.service.address.getAddressContractTransactions(address.rawAddresses, contract)
    this.ctx.body = {
      totalCount,
      transactions: transactions.map(transaction => ({
        transactionId: transaction.transactionId.toString('hex'),
        outputIndex: transaction.outputIndex,
        blockHeight: transaction.blockHeight,
        blockHash: transaction.blockHash?.toString('hex'),
        timestamp: transaction.timestamp,
        confirmations: transaction.confirmations,
        type: transaction.scriptPubKey.type,
        gasLimit: transaction.scriptPubKey.gasLimit,
        gasPrice: transaction.scriptPubKey.gasPrice,
        byteCode: transaction.scriptPubKey.byteCode.toString('hex'),
        outputValue: transaction.value.toString(),
        outputAddress: transaction.outputAddressHex.toString('hex'),
        outputAddressHex: transaction.outputAddressHex.toString('hex'),
        sender: transaction.sender.toString(),
        gasUsed: transaction.gasUsed,
        contractAddress: transaction.contractAddressHex.toString('hex'),
        contractAddressHex: transaction.contractAddressHex.toString('hex'),
        excepted: transaction.excepted,
        exceptedMessage: transaction.exceptedMessage,
        evmLogs: transaction.evmLogs.map(log => ({
          address: log.addressHex.toString('hex'),
          addressHex: log.addressHex.toString('hex'),
          topics: log.topics.map(topic => topic.toString('hex')),
          data: log.data.toString('hex')
        }))
      }))
    }
  }

  async qrc20TokenTransactions() {
    const {address, token} = this.ctx.state
    const {totalCount, transactions} = await this.ctx.service.address.getAddressQRC20TokenTransactions(address.rawAddresses, token)
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
        value: transaction.value.toString(),
        amount: transaction.amount.toString()
      }))
    }
  }

  async qrc20TokenMempoolTransactions() {
    const {address, token} = this.ctx.state
    const transactions = await this.ctx.service.address.getAddressQRC20TokenMempoolTransactions(address.rawAddresses, token)
    this.ctx.body = transactions.map(transaction => ({
      transactionId: transaction.transactionId.toString('hex'),
      outputIndex: transaction.outputIndex,
      from: transaction.from,
      fromHex: transaction.fromHex?.toString('hex'),
      to: transaction.to,
      toHex: transaction.toHex?.toString('hex'),
      value: transaction.value.toString(),
      amount: transaction.amount.toString()
    }))
  }

  async utxo() {
    const utxos = await this.ctx.service.address.getUTXO(this.ctx.state.address.addressIds)
    this.ctx.body = utxos.map(utxo => ({
      transactionId: utxo.transactionId.toString('hex'),
      outputIndex: utxo.outputIndex,
      scriptPubKey: utxo.scriptPubKey.toString('hex'),
      address: utxo.address,
      value: utxo.value.toString(),
      isStake: utxo.isStake,
      blockHeight: utxo.blockHeight,
      confirmations: utxo.confirmations
    }))
  }

  async balanceHistory() {
    const {totalCount, transactions} = await this.ctx.service.balance.getBalanceHistory(this.ctx.state.address.addressIds)
    this.ctx.body = {
      totalCount,
      transactions: transactions.map(tx => ({
        id: tx.id.toString('hex'),
        blockHash: tx.block?.hash.toString('hex'),
        blockHeight: tx.block?.height,
        timestamp: tx.block?.timestamp,
        amount: tx.amount.toString(),
        balance: tx.balance.toString()
      }))
    }
  }

  async qrc20BalanceHistory() {
    const {Address} = this.app.qtuminfo.lib
    let tokenAddress = null
    if (this.ctx.state.token) {
      if (this.ctx.state.token.type === 'qrc20') {
        tokenAddress = this.ctx.state.token.contractAddress
      } else {
        this.ctx.body = {
          totalCount: 0,
          transactions: []
        }
        return
      }
    }
    const hexAddresses = this.ctx.state.address.rawAddresses
      .filter(address => address.type === Address.PAY_TO_PUBLIC_KEY_HASH)
      .map(address => address.data)
    const {totalCount, transactions} = await this.ctx.service.qrc20.getQRC20BalanceHistory(hexAddresses, tokenAddress)
    this.ctx.body = {
      totalCount,
      transactions: transactions.map(tx => ({
        id: tx.id.toString('hex'),
        blockHash: tx.block.hash.toString('hex'),
        blockHeight: tx.block.height,
        timestamp: tx.block.timestamp,
        confirmations: tx.confirmations,
        tokens: tx.tokens.map(item => ({
          address: item.addressHex.toString('hex'),
          addressHex: item.addressHex.toString('hex'),
          name: item.name,
          symbol: item.symbol,
          decimals: item.decimals,
          amount: item.amount.toString(),
          balance: item.balance.toString()
        }))
      }))
    }
  }
}

module.exports = AddressController
