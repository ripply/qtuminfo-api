const {Controller} = require('egg')

class BulletinController extends Controller {
  async query() {
    const {ctx} = this
    ctx.body = await ctx.service.admin.bulletin.listAllBulletins()
  }

  async create() {
    const {ctx} = this
    let {locale, title, url, priority, translations} = ctx.request.body
    ctx.body = await ctx.service.admin.bulletin.createBulletin({locale, title, url, priority, translations})
  }

  async edit() {
    const {ctx} = this
    let {id} = ctx.params
    let {locale, title, url, priority, translations} = ctx.request.body
    ctx.body = await ctx.service.admin.bulletin.updateBulletin({id, locale, title, url, priority, translations})
  }

  async delete() {
    const {ctx} = this
    let {id} = ctx.params
    ctx.body = await ctx.service.admin.bulletin.destroyBulletin(id)
  }
}

module.exports = BulletinController
