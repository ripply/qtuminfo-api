const {Controller} = require('egg')

class BulletinController extends Controller {
  async list() {
    const {ctx} = this
    let locale = ctx.query.locale
    let count = ctx.query.count ?? 3
    ctx.body = await ctx.service.bulletin.listBulletins(count, {locale})
  }
}

module.exports = BulletinController
