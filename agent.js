const SocketClient = require('socket.io-client')

module.exports = function(agent) {
  let tip = null

  agent.messenger.on('egg-ready', () => {
    const io = SocketClient(`http://localhost:${agent.config.qtuminfo.port}`)
    io.on('tip', newTip => {
      tip = newTip
      agent.messenger.sendToApp('block-tip', tip)
      agent.messenger.sendRandom('socket/block-tip', tip)
    })
    io.on('block', block => {
      tip = block
      agent.messenger.sendToApp('new-block', block)
      agent.messenger.sendRandom('update-blocktime')
      agent.messenger.sendRandom('update-difficulty')
      agent.messenger.sendRandom('update-stakeweight')
      agent.messenger.sendRandom('update-dgpinfo')
      agent.messenger.sendRandom('update-addresses')
      agent.messenger.sendRandom('socket/block-tip', block)
      agent.messenger.sendRandom('update-24h-statistics')
    })
    io.on('reorg', block => {
      tip = block
      agent.messenger.sendToApp('reorg-to-block', block)
      agent.messenger.sendRandom('socket/reorg/block-tip', block)
    })
    io.on('mempool-transaction', id => {
      if (id) {
        agent.messenger.sendRandom('socket/mempool-transaction', id)
      }
    })
  })

  let lastTipHash = Buffer.alloc(0)
  function updateStatistics() {
    if (tip && lastTipHash.compare(tip.hash) !== 0) {
      agent.messenger.sendRandom('update-richlist')
      agent.messenger.sendRandom('update-qrc20-statistics')
      agent.messenger.sendRandom('update-qrc721-statistics')
      agent.messenger.sendRandom('update-daily-transactions')
      agent.messenger.sendRandom('update-block-interval')
      agent.messenger.sendRandom('update-address-growth')
      lastTipHash = tip.hash
    }
  }

  setInterval(updateStatistics, 2 * 60 * 1000).unref()

  agent.messenger.on('blockchain-info', () => {
    agent.messenger.sendToApp('blockchain-info', {tip})
  })

  agent.messenger.on('egg-ready', () => {
    const interval = setInterval(() => {
      if (tip) {
        agent.messenger.sendToApp('blockchain-info', {tip})
        clearInterval(interval)
        updateStatistics()
      }
    }, 0)
    agent.messenger.sendRandom('update-blocktime')
    agent.messenger.sendRandom('update-difficulty')
    agent.messenger.sendRandom('update-stakeweight')
    agent.messenger.sendRandom('update-fullnodes')
    agent.messenger.sendRandom('update-feerate')
    agent.messenger.sendRandom('update-dgpinfo')
    agent.messenger.sendRandom('update-addresses')
    agent.messenger.sendRandom('update-24h-statistics')
    agent.messenger.sendRandom('update-evm-log-tags')
  })
}
