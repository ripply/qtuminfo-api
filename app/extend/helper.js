function transformSQLArg(arg) {
  if (typeof arg === 'string') {
    return `'${arg}'`
  } else if (['number', 'bigint'].includes(typeof arg)) {
    return arg.toString()
  } else if (Buffer.isBuffer(arg)) {
    return `X'${arg.toString('hex')}'`
  } else if (Array.isArray(arg)) {
    return arg.length === 0 ? '(NULL)' : `(${arg.map(transformSQLArg).join(', ')})`
  } else if (arg && 'raw' in arg) {
    return arg.raw
  }
  return arg.toString()
}

exports.sql = function(strings, ...args) {
  const buffer = []
  for (let i = 0; i < args.length; ++i) {
    buffer.push(strings[i].replace(/\s+/g, ' '), transformSQLArg(args[i]))
  }
  buffer.push(strings[args.length].replace(/\s+/g, ' '))
  return buffer.join('')
}

exports.isEmail = function(email) {
  return /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/.test(email)
}
