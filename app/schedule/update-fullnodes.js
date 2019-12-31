module.exports = app => ({
  schedule: {
    cron: '4-59/5 * * * *',
    type: 'worker',
    disable: !app.config.enableFullnodes
  },
  async task(ctx) {
    let fullNodes = await ctx.service.misc.getFullNodes()
    await ctx.service.cache.setCache('fullnodes', fullNodes)
    app.io.of('/').to('blockchain')
      .emit('fullnodes', fullNodes)
  }
})
