module.exports = (paramName = 'contract') => async function contract(ctx, next) {
  ctx.assert(ctx.params[paramName], 404)
  const {Address: RawAddress} = ctx.app.qtuminfo.lib
  const chain = ctx.app.chain
  const {Address, Transaction, Contract, EvmReceipt: EVMReceipt} = ctx.model
  const {gte: $gte} = ctx.app.Sequelize.Op

  const contract = {}
  let rawAddress
  try {
    rawAddress = RawAddress.fromString(ctx.params[paramName], chain)
  } catch (err) {
    ctx.throw(400)
  }
  let filter
  if (rawAddress.type === RawAddress.CONTRACT) {
    filter = {address: Buffer.from(ctx.params[paramName], 'hex')}
  } else if (rawAddress.type === RawAddress.EVM_CONTRACT) {
    filter = {addressString: ctx.params[paramName]}
  } else {
    ctx.throw(400)
  }
  const contractResult = await Contract.findOne({
    where: filter,
    attributes: ['address', 'addressString', 'vm', 'type', 'createHeight', 'destructHeight'],
    include: [
      {
        model: EVMReceipt,
        as: 'createReceipt',
        required: false,
        attributes: ['outputIndex', 'senderType', 'senderData'],
        include: [{
          model: Transaction,
          as: 'transaction',
          required: true,
          attributes: ['id']
        }]
      },
      {
        model: EVMReceipt,
        as: 'destructReceipt',
        required: false,
        attributes: ['outputIndex', 'senderType', 'senderData'],
        include: [{
          model: Transaction,
          as: 'transaction',
          required: true,
          attributes: ['id']
        }]
      }
    ]
  })
  ctx.assert(contractResult, 404)
  contract.contractAddress = contractResult.address
  contract.address = contractResult.addressString
  contract.vm = contractResult.vm
  contract.type = contractResult.type
  contract.createHeight = contractResult.createHeight
  if (contractResult.createReceipt) {
    contract.createTransactionId = contractResult.createReceipt.transaction.id
    contract.createOutputIndex = contractResult.createReceipt.outputIndex
    contract.createBy = new RawAddress({
      type: contractResult.createReceipt.senderType,
      data: contractResult.createReceipt.senderData,
      chain
    })
  }
  contract.destructHeight = contractResult.destructHeight
  if (contractResult.destructReceipt) {
    contract.destructTransactionId = contractResult.destructReceipt.transaction.id
    contract.destructOutputIndex = contractResult.destructReceipt.outputIndex
    contract.destructBy = new RawAddress({
      type: contractResult.destructReceipt.senderType,
      data: contractResult.destructReceipt.senderData,
      chain
    })
  }

  const addressList = await Address.findAll({
    where: {
      type: {[$gte]: Address.parseType('contract')},
      data: contract.contractAddress
    },
    attributes: ['_id']
  })
  contract.addressIds = addressList.map(address => address._id)
  ctx.state[paramName] = contract
  await next()
}
