module.exports = app => {
  app.blockchainInfo = {
    tip: null
  }
  const namespace = app.io.of('/')

  app.messenger.on('egg-ready', () => {
    app.messenger.sendToAgent('blockchain-info')
  })

  app.messenger.on('update-24h-statistics', async () => {
    let ctx = app.createAnonymousContext()
    let _24hStatistics = await ctx.service.statistics.get24hStatistics()
    await ctx.service.cache.setCache('24h-statistics', _24hStatistics)
    namespace.to('blockchain').emit('24h-statistics', _24hStatistics)
  })

  app.messenger.on('update-richlist', async () => {
    let ctx = app.createAnonymousContext()
    await ctx.service.balance.updateRichList()
  })

  app.messenger.on('update-qrc20-statistics', async () => {
    let ctx = app.createAnonymousContext()
    await ctx.service.qrc20.updateQRC20Statistics()
  })

  app.messenger.on('update-qrc721-statistics', async () => {
    let ctx = app.createAnonymousContext()
    await ctx.service.qrc721.updateQRC721Statistics()
  })

  app.messenger.on('update-daily-transactions', async () => {
    let ctx = app.createAnonymousContext()
    let dailyTransactions = await ctx.service.statistics.getDailyTransactions()
    await ctx.service.cache.setCache('daily-transactions', dailyTransactions)
  })

  app.messenger.on('update-block-interval', async () => {
    let ctx = app.createAnonymousContext()
    let blockInterval = await ctx.service.statistics.getBlockIntervalStatistics()
    await ctx.service.cache.setCache('block-interval', blockInterval)
  })

  app.messenger.on('update-address-growth', async () => {
    let ctx = app.createAnonymousContext()
    let addressGrowth = await ctx.service.statistics.getAddressGrowth()
    await ctx.service.cache.setCache('address-growth', addressGrowth)
  })

  app.messenger.on('update-blocktime', async () => {
    let ctx = app.createAnonymousContext()
    let timestamp = await ctx.service.info.getBlockTime()
    await ctx.service.cache.setCache('blocktime', timestamp)
    namespace.to('blockchain').emit('blocktime', timestamp)
  })

  app.messenger.on('update-difficulty', async () => {
    let ctx = app.createAnonymousContext()
    let difficulty = await ctx.service.info.getDifficulty()
    await ctx.service.cache.setCache('difficulty', difficulty)
    namespace.to('blockchain').emit('difficulty', difficulty)
  })

  app.messenger.on('update-stakeweight', async () => {
    let ctx = app.createAnonymousContext()
    let stakeWeight = await ctx.service.info.getStakeWeight()
    await ctx.service.cache.setCache('stakeweight', stakeWeight)
    namespace.to('blockchain').emit('stakeweight', stakeWeight)
  })

  app.messenger.on('update-feerate', async () => {
    await app.runSchedule('update-feerate')
  })

  app.messenger.on('update-fullnodes', async () => {
    await app.runSchedule('update-fullnodes')
  })

  app.messenger.on('update-dgpinfo', async () => {
    let ctx = app.createAnonymousContext()
    let dgpInfo = await ctx.service.info.getDGPInfo()
    await ctx.service.cache.setCache('dgpinfo', dgpInfo)
    namespace.to('blockchain').emit('dgpinfo', dgpInfo)
  })

  app.messenger.on('update-addresses', async () => {
    let ctx = app.createAnonymousContext()
    let addresses = await ctx.service.info.getAddresses()
    await ctx.service.cache.setCache('addresses', addresses)
    namespace.to('blockchain').emit('addresses', addresses)
  })

  app.messenger.on('blockchain-info', info => {
    app.blockchainInfo = info
  })
  app.messenger.on('block-tip', tip => {
    app.blockchainInfo.tip = tip
  })
  app.messenger.on('new-block', block => {
    app.blockchainInfo.tip = block
  })
  app.messenger.on('reorg-to-block', block => {
    app.blockchainInfo.tip = block
  })

  app.messenger.on('socket/block-tip', async tip => {
    app.blockchainInfo.tip = tip
    namespace.emit('tip', tip)
    let ctx = app.createAnonymousContext()
    let transactionCache = this.ctx.service.cache.getLRUCache({namespace: 'transaction', max: 1000})
    let transactions = (await ctx.service.block.getBlockTransactions(tip.height)).map(id => id.toString('hex'))
    for (let id of transactions) {
      await transactionCache.del(id.toString('hex'))
      namespace.to(`transaction/${id}`).emit('transaction/confirm', id)
    }
    let list = await ctx.service.block.getBlockAddressTransactions(tip.height)
    for (let i = 0; i < transactions.length; ++i) {
      for (let address of list[i] || []) {
        namespace.to(`address/${address}`).emit('address/transaction', {address, id: transactions[i]})
      }
    }
    await Promise.all([
      (async () => {
        let ids = await ctx.service.transaction.getRecentTransactions()
        let transactions = await Promise.all(ids.map(
          id => ctx.service.transaction.getTransaction(Buffer.from(id, 'hex'))
        ))
        namespace.to('transaction').emit('recent-transactions', transactions)
      })(),
      (async () => {
        let {totalCount, ids} = await ctx.service.transaction.getLatestTransactions()
        let transactions = await Promise.all(ids.map(
          id => ctx.service.transaction.getTransaction(Buffer.from(id, 'hex'))
        ))
        namespace.to('transaction').emit('latest-transactions', {totalCount, transactions})
      })()
    ])
  })

  app.messenger.on('socket/reorg/block-tip', async tip => {
    let ctx = app.createAnonymousContext()
    let blockCache = ctx.service.cache.getLRUCache({namespace: 'block', max: 100})
    let originalHeight = app.blockchainInfo.tip.height
    try {
      for (let height = tip.height + 1; height <= originalHeight; ++height) {
        let {hash} = await blockCache.get(height)
        await Promise.all([
          () => blockCache.del(height),
          () => blockCache.del(hash)
        ])
      }
    } finally {
      app.blockchainInfo.tip = tip
      namespace.emit('reorg', tip)
    }
  })

  app.messenger.on('socket/mempool-transaction', async id => {
    id = Buffer.from(id)
    let ctx = app.createAnonymousContext()
    let transaction = await ctx.service.transaction.getTransaction(id)
    if (!transaction) {
      return
    }
    namespace.to('mempool').emit('mempool/transaction', transaction)
    let addresses = await ctx.service.transaction.getMempoolTransactionAddresses(id)
    for (let address of addresses) {
      namespace.to(`address/${address}`).emit('address/transaction', {address, id: id.toString('hex')})
    }
  })
}
