module.exports = ({defaultPageSize = 100} = {}) => async function pagination(ctx, next) {
  if (!['GET', 'POST'].includes(ctx.method)) {
    return await next()
  }
  const object = {GET: ctx.query, POST: ctx.request.body}[ctx.method]
  let limit = defaultPageSize
  let offset = 0
  let reversed
  if ('limit' in object && 'offset' in object) {
    limit = Number.parseInt(object.limit)
    offset = Number.parseInt(object.offset)
  }
  if ('pageSize' in object && 'pageIndex' in object) {
    const pageSize = Number.parseInt(object.pageSize)
    const pageIndex = Number.parseInt(object.pageIndex)
    limit = pageSize
    offset = pageSize * pageIndex
  }
  if ('pageSize' in object && 'page' in object) {
    const pageSize = Number.parseInt(object.pageSize)
    const pageIndex = Number.parseInt(object.page)
    limit = pageSize
    offset = pageSize * pageIndex
  }
  if ('from' in object && 'to' in object) {
    const from = Number.parseInt(object.from)
    const to = Number.parseInt(object.to)
    limit = to - from + 1
    offset = from
  }
  ctx.assert(limit > 0 && offset >= 0, 400)
  if ('reversed' in object) {
    reversed = ![false, 'false', 0, '0'].includes(object.reversed)
  }
  ctx.state.pagination = {limit, offset, reversed}
  await next()
}
