module.exports = () => async function admin(ctx, next) {
  ctx.assert(ctx.session.admin, 401)
  await next()
}
