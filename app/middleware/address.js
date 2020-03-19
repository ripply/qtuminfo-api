module.exports = () => async function address(ctx, next) {
  ctx.assert(ctx.params.address, 404)
  const {Address: RawAddress} = ctx.app.qtuminfo.lib
  const chain = ctx.app.chain
  const {Address} = ctx.model
  const {in: $in} = ctx.app.Sequelize.Op

  const addresses = ctx.params.address.split(',')
  const rawAddresses = []
  for (const address of addresses) {
    try {
      rawAddresses.push(RawAddress.fromString(address, chain))
    } catch (err) {
      ctx.throw(400)
    }
  }
  const result = await Address.findAll({
    where: {string: {[$in]: addresses}},
    attributes: ['_id', 'type', 'data']
  })
  ctx.state.address = {
    rawAddresses,
    addressIds: result.map(address => address._id),
    p2pkhAddressIds: result.filter(address => address.type === RawAddress.PAY_TO_PUBLIC_KEY_HASH).map(address => address._id),
  }
  await next()
}
