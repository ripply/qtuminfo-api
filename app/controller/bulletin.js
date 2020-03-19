const {Controller} = require('egg')

class BulletinController extends Controller {
  async list() {
    const locale = this.ctx.query.locale
    const count = this.ctx.query.count ?? 3
    this.ctx.body = await this.ctx.service.bulletin.listBulletins(count, {locale})
  }
}

module.exports = BulletinController
