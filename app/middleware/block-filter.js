module.exports = ({ignoreGenesis = false} = {}) => async function pagination(ctx, next) {
  const {Header} = ctx.model
  const {gte: $gte, lte: $lte} = ctx.app.Sequelize.Op

  if (!['GET', 'POST'].includes(ctx.method)) {
    return await next()
  }
  let fromBlock = ignoreGenesis ? 1 : null
  let toBlock = null
  const object = {GET: ctx.query, POST: ctx.request.body}[ctx.method]
  if ('fromBlock' in object) {
    const height = Number.parseInt(object.fromBlock)
    ctx.assert(height >= 0 && height <= 0xffffffff, 400)
    if (height > fromBlock) {
      fromBlock = height
    }
  }
  if ('toBlock' in object) {
    const height = Number.parseInt(object.toBlock)
    ctx.assert(height >= 0 && height <= 0xffffffff, 400)
    if (toBlock == null || height < toBlock) {
      toBlock = height
    }
  }
  if ('fromTime' in object) {
    const timestamp = Math.floor(Date.parse(object.fromTime) / 1000)
    ctx.assert(timestamp >= 0 && timestamp <= 0xffffffff, 400)
    const header = await Header.findOne({
      where: {timestamp: {[$gte]: timestamp}},
      attributes: ['height'],
      order: [['timestamp', 'ASC']]
    })
    if (header?.height > fromBlock) {
      fromBlock = header.height
    }
  }
  if ('toTime' in object) {
    const timestamp = Math.floor(Date.parse(object.toTime) / 1000)
    ctx.assert(timestamp >= 0 && timestamp <= 0xffffffff, 400)
    const header = await Header.findOne({
      where: {timestamp: {[$lte]: timestamp}},
      attributes: ['height'],
      order: [['timestamp', 'DESC']]
    })
    if (toBlock == null || header?.height < toBlock) {
      toBlock = header.height
    }
  }
  ctx.state.fromBlock = fromBlock
  ctx.state.toBlock = toBlock
  await next()
}
