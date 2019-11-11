const {Controller} = require('egg')

class BulletinController extends Controller {
  async list() {
    const {ctx} = this
    let count = ctx.query.count || 3
    ctx.body = await ctx.service.bulletin.listBulletins(count)
  }
}

module.exports = BulletinController
