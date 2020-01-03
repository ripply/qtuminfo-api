module.exports = ({ignoreGenesis = false} = {}) => async function pagination(ctx, next) {
  const {Header} = ctx.model
  const {gte: $gte, lte: $lte} = ctx.app.Sequelize.Op

  if (!['GET', 'POST'].includes(ctx.method)) {
    return await next()
  }
  let fromBlock = ignoreGenesis ? 1 : null
  let toBlock = null
  let object = {GET: ctx.query, POST: ctx.request.body}[ctx.method]
  ctx.state.hasBlockFilter = false
  if ('fromBlock' in object) {
    let height = Number.parseInt(object.fromBlock)
    ctx.assert(height >= 0 && height <= 0xffffffff, 400)
    if (height > fromBlock) {
      fromBlock = height
    }
    ctx.state.hasBlockFilter = true
  }
  if ('toBlock' in object) {
    let height = Number.parseInt(object.toBlock)
    ctx.assert(height >= 0 && height <= 0xffffffff, 400)
    if (toBlock == null || height < toBlock) {
      toBlock = height
    }
    ctx.state.hasBlockFilter = true
  }
  if ('fromTime' in object) {
    let timestamp = Math.floor(Date.parse(object.fromTime) / 1000)
    ctx.assert(timestamp >= 0 && timestamp <= 0xffffffff, 400)
    let header = await Header.findOne({
      where: {timestamp: {[$gte]: timestamp}},
      attributes: ['height'],
      order: [['timestamp', 'ASC']]
    })
    if (header && header.height > fromBlock) {
      fromBlock = header.height
    }
    ctx.state.hasBlockFilter = true
  }
  if ('toTime' in object) {
    let timestamp = Math.floor(Date.parse(object.toTime) / 1000)
    ctx.assert(timestamp >= 0 && timestamp <= 0xffffffff, 400)
    let header = await Header.findOne({
      where: {timestamp: {[$lte]: timestamp}},
      attributes: ['height'],
      order: [['timestamp', 'DESC']]
    })
    if (header && (toBlock == null || header.height < toBlock)) {
      toBlock = header.height
    }
    ctx.state.hasBlockFilter = true
  }
  ctx.state.fromBlock = fromBlock
  ctx.state.toBlock = toBlock
  await next()
}
