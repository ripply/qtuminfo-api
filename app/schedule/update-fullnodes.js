module.exports = app => ({
  schedule: {
    cron: '4-59/5 * * * *',
    type: 'worker',
    disable: !app.config.enableFullnodes
  },
  async task(ctx) {
    let fullNodes = await ctx.service.misc.getFullNodes()
    await app.redis.hset(app.name, 'fullnodes', JSON.stringify(fullNodes))
    app.io.of('/').to('blockchain')
      .emit('fullnodes', fullNodes)
  }
})
